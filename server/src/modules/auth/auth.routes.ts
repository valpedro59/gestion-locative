import { Router } from "express";

import { requirePermission, type RequireAuth } from "../../middleware/auth";
import type { AuthService } from "./auth.service";
import { createAuthController } from "./auth.controller";
import { loginLimit } from "../../lib/rateLimit";

export function createAuthRouter(
  service: AuthService,
  requireAuth: RequireAuth,
) {
  const router = Router();
  const controller = createAuthController(service);

  // Public : inscription d'une agence et de son premier admin.
  // À protéger par une limitation de débit avant la mise en production.
  router.post("/auth/register-agency", loginLimit, controller.registerAgency);

  // Public : connexion. Pose le cookie de session. À protéger par une limitation
  // de débit (par IP et par e-mail) avant la mise en production.
  router.post("/auth/login", loginLimit, controller.login);

  router.post("/auth/logout", controller.logout);

  router.get("/me", requireAuth, controller.profile);

  // Réservé aux admins. L'agence vient de la session, pas du corps de la requête.
  router.post(
    "/users",
    requireAuth,
    requirePermission("user.manage"),
    controller.addUser,
  );

  return router;
}
