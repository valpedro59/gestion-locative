import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Database } from "../src/db/types";
import { verifyPassword } from "../src/lib/password";
import { createAuthService } from "../src/modules/auth/auth.service";

const agencyInput = {
  agencyName: "Immo Pointe-Noire",
  country: "CG" as const,
  fullName: "Marie Admin",
  email: "marie@immo.cg",
  password: "un-mot-de-passe-solide",
};

describe("auth service", () => {
  let db: Database;
  let service: ReturnType<typeof createAuthService>;

  beforeEach(async () => {
    const { createTestDb } = await import("./helpers");
    db = await createTestDb();
    service = createAuthService(db);
  });

  it("crée l'agence et son premier utilisateur admin, avec audit", async () => {
    const { agency, user } = await service.createAgency(agencyInput);
    expect(user.agencyId).toBe(agency.id);
    expect(user.role).toBe("admin");
    expect(user).not.toHaveProperty("passwordHash");
    const audit = await db.select().from(schema.auditLog);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "agency.create", entityId: agency.id, userId: user.id });
  });

  it("hache le mot de passe (jamais en clair) et il se vérifie", async () => {
    await service.createAgency(agencyInput);
    const [row] = await db.select().from(schema.users);
    expect(row!.passwordHash).not.toContain(agencyInput.password);
    expect(await verifyPassword(agencyInput.password, row!.passwordHash)).toBe(true);
    expect(await verifyPassword("mauvais-mot-de-passe", row!.passwordHash)).toBe(false);
  });

  it("refuse un e-mail déjà utilisé et ne laisse pas d'agence orpheline", async () => {
    await service.createAgency(agencyInput);
    await expect(service.createAgency({ ...agencyInput, agencyName: "Autre agence" }))
      .rejects.toMatchObject({ status: 409, code: "email_already_used" });
    expect(await db.select().from(schema.agencies)).toHaveLength(1);
    expect(await db.select().from(schema.users)).toHaveLength(1);
  });

  it("ajoute un agent à l'agence de l'admin connecté, avec audit", async () => {
    const { agency, user: admin } = await service.createAgency(agencyInput);
    const agent = await service.addUser(
      { agencyId: agency.id, userId: admin.id },
      { fullName: "Paul Agent", email: "paul@immo.cg", password: "autre-mot-de-passe", role: "agent" },
    );
    expect(agent).toMatchObject({ agencyId: agency.id, role: "agent" });
    expect(agent).not.toHaveProperty("passwordHash");
    const audit = await db.select().from(schema.auditLog);
    const created = audit.find((a) => a.action === "user.create");
    expect(created).toMatchObject({ userId: admin.id, entityId: agent.id, agencyId: agency.id });
  });

  it("refuse un e-mail déjà utilisé lors de l'ajout d'un utilisateur", async () => {
    const { agency, user: admin } = await service.createAgency(agencyInput);
    await expect(service.addUser(
      { agencyId: agency.id, userId: admin.id },
      { fullName: "Doublon", email: "marie@immo.cg", password: "autre-mot-de-passe", role: "agent" },
    )).rejects.toMatchObject({ status: 409, code: "email_already_used" });
  });

  describe("login", () => {
    it("connecte un utilisateur actif : profil public, sans hash, avec audit", async () => {
      const { user } = await service.createAgency(agencyInput);
      const logged = await service.login({ email: agencyInput.email, password: agencyInput.password });
      expect(logged.id).toBe(user.id);
      expect(logged).not.toHaveProperty("passwordHash");
      const audit = await db.select().from(schema.auditLog);
      expect(audit.some((a) => a.action === "auth.login" && a.userId === user.id)).toBe(true);
    });

    it("mauvais mot de passe : 401 invalid_credentials", async () => {
      await service.createAgency(agencyInput);
      await expect(service.login({ email: agencyInput.email, password: "mauvais-mot-de-passe" }))
        .rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
    });

    it("e-mail inconnu : exactement la même erreur (pas d'énumération des comptes)", async () => {
      await service.createAgency(agencyInput);
      const wrongPassword = await service.login({ email: agencyInput.email, password: "mauvais-mot-de-passe" }).catch((e) => e);
      const unknownEmail = await service.login({ email: "inconnu@immo.cg", password: "mauvais-mot-de-passe" }).catch((e) => e);
      expect(unknownEmail.status).toBe(wrongPassword.status);
      expect(unknownEmail.code).toBe(wrongPassword.code);
      expect(unknownEmail.message).toBe(wrongPassword.message);
    });

    it("compte désactivé : 403 si le mot de passe est bon, 401 sinon", async () => {
      const { user } = await service.createAgency(agencyInput);
      await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, user.id));
      await expect(service.login({ email: agencyInput.email, password: agencyInput.password }))
        .rejects.toMatchObject({ status: 403, code: "account_disabled" });
      await expect(service.login({ email: agencyInput.email, password: "mauvais-mot-de-passe" }))
        .rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
    });
  });
});
