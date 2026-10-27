import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Database } from "../src/db/types";
import { createPaymentsService } from "../src/modules/payments/payments.service";
import { AppError } from "../src/lib/errors";

const TODAY = "2026-10-24";

async function setup() {
  const client = new PGlite();
  const sqlDir = join(__dirname, "..", "drizzle");
  for (const file of readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.exec(readFileSync(join(sqlDir, file), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  const db = drizzle(client, { schema }) as unknown as Database;

  async function seedAgency(name: string) {
    const [agency] = await db.insert(schema.agencies).values({ name }).returning();
    const [user] = await db.insert(schema.users).values({
      agencyId: agency!.id, email: `${name}@test.cg`, passwordHash: "x", fullName: name, role: "admin",
    }).returning();
    const [owner] = await db.insert(schema.owners).values({ agencyId: agency!.id, fullName: "Proprio" }).returning();
    const [mandate] = await db.insert(schema.mandates).values({
      agencyId: agency!.id, ownerId: owner!.id, commissionPct: "8.00", startsOn: "2026-01-01",
    }).returning();
    const [property] = await db.insert(schema.properties).values({
      agencyId: agency!.id, mandateId: mandate!.id, name: "Immeuble A", address: "Rue 1",
    }).returning();
    const [unit] = await db.insert(schema.units).values({
      agencyId: agency!.id, propertyId: property!.id, label: "Apt 1",
    }).returning();
    const [tenant] = await db.insert(schema.tenants).values({ agencyId: agency!.id, fullName: "Locataire" }).returning();
    const [lease] = await db.insert(schema.leases).values({
      agencyId: agency!.id, unitId: unit!.id, tenantId: tenant!.id, status: "actif",
      startsOn: "2026-01-01", rentXaf: 150000,
    }).returning();
    async function newDue(period: string, amountXaf = 150000, dueDate = "2026-10-31") {
      const [due] = await db.insert(schema.dues).values({
        agencyId: agency!.id, leaseId: lease!.id, period, dueDate, amountXaf,
      }).returning();
      return due!;
    }
    return { agency: agency!, ctx: { agencyId: agency!.id, userId: user!.id }, newDue };
  }
  return { db, service: createPaymentsService(db), seedAgency };
}

const pay = (amountXaf: number, extra: Partial<{ paidOn: string }> = {}) => ({
  amountXaf, method: "virement" as const, paidOn: "2026-10-20", ...extra,
});

describe("recordPayment", () => {
  let t: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => { t = await setup(); });

  it("solde l'échéance et émet une quittance n°1", async () => {
    const a = await t.seedAgency("a");
    const due = await a.newDue("2026-10-01");
    const r = await t.service.recordPayment(a.ctx, due.id, pay(150000), "key-0001-aaaa", TODAY);
    expect(r.replayed).toBe(false);
    expect(r.due).toMatchObject({ status: "payee", paidXaf: 150000, remainingXaf: 0 });
    expect(r.receipt).toMatchObject({ number: 1, kind: "quittance" });
  });

  it("paiement partiel : reçu, puis quittance au solde, numéros qui se suivent", async () => {
    const a = await t.seedAgency("a");
    const due = await a.newDue("2026-10-01");
    const r1 = await t.service.recordPayment(a.ctx, due.id, pay(100000), "key-0002-aaaa", TODAY);
    expect(r1.due).toMatchObject({ status: "partielle", remainingXaf: 50000 });
    expect(r1.receipt).toMatchObject({ number: 1, kind: "recu" });
    const r2 = await t.service.recordPayment(a.ctx, due.id, pay(50000), "key-0003-aaaa", TODAY);
    expect(r2.due.status).toBe("payee");
    expect(r2.receipt).toMatchObject({ number: 2, kind: "quittance" });
  });

  it("passe en retard si la date limite est dépassée et que l'échéance n'est pas soldée", async () => {
    const a = await t.seedAgency("a");
    const due = await a.newDue("2026-09-01", 150000, "2026-09-05");
    const r = await t.service.recordPayment(a.ctx, due.id, pay(50000), "key-0004-aaaa", TODAY);
    expect(r.due.status).toBe("en_retard");
  });

  it("rejeu avec la même clé : même résultat, pas de doublon", async () => {
    const a = await t.seedAgency("a");
    const due = await a.newDue("2026-10-01");
    const r1 = await t.service.recordPayment(a.ctx, due.id, pay(50000), "key-0005-aaaa", TODAY);
    const r2 = await t.service.recordPayment(a.ctx, due.id, pay(50000), "key-0005-aaaa", TODAY);
    expect(r2.replayed).toBe(true);
    expect(r2.payment.id).toBe(r1.payment.id);
    expect(r2.receipt.number).toBe(r1.receipt.number);
    const rows = await t.db.select().from(schema.payments);
    expect(rows).toHaveLength(1);
  });

  it("clé d'idempotence réutilisée sur une autre échéance : 409", async () => {
    const a = await t.seedAgency("a");
    const d1 = await a.newDue("2026-10-01");
    const d2 = await a.newDue("2026-11-01");
    await t.service.recordPayment(a.ctx, d1.id, pay(10000), "key-0006-aaaa", TODAY);
    await expect(t.service.recordPayment(a.ctx, d2.id, pay(10000), "key-0006-aaaa", TODAY))
      .rejects.toMatchObject({ status: 409, code: "idempotency_key_reused" });
  });

  it("refuse un montant supérieur au solde", async () => {
    const a = await t.seedAgency("a");
    const due = await a.newDue("2026-10-01");
    await expect(t.service.recordPayment(a.ctx, due.id, pay(150001), "key-0007-aaaa", TODAY))
      .rejects.toMatchObject({ status: 422, code: "amount_exceeds_balance" });
    expect(await t.db.select().from(schema.payments)).toHaveLength(0);
  });

  it("refuse un paiement sur une échéance déjà soldée", async () => {
    const a = await t.seedAgency("a");
    const due = await a.newDue("2026-10-01");
    await t.service.recordPayment(a.ctx, due.id, pay(150000), "key-0008-aaaa", TODAY);
    await expect(t.service.recordPayment(a.ctx, due.id, pay(1000), "key-0009-aaaa", TODAY))
      .rejects.toMatchObject({ status: 409, code: "due_already_paid" });
  });

  it("refuse une date de paiement future", async () => {
    const a = await t.seedAgency("a");
    const due = await a.newDue("2026-10-01");
    await expect(t.service.recordPayment(a.ctx, due.id, pay(1000, { paidOn: "2026-10-25" }), "key-0010-aaaa", TODAY))
      .rejects.toMatchObject({ status: 422, code: "paid_on_in_future" });
  });

  it("isole les agences : l'échéance d'une autre agence est introuvable", async () => {
    const a = await t.seedAgency("a");
    const b = await t.seedAgency("b");
    const dueOfB = await b.newDue("2026-10-01");
    const err = await t.service.recordPayment(a.ctx, dueOfB.id, pay(1000), "key-0011-aaaa", TODAY).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(404);
  });

  it("numérote les quittances séparément par agence", async () => {
    const a = await t.seedAgency("a");
    const b = await t.seedAgency("b");
    const da = await a.newDue("2026-10-01");
    const db_ = await b.newDue("2026-10-01");
    const ra = await t.service.recordPayment(a.ctx, da.id, pay(1000), "key-0012-aaaa", TODAY);
    const rb = await t.service.recordPayment(b.ctx, db_.id, pay(1000), "key-0013-aaaa", TODAY);
    expect(ra.receipt.number).toBe(1);
    expect(rb.receipt.number).toBe(1);
  });

  it("écrit une ligne d'audit", async () => {
    const a = await t.seedAgency("a");
    const due = await a.newDue("2026-10-01");
    await t.service.recordPayment(a.ctx, due.id, pay(1000), "key-0014-aaaa", TODAY);
    const rows = await t.db.select().from(schema.auditLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "payment.record", entityType: "payment" });
  });
});
