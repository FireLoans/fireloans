import { periodicPayment } from "./amortization";
import { getHemMonthly } from "./hem-table";

// Resident tax rates for the 2026–27 year: the "Round 2" cuts legislated in
// the 2024–25 Budget took the 16% bracket to 15% from 1 July 2026 (and to
// 14% from 1 July 2027   update again when this site is still live then).
// Cross-checked cell-for-cell against a major lender's own broker
// serviceability workbook (References!B14:D19, "effective 17/07/2026")   identical.
export const TAX_BRACKETS_2026_27 = [
  { upTo: 18200, base: 0, rate: 0 },
  { upTo: 45000, base: 0, rate: 0.15 },
  { upTo: 135000, base: 4020, rate: 0.3 },
  { upTo: 190000, base: 31020, rate: 0.37 },
  { upTo: Infinity, base: 51370, rate: 0.45 },
];

export const MEDICARE_LEVY_RATE = 0.02;

/** Rough resident income tax + 2% Medicare levy estimate   for illustration only. */
export function estimateAnnualNetIncome(gross: number): number {
  if (gross <= 0) return 0;
  const bracket =
    TAX_BRACKETS_2026_27.find((b, i) => gross <= b.upTo || i === TAX_BRACKETS_2026_27.length - 1) ??
    TAX_BRACKETS_2026_27[0];
  const prevCap = TAX_BRACKETS_2026_27[TAX_BRACKETS_2026_27.indexOf(bracket) - 1]?.upTo ?? 0;
  const tax = bracket.base + (gross - prevCap) * bracket.rate;
  const medicare = gross * MEDICARE_LEVY_RATE;
  return Math.max(0, gross - tax - medicare);
}

/**
 * The marginal rate that applies at the TOP of `gross`'s own bracket (income tax only,
 * excluding Medicare). Used to shade a second income stream (e.g. bonus/rental) at the
 * rate it would actually be taxed at on top of a base income, without re-running the
 * whole progressive calculation from zero for every combined dollar.
 */
export function marginalTaxRateFor(gross: number): number {
  if (gross <= 0) return 0;
  const bracket =
    TAX_BRACKETS_2026_27.find((b, i) => gross <= b.upTo || i === TAX_BRACKETS_2026_27.length - 1) ??
    TAX_BRACKETS_2026_27[0];
  return bracket.rate;
}

export type Frequency = "weekly" | "fortnightly" | "monthly" | "annually";

const FREQUENCY_MULTIPLIER: Record<Frequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  annually: 1,
};

export function toAnnual(amount: number, frequency: Frequency): number {
  return amount * FREQUENCY_MULTIPLIER[frequency];
}

export type RateType = "variable" | "fixed";

/**
 * The following constants and formulas are ported directly from a major
 * Australian lender's own broker serviceability calculator (a .xlsm
 * workbook, effective 17 July 2026)   not invented. Source cell/name
 * references are noted in parentheses throughout this file.
 */
// The assessed rate is never lower than this floor, regardless of the actual offered rate (minVar_rate).
export const MIN_ASSESSMENT_RATE_PCT = 5.3;
// Buffer added on top of the (rate, floor)-max: 3.00% standard, 2.25% for a 4-5yr fixed rate (Var_buffer / Fix_buffer).
export const VARIABLE_BUFFER_PCT = 3.0;
export const FIXED_LONG_TERM_BUFFER_PCT = 2.25;
// Credit cards & BNPL assessed at 45.6% p.a. of the limit   i.e. 3.8% applied monthly (Notes: "45.6% p.a of credit card limits").
export const CREDIT_CARD_ASSESSMENT_RATE = 0.038;
// Fallback remaining term used to benchmark an existing debt when no term is given (Default_Loan_Assess_Term_Months).
export const DEFAULT_ASSESS_TERM_MONTHS = 294;
// The workbook doesn't apply a flat "safety margin"   instead, a loan that leaves less than
// $500/month surplus is flagged to refer to a credit assessor rather than auto-passing
// (Is_SurplusInDangerZone). We use that same $500 line as the practical ceiling for an auto "pass".
export const MIN_MONTHLY_SURPLUS_BUFFER = 500;
// Verbatim from the source workbook's own result messages (References!B5:B8), lightly adapted
// only where they refer to Excel-internal tabs that don't exist in this context.
export const NSR_PASS_MESSAGE = "Passes serviceability test";
export const NSR_FAIL_MESSAGE = "Fails serviceability test based on the figures entered";
export const NSR_REFER_MESSAGE =
  "Refer to a broker   minimum surplus of $500/month is required unless satisfactory evidence of at least $10,000 in savings, redraw or liquid assets is available.";
// Variable/other income (rental, bonus, overtime, commission) is rarely accepted dollar-for-dollar  
// not verified against the source file (which handles this via separate rental/self-employed
// worksheets we haven't ported); kept as our own conservative industry-standard shading.
export const OTHER_INCOME_SHADING = 0.8;

function assessedRateFor(interestRatePct: number, rateType: RateType, fixedTermYears: number): number {
  const buffer = rateType === "fixed" && fixedTermYears >= 4 ? FIXED_LONG_TERM_BUFFER_PCT : VARIABLE_BUFFER_PCT;
  return Math.max(interestRatePct + buffer, MIN_ASSESSMENT_RATE_PCT);
}

/** One existing credit facility (limit/rate/term/actual repayment)   mirrors the workbook's per-account debt rows. */
export type ExistingDebtAccount = {
  limit: number;
  ratePct: number; // 0 = unknown; the floor rate alone is used, matching the source formula
  termYears: number; // 0 = unknown; falls back to DEFAULT_ASSESS_TERM_MONTHS
  currentMonthlyRepayment: number; // 0 = unknown; the recalculated benchmark is used instead
};

export function emptyDebtAccount(): ExistingDebtAccount {
  return { limit: 0, ratePct: 0, termYears: 0, currentMonthlyRepayment: 0 };
}

/**
 * Assessed as the GREATER of the actual declared repayment or a benchmark repayment
 * recalculated at the buffered/floored rate over the (remaining) term   exactly the
 * workbook's own `=MAX(declared repayment, PMT(MAX(rate+buffer,floor), term, limit))`
 * pattern used for every existing mortgage, personal loan, hire purchase, lease and
 * other/margin facility (Serviceability Worksheet!AF361:AG369).
 */
function assessedAnnualRepayment(account: ExistingDebtAccount): number {
  if (account.limit <= 0 && account.currentMonthlyRepayment <= 0) return 0;
  const rate = account.ratePct > 0 ? Math.max(account.ratePct + VARIABLE_BUFFER_PCT, MIN_ASSESSMENT_RATE_PCT) : MIN_ASSESSMENT_RATE_PCT;
  const termMonths = account.termYears > 0 ? account.termYears * 12 : DEFAULT_ASSESS_TERM_MONTHS;
  const benchmarkAnnual = account.limit > 0 ? periodicPayment(account.limit, rate, termMonths, 12) * 12 : 0;
  const declaredAnnual = account.currentMonthlyRepayment * 12;
  return Math.max(declaredAnnual, benchmarkAnnual);
}

export type BorrowingPowerInput = {
  isJoint: boolean;
  dependents: number;

  salary1: number;
  salary1Frequency: Frequency;
  overtimeBonus1: number;
  overtimeBonus1Frequency: Frequency;
  salary2: number;
  salary2Frequency: Frequency;
  overtimeBonus2: number;
  overtimeBonus2Frequency: Frequency;
  otherIncome: number;
  otherIncomeFrequency: Frequency;
  nonTaxableIncome: number;
  nonTaxableIncomeFrequency: Frequency;

  generalLivingExpenses: number;
  generalLivingExpensesFrequency: Frequency;
  additionalLivingExpenses: number;
  additionalLivingExpensesFrequency: Frequency;

  homeLoan: ExistingDebtAccount;
  personalLoan: ExistingDebtAccount;
  hirePurchase: ExistingDebtAccount;
  leaseCarLoan: ExistingDebtAccount;
  otherDebts: ExistingDebtAccount;
  marginLoan: ExistingDebtAccount;

  hecsRepayments: number;
  hecsRepaymentsFrequency: Frequency;
  otherCommitments: number;
  otherCommitmentsFrequency: Frequency;
  totalCreditCardLimits: number;
  bnplLimit: number;
  bnplCurrentMonthlyRepayment: number;

  interestRatePct: number;
  rateType: RateType;
  fixedTermYears: number;
  loanTermYears: number;
  repaymentBasis: RepaymentBasis;
  interestOnlyYears: number;
};

export type RepaymentBasis = "principal_and_interest" | "interest_only";

export type BorrowingPowerResult = {
  maxLoanAmount: number;
  monthlyRepayment: number;
  fortnightlyRepayment: number;
  weeklyRepayment: number;
  monthlyRepaymentAfterIO: number | null;
  netMonthlyIncome: number;
  monthlyOutgoings: number;
  monthlySurplus: number;
  expenseFloorApplied: boolean;
  assessedMonthlyExpenses: number;
  assessedRatePct: number;
  nsr: number | null;
  loanToIncome: number | null;
  debtToIncome: number | null;
  serviceabilityMessage: string;
};

export function calculateBorrowingPower(input: BorrowingPowerInput): BorrowingPowerResult {
  const grossSalary1 = toAnnual(input.salary1, input.salary1Frequency);
  const grossOvertimeBonus1 = toAnnual(input.overtimeBonus1, input.overtimeBonus1Frequency);
  const grossSalary2 = input.isJoint ? toAnnual(input.salary2, input.salary2Frequency) : 0;
  const grossOvertimeBonus2 = input.isJoint ? toAnnual(input.overtimeBonus2, input.overtimeBonus2Frequency) : 0;
  const grossOtherIncome = toAnnual(input.otherIncome, input.otherIncomeFrequency);
  const grossNonTaxableIncome = toAnnual(input.nonTaxableIncome, input.nonTaxableIncomeFrequency);

  // Overtime/bonus/other income shaded before tax   combined with salary per applicant so
  // progressive tax brackets apply once to the whole taxable amount, not per income source.
  const taxableIncome1 = grossSalary1 + grossOvertimeBonus1 * OTHER_INCOME_SHADING;
  const taxableIncome2 = grossSalary2 + grossOvertimeBonus2 * OTHER_INCOME_SHADING;
  const taxableOtherIncome = grossOtherIncome * OTHER_INCOME_SHADING;

  const netAnnual =
    estimateAnnualNetIncome(taxableIncome1) +
    estimateAnnualNetIncome(taxableIncome2) +
    estimateAnnualNetIncome(taxableOtherIncome) +
    grossNonTaxableIncome; // non-taxable income (e.g. Family Tax Benefit) is added net, untaxed
  const netMonthlyIncome = netAnnual / 12;

  const totalGrossAnnualIncome = grossSalary1 + grossOvertimeBonus1 + grossSalary2 + grossOvertimeBonus2 + grossOtherIncome;
  const hemMonthly = getHemMonthly(input.isJoint, input.dependents, totalGrossAnnualIncome);
  const declaredGeneralMonthly = toAnnual(input.generalLivingExpenses, input.generalLivingExpensesFrequency) / 12;
  const additionalMonthly = toAnnual(input.additionalLivingExpenses, input.additionalLivingExpensesFrequency) / 12;
  const assessedGeneralMonthly = Math.max(declaredGeneralMonthly, hemMonthly);
  const assessedMonthlyExpenses = assessedGeneralMonthly + additionalMonthly;
  const expenseFloorApplied = hemMonthly > declaredGeneralMonthly;

  const existingDebtsAnnual =
    assessedAnnualRepayment(input.homeLoan) +
    assessedAnnualRepayment(input.personalLoan) +
    assessedAnnualRepayment(input.hirePurchase) +
    assessedAnnualRepayment(input.leaseCarLoan) +
    assessedAnnualRepayment(input.otherDebts) +
    assessedAnnualRepayment(input.marginLoan);
  const existingDebtsMonthly = existingDebtsAnnual / 12;

  const hecsMonthly = toAnnual(input.hecsRepayments, input.hecsRepaymentsFrequency) / 12;
  const otherCommitmentsMonthly = toAnnual(input.otherCommitments, input.otherCommitmentsFrequency) / 12;
  const creditCardLiability = input.totalCreditCardLimits * CREDIT_CARD_ASSESSMENT_RATE;
  // BNPL: the source formula compares an annual repayment figure against a raw balance dollar
  // figure (AG370 = balance, not a recalculated benchmark)   internally inconsistent units, so
  // rather than propagate what looks like a template quirk, BNPL is assessed the same
  // conservative way as credit cards: limit × the same monthly assessment rate.
  const bnplBenchmarkAnnual = input.bnplLimit * CREDIT_CARD_ASSESSMENT_RATE * 12;
  const bnplDeclaredAnnual = input.bnplCurrentMonthlyRepayment * 12;
  const bnplLiability = Math.max(bnplDeclaredAnnual, bnplBenchmarkAnnual) / 12;

  const monthlyOutgoings =
    assessedMonthlyExpenses + existingDebtsMonthly + hecsMonthly + otherCommitmentsMonthly + creditCardLiability + bnplLiability;

  const monthlySurplus = netMonthlyIncome - monthlyOutgoings;
  const assessableCapacity = Math.max(0, monthlySurplus - MIN_MONTHLY_SURPLUS_BUFFER);

  // An interest-only period is assessed by amortising the FULL loan over just the
  // remaining principal & interest years, not the whole term   the same conservative
  // treatment as the source workbook (`PMT(rate, (LoanTerm - IntOnlyPrd)*12, LoanAmt)`),
  // so an IO loan always shows lower borrowing power than the same loan on P&I.
  const isInterestOnly = input.repaymentBasis === "interest_only";
  const ioYears = isInterestOnly ? Math.min(Math.max(input.interestOnlyYears, 0), Math.max(input.loanTermYears - 1, 1)) : 0;
  const assessmentTermMonths = (input.loanTermYears - ioYears) * 12;

  const assessedRatePct = assessedRateFor(input.interestRatePct, input.rateType, input.fixedTermYears);
  const n = assessmentTermMonths;
  const r = assessedRatePct / 100 / 12;

  const maxLoanAmount =
    r === 0 ? assessableCapacity * n : (assessableCapacity * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));

  const roundedLoan = Math.floor(maxLoanAmount / 1000) * 1000;
  const monthlyRepaymentAtAssessedRate = periodicPayment(roundedLoan, assessedRatePct, n, 12);

  // What's actually shown to the borrower uses the real (non-buffered) rate.
  const monthlyRepayment = isInterestOnly
    ? roundedLoan * (input.interestRatePct / 100 / 12)
    : periodicPayment(roundedLoan, input.interestRatePct, n, 12);
  const monthlyRepaymentAfterIO = isInterestOnly ? periodicPayment(roundedLoan, input.interestRatePct, n, 12) : null;

  const totalMonthlyOutgoingsInclNewLoan = monthlyOutgoings + monthlyRepaymentAtAssessedRate;
  const nsr = totalMonthlyOutgoingsInclNewLoan > 0 ? netMonthlyIncome / totalMonthlyOutgoingsInclNewLoan : null;

  const existingLimitsTotal =
    input.homeLoan.limit +
    input.personalLoan.limit +
    input.hirePurchase.limit +
    input.leaseCarLoan.limit +
    input.otherDebts.limit +
    input.marginLoan.limit +
    input.totalCreditCardLimits +
    input.bnplLimit;
  const loanToIncome = totalGrossAnnualIncome > 0 ? roundedLoan / totalGrossAnnualIncome : null;
  const debtToIncome = totalGrossAnnualIncome > 0 ? (roundedLoan + existingLimitsTotal) / totalGrossAnnualIncome : null;

  let serviceabilityMessage: string;
  if (monthlySurplus <= 0) {
    serviceabilityMessage = NSR_FAIL_MESSAGE;
  } else if (monthlySurplus < MIN_MONTHLY_SURPLUS_BUFFER) {
    serviceabilityMessage = NSR_REFER_MESSAGE;
  } else {
    serviceabilityMessage = NSR_PASS_MESSAGE;
  }

  return {
    maxLoanAmount: roundedLoan,
    monthlyRepayment,
    fortnightlyRepayment: (monthlyRepayment * 12) / 26,
    weeklyRepayment: (monthlyRepayment * 12) / 52,
    monthlyRepaymentAfterIO,
    netMonthlyIncome,
    monthlyOutgoings,
    monthlySurplus,
    expenseFloorApplied,
    assessedMonthlyExpenses,
    assessedRatePct,
    nsr,
    loanToIncome,
    debtToIncome,
    serviceabilityMessage,
  };
}
