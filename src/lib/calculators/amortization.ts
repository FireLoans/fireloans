export type RepaymentFrequency = "weekly" | "fortnightly" | "monthly";

export const PERIODS_PER_YEAR: Record<RepaymentFrequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
};

/** Standard reducing-balance principal & interest payment per period. */
export function periodicPayment(principal: number, annualRatePct: number, totalPeriods: number, periodsPerYear: number): number {
  const r = annualRatePct / 100 / periodsPerYear;
  if (totalPeriods <= 0) return 0;
  if (r === 0) return principal / totalPeriods;
  const factor = Math.pow(1 + r, totalPeriods);
  return (principal * r * factor) / (factor - 1);
}

/** Remaining balance after `periodsElapsed` payments of `payment` at rate `annualRatePct`. */
export function remainingBalance(
  principal: number,
  annualRatePct: number,
  periodsPerYear: number,
  payment: number,
  periodsElapsed: number
): number {
  const r = annualRatePct / 100 / periodsPerYear;
  if (periodsElapsed <= 0) return principal;
  if (r === 0) return Math.max(0, principal - payment * periodsElapsed);
  const factor = Math.pow(1 + r, periodsElapsed);
  const balance = principal * factor - payment * ((factor - 1) / r);
  return Math.max(0, balance);
}

export type BalancePoint = { period: number; year: number; balance: number; cumulativePaid: number };

/**
 * Builds a yearly balance series for charting, supporting a rate change at
 * `rateChangeAtPeriod` (used for intro/honeymoon-rate loans)   the payment is
 * recalculated on the remaining balance over the remaining term once the
 * rate changes, matching how real lenders reamortize a loan.
 */
export function buildAmortizationSeries(params: {
  principal: number;
  annualRatePct: number;
  totalPeriods: number;
  periodsPerYear: number;
  secondRatePct?: number;
  rateChangeAtPeriod?: number;
}): { series: BalancePoint[]; firstPayment: number; secondPayment: number | null } {
  const { principal, annualRatePct, totalPeriods, periodsPerYear, secondRatePct, rateChangeAtPeriod } = params;

  const firstPayment = periodicPayment(principal, annualRatePct, totalPeriods, periodsPerYear);
  const hasRateChange =
    typeof secondRatePct === "number" && typeof rateChangeAtPeriod === "number" && rateChangeAtPeriod < totalPeriods;

  let secondPayment: number | null = null;
  let balanceAtChange = principal;
  if (hasRateChange) {
    balanceAtChange = remainingBalance(principal, annualRatePct, periodsPerYear, firstPayment, rateChangeAtPeriod!);
    secondPayment = periodicPayment(balanceAtChange, secondRatePct!, totalPeriods - rateChangeAtPeriod!, periodsPerYear);
  }

  const series: BalancePoint[] = [];
  let cumulativePaid = 0;
  const yearsTotal = Math.ceil(totalPeriods / periodsPerYear);

  for (let year = 0; year <= yearsTotal; year++) {
    const period = Math.min(year * periodsPerYear, totalPeriods);
    let balance: number;
    if (!hasRateChange || period <= rateChangeAtPeriod!) {
      balance = remainingBalance(principal, annualRatePct, periodsPerYear, firstPayment, period);
      cumulativePaid = firstPayment * period;
    } else {
      const periodsIntoSecond = period - rateChangeAtPeriod!;
      balance = remainingBalance(balanceAtChange, secondRatePct!, periodsPerYear, secondPayment!, periodsIntoSecond);
      cumulativePaid = firstPayment * rateChangeAtPeriod! + secondPayment! * periodsIntoSecond;
    }
    series.push({ period, year, balance, cumulativePaid });
  }

  return { series, firstPayment, secondPayment };
}

/** Converts a period count into whole years + remainder months, rounding once at the total-months level (not per-field) so e.g. 11.6 months carries into the next year instead of ever displaying "13 months". */
export function periodsToYearsMonths(periods: number, periodsPerYear: number): { years: number; months: number } {
  const totalMonths = Math.round((periods / periodsPerYear) * 12);
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

export type FixedPaymentSchedule = {
  payoffPeriods: number;
  payoffTime: { years: number; months: number };
  totalInterestPaid: number;
  totalPaid: number;
  series: BalancePoint[];
  /** True if `payment` doesn't even cover the first period's interest, so the balance never reduces. */
  neverPaysOff: boolean;
};

/**
 * Schedules a loan paid at a constant, arbitrary `payment` per period (rather than the
 * payment solved to fully amortize over a given term) — the shape a "redirect 100% of
 * surplus cash flow to the loan" acceleration product needs, where the payment amount is
 * an external input (household surplus), not derived from a target payoff term. Capped at
 * `maxPeriods` (default 40 years' worth) so a too-small payment can't loop indefinitely.
 */
export function buildFixedPaymentSchedule(params: {
  principal: number;
  annualRatePct: number;
  periodsPerYear: number;
  payment: number;
  maxPeriods?: number;
}): FixedPaymentSchedule {
  const { principal, annualRatePct, periodsPerYear, payment, maxPeriods = 40 * periodsPerYear } = params;
  const r = annualRatePct / 100 / periodsPerYear;

  if (principal <= 0) {
    return { payoffPeriods: 0, payoffTime: { years: 0, months: 0 }, totalInterestPaid: 0, totalPaid: 0, series: [{ period: 0, year: 0, balance: 0, cumulativePaid: 0 }], neverPaysOff: false };
  }

  const firstPeriodInterest = principal * r;
  if (payment <= firstPeriodInterest) {
    // Payment doesn't even cover interest on day one — balance would grow forever.
    return {
      payoffPeriods: maxPeriods,
      payoffTime: periodsToYearsMonths(maxPeriods, periodsPerYear),
      totalInterestPaid: NaN,
      totalPaid: NaN,
      series: [{ period: 0, year: 0, balance: principal, cumulativePaid: 0 }],
      neverPaysOff: true,
    };
  }

  const series: BalancePoint[] = [{ period: 0, year: 0, balance: principal, cumulativePaid: 0 }];
  let balance = principal;
  let cumulativePaid = 0;
  let period = 0;

  while (balance > 0.005 && period < maxPeriods) {
    period += 1;
    const interest = balance * r;
    const principalPortion = Math.min(balance, payment - interest);
    const actualPayment = interest + principalPortion;
    balance = Math.max(0, balance - principalPortion);
    cumulativePaid += actualPayment;

    // Only checkpoint at the END of a full calendar year (period is an exact multiple of
    // periodsPerYear), or at the exact moment of payoff   never at the START of a year, which
    // would record a "year" row after just one period had elapsed.
    const isYearEnd = period % periodsPerYear === 0;
    if (isYearEnd || balance === 0) {
      const year = Math.ceil(period / periodsPerYear);
      series.push({ period, year, balance, cumulativePaid });
    }
  }

  return {
    payoffPeriods: period,
    payoffTime: periodsToYearsMonths(period, periodsPerYear),
    totalInterestPaid: cumulativePaid - principal,
    totalPaid: cumulativePaid,
    series,
    neverPaysOff: false,
  };
}

export type ExtraRepaymentPlan = {
  minPayment: number;
  paymentWithExtra: number;
  payoffPeriods: number;
  payoffTime: { years: number; months: number };
  totalInterestPaid: number;
  totalPaid: number;
  interestSaved: number;
  timeSaved: { years: number; months: number };
  series: BalancePoint[];
};

/**
 * Extra-repayment payoff plan, using the same reducing-balance formula every
 * Australian lender's calculator (ING's Extra Repayments calculator included)
 * relies on: a constant periodic payment against a compounding balance is a
 * closed-form geometric series, so paying `extraPerPeriod` more each period
 * is equivalent to re-running `remainingBalance` with the larger payment and
 * solving for the period where it hits zero, rather than a period-by-period
 * simulation loop.
 */
export function buildExtraRepaymentPlan(params: {
  principal: number;
  annualRatePct: number;
  totalPeriods: number;
  periodsPerYear: number;
  extraPerPeriod: number;
}): ExtraRepaymentPlan {
  const { principal, annualRatePct, totalPeriods, periodsPerYear, extraPerPeriod } = params;
  const r = annualRatePct / 100 / periodsPerYear;
  const minPayment = periodicPayment(principal, annualRatePct, totalPeriods, periodsPerYear);
  const paymentWithExtra = minPayment + Math.max(0, extraPerPeriod);
  const baselineInterest = minPayment * totalPeriods - principal;

  let payoffPeriods = totalPeriods;
  if (extraPerPeriod > 0 && paymentWithExtra > principal * r) {
    const exactPeriods =
      r === 0
        ? principal / paymentWithExtra
        : Math.log(paymentWithExtra / (paymentWithExtra - principal * r)) / Math.log(1 + r);
    payoffPeriods = Math.min(totalPeriods, Math.max(1, Math.ceil(exactPeriods - 1e-9)));
  }

  // The closed-form balance is exact only up to the second-last period — the final
  // payment is simulated directly so it clears the remaining balance exactly rather
  // than overshooting into negative territory.
  const balanceBeforeLast = remainingBalance(principal, annualRatePct, periodsPerYear, paymentWithExtra, payoffPeriods - 1);
  const interestOnLast = balanceBeforeLast * r;
  const lastPayment = Math.min(paymentWithExtra, balanceBeforeLast + interestOnLast);
  const totalPaid = paymentWithExtra * (payoffPeriods - 1) + lastPayment;
  const totalInterestPaid = totalPaid - principal;

  const yearsTotal = Math.ceil(totalPeriods / periodsPerYear);
  const series: BalancePoint[] = [];
  for (let year = 0; year <= yearsTotal; year++) {
    const period = Math.min(year * periodsPerYear, totalPeriods);
    let balance: number;
    let cumulativePaid: number;
    if (period >= payoffPeriods) {
      balance = 0;
      cumulativePaid = totalPaid;
    } else {
      balance = remainingBalance(principal, annualRatePct, periodsPerYear, paymentWithExtra, period);
      cumulativePaid = paymentWithExtra * period;
    }
    series.push({ period, year, balance, cumulativePaid });
  }

  const payoffTime = periodsToYearsMonths(payoffPeriods, periodsPerYear);
  const baselineTime = periodsToYearsMonths(totalPeriods, periodsPerYear);
  const savedMonthsTotal = baselineTime.years * 12 + baselineTime.months - (payoffTime.years * 12 + payoffTime.months);

  return {
    minPayment,
    paymentWithExtra,
    payoffPeriods,
    payoffTime,
    totalInterestPaid,
    totalPaid,
    interestSaved: Math.max(0, baselineInterest - totalInterestPaid),
    timeSaved: { years: Math.floor(Math.max(0, savedMonthsTotal) / 12), months: Math.max(0, savedMonthsTotal) % 12 },
    series,
  };
}
