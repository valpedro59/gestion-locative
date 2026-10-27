import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : AAAA-MM-JJ")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Date invalide");

export const dueParamsSchema = z.object({ id: z.string().uuid() });

export const recordPaymentBodySchema = z.object({
  amountXaf: z.number().int().positive(),
  method: z.enum(["virement", "especes"]),
  paidOn: isoDate,
  reference: z.string().trim().max(100).optional(),
});

export const idempotencyKeySchema = z.string().min(8).max(100);

export type RecordPaymentInput = z.infer<typeof recordPaymentBodySchema>;
