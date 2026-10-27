import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { users } from "../db/schema";
import type { Database } from "../db/types";
import { AppError } from "../lib/errors";
import { can, type Permission, type Role } from "../lib/permissions";
import { SESSION_COOKIE, verifySession } from "../lib/session";

export type AuthContext = { userId: string; agencyId: string; role: Role };

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function extractToken(req: Request): string | undefined {
  const cookie = req.cookies?.[SESSION_COOKIE];
  if (typeof cookie === "string" && cookie) return cookie;
  const header = req.header("Authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return undefined;
}

const sessionInvalid = () =>
  new AppError(401, "invalid_session", "Session invalide ou expirée");

// Vérifie le jeton, puis relit l'utilisateur en base (une lecture par clé primaire) :
// un utilisateur désactivé perd l'accès tout de suite, et le rôle utilisé est
// toujours celui d'aujourd'hui, pas celui du moment de la connexion.
export function createRequireAuth(db: Database) {
  return async function requireAuth(req: Request, _res: Response, next: NextFunction) {
    const token = extractToken(req);
    if (!token) throw new AppError(401, "unauthenticated", "Connexion requise");

    let userId: string;
    try {
      userId = verifySession(token);
    } catch {
      throw sessionInvalid();
    }

    const [user] = await db
      .select({ id: users.id, agencyId: users.agencyId, role: users.role, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || !user.isActive) throw sessionInvalid();

    req.auth = { userId: user.id, agencyId: user.agencyId, role: user.role };
    next();
  };
}

export type RequireAuth = ReturnType<typeof createRequireAuth>;

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new AppError(401, "unauthenticated", "Connexion requise");
    if (!can(req.auth.role, permission)) {
      throw new AppError(403, "forbidden", "Action non autorisée pour votre rôle");
    }
    next();
  };
}
