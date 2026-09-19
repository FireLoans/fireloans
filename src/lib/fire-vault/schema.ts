import { z } from "zod";

/** The one fixed access passcode, emailed to anyone who requests it. Not per-user, not random — a shared access gate, not a security-grade OTP. */
export const FIRE_VAULT_PASSCODE = "FIRELOANS26";

/** Shared between the client gate form and the server routes so validation can never drift apart. */
export const sendCodeSchema = z.object({
  name: z.string().min(2, "Enter your name").max(200),
  email: z.string().email("Enter a valid email").max(320),
  mobile: z.string().min(8, "Enter a valid mobile number").max(30),
  // Honeypot   see contact-schema.ts for the same pattern.
  company: z.string().max(200).optional().or(z.literal("")),
});
export type SendCodeValues = z.infer<typeof sendCodeSchema>;

export const verifyCodeSchema = z.object({
  name: z.string().min(2, "Enter your name").max(200),
  email: z.string().email("Enter a valid email").max(320),
  mobile: z.string().min(8, "Enter a valid mobile number").max(30),
  code: z.string().min(1, "Enter the code from your email").max(50),
});
export type VerifyCodeValues = z.infer<typeof verifyCodeSchema>;

/**
 * Sent as a `navigator.sendBeacon` payload when a verified visitor leaves the FIRE Vault
 * calculator, so the broker gets their actual numbers, not just that they signed up. Name and
 * email are NOT taken from this payload server-side (an attacker could put anything here) —
 * the route re-derives identity from the visitor's own verified session cookie instead. This
 * schema only validates the calculator snapshot itself.
 */
const applicantSnapshotSchema = z.object({ grossSalary: z.number(), additionalIncome: z.number() });
const rentalIncomeSnapshotSchema = z.object({ grossAnnualRent: z.number() });
const loanSnapshotSchema = z.object({
  balance: z.number(),
  ratePct: z.number(),
  termYears: z.number(),
  termMonths: z.number(),
  monthlyRepayment: z.number(),
});
const investmentLoanSnapshotSchema = loanSnapshotSchema.extend({
  repaymentType: z.enum(["interest_only", "principal_and_interest"]),
});

export const leadSnapshotSchema = z.object({
  input: z.object({
    applicants: z.array(applicantSnapshotSchema).min(1).max(4),
    rentalIncomes: z.array(rentalIncomeSnapshotSchema).max(10),
    dependents: z.number(),
    location: z.enum(["rest_of_australia", "remote"]),
    useHemBenchmark: z.boolean(),
    manualMonthlyExpenses: z.number(),
    ownerOccupiedLoans: z.array(loanSnapshotSchema).max(10),
    investmentLoans: z.array(investmentLoanSnapshotSchema).max(10),
    fireLoan: loanSnapshotSchema,
    carLoanMonthly: z.number(),
    personalLoanMonthly: z.number(),
  }),
  summary: z.object({
    totalGrossAnnualIncome: z.number(),
    totalNetMonthlyIncome: z.number(),
    existingLoanBalance: z.number(),
    fireLoanBalance: z.number(),
    monthlySurplus: z.number(),
    currentPayoffLabel: z.string().max(100),
    acceleratedPayoffLabel: z.string().max(100),
    interestSaved: z.number(),
    neverPaysOff: z.boolean(),
  }),
});
export type LeadSnapshotValues = z.infer<typeof leadSnapshotSchema>;
