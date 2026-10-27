import { Router } from "express";
import { requirePermission, type RequireAuth } from "../../middleware/auth";
import { AppError } from "../../lib/errors";
import {
  dueParamsSchema,
  idempotencyKeySchema,
  recordPaymentBodySchema,
} from "./payments.schemas";
import type { PaymentsService } from "./payments.service";

export function createPaymentsRouter(service: PaymentsService, requireAuth: RequireAuth) {
  const router = Router();

  // POST /api/v1/dues/:id/payments
  router.post(
    "/dues/:id/payments",
    requireAuth,
    requirePermission("payment.record"),
    async (req, res) => {
      const { id } = dueParamsSchema.parse(req.params);
      const body = recordPaymentBodySchema.parse(req.body);

      const rawKey = req.header("Idempotency-Key");
      if (!rawKey) {
        throw new AppError(400, "idempotency_key_required", "L'en-tête Idempotency-Key est requis");
      }
      const key = idempotencyKeySchema.parse(rawKey);

      const auth = req.auth!;
      const result = await service.recordPayment(
        { agencyId: auth.agencyId, userId: auth.userId },
        id,
        body,
        key,
      );
      res.status(result.replayed ? 200 : 201).json(result);
    },
  );

  return router;
}
