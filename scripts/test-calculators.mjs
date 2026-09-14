#!/usr/bin/env node --experimental-strip-types
/**
 * Tests for src/lib/calculators/*. Two kinds of check:
 *
 * 1. Self-consistency invariants that must hold regardless of the exact
 *    numbers involved (a fully amortizing loan reaches zero balance by its
 *    last period; extra repayments can never increase total interest; a
 *    bracket-based tax/duty table must be continuous at every bracket
 *    boundary). These don't depend on knowing the "correct" answer in
 *    advance, so they can't be wrong for the same reason the code under
 *    test might be wrong.
 * 2. Specific benchmark figures already asserted in the source files'
 *    own comments (e.g. NT stamp duty on $500,000 = $23,928.60) — this
 *    checks the code actually produces what it claims to, as a regression
 *    test against future edits.
 */
import {
  periodicPayment,
  remainingBalance,
  buildExtraRepaymentPlan,
  buildFixedPaymentSchedule,
  periodsToYearsMonths,
} from "../src/lib/calculators/amortization.ts";
import {
  calculateBorrowingPower,
  emptyDebtAccount,
  estimateAnnualNetIncome,
  marginalTaxRateFor,
  MEDICARE_LEVY_RATE,
} from "../src/lib/calculators/borrowing-power.ts";
import { getHemMonthly } from "../src/lib/calculators/hem-table.ts";
import { calculateStampDuty, AU_STATES } from "../src/lib/calculators/stamp-duty.ts";
import { calculateFireVault } from "../src/lib/calculators/fire-vault.ts";

let failed = 0;
function check(label, condition, detail = "") {
  if (!condition) failed += 1;
  console.log(`  ${condition ? "ok  " : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
}
function close(a, b, tolerance = 0.01) {
  return Math.abs(a - b) <= tolerance;
}

// ---------------------------------------------------------------------------
console.log("\n1. periodicPayment / remainingBalance — self-consistency");
{
  for (const [principal, rate, years, ppy] of [
    [500000, 6, 30, 12],
    [400000, 6.09, 30, 12],
    [750000, 5.5, 25, 26],
    [250000, 8.5, 15, 52],
    [300000, 0, 10, 12], // 0% edge case
  ]) {
    const n = years * ppy;
    const pmt = periodicPayment(principal, rate, n, ppy);
    const balanceAtEnd = remainingBalance(principal, rate, ppy, pmt, n);
    check(
      `$${principal.toLocaleString()} @ ${rate}% / ${years}yr / ${ppy}pa fully amortizes`,
      close(balanceAtEnd, 0, 0.5),
      `payment=${pmt.toFixed(2)}, balance at term end=${balanceAtEnd.toFixed(4)}`,
    );

    // Sum of all payments must equal principal + total interest, and every
    // payment must be strictly positive for a real loan (rate > 0, n > 0).
    if (rate > 0) check(`  payment is positive`, pmt > 0);
    const totalPaid = pmt * n;
    check(`  total paid (${totalPaid.toFixed(2)}) exceeds principal`, totalPaid >= principal - 0.5);
  }

  // Halfway through a fully amortizing loan, the balance must be strictly
  // between 0 and the principal (monotonically decreasing, never negative,
  // never above what was borrowed).
  const pmt = periodicPayment(500000, 6, 360, 12);
  const halfway = remainingBalance(500000, 6, 12, pmt, 180);
  check("balance at halfway point is between 0 and principal", halfway > 0 && halfway < 500000, `${halfway.toFixed(2)}`);
}

console.log("\n2. periodsToYearsMonths");
{
  const cases = [
    [360, 12, { years: 30, months: 0 }],
    [0, 12, { years: 0, months: 0 }],
    [6, 12, { years: 0, months: 6 }],
    [359, 12, { years: 29, months: 11 }],
  ];
  for (const [periods, ppy, expected] of cases) {
    const got = periodsToYearsMonths(periods, ppy);
    check(`${periods} periods @ ${ppy}/yr -> ${expected.years}y ${expected.months}m`, got.years === expected.years && got.months === expected.months, JSON.stringify(got));
  }
}

console.log("\n3. buildExtraRepaymentPlan — invariants");
{
  for (const [principal, rate, years, extra] of [
    [500000, 6, 30, 200],
    [500000, 6, 30, 1000],
    [300000, 4.5, 25, 50],
    [750000, 7.2, 20, 500],
  ]) {
    const totalPeriods = years * 12;
    const minPayment = periodicPayment(principal, rate, totalPeriods, 12);
    const baselineInterest = minPayment * totalPeriods - principal;
    const plan = buildExtraRepaymentPlan({ principal, annualRatePct: rate, totalPeriods, periodsPerYear: 12, extraPerPeriod: extra });

    check(`payoff periods (${plan.payoffPeriods}) <= total periods (${totalPeriods})`, plan.payoffPeriods <= totalPeriods);
    check(`interest saved is positive when extra > 0`, plan.interestSaved > 0, `saved=${plan.interestSaved.toFixed(2)}`);
    check(
      `totalInterestPaid (${plan.totalInterestPaid.toFixed(2)}) < baseline (${baselineInterest.toFixed(2)})`,
      plan.totalInterestPaid < baselineInterest,
    );
    // Reconstructing totalPaid from totalInterestPaid + principal must match the plan's own figure.
    check(`totalPaid reconciles with totalInterestPaid + principal`, close(plan.totalInterestPaid + principal, plan.totalPaid, 0.01));
    // The plan must actually reach (or very nearly reach) zero balance in its own series' last point.
    const lastPoint = plan.series[plan.series.length - 1];
    check(`series' final balance is ~0`, close(lastPoint.balance, 0, 1), `${lastPoint.balance.toFixed(4)}`);
  }

  // Extra repayment that's absurdly large should still resolve to a sane, short payoff (>= 1 period), never throw/NaN.
  const extreme = buildExtraRepaymentPlan({ principal: 100000, annualRatePct: 6, totalPeriods: 360, periodsPerYear: 12, extraPerPeriod: 1_000_000 });
  check("extreme extra repayment doesn't produce NaN", Number.isFinite(extreme.payoffPeriods) && Number.isFinite(extreme.totalPaid));
  check("extreme extra repayment pays off in period 1", extreme.payoffPeriods === 1, `${extreme.payoffPeriods}`);
}

console.log("\n4. Stamp duty — bracket continuity (no jump at any boundary) for every state");
{
  const scenarios = [
    { propertyType: "owner-occupied", purchaseType: "established", isFirstHomeBuyer: false },
    { propertyType: "investment", purchaseType: "established", isFirstHomeBuyer: false },
  ];
  // VIC owner-occupied is a deliberate exception: the Principal Place of
  // Residence rate applies only for $130,001-$550,000 and does NOT taper
  // out above that   a genuine, well-documented cliff in Victorian law
  // (unlike VIC's own FHB concession a few lines below, which does taper).
  // Confirmed by hand: PPR duty at $550,000 is $24,970; the general rate
  // one dollar later is ~$28,070   a real ~$3,100 gap, not a bug.
  const KNOWN_LEGISLATED_CLIFFS = new Set(["VIC:owner-occupied"]);

  for (const state of AU_STATES.map((s) => s.code)) {
    for (const scenario of scenarios) {
      if (KNOWN_LEGISLATED_CLIFFS.has(`${state}:${scenario.propertyType}`)) continue;
      // Sample the duty curve densely and confirm it never has a large
      // discontinuous jump for a tiny change in property value    a classic
      // bug in bracket-table code is a `base` that doesn't match the
      // cumulative duty at the previous bracket's own threshold.
      let prevDuty = null;
      let maxJumpPer1000 = 0;
      for (let value = 10000; value <= 2_000_000; value += 1000) {
        const result = calculateStampDuty({ state, propertyValue: value, ...scenario });
        if (prevDuty !== null) {
          const jump = result.stampDuty - prevDuty;
          // A concession tapering in/out over its own $ window is expected
          // to move faster than the bracket rate; ignore modest jumps and
          // only flag something that looks like a table error (a jump far
          // larger than any real marginal rate times a $1000 step could
          // produce, i.e. paying wildly more duty for $1000 more house).
          if (jump > maxJumpPer1000) maxJumpPer1000 = jump;
        }
        prevDuty = result.stampDuty;
      }
      check(
        `${state} ${scenario.propertyType}: no discontinuous jump across $10k–$2M`,
        maxJumpPer1000 < 500,
        `largest per-$1000-step jump = $${maxJumpPer1000.toFixed(2)}`,
      );
    }
  }
}

console.log("\n5. Stamp duty — benchmark already claimed in the source comments");
{
  // ntDutyUnder525k's own comment: "$500,000 -> $23,928.60"
  const nt = calculateStampDuty({ state: "NT", propertyValue: 500000, isFirstHomeBuyer: false, propertyType: "investment", purchaseType: "established" });
  check("NT $500,000 stamp duty matches the comment's own stated benchmark ($23,928.60)", close(nt.stampDuty, 23928.6, 1), `got $${nt.stampDuty}`);
}

console.log("\n6. Stamp duty — first home buyer concessions never increase duty vs non-FHB");
{
  for (const state of AU_STATES.map((s) => s.code)) {
    for (const value of [400000, 650000, 900000]) {
      const base = { state, propertyValue: value, propertyType: "owner-occupied", purchaseType: "established" };
      const nonFhb = calculateStampDuty({ ...base, isFirstHomeBuyer: false });
      const fhb = calculateStampDuty({ ...base, isFirstHomeBuyer: true });
      check(`${state} $${value.toLocaleString()}: FHB duty (${fhb.stampDuty}) <= non-FHB duty (${nonFhb.stampDuty})`, fhb.stampDuty <= nonFhb.stampDuty);
    }
  }
}

console.log("\n7. HEM table — monotonic in income (never demands less at a higher income band) and dependents");
{
  for (const isJoint of [true, false]) {
    for (const dependents of [0, 1, 2, 3, 5, 10]) {
      let prev = -Infinity;
      for (const income of [10000, 30000, 50000, 80000, 150000, 300000, 500000, 1000000, 2000000]) {
        const hem = getHemMonthly(isJoint, dependents, income);
        check(`${isJoint ? "couple" : "single"}/${dependents} dep, $${income}: HEM (${hem}) >= previous band (${prev})`, hem >= prev - 0.01);
        prev = hem;
      }
    }
  }
  // More dependents at the same income should never demand a lower benchmark.
  const income = 100000;
  let prevByDependents = -Infinity;
  for (let dependents = 0; dependents <= 10; dependents++) {
    const hem = getHemMonthly(true, dependents, income);
    check(`couple, $100k income, ${dependents} dependents: HEM (${hem}) >= fewer dependents (${prevByDependents})`, hem >= prevByDependents - 0.01);
    prevByDependents = hem;
  }
}

console.log("\n8. Borrowing power — sanity and invariants");
{
  const DEFAULT_INPUT = {
    isJoint: false,
    dependents: 0,
    salary1: 100000,
    salary1Frequency: "annually",
    overtimeBonus1: 0,
    overtimeBonus1Frequency: "annually",
    salary2: 0,
    salary2Frequency: "annually",
    overtimeBonus2: 0,
    overtimeBonus2Frequency: "annually",
    otherIncome: 0,
    otherIncomeFrequency: "annually",
    nonTaxableIncome: 0,
    nonTaxableIncomeFrequency: "annually",
    generalLivingExpenses: 2000,
    generalLivingExpensesFrequency: "monthly",
    additionalLivingExpenses: 0,
    additionalLivingExpensesFrequency: "monthly",
    homeLoan: emptyDebtAccount(),
    personalLoan: emptyDebtAccount(),
    hirePurchase: emptyDebtAccount(),
    leaseCarLoan: emptyDebtAccount(),
    otherDebts: emptyDebtAccount(),
    marginLoan: emptyDebtAccount(),
    hecsRepayments: 0,
    hecsRepaymentsFrequency: "monthly",
    otherCommitments: 0,
    otherCommitmentsFrequency: "monthly",
    totalCreditCardLimits: 0,
    bnplLimit: 0,
    bnplCurrentMonthlyRepayment: 0,
    interestRatePct: 6.09,
    rateType: "variable",
    fixedTermYears: 3,
    loanTermYears: 30,
    repaymentBasis: "principal_and_interest",
    interestOnlyYears: 3,
  };

  const base = calculateBorrowingPower(DEFAULT_INPUT);
  check("default scenario: no NaN/Infinity anywhere", Object.values(base).every((v) => typeof v !== "number" || Number.isFinite(v)), JSON.stringify(base));
  check("default scenario: assessed rate >= floor (5.3%)", base.assessedRatePct >= 5.3, `${base.assessedRatePct}`);
  check("default scenario: assessed rate = rate + 3% buffer for variable", close(base.assessedRatePct, 6.09 + 3.0, 0.001), `${base.assessedRatePct}`);
  check("default scenario: max loan is a positive, round-thousand figure", base.maxLoanAmount > 0 && base.maxLoanAmount % 1000 === 0, `${base.maxLoanAmount}`);

  // Higher income -> strictly more (or equal) borrowing power, all else equal.
  const higherIncome = calculateBorrowingPower({ ...DEFAULT_INPUT, salary1: 200000 });
  check("higher income -> higher max loan", higherIncome.maxLoanAmount >= base.maxLoanAmount, `${base.maxLoanAmount} -> ${higherIncome.maxLoanAmount}`);

  // More existing debt -> strictly less (or equal) borrowing power.
  const withDebt = calculateBorrowingPower({
    ...DEFAULT_INPUT,
    personalLoan: { limit: 30000, ratePct: 12, termYears: 5, currentMonthlyRepayment: 0 },
  });
  check("adding existing debt -> lower (or equal) max loan", withDebt.maxLoanAmount <= base.maxLoanAmount, `${base.maxLoanAmount} -> ${withDebt.maxLoanAmount}`);

  // Interest-only borrowing power must never exceed P&I borrowing power for
  // the same inputs    an IO loan is assessed more conservatively (P&I over
  // a shorter remaining term), never more generously.
  const ioResult = calculateBorrowingPower({ ...DEFAULT_INPUT, repaymentBasis: "interest_only", interestOnlyYears: 3 });
  check("interest-only max loan <= P&I max loan", ioResult.maxLoanAmount <= base.maxLoanAmount, `IO=${ioResult.maxLoanAmount}, P&I=${base.maxLoanAmount}`);

  // More dependents -> lower (or equal) borrowing power (higher HEM floor).
  const withDependents = calculateBorrowingPower({ ...DEFAULT_INPUT, dependents: 3 });
  check("more dependents -> lower (or equal) max loan", withDependents.maxLoanAmount <= base.maxLoanAmount, `${base.maxLoanAmount} -> ${withDependents.maxLoanAmount}`);

  // A joint application with a real second income should out-borrow a single
  // applicant with the same primary income.
  const joint = calculateBorrowingPower({ ...DEFAULT_INPUT, isJoint: true, salary2: 80000, salary2Frequency: "annually" });
  check("joint application with second income -> higher max loan", joint.maxLoanAmount >= base.maxLoanAmount, `${base.maxLoanAmount} -> ${joint.maxLoanAmount}`);

  // Zero/negative income shouldn't crash or go negative.
  const zeroIncome = calculateBorrowingPower({ ...DEFAULT_INPUT, salary1: 0 });
  check("zero income -> zero max loan, no crash", zeroIncome.maxLoanAmount === 0, `${zeroIncome.maxLoanAmount}`);
}

console.log("\n9. FIRE Vault — marginalTaxRateFor bracket boundaries");
{
  const cases = [
    [0, 0],
    [10000, 0],
    [18200, 0],
    [30000, 0.15],
    [45000, 0.15],
    [100000, 0.3],
    [135000, 0.3],
    [160000, 0.37],
    [190000, 0.37],
    [250000, 0.45],
  ];
  for (const [gross, expectedRate] of cases) {
    check(`marginalTaxRateFor($${gross.toLocaleString()}) = ${expectedRate}`, close(marginalTaxRateFor(gross), expectedRate, 0.001));
  }
}

console.log("\n10. FIRE Vault — buildFixedPaymentSchedule invariants");
{
  // A payment that fully covers a standard amortizing PMT must fully pay off within that same term.
  const principal = 500000;
  const rate = 6;
  const term = 360;
  const minPayment = periodicPayment(principal, rate, term, 12);
  const exact = buildFixedPaymentSchedule({ principal, annualRatePct: rate, periodsPerYear: 12, payment: minPayment });
  check("payment = standard PMT pays off at (or just after) the standard term", Math.abs(exact.payoffPeriods - term) <= 2, `${exact.payoffPeriods} vs ${term}`);
  check("payoff schedule's final balance is ~0", close(exact.series[exact.series.length - 1].balance, 0, 1));
  check("totalPaid reconciles with totalInterestPaid + principal", close(exact.totalInterestPaid + principal, exact.totalPaid, 0.5));

  // A bigger payment must never take longer to pay off (monotonic in payment).
  const bigger = buildFixedPaymentSchedule({ principal, annualRatePct: rate, periodsPerYear: 12, payment: minPayment * 2 });
  check("doubling the payment pays off in fewer (or equal) periods", bigger.payoffPeriods <= exact.payoffPeriods, `${bigger.payoffPeriods} vs ${exact.payoffPeriods}`);
  check("doubling the payment never doesn't-pay-off when the original did", !bigger.neverPaysOff);

  // A payment below the first period's interest can never pay the loan off.
  const tooSmall = buildFixedPaymentSchedule({ principal, annualRatePct: rate, periodsPerYear: 12, payment: (principal * rate) / 100 / 12 - 1 });
  check("payment below first-period interest never pays off", tooSmall.neverPaysOff === true);

  // Zero principal is a no-op, not a crash.
  const zero = buildFixedPaymentSchedule({ principal: 0, annualRatePct: rate, periodsPerYear: 12, payment: 1000 });
  check("zero principal pays off immediately with no NaN", zero.payoffPeriods === 0 && Number.isFinite(zero.totalPaid));

  // An enormous payment pays off almost immediately, never throws/NaN.
  const huge = buildFixedPaymentSchedule({ principal: 50000, annualRatePct: rate, periodsPerYear: 12, payment: 1_000_000 });
  check("enormous payment pays off in period 1, no NaN", huge.payoffPeriods === 1 && Number.isFinite(huge.totalPaid));

  // Increasing the rate while holding payment fixed must never shorten the payoff.
  const lowerRate = buildFixedPaymentSchedule({ principal, annualRatePct: 4, periodsPerYear: 12, payment: minPayment });
  const higherRate = buildFixedPaymentSchedule({ principal, annualRatePct: 8, periodsPerYear: 12, payment: minPayment });
  check(
    "higher rate at the same payment never pays off faster than a lower rate",
    higherRate.neverPaysOff || lowerRate.payoffPeriods <= higherRate.payoffPeriods,
    `${lowerRate.payoffPeriods} vs ${higherRate.payoffPeriods} (higherNeverPaysOff=${higherRate.neverPaysOff})`,
  );
}

console.log("\n11. FIRE Vault — calculateFireVault: scale, edge cases and invariants");
{
  function baseInput(overrides = {}) {
    return {
      applicants: [{ grossSalary: 100000, additionalIncome: 0 }],
      properties: [],
      dependents: 0,
      useHemBenchmark: true,
      manualMonthlyExpenses: 2500,
      loans: [{ balance: 500000, ratePct: 6, termYears: 30, monthlyRepayment: 3000 }],
      carLoanMonthly: 0,
      personalLoanMonthly: 0,
      creditCardLimit: 0,
      fireVaultRatePct: 5,
      ...overrides,
    };
  }

  // Zero loans: nothing to pay off, no NaN, immediate "payoff".
  const noLoans = calculateFireVault(baseInput({ loans: [] }));
  check("zero loans -> zero combined balance", noLoans.combinedLoanBalance === 0);
  check("zero loans -> current path payoff is immediate, no NaN", noLoans.currentPath.yearsToPayOff.years === 0 && Number.isFinite(noLoans.currentPath.totalAmount));
  check("zero loans -> accelerated path payoff is immediate, no NaN", noLoans.acceleratedPath.yearsToPayOff.years === 0 && Number.isFinite(noLoans.acceleratedPath.totalAmount));

  // Maximal shape: 4 applicants, 10 properties, 10 loans   must not crash, totals must sum correctly.
  const maxed = calculateFireVault(
    baseInput({
      applicants: Array.from({ length: 4 }, () => ({ grossSalary: 90000, additionalIncome: 5000 })),
      properties: Array.from({ length: 10 }, () => ({ weeklyRent: 500, monthlyExpenses: 400 })),
      loans: Array.from({ length: 10 }, () => ({ balance: 100000, ratePct: 6, termYears: 25, monthlyRepayment: 650 })),
      dependents: 3,
    }),
  );
  check("4 applicants x $95,000 gross each -> total gross income sums correctly", close(maxed.totalGrossAnnualIncome, 4 * 95000 + 10 * 500 * 52, 1), `${maxed.totalGrossAnnualIncome}`);
  check("10 loans of $100,000 -> combined balance = $1,000,000", close(maxed.combinedLoanBalance, 1000000, 1));
  check("10 loans of $650/mo -> combined current repayment = $6,500/mo", close(maxed.combinedCurrentMonthlyRepayment, 6500, 1));
  check("maximal scenario produces no NaN in any numeric field", [
    maxed.totalNetMonthlyIncome, maxed.assessedMonthlyExpenses, maxed.monthlySurplus, maxed.combinedLoanBalance,
  ].every((v) => Number.isFinite(v)));

  // HEM toggle: switching to manual uses exactly the manual figure, not a floor.
  const hemOn = calculateFireVault(baseInput({ useHemBenchmark: true }));
  const hemOff = calculateFireVault(baseInput({ useHemBenchmark: false, manualMonthlyExpenses: 1 }));
  check("HEM benchmark applied when toggled on", close(hemOn.assessedMonthlyExpenses, hemOn.hemMonthlyBenchmark, 0.01));
  check("manual override used as-is (no floor) when toggled off", close(hemOff.assessedMonthlyExpenses, 1, 0.01), `${hemOff.assessedMonthlyExpenses}`);

  // More dependents -> higher (or equal) HEM benchmark -> lower (or equal) surplus, all else equal.
  const fewDependents = calculateFireVault(baseInput({ dependents: 0 }));
  const manyDependents = calculateFireVault(baseInput({ dependents: 3 }));
  check("more dependents -> lower (or equal) monthly surplus", manyDependents.monthlySurplus <= fewDependents.monthlySurplus, `${fewDependents.monthlySurplus} -> ${manyDependents.monthlySurplus}`);

  // Adding a property with strong positive rent should increase total gross income and net income.
  const withProperty = calculateFireVault(baseInput({ properties: [{ weeklyRent: 700, monthlyExpenses: 300 }] }));
  const noProperty = calculateFireVault(baseInput({ properties: [] }));
  check("adding a rental property -> higher total gross income", withProperty.totalGrossAnnualIncome > noProperty.totalGrossAnnualIncome);
  check("adding a rental property -> higher net monthly income", withProperty.totalNetMonthlyIncome > noProperty.totalNetMonthlyIncome);

  // Additional (bonus) income nets out to exactly the marginal-rate formula this engine claims to use.
  const bonusCase = calculateFireVault(baseInput({ applicants: [{ grossSalary: 120000, additionalIncome: 5000 }] }));
  const expectedNet = estimateAnnualNetIncome(120000) + 5000 * (1 - marginalTaxRateFor(120000) - MEDICARE_LEVY_RATE);
  check("bonus income taxed at the marginal rate of the base salary's bracket", close(bonusCase.applicantBreakdown[0].netAnnual, expectedNet, 1), `${bonusCase.applicantBreakdown[0].netAnnual} vs ${expectedNet}`);

  // A higher FIRE Vault rate (payment held via surplus, not directly comparable) — instead assert
  // a lower rate on the SAME surplus never pays off slower than a higher one (same invariant as
  // the raw amortization check above, exercised through the full household pipeline this time).
  const lowerFvRate = calculateFireVault(baseInput({ fireVaultRatePct: 3 }));
  const higherFvRate = calculateFireVault(baseInput({ fireVaultRatePct: 9 }));
  const lowerMonths = lowerFvRate.acceleratedPath.yearsToPayOff.years * 12 + lowerFvRate.acceleratedPath.yearsToPayOff.months;
  const higherMonths = higherFvRate.acceleratedPath.yearsToPayOff.years * 12 + higherFvRate.acceleratedPath.yearsToPayOff.months;
  check(
    "higher FIRE Vault rate never pays off faster than a lower one, surplus held equal",
    higherFvRate.acceleratedPath.neverPaysOff || lowerMonths <= higherMonths,
    `${lowerMonths} vs ${higherMonths}`,
  );

  // Insufficient surplus (huge expenses relative to income) must report neverPaysOff cleanly, not crash.
  const insufficientSurplus = calculateFireVault(
    baseInput({ useHemBenchmark: false, manualMonthlyExpenses: 20000, applicants: [{ grossSalary: 60000, additionalIncome: 0 }] }),
  );
  check("insufficient surplus -> negative monthlySurplus, no crash", insufficientSurplus.monthlySurplus < 0);
  check("insufficient surplus -> accelerated path reports neverPaysOff", insufficientSurplus.acceleratedPath.neverPaysOff === true);
  check("insufficient surplus -> interestSaved falls back to 0, not NaN", insufficientSurplus.interestSaved === 0);

  // Zero income across the board must not crash or go negative.
  const zeroIncome = calculateFireVault(baseInput({ applicants: [{ grossSalary: 0, additionalIncome: 0 }] }));
  check("zero income -> zero net income, no crash", zeroIncome.totalNetMonthlyIncome === 0);
  check("zero income -> NSR/LTI/DTI still finite or null, never NaN", [zeroIncome.netServiceabilityRatio, zeroIncome.loanToIncome, zeroIncome.debtToIncome].every((v) => v === null || Number.isFinite(v)));
}

console.log("\n12. FIRE Vault — regression anchor against the real rapidpay.infinity.com.au output");
{
  // Reproduces the exact scenario tested live against rapidpay.infinity.com.au in-session:
  // $500,000 balance, 6.5% current rate, $3,200/month current repayment, 5.5% target rate,
  // couple + 2 kids, $120k+$5k / $90k incomes. The live site reported (for its "Disgusting Bank
  // Loan", i.e. the plain current-repayment amortization   independent of any tax/HEM choice, so
  // directly comparable): 29 years 0 months, $1,110,400 total, $609,569 total interest.
  const anchor = calculateFireVault({
    applicants: [
      { grossSalary: 120000, additionalIncome: 5000 },
      { grossSalary: 90000, additionalIncome: 0 },
    ],
    properties: [],
    dependents: 2,
    useHemBenchmark: true,
    manualMonthlyExpenses: 0,
    loans: [{ balance: 500000, ratePct: 6.5, termYears: 30, monthlyRepayment: 3200 }],
    carLoanMonthly: 0,
    personalLoanMonthly: 0,
    creditCardLimit: 0,
    fireVaultRatePct: 5.5,
  });

  check(
    "current path payoff time matches the live RapidPay result (29y0m) within 1 month",
    Math.abs((anchor.currentPath.yearsToPayOff.years * 12 + anchor.currentPath.yearsToPayOff.months) - 29 * 12) <= 1,
    `${anchor.currentPath.yearsToPayOff.years}y ${anchor.currentPath.yearsToPayOff.months}m`,
  );
  check(
    "current path total interest is within $5,000 of the live RapidPay result ($609,569)",
    Math.abs(anchor.currentPath.totalInterestPaid - 609569) < 5000,
    `$${anchor.currentPath.totalInterestPaid.toFixed(0)}`,
  );
  check(
    "current path total amount is within $5,000 of the live RapidPay result ($1,110,400)",
    Math.abs(anchor.currentPath.totalAmount - 1110400) < 5000,
    `$${anchor.currentPath.totalAmount.toFixed(0)}`,
  );

  // The accelerated path isn't expected to match RapidPay cent-for-cent (this engine
  // deliberately uses newer 2026-27 tax brackets and the site's own income-banded HEM table
  // rather than RapidPay's flat regional figure) — assert it's directionally sane instead.
  check("accelerated path pays off faster than the current path", !anchor.acceleratedPath.neverPaysOff);
  const currentMonthsAnchor = anchor.currentPath.yearsToPayOff.years * 12 + anchor.currentPath.yearsToPayOff.months;
  const acceleratedMonthsAnchor = anchor.acceleratedPath.yearsToPayOff.years * 12 + anchor.acceleratedPath.yearsToPayOff.months;
  check(
    "accelerated path is dramatically shorter (in the same ballpark as RapidPay's own ~5x speed-up)",
    acceleratedMonthsAnchor < currentMonthsAnchor / 2,
    `${acceleratedMonthsAnchor} vs ${currentMonthsAnchor} months`,
  );
  check("accelerated path payoff lands in a plausible 3-10 year range", acceleratedMonthsAnchor >= 3 * 12 && acceleratedMonthsAnchor <= 10 * 12, `${(acceleratedMonthsAnchor / 12).toFixed(1)} years`);
}

console.log("\n13. FIRE Vault — 20-scenario validation pass (explicit, varied numbers)");
{
  function baseInput(overrides = {}) {
    return {
      applicants: [{ grossSalary: 100000, additionalIncome: 0 }],
      properties: [],
      dependents: 0,
      useHemBenchmark: true,
      manualMonthlyExpenses: 2500,
      loans: [{ balance: 500000, ratePct: 6.09, termYears: 30, termMonths: 0, monthlyRepayment: 3000 }],
      carLoanMonthly: 0,
      personalLoanMonthly: 0,
      creditCardLimit: 0,
      fireVaultRatePct: 6.09,
      ...overrides,
    };
  }
  const applicant = (grossSalary, additionalIncome = 0) => ({ grossSalary, additionalIncome });
  const property = (weeklyRent, monthlyExpenses = 0) => ({ weeklyRent, monthlyExpenses });
  const loan = (balance, ratePct, monthlyRepayment, termYears = 30) => ({ balance, ratePct, termYears, termMonths: 0, monthlyRepayment });

  // 1: the new site-wide default rate (6.09%) on a single round-number loan   basic sanity, no NaN.
  {
    const r = calculateFireVault(baseInput());
    check("#1 default 6.09% scenario: no NaN, combined balance = $500,000", Number.isFinite(r.monthlySurplus) && r.combinedLoanBalance === 500000);
  }

  // 2-5: applicant count 1/2/3/4, same $100k per applicant each time   total gross income must scale exactly with count.
  for (const count of [1, 2, 3, 4]) {
    const r = calculateFireVault(baseInput({ applicants: Array.from({ length: count }, () => applicant(100000)) }));
    check(`#${count + 1} ${count} applicant(s) @ $100k each -> total gross = $${count * 100000}`, close(r.totalGrossAnnualIncome, count * 100000, 1), `${r.totalGrossAnnualIncome}`);
    check(`  applicant breakdown has exactly ${count} row(s)`, r.applicantBreakdown.length === count);
  }

  // 6-9: property count 0/3/7/10 @ $400/week each   total gross income must include exactly count*400*52.
  for (const count of [0, 3, 7, 10]) {
    const r = calculateFireVault(baseInput({ properties: Array.from({ length: count }, () => property(400, 200)) }));
    const expectedGross = 100000 + count * 400 * 52;
    check(`#${count === 0 ? 6 : count === 3 ? 7 : count === 7 ? 8 : 9} ${count} propert${count === 1 ? "y" : "ies"} @ $400/wk -> total gross = $${expectedGross}`, close(r.totalGrossAnnualIncome, expectedGross, 1), `${r.totalGrossAnnualIncome}`);
    check(`  property expenses/mo = $${count * 200}`, close(r.propertyExpensesMonthly, count * 200, 1));
  }

  // 10-13: loan count 1/4/7/10, each $200k @ 6% with $1,200/mo repayment   combined figures must sum exactly.
  const loanCountLabels = { 1: 10, 4: 11, 7: 12, 10: 13 };
  for (const count of [1, 4, 7, 10]) {
    const r = calculateFireVault(baseInput({ loans: Array.from({ length: count }, () => loan(200000, 6, 1200)) }));
    check(`#${loanCountLabels[count]} ${count} loan(s) of $200k @ 6% -> combined balance = $${count * 200000}`, close(r.combinedLoanBalance, count * 200000, 1));
    check(`  weighted rate stays 6% regardless of count`, close(r.weightedCurrentRatePct, 6, 0.001));
    check(`  combined repayment = $${count * 1200}/mo`, close(r.combinedCurrentMonthlyRepayment, count * 1200, 1));
  }

  // 14: HEM toggle on vs manual override with the exact same manual figure as the benchmark   results must match.
  {
    const withHem = calculateFireVault(baseInput({ useHemBenchmark: true }));
    const withManualEqual = calculateFireVault(baseInput({ useHemBenchmark: false, manualMonthlyExpenses: withHem.hemMonthlyBenchmark }));
    check("#14 manual expense equal to HEM benchmark -> identical assessed expenses", close(withHem.assessedMonthlyExpenses, withManualEqual.assessedMonthlyExpenses, 0.01));
  }

  // 15: more dependents -> HEM benchmark strictly increases (or stays equal), never decreases.
  {
    const r0 = calculateFireVault(baseInput({ dependents: 0 }));
    const r3 = calculateFireVault(baseInput({ dependents: 3 }));
    check("#15 3 dependents -> HEM benchmark >= 0 dependents", r3.hemMonthlyBenchmark >= r0.hemMonthlyBenchmark, `${r0.hemMonthlyBenchmark} -> ${r3.hemMonthlyBenchmark}`);
  }

  // 16: insufficient surplus at the new 6.09% default rate   must degrade cleanly, not crash.
  {
    const r = calculateFireVault(baseInput({ applicants: [applicant(40000)], useHemBenchmark: false, manualMonthlyExpenses: 15000 }));
    check("#16 insufficient surplus at 6.09% -> neverPaysOff, no NaN elsewhere", r.acceleratedPath.neverPaysOff === true && Number.isFinite(r.monthlySurplus));
  }

  // 17: maximal realistic scale   4 applicants, 10 properties, 10 loans, all with large but plausible figures.
  {
    const r = calculateFireVault(
      baseInput({
        applicants: Array.from({ length: 4 }, () => applicant(150000, 20000)),
        properties: Array.from({ length: 10 }, () => property(900, 500)),
        loans: Array.from({ length: 10 }, () => loan(300000, 6.5, 1900)),
        dependents: 2,
      }),
    );
    check("#17 maximal scale -> no NaN/Infinity in any headline figure", [r.totalGrossAnnualIncome, r.totalNetMonthlyIncome, r.monthlySurplus, r.combinedLoanBalance].every((v) => Number.isFinite(v)));
    check("#17 maximal scale -> combined balance = $3,000,000", close(r.combinedLoanBalance, 3000000, 1));
  }

  // 18: everything zero   the true baseline, must not crash or divide by zero.
  {
    const r = calculateFireVault(baseInput({ applicants: [applicant(0)], loans: [], useHemBenchmark: false, manualMonthlyExpenses: 0 }));
    check("#18 all-zero baseline -> zero income, zero balance, no crash", r.totalNetMonthlyIncome === 0 && r.combinedLoanBalance === 0);
    check("#18 all-zero baseline -> NSR/LTI/DTI are null (no income/debt to ratio), never NaN", r.netServiceabilityRatio === null && r.loanToIncome === null && r.debtToIncome === null);
  }

  // 19: FIRE Vault rate swept from 1% to 15%   payoff time must be monotonically non-decreasing as rate rises (surplus held fixed).
  {
    const rates = [1, 3, 6.09, 9, 12, 15];
    let prevMonths = -Infinity;
    for (const rate of rates) {
      const r = calculateFireVault(baseInput({ fireVaultRatePct: rate }));
      if (!r.acceleratedPath.neverPaysOff) {
        const months = r.acceleratedPath.yearsToPayOff.years * 12 + r.acceleratedPath.yearsToPayOff.months;
        check(`#19 rate ${rate}%: payoff months (${months}) >= previous rate's (${prevMonths === -Infinity ? "n/a" : prevMonths})`, prevMonths === -Infinity || months >= prevMonths, `${prevMonths} -> ${months}`);
        prevMonths = months;
      }
    }
  }

  // 20: hand-computed exact tax check   $80,000 salary via the 2026-27 brackets: 4020 + (80000-45000)*0.30 = 14,520 tax; -2% Medicare ($1,600) -> $63,880 net.
  {
    const r = calculateFireVault(baseInput({ applicants: [applicant(80000)] }));
    check("#20 $80,000 salary nets exactly $63,880 (hand-computed against the 2026-27 bracket table)", close(r.applicantBreakdown[0].netAnnual, 63880, 1), `${r.applicantBreakdown[0].netAnnual}`);
  }
}

console.log(`\n${failed === 0 ? "PASSED" : "FAILED"} — ${failed} failing assertion(s)\n`);
process.exit(failed === 0 ? 0 : 1);
