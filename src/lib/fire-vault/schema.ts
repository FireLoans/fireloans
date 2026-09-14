import { z } from "zod";

/** The one fixed access passcode, emailed to anyone who requests it. Not per-user, not random — a shared access gate, not a security-grade OTP. */
export const FIRE_VAULT_PASSCODE = "FIRELOANS26";

/** Shared between the client gate form and the server routes so validation can never drift apart. */
export const sendCodeSchema = z.object({
  name: z.string().min(2, "Enter your name").max(200),
  email: z.string().email("Enter a valid email").max(320),
  // Honeypot   see contact-schema.ts for the same pattern.
  company: z.string().max(200).optional().or(z.literal("")),
});
export type SendCodeValues = z.infer<typeof sendCodeSchema>;

export const verifyCodeSchema = z.object({
  name: z.string().min(2, "Enter your name").max(200),
  email: z.string().email("Enter a valid email").max(320),
  code: z.string().min(1, "Enter the code from your email").max(50),
});
export type VerifyCodeValues = z.infer<typeof verifyCodeSchema>;
