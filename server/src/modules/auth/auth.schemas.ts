import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(10, "10 caractères minimum").max(128);
const fullName = z.string().trim().min(2).max(120);

// Le mot de passe en clair arrive du client ; seul le service le hache.
// Aucun champ "passwordHash" ni "agencyId" n'est accepté dans ces corps de requête.
export const createAgencySchema = z.object({
  agencyName: z.string().trim().min(2).max(120),
  country: z.enum(["CG"]).default("CG"), // Congo-Brazzaville uniquement pour l'instant
  fullName,
  email,
  password,
});

export const addUserSchema = z.object({
  fullName,
  email,
  password,
  role: z.enum(["admin", "agent"]).default("agent"),
});

// À la connexion, on n'impose pas de longueur minimale (seulement à la création du mot de passe).
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAgencyInput = z.infer<typeof createAgencySchema>;
export type AddUserInput = z.infer<typeof addUserSchema>;
