import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../db/types";
import { agencies, auditLog, dues, payments, receipts } from "../../db/schema";
import { computeDueStatus, formatXaf, receiptKindFor } from "../../lib/domain";
import { AppError, notFound } from "../../lib/errors";
import type { RecordPaymentInput } from "./payments.schemas";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DueRow = typeof dues.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

export type RecordPaymentResult = {
  replayed: boolean;
  payment: PaymentRow;
  receipt: { id: string; number: number; kind: "quittance" | "recu" };
  due: { id: string; status: string; paidXaf: number; remainingXaf: number };
};

// Date du jour à Pointe-Noire / Brazzaville (UTC+1), au format AAAA-MM-JJ.
export const todayInCongo = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Brazzaville" }).format(new Date());

async function sumValidPayments(tx: Tx, dueId: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${payments.amountXaf}), 0)::int` })
    .from(payments)
    .where(and(eq(payments.dueId, dueId), eq(payments.status, "valide")));
  return row?.total ?? 0;
}

async function snapshot(tx: Tx, due: DueRow, payment: PaymentRow): Promise<Omit<RecordPaymentResult, "replayed">> {
  const [receipt] = await tx.select().from(receipts).where(eq(receipts.paymentId, payment.id));
  if (!receipt) throw new AppError(500, "receipt_missing", "Quittance manquante pour ce paiement");
  const paidXaf = await sumValidPayments(tx, due.id);
  return {
    payment,
    receipt: { id: receipt.id, number: receipt.number, kind: receipt.kind },
    due: { id: due.id, status: due.status, paidXaf, remainingXaf: due.amountXaf - paidXaf },
  };
}

export function createPaymentsService(db: Database) {
  return {
    async recordPayment(
      ctx: { agencyId: string; userId: string },
      dueId: string,
      input: RecordPaymentInput,
      idempotencyKey: string,
      today: string = todayInCongo(),
    ): Promise<RecordPaymentResult> {
      return db.transaction(async (tx) => {
        // 1. Verrouille l'échéance (et vérifie qu'elle appartient à l'agence).
        //    Deux requêtes simultanées sur la même échéance passent l'une après l'autre.
        const [due] = await tx
          .select()
          .from(dues)
          .where(and(eq(dues.id, dueId), eq(dues.agencyId, ctx.agencyId)))
          .for("update");
        if (!due) throw notFound("Échéance");

        // 2. Rejeu : même clé = même résultat, sans doublon.
        const [existing] = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.agencyId, ctx.agencyId), eq(payments.idempotencyKey, idempotencyKey)));
        if (existing) {
          if (existing.dueId !== dueId) {
            throw new AppError(409, "idempotency_key_reused", "Cette clé d'idempotence a déjà servi pour une autre échéance");
          }
          return { replayed: true, ...(await snapshot(tx, due, existing)) };
        }

        // 3. Règles métier.
        if (input.paidOn > today) {
          throw new AppError(422, "paid_on_in_future", "La date de paiement ne peut pas être dans le futur");
        }
        const paidBefore = await sumValidPayments(tx, due.id);
        const remaining = due.amountXaf - paidBefore;
        if (remaining <= 0) {
          throw new AppError(409, "due_already_paid", "Cette échéance est déjà soldée");
        }
        if (input.amountXaf > remaining) {
          throw new AppError(
            422,
            "amount_exceeds_balance",
            `Le montant dépasse le solde de l'échéance (${formatXaf(remaining)}). Pour un paiement d'avance, saisissez un paiement par échéance.`,
            { remainingXaf: remaining },
          );
        }

        // 4. Enregistre le paiement et recalcule l'échéance.
        const [payment] = await tx
          .insert(payments)
          .values({
            agencyId: ctx.agencyId,
            dueId: due.id,
            amountXaf: input.amountXaf,
            method: input.method,
            paidOn: input.paidOn,
            reference: input.reference ?? null,
            idempotencyKey,
            createdBy: ctx.userId,
          })
          .returning();
        if (!payment) throw new AppError(500, "insert_failed", "Échec de l'enregistrement du paiement");

        const paidAfter = paidBefore + input.amountXaf;
        const status = computeDueStatus(due, paidAfter, today);
        await tx.update(dues).set({ status, updatedAt: new Date() }).where(eq(dues.id, due.id));

        // 5. Numéro de quittance : incrément atomique (verrou de ligne sur l'agence).
        const [counter] = await tx
          .update(agencies)
          .set({ receiptCounter: sql`${agencies.receiptCounter} + 1` })
          .where(eq(agencies.id, ctx.agencyId))
          .returning({ number: agencies.receiptCounter });
        if (!counter) throw new AppError(500, "counter_failed", "Échec de la numérotation");

        const [receipt] = await tx
          .insert(receipts)
          .values({
            agencyId: ctx.agencyId,
            paymentId: payment.id,
            number: counter.number,
            kind: receiptKindFor(due, paidAfter),
          })
          .returning();
        if (!receipt) throw new AppError(500, "insert_failed", "Échec de la création de la quittance");

        // 6. Journal d'audit.
        await tx.insert(auditLog).values({
          agencyId: ctx.agencyId,
          userId: ctx.userId,
          action: "payment.record",
          entityType: "payment",
          entityId: payment.id,
          after: { amountXaf: payment.amountXaf, dueId: due.id, dueStatus: status, receiptNumber: receipt.number },
        });

        // Le PDF de la quittance est généré après le commit (tâche de fond),
        // pas dans la transaction : receipts.pdfStorageKey reste null jusque-là.
        return {
          replayed: false,
          payment,
          receipt: { id: receipt.id, number: receipt.number, kind: receipt.kind },
          due: { id: due.id, status, paidXaf: paidAfter, remainingXaf: due.amountXaf - paidAfter },
        };
      });
    },
  };
}

export type PaymentsService = ReturnType<typeof createPaymentsService>;
