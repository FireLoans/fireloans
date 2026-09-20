import {
  buildFixedPaymentSchedule,
  periodicPayment,
  periodsToYearsMonths,
  type BalancePoint,
  type FixedPaymentSchedule,
} from "./amortization";
import { MEDICARE_LEVY_RATE, estimateAnnualNetIncome, marginalTaxRateFor } from "./borrowing-power";
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

/** A single rental income line — entered as gross rent per week, since that's how customers actually know it (not annual). */
export type RentalIncome = { weeklyRent: number };

export function emptyRentalIncome(): RentalIncome {
  return { weeklyRent: 0 };
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

/** An investment loan carries the same fields as any other existing loan, plus its repayment
 *  basis and its own property's running costs (rates, strata, insurance, agent fees) — tracked
 *  per loan/property since each one can have different costs, not as one combined figure. */
export type InvestmentLoan = ExistingLoan & { repaymentType: RepaymentType; expensesMonthly: number };

export function emptyInvestmentLoan(): InvestmentLoan {
  return { ...emptyLoan(), repaymentType: "principal_and_interest", expensesMonthly: 0 };
}

/** Standard P&I minimum repayment for a loan's own balance/rate/term — used to auto-populate the
 *  Fire Loan's repayment (so it can be compared against the customer's current repayment) rather
 *  than requiring it to be typed in by hand. `monthlyRepayment` on the loan itself is ignored here. */
export function computeLoanRepayment(loan: { balance: number; ratePct: number; termYears: number; termMonths: number }): number {
  const totalMonths = loan.termYears * 12 + loan.termMonths;
  return periodicPayment(loan.balance, loan.ratePct, totalMonths, 12);
}

/** Same auto-populate behaviour for an investment loan, respecting its Interest Only vs P&I basis. */
export function computeInvestmentLoanRepayment(loan: InvestmentLoan): number {
  if (loan.repaymentType === "interest_only") {
    return loan.balance * (loan.ratePct / 100 / 12);
  }
  return computeLoanRepayment(loan);
}

export type FireVaultInput = {
  applicants: Applicant[]; // 1-4
  rentalIncomes: RentalIncome[]; // 0-10

  dependents: number;
  location: HemLocation;
  useHemBenchmark: boolean;
  manualMonthlyExpenses: number;

  // The existing owner-occupied loan(s) — the "current path" baseline runs against these, at
  // their own actual rate/repayment, entirely separate from the investment loan(s) below.
  ownerOccupiedLoans: ExistingLoan[]; // 0-10
  // Held debt, not something extra repayments are ever directed at — its own repayment (auto,
  // respecting Interest Only vs P&I) plus its own running costs (expensesMonthly) are both just
  // ordinary monthly outgoings.
  investmentLoans: InvestmentLoan[]; // 0-10
  // The single new consolidated loan being proposed — the "accelerated path" runs against this,
  // at its own rate, with its own minimum repayment plus 100% of household surplus.
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
  weeklyRent: number;
  annualRent: number;
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
  salaryGrossAnnualIncome: number;
  salaryNetMonthlyIncome: number;
  totalNetMonthlyIncome: number;
  applicantBreakdown: ApplicantBreakdown[];
  rentalIncomeBreakdown: RentalIncomeBreakdown[];

  hemMonthlyBenchmark: number;
  assessedMonthlyExpenses: number;
  additionalRepaymentsMonthly: number;
  monthlySurplus: number;

  ownerOccupiedLoanBalance: number;
  weightedOwnerOccupiedRatePct: number;
  ownerOccupiedLoanMonthlyRepayment: number;
  investmentLoanBalance: number;
  investmentLoanMonthlyRepayment: number;
  investmentPropertyExpensesMonthly: number;
  fireLoanBalance: number;
  fireLoanRepayment: number;

  currentPath: LoanPath;
  acceleratedPath: LoanPath;

  interestSaved: number;
  /** Interest saved by JUST the extra repayments — Fire Loan at its own rate, minimum repayment
   *  vs minimum+surplus, with no refinance-rate benefit mixed in. Matches what an "extra
   *  repayment calculator" (e.g. a bank's own) reports if you only give it the new rate. */
  interestSavedFromExtraRepayments: number;
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
    weeklyRent: r.weeklyRent,
    annualRent: r.weeklyRent * 52,
  }));

  // Kept separate from totalGrossAnnualIncome below: the HEM lookup must be based on applicant
  // (salary) income only. Folding rental income into that lookup was a confirmed bug — it
  // inflated the benchmark, since HEM measures a household's own living costs, not income earned
  // from an investment property.
  const salaryGrossAnnualIncome = applicantBreakdown.reduce((sum, a) => sum + a.grossSalary + a.additionalIncome, 0);
  const salaryNetMonthlyIncome = applicantBreakdown.reduce((sum, a) => sum + a.netAnnual, 0) / 12;
  const totalRentalAnnual = rentalIncomeBreakdown.reduce((sum, r) => sum + r.annualRent, 0);
  const totalGrossAnnualIncome = salaryGrossAnnualIncome + totalRentalAnnual;

  // Rental income is taken at face value here, with no tax or income-shading applied — Total
  // Monthly Income is meant to read as a straight sum of what's shown on screen (each applicant's
  // net monthly figure plus each rental line's own monthly figure), not a further-adjusted number.
  const totalNetAnnualIncome = applicantBreakdown.reduce((sum, a) => sum + a.netAnnual, 0) + totalRentalAnnual;
  const totalNetMonthlyIncome = totalNetAnnualIncome / 12;

  const isJoint = input.applicants.length >= 2;
  const hemMonthlyBenchmark = getHemMonthlyByLocation(isJoint, input.location, input.dependents, salaryGrossAnnualIncome);
  // Mirrors RapidPay's own "Update HEM?" toggle behaviour: locked to the benchmark, or a
  // straight manual override — not floored, unlike the site's own Borrowing Power calculator.
  const assessedMonthlyExpenses = input.useHemBenchmark ? hemMonthlyBenchmark : input.manualMonthlyExpenses;

  const additionalRepaymentsMonthly = input.carLoanMonthly + input.personalLoanMonthly;
  const fireLoanRepayment = computeLoanRepayment(input.fireLoan);
  const investmentLoanBalance = input.investmentLoans.reduce((sum, l) => sum + l.balance, 0);
  const investmentLoanMonthlyRepayment = input.investmentLoans.reduce((sum, l) => sum + computeInvestmentLoanRepayment(l), 0);
  const investmentPropertyExpensesMonthly = input.investmentLoans.reduce((sum, l) => sum + l.expensesMonthly, 0);

  // Monthly surplus is what's left of household income after EVERY outgoing — living expenses,
  // investment property costs, the Fire Loan's own minimum repayment, the investment loan's own
  // repayment, and the smaller additional repayments. This surplus is what then gets redirected
  // as extra repayments onto the Fire Loan (the accelerated path below) — it's not "income before
  // the home loan," it's what's genuinely left over each month.
  const monthlySurplus =
    totalNetMonthlyIncome -
    assessedMonthlyExpenses -
    investmentPropertyExpensesMonthly -
    fireLoanRepayment -
    investmentLoanMonthlyRepayment -
    additionalRepaymentsMonthly;

  // The "current path" baseline: what happens to the EXISTING owner-occupied loan(s) if nothing
  // is refinanced, paid at their own declared balance/rate/repayment. The investment loan is
  // deliberately excluded here — it's held debt, not something extra repayments are ever
  // redirected at, so it plays no part in this payoff comparison.
  const ownerOccupiedLoanBalance = input.ownerOccupiedLoans.reduce((sum, l) => sum + l.balance, 0);
  const ownerOccupiedLoanMonthlyRepayment = input.ownerOccupiedLoans.reduce((sum, l) => sum + l.monthlyRepayment, 0);
  const weightedOwnerOccupiedRatePct =
    ownerOccupiedLoanBalance > 0
      ? input.ownerOccupiedLoans.reduce((sum, l) => sum + l.balance * l.ratePct, 0) / ownerOccupiedLoanBalance
      : 0;

  const currentSchedule = buildFixedPaymentSchedule({
    principal: ownerOccupiedLoanBalance,
    annualRatePct: weightedOwnerOccupiedRatePct,
    periodsPerYear: 12,
    payment: ownerOccupiedLoanMonthlyRepayment,
  });
  // The "accelerated path": the single proposed FIRE loan, paid at its own minimum repayment PLUS
  // 100% of household surplus redirected against it every month.
  const acceleratedSchedule = buildFixedPaymentSchedule({
    principal: input.fireLoan.balance,
    annualRatePct: input.fireLoan.ratePct,
    periodsPerYear: 12,
    payment: fireLoanRepayment + Math.max(0, monthlySurplus),
  });
  // Fire Loan at its OWN rate, paid at just its own minimum — isolates the extra-repayment effect
  // from the refinance-rate effect, so it can be compared like-for-like against the accelerated
  // schedule above (same principal, same rate — only the payment amount differs).
  const fireLoanMinimumSchedule = buildFixedPaymentSchedule({
    principal: input.fireLoan.balance,
    annualRatePct: input.fireLoan.ratePct,
    periodsPerYear: 12,
    payment: fireLoanRepayment,
  });

  const totalOutgoingsMonthly =
    assessedMonthlyExpenses +
    investmentPropertyExpensesMonthly +
    fireLoanRepayment +
    investmentLoanMonthlyRepayment +
    additionalRepaymentsMonthly;

  const currentPath = toLoanPath(currentSchedule, totalNetMonthlyIncome, assessedMonthlyExpenses, weightedOwnerOccupiedRatePct);
  const acceleratedPath = toLoanPath(acceleratedSchedule, totalNetMonthlyIncome, assessedMonthlyExpenses, input.fireLoan.ratePct);

  const interestSaved =
    currentPath.neverPaysOff || acceleratedPath.neverPaysOff
      ? 0
      : Math.max(0, currentPath.totalInterestPaid - acceleratedPath.totalInterestPaid);

  const interestSavedFromExtraRepayments =
    fireLoanMinimumSchedule.neverPaysOff || acceleratedPath.neverPaysOff
      ? 0
      : Math.max(0, fireLoanMinimumSchedule.totalInterestPaid - acceleratedPath.totalInterestPaid);

  const currentMonths = currentPath.yearsToPayOff.years * 12 + currentPath.yearsToPayOff.months;
  const acceleratedMonths = acceleratedPath.yearsToPayOff.years * 12 + acceleratedPath.yearsToPayOff.months;
  const timeSavedMonths =
    currentPath.neverPaysOff || acceleratedPath.neverPaysOff ? 0 : Math.max(0, currentMonths - acceleratedMonths);

  return {
    totalGrossAnnualIncome,
    salaryGrossAnnualIncome,
    salaryNetMonthlyIncome,
    totalNetMonthlyIncome,
    applicantBreakdown,
    rentalIncomeBreakdown,
    hemMonthlyBenchmark,
    assessedMonthlyExpenses,
    additionalRepaymentsMonthly,
    monthlySurplus,
    ownerOccupiedLoanBalance,
    weightedOwnerOccupiedRatePct,
    ownerOccupiedLoanMonthlyRepayment,
    investmentLoanBalance,
    investmentLoanMonthlyRepayment,
    investmentPropertyExpensesMonthly,
    fireLoanBalance: input.fireLoan.balance,
    fireLoanRepayment,
    currentPath,
    acceleratedPath,
    interestSaved,
    interestSavedFromExtraRepayments,
    timeSavedMonths,
    netServiceabilityRatio: totalOutgoingsMonthly > 0 ? totalNetMonthlyIncome / totalOutgoingsMonthly : null,
    loanToIncome: totalGrossAnnualIncome > 0 ? (ownerOccupiedLoanBalance + investmentLoanBalance) / totalGrossAnnualIncome : null,
  };
}

export function timeSavedYearsMonths(months: number): { years: number; months: number } {
  return periodsToYearsMonths(months, 12);
}
