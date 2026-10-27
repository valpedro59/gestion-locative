import { eq } from "drizzle-orm";
import type { Database } from "../../db/types";
import { agencies, auditLog, users } from "../../db/schema";
import { AppError, notFound } from "../../lib/errors";
import { hashPassword, verifyPassword } from "../../lib/password";
import type { AddUserInput, CreateAgencyInput, LoginInput } from "./auth.schemas";

type UserRow = typeof users.$inferSelect;

// Ne jamais renvoyer passwordHash au client.
export function toPublicUser(user: UserRow) {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}

// Les erreurs du driver peuvent être enveloppées (cause) : on regarde les deux niveaux.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

const emailTaken = () =>
  new AppError(409, "email_already_used", "Cette adresse e-mail est déjà utilisée");

// Même erreur (même code, même message) que l'e-mail soit inconnu ou le mot de passe faux :
// on ne révèle pas quelles adresses ont un compte.
const invalidCredentials = () =>
  new AppError(401, "invalid_credentials", "E-mail ou mot de passe incorrect");

// Hash factice, calculé une seule fois : quand l'e-mail est inconnu, on vérifie quand même
// un mot de passe contre lui, pour que la réponse prenne le même temps que pour un vrai compte.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("mot-de-passe-factice-pour-le-timing"));

export function createAuthService(db: Database) {
  return {
    // Inscription : l'agence et son premier utilisateur (admin) sont créés
    // ensemble, dans une seule transaction.
    async createAgency(input: CreateAgencyInput) {
      const passwordHash = await hashPassword(input.password);
      try {
        return await db.transaction(async (tx) => {
          const [agency] = await tx
            .insert(agencies)
            .values({ name: input.agencyName, country: input.country })
            .returning();
          if (!agency) throw new AppError(500, "agency_insert_failed", "Échec de la création de l'agence");

          const [user] = await tx
            .insert(users)
            .values({
              agencyId: agency.id,
              email: input.email,
              passwordHash,
              fullName: input.fullName,
              role: "admin",
            })
            .returning();
          if (!user) throw new AppError(500, "user_insert_failed", "Échec de la création de l'utilisateur");

          await tx.insert(auditLog).values({
            agencyId: agency.id,
            userId: user.id,
            action: "agency.create",
            entityType: "agency",
            entityId: agency.id,
            after: { name: agency.name, country: agency.country },
          });

          return { agency, user: toPublicUser(user) };
        });
      } catch (err) {
        if (isUniqueViolation(err)) throw emailTaken();
        throw err;
      }
    },

    // Ajout d'un utilisateur à l'agence de l'admin connecté.
    // ctx vient de la SESSION, jamais du corps de la requête : on ne peut donc
    // ajouter quelqu'un qu'à sa propre agence.
    async addUser(ctx: { agencyId: string; userId: string }, input: AddUserInput) {
      const passwordHash = await hashPassword(input.password);
      try {
        return await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({
              agencyId: ctx.agencyId,
              email: input.email,
              passwordHash,
              fullName: input.fullName,
              role: input.role,
            })
            .returning();
          if (!user) throw new AppError(500, "user_insert_failed", "Échec de la création de l'utilisateur");

          await tx.insert(auditLog).values({
            agencyId: ctx.agencyId,
            userId: ctx.userId, // l'admin qui a créé le compte
            action: "user.create",
            entityType: "user",
            entityId: user.id,
            after: { email: user.email, role: user.role },
          });

          return toPublicUser(user);
        });
      } catch (err) {
        if (isUniqueViolation(err)) throw emailTaken();
        throw err;
      }
    },

    // Connexion : vérifie l'identité, ne crée pas la session (c'est le rôle de la route).
    // Pas de transaction : c'est une lecture, et on ne garde pas une connexion
    // de la base occupée pendant le calcul du hash.
    async login(input: LoginInput) {
      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

      const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
      if (!user || !passwordOk) throw invalidCredentials();

      // Vérifié APRÈS le mot de passe : seul quelqu'un qui connaît le bon mot de passe
      // apprend que le compte est désactivé.
      if (!user.isActive) {
        throw new AppError(403, "account_disabled", "Ce compte est désactivé. Contactez l'administrateur de votre agence.");
      }

      await db.insert(auditLog).values({
        agencyId: user.agencyId,
        userId: user.id,
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
      });

      return toPublicUser(user);
    },

    // Profil de l'utilisateur connecté et son agence.
    async me(ctx: { userId: string }) {
      const [row] = await db
        .select({ user: users, agency: agencies })
        .from(users)
        .innerJoin(agencies, eq(users.agencyId, agencies.id))
        .where(eq(users.id, ctx.userId))
        .limit(1);
      if (!row) throw notFound("Utilisateur");
      return {
        user: toPublicUser(row.user),
        agency: { id: row.agency.id, name: row.agency.name, country: row.agency.country },
      };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
