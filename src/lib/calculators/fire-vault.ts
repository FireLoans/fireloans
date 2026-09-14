import {
  buildFixedPaymentSchedule,
  periodsToYearsMonths,
  type BalancePoint,
  type FixedPaymentSchedule,
} from "./amortization";
import {
  CREDIT_CARD_ASSESSMENT_RATE,
  MEDICARE_LEVY_RATE,
  OTHER_INCOME_SHADING,
  estimateAnnualNetIncome,
  marginalTaxRateFor,
} from "./borrowing-power";
import { getHemMonthly } from "./hem-table";

/**
 * FIRE Vault is the site's own version of the "redirect 100% of household surplus at an
 * accelerated rate" comparison popularised by products like Infinity's Rapid Repay — reverse
 * engineered live against rapidpay.infinity.com.au, then generalised well beyond its single
 * applicant/single loan model: up to 4 applicants, up to 10 investment properties (with their
 * own rental income + expenses), and up to 10 existing loans blended into one combined payoff
 * comparison, all on the site's own (newer, already-verified) 2026-27 tax brackets and
 * income-banded HEM table rather than RapidPay's flat regional figure.
 */

export type Applicant = {
  grossSalary: number; // annual
  additionalIncome: number; // annual   bonus/overtime/commission
};

export function emptyApplicant(): Applicant {
  return { grossSalary: 0, additionalIncome: 0 };
}

export type InvestmentProperty = {
  weeklyRent: number;
  monthlyExpenses: number;
};

export function emptyProperty(): InvestmentProperty {
  return { weeklyRent: 0, monthlyExpenses: 0 };
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

export type FireVaultInput = {
  applicants: Applicant[]; // 1-4
  properties: InvestmentProperty[]; // 0-10
  dependents: number;
  useHemBenchmark: boolean;
  manualMonthlyExpenses: number;
  loans: ExistingLoan[]; // 0-10
  carLoanMonthly: number;
  personalLoanMonthly: number;
  creditCardLimit: number;
  fireVaultRatePct: number;
};

/** Per-applicant tax breakdown, surfaced as a transparency table   RapidPay only ever shows combined totals. */
export type ApplicantBreakdown = {
  grossSalary: number;
  additionalIncome: number;
  netAnnual: number;
};

export type PropertyBreakdown = {
  weeklyRent: number;
  annualRent: number;
  monthlyExpenses: number;
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
  propertyBreakdown: PropertyBreakdown[];

  hemMonthlyBenchmark: number;
  assessedMonthlyExpenses: number;
  propertyExpensesMonthly: number;
  additionalRepaymentsMonthly: number;
  monthlySurplus: number;

  combinedLoanBalance: number;
  weightedCurrentRatePct: number;
  combinedCurrentMonthlyRepayment: number;

  currentPath: LoanPath;
  acceleratedPath: LoanPath;

  interestSaved: number;
  timeSavedMonths: number;

  netServiceabilityRatio: number | null;
  loanToIncome: number | null;
  debtToIncome: number | null;
};

/** Bonus/overtime is taxed at the marginal rate that applies at the TOP of the base salary's own bracket, plus Medicare   the exact mechanic reverse-engineered from RapidPay's live output, layered on this site's own (newer) tax brackets. */
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

  const propertyBreakdown: PropertyBreakdown[] = input.properties.map((p) => ({
    weeklyRent: p.weeklyRent,
    annualRent: p.weeklyRent * 52,
    monthlyExpenses: p.monthlyExpenses,
  }));

  const totalGrossAnnualIncome =
    applicantBreakdown.reduce((sum, a) => sum + a.grossSalary + a.additionalIncome, 0) +
    propertyBreakdown.reduce((sum, p) => sum + p.annualRent, 0);

  const totalRentalAnnual = propertyBreakdown.reduce((sum, p) => sum + p.annualRent, 0);
  const netRentalAnnual = estimateAnnualNetIncome(totalRentalAnnual * OTHER_INCOME_SHADING);

  const totalNetAnnualIncome = applicantBreakdown.reduce((sum, a) => sum + a.netAnnual, 0) + netRentalAnnual;
  const totalNetMonthlyIncome = totalNetAnnualIncome / 12;

  const isJoint = input.applicants.length >= 2;
  const hemMonthlyBenchmark = getHemMonthly(isJoint, input.dependents, totalGrossAnnualIncome);
  // Mirrors RapidPay's own "Update HEM?" toggle behaviour: locked to the benchmark, or a
  // straight manual override   not floored, unlike the site's own Borrowing Power calculator.
  const assessedMonthlyExpenses = input.useHemBenchmark ? hemMonthlyBenchmark : input.manualMonthlyExpenses;

  const propertyExpensesMonthly = input.properties.reduce((sum, p) => sum + p.monthlyExpenses, 0);
  const additionalRepaymentsMonthly =
    input.carLoanMonthly + input.personalLoanMonthly + input.creditCardLimit * CREDIT_CARD_ASSESSMENT_RATE;

  const monthlySurplus =
    totalNetMonthlyIncome - assessedMonthlyExpenses - propertyExpensesMonthly - additionalRepaymentsMonthly;

  const combinedLoanBalance = input.loans.reduce((sum, l) => sum + l.balance, 0);
  const combinedCurrentMonthlyRepayment = input.loans.reduce((sum, l) => sum + l.monthlyRepayment, 0);
  const weightedCurrentRatePct =
    combinedLoanBalance > 0 ? input.loans.reduce((sum, l) => sum + l.balance * l.ratePct, 0) / combinedLoanBalance : 0;

  const currentSchedule = buildFixedPaymentSchedule({
    principal: combinedLoanBalance,
    annualRatePct: weightedCurrentRatePct,
    periodsPerYear: 12,
    payment: combinedCurrentMonthlyRepayment,
  });
  const acceleratedSchedule = buildFixedPaymentSchedule({
    principal: combinedLoanBalance,
    annualRatePct: input.fireVaultRatePct,
    periodsPerYear: 12,
    payment: Math.max(0, monthlySurplus),
  });

  const totalOutgoingsMonthly =
    assessedMonthlyExpenses + propertyExpensesMonthly + additionalRepaymentsMonthly + combinedCurrentMonthlyRepayment;

  const currentPath = toLoanPath(currentSchedule, totalNetMonthlyIncome, assessedMonthlyExpenses, weightedCurrentRatePct);
  const acceleratedPath = toLoanPath(acceleratedSchedule, totalNetMonthlyIncome, assessedMonthlyExpenses, input.fireVaultRatePct);

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
    propertyBreakdown,
    hemMonthlyBenchmark,
    assessedMonthlyExpenses,
    propertyExpensesMonthly,
    additionalRepaymentsMonthly,
    monthlySurplus,
    combinedLoanBalance,
    weightedCurrentRatePct,
    combinedCurrentMonthlyRepayment,
    currentPath,
    acceleratedPath,
    interestSaved,
    timeSavedMonths,
    netServiceabilityRatio: totalOutgoingsMonthly > 0 ? totalNetMonthlyIncome / totalOutgoingsMonthly : null,
    loanToIncome: totalGrossAnnualIncome > 0 ? combinedLoanBalance / totalGrossAnnualIncome : null,
    debtToIncome:
      totalGrossAnnualIncome > 0 ? (combinedLoanBalance + input.creditCardLimit) / totalGrossAnnualIncome : null,
  };
}

export function timeSavedYearsMonths(months: number): { years: number; months: number } {
  return periodsToYearsMonths(months, 12);
}
