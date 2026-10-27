import { Request, Response } from "express";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  signSession,
} from "../../lib/session";
import { addUserSchema, createAgencySchema, loginSchema } from "./auth.schemas";
import type { AuthService } from "./auth.service";

export function createAuthController(service: AuthService) {
  return {
    registerAgency: async (req: Request, res: Response) => {
      const input = createAgencySchema.parse(req.body);
      const result = await service.createAgency(input);
      res.status(201).json(result);
    },

    login: async (req: Request, res: Response) => {
      const input = loginSchema.parse(req.body);
      const user = await service.login(input);
      res.cookie(SESSION_COOKIE, signSession(user.id), {
        ...sessionCookieOptions(),
        maxAge: SESSION_TTL_SECONDS * 1000,
      });
      res.json({ user });
    },

    logout: (_req: Request, res: Response) => {
      res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
      res.status(204).end();
    },
    profile: async (req: Request, res: Response) => {
      res.json(await service.me({ userId: req.auth!.userId }));
    },

    addUser: async (req: Request, res: Response) => {
      const input = addUserSchema.parse(req.body);
      const auth = req.auth!;
      const user = await service.addUser(
        { agencyId: auth.agencyId, userId: auth.userId },
        input,
      );
      res.status(201).json({ user });
    },
  };
}
