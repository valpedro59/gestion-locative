import jwt from "jsonwebtoken";
import { env } from "./env";

export const SESSION_COOKIE = "session";
// Durée d'une session : une journée de travail. À ajuster selon les retours des agences.
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

// Le jeton ne contient que l'identifiant de l'utilisateur (claim "sub").
// L'agence et le rôle sont relus en base à chaque requête (voir requireAuth) :
// une désactivation ou un changement de rôle prend effet immédiatement.
export function signSession(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: userId,
    expiresIn: SESSION_TTL_SECONDS,
  });
}

export function verifySession(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
  if (typeof payload === "string" || !payload.sub) throw new Error("claims invalides");
  return payload.sub;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true, // illisible depuis JavaScript : protège le jeton contre le vol par XSS
    secure: env.NODE_ENV === "production", // HTTPS uniquement en production
    sameSite: "lax" as const,
    path: "/",
  };
}
