import z, { email } from "zod";

const Owner = z.object({
  fullName: z.string().min(7),
  phone: z.e164(),
  email: z.email(),
  address: z.string().min(10),
});

const Mandate = z.object({
  commissionPct: z.number(),
  startsOn: z.date(),
  endsOn: z.date,
});

export type Owner = z.infer<typeof Owner>;
export type MandateSchema = z.infer<typeof Mandate>;
