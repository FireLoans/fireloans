import {
  buildFixedPaymentSchedule,
  periodsToYearsMonths,
  type BalancePoint,
  type FixedPaymentSchedule,
} from "./amortization";
import {
  MEDICARE_LEVY_RATE,
  OTHER_INCOME_SHADING,
  estimateAnnualNetIncome,
  marginalTaxRateFor,
} from "./borrowing-power";
import { getHemMonthlyByLocation, type HemLocation } from "./hem-table";

/**
 * FIRE Vault is the site's own version of the "redirect 100% of household surplus at an
 * accelerated rate" comparison popularised by products like Infinity's Rapid Repay — reverse
 * engineered live against rapidpay.infinity.com.au, then generalised well beyond its single
 * applicant/single loan model: up to 4 applicants, rental income entries, and existing loans
 * split into owner-occupied / investment / the single proposed FIRE loan, all on the site's own
 * (newer, already-verified) 2026-27 tax brackets and income-banded HEM table rather than
 * RapidPay's flat regional figure.
 */

export type Applicant = { grossSalary: number; additionalIncome: number };

export function emptyApplicant(): Applicant {
  return { grossSalary: 0, additionalIncome: 0 };
}

/** A single rental income line — a flat gross annual figure, not derived from a per-property rent/expenses split. */
export type RentalIncome = { grossAnnualRent: number };

export function emptyRentalIncome(): RentalIncome {
  return { grossAnnualRent: 0 };
}

export type ExistingLoan = {
  balance: number;
  ratePct: number;
  termYears: number;
  termMonths: number;
  monthlyRepayment: number;
};

export function emptyLoan(): ExistingLoan {
  return { balance: 0, ratePct: 0, termYears: 0, termMonths: 0, monthlyRepayment: 0 };
}

export type RepaymentType = "interest_only" | "principal_and_interest";

/** An investment loan carries the same fields as any other existing loan, plus its repayment basis. */
export type InvestmentLoan = ExistingLoan & { repaymentType: RepaymentType };

export function emptyInvestmentLoan(): InvestmentLoan {
  return { ...emptyLoan(), repaymentType: "principal_and_interest" };
}

export type FireVaultInput = {
  applicants: Applicant[]; // 1-4
  rentalIncomes: RentalIncome[]; // 0-10

  dependents: number;
  location: HemLocation;
  useHemBenchmark: boolean;
  manualMonthlyExpenses: number;

  // Existing facilities being refinanced/consolidated — used for the "current path" baseline.
  ownerOccupiedLoans: ExistingLoan[]; // 0-10
  investmentLoans: InvestmentLoan[]; // 0-10
  // The single new consolidated loan being proposed — the "accelerated path" runs against this.
  fireLoan: ExistingLoan;

  carLoanMonthly: number;
  personalLoanMonthly: number;
};

/** Per-applicant tax breakdown, surfaced as a transparency table — RapidPay only ever shows combined totals. */
export type ApplicantBreakdown = {
  grossSalary: number;
  additionalIncome: number;
  netAnnual: number;
};

export type RentalIncomeBreakdown = {
  grossAnnualRent: number;
};

export type ScheduleRow = {
  year: number;
  principalRemaining: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  interestRatePct: number;
  totalAnnualRepayment: number;
  interestPaidThisYear: number;
  principalRepaidThisYear: number;
  averageMonthlyPrincipalRepaid: number;
};

export type LoanPath = {
  yearsToPayOff: { years: number; months: number };
  totalAmount: number;
  totalInterestPaid: number;
  neverPaysOff: boolean;
  chartPoints: { x: number; y: number }[];
  schedule: ScheduleRow[];
};

export type FireVaultResult = {
  totalGrossAnnualIncome: number;
  totalNetMonthlyIncome: number;
  applicantBreakdown: ApplicantBreakdown[];
  rentalIncomeBreakdown: RentalIncomeBreakdown[];

  hemMonthlyBenchmark: number;
  assessedMonthlyExpenses: number;
  additionalRepaymentsMonthly: number;
  monthlySurplus: number;

  existingLoanBalance: number;
  weightedExistingRatePct: number;
  existingLoanMonthlyRepayment: number;
  fireLoanBalance: number;

  currentPath: LoanPath;
  acceleratedPath: LoanPath;

  interestSaved: number;
  timeSavedMonths: number;

  netServiceabilityRatio: number | null;
  loanToIncome: number | null;
};

/** Bonus/overtime is taxed at the marginal rate that applies at the TOP of the base salary's own bracket, plus Medicare — the exact mechanic reverse-engineered from RapidPay's live output, layered on this site's own (newer) tax brackets. */
function netAdditionalIncome(baseSalary: number, additionalIncome: number): number {
  if (additionalIncome <= 0) return 0;
  const rate = marginalTaxRateFor(baseSalary) + MEDICARE_LEVY_RATE;
  return additionalIncome * (1 - rate);
}

function buildScheduleRows(schedule: FixedPaymentSchedule, monthlyIncome: number, monthlyExpenses: number, ratePct: number): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  for (let i = 1; i < schedule.series.length; i++) {
    const point = schedule.series[i];
    const prev = schedule.series[i - 1];
    const totalAnnualRepayment = point.cumulativePaid - prev.cumulativePaid;
    const principalRepaidThisYear = Math.max(0, prev.balance - point.balance);
    const interestPaidThisYear = totalAnnualRepayment - principalRepaidThisYear;
    const monthsThisRow = Math.max(1, point.period - prev.period);
    rows.push({
      year: point.year,
      principalRemaining: point.balance,
      monthlyIncome,
      monthlyExpenses,
      interestRatePct: ratePct,
      totalAnnualRepayment,
      interestPaidThisYear,
      principalRepaidThisYear,
      averageMonthlyPrincipalRepaid: principalRepaidThisYear / monthsThisRow,
    });
  }
  return rows;
}

function toLoanPath(schedule: FixedPaymentSchedule, monthlyIncome: number, monthlyExpenses: number, ratePct: number): LoanPath {
  return {
    yearsToPayOff: schedule.payoffTime,
    totalAmount: schedule.neverPaysOff ? Infinity : schedule.totalPaid,
    totalInterestPaid: schedule.neverPaysOff ? Infinity : schedule.totalInterestPaid,
    neverPaysOff: schedule.neverPaysOff,
    chartPoints: schedule.series.map((p: BalancePoint) => ({ x: p.year, y: p.balance })),
    schedule: buildScheduleRows(schedule, monthlyIncome, monthlyExpenses, ratePct),
  };
}

export function calculateFireVault(input: FireVaultInput): FireVaultResult {
  const applicantBreakdown: ApplicantBreakdown[] = input.applicants.map((a) => ({
    grossSalary: a.grossSalary,
    additionalIncome: a.additionalIncome,
    netAnnual: estimateAnnualNetIncome(a.grossSalary) + netAdditionalIncome(a.grossSalary, a.additionalIncome),
  }));

  const rentalIncomeBreakdown: RentalIncomeBreakdown[] = input.rentalIncomes.map((r) => ({
    grossAnnualRent: r.grossAnnualRent,
  }));

  // Kept separate from totalGrossAnnualIncome below: the HEM lookup must be based on applicant
  // (salary) income only. Folding rental income into that lookup was a confirmed bug — it
  // inflated the benchmark, since HEM measures a household's own living costs, not income earned
  // from an investment property.
  const salaryGrossAnnualIncome = applicantBreakdown.reduce((sum, a) => sum + a.grossSalary + a.additionalIncome, 0);
  const totalRentalAnnual = rentalIncomeBreakdown.reduce((sum, r) => sum + r.grossAnnualRent, 0);
  const totalGrossAnnualIncome = salaryGrossAnnualIncome + totalRentalAnnual;

  const netRentalAnnual = estimateAnnualNetIncome(totalRentalAnnual * OTHER_INCOME_SHADING);
  const totalNetAnnualIncome = applicantBreakdown.reduce((sum, a) => sum + a.netAnnual, 0) + netRentalAnnual;
  const totalNetMonthlyIncome = totalNetAnnualIncome / 12;

  const isJoint = input.applicants.length >= 2;
  const hemMonthlyBenchmark = getHemMonthlyByLocation(isJoint, input.location, input.dependents, salaryGrossAnnualIncome);
  // Mirrors RapidPay's own "Update HEM?" toggle behaviour: locked to the benchmark, or a
  // straight manual override — not floored, unlike the site's own Borrowing Power calculator.
  const assessedMonthlyExpenses = input.useHemBenchmark ? hemMonthlyBenchmark : input.manualMonthlyExpenses;

  const additionalRepaymentsMonthly = input.carLoanMonthly + input.personalLoanMonthly;
  const monthlySurplus = totalNetMonthlyIncome - assessedMonthlyExpenses - additionalRepaymentsMonthly;

  // The "current path" baseline: what happens if nothing is refinanced and existing loans keep
  // being paid at their own declared balance/rate/repayment.
  const existingLoans: ExistingLoan[] = [...input.ownerOccupiedLoans, ...input.investmentLoans];
  const existingLoanBalance = existingLoans.reduce((sum, l) => sum + l.balance, 0);
  const existingLoanMonthlyRepayment = existingLoans.reduce((sum, l) => sum + l.monthlyRepayment, 0);
  const weightedExistingRatePct =
    existingLoanBalance > 0 ? existingLoans.reduce((sum, l) => sum + l.balance * l.ratePct, 0) / existingLoanBalance : 0;

  const currentSchedule = buildFixedPaymentSchedule({
    principal: existingLoanBalance,
    annualRatePct: weightedExistingRatePct,
    periodsPerYear: 12,
    payment: existingLoanMonthlyRepayment,
  });
  // The "accelerated path": the single proposed FIRE loan, with the full household surplus
  // redirected against it every month instead of just its own minimum repayment.
  const acceleratedSchedule = buildFixedPaymentSchedule({
    principal: input.fireLoan.balance,
    annualRatePct: input.fireLoan.ratePct,
    periodsPerYear: 12,
    payment: Math.max(0, monthlySurplus),
  });

  const totalOutgoingsMonthly = assessedMonthlyExpenses + additionalRepaymentsMonthly + existingLoanMonthlyRepayment;

  const currentPath = toLoanPath(currentSchedule, totalNetMonthlyIncome, assessedMonthlyExpenses, weightedExistingRatePct);
  const acceleratedPath = toLoanPath(acceleratedSchedule, totalNetMonthlyIncome, assessedMonthlyExpenses, input.fireLoan.ratePct);

  const interestSaved =
    currentPath.neverPaysOff || acceleratedPath.neverPaysOff
      ? 0
      : Math.max(0, currentPath.totalInterestPaid - acceleratedPath.totalInterestPaid);

  const currentMonths = currentPath.yearsToPayOff.years * 12 + currentPath.yearsToPayOff.months;
  const acceleratedMonths = acceleratedPath.yearsToPayOff.years * 12 + acceleratedPath.yearsToPayOff.months;
  const timeSavedMonths =
    currentPath.neverPaysOff || acceleratedPath.neverPaysOff ? 0 : Math.max(0, currentMonths - acceleratedMonths);

  return {
    totalGrossAnnualIncome,
    totalNetMonthlyIncome,
    applicantBreakdown,
    rentalIncomeBreakdown,
    hemMonthlyBenchmark,
    assessedMonthlyExpenses,
    additionalRepaymentsMonthly,
    monthlySurplus,
    existingLoanBalance,
    weightedExistingRatePct,
    existingLoanMonthlyRepayment,
    fireLoanBalance: input.fireLoan.balance,
    currentPath,
    acceleratedPath,
    interestSaved,
    timeSavedMonths,
    netServiceabilityRatio: totalOutgoingsMonthly > 0 ? totalNetMonthlyIncome / totalOutgoingsMonthly : null,
    loanToIncome: totalGrossAnnualIncome > 0 ? existingLoanBalance / totalGrossAnnualIncome : null,
  };
}

export function timeSavedYearsMonths(months: number): { years: number; months: number } {
  return periodsToYearsMonths(months, 12);
}
