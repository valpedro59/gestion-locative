import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { mandates, owners } from "../../db/schema";
import { notFound } from "../../lib/errors";
import { MandateSchema, Owner } from "./owners.schemas";

export const addOwners = async (ctx: { agencyId: string }, input: Owner) => {
  return db.transaction(async (tx) => {
    const [owner] = await tx
      .insert(owners)
      .values({
        agencyId: ctx.agencyId,
        fullName: input.fullName,
        phone: input.phone,
        email: input.email,
        address: input.address,
      })
      .returning();
    if (!owner)
      throw notFound("Échec inattendu de la création de l'utilisateur");
    return owner;
  });
};

export const removeOwner = async (
  ctx: { agencyId: string },
  ownerId: string,
) => {
  return await db.transaction(async (tx) => {
    const ownerToDelete = await tx
      .delete(owners)
      .where(eq(owners.id, ownerId))
      .returning({ ownerId: owners.id });
    return ownerToDelete;
  });
};

// service : créer un mandat
export const createMandate = async (
  ctx: { agencyId: string },
  ownerId: string,
  input: MandateSchema,
) => {
  return await db.transaction(async (tx) => {
    const [existingOwner] = await db
      .select()
      .from(owners)
      .where(and(eq(owners.id, ownerId), eq(owners.agencyId, ctx.agencyId)))
      .limit(1);

    if (!existingOwner) {
      throw new Error(
        "Propriétaire introuvable ou non autorisé dans cette agence.",
      );
    }
    const [newMandate] = await tx
      .insert(mandates)
      .values({
        agencyId: ctx.agencyId,
        ownerId: ownerId,
        commissionPct: input.commissionPct,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
      })
      .returning();
    return newMandate;
  });
};

// const [mandate] = await tx
// .select()
// .from(mandates)
// .where(
//     and(eq(mandates.id, input.mandateId), eq(mandates.agencyId, ctx.agencyId)),
// );
// if (!mandate) throw notFound("Mandat"); // 404, pas 403

// await tx.insert(properties).values({
//     agencyId: ctx.agencyId,
//     mandateId: mandate.id /* ... */,
// });
