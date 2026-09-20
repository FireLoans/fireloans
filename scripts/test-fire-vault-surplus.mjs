// Verifies FIRE Vault's Monthly Surplus formula against 10 independently varied scenarios.
// Run: npm run test:fire-vault-surplus
import { calculateFireVault } from "../src/lib/calculators/fire-vault.ts";

function approxEqual(a, b, epsilon = 0.02) {
  return Math.abs(a - b) <= epsilon;
}

function baseInput(overrides = {}) {
  return {
    applicants: [{ grossSalary: 100000, additionalIncome: 0 }],
    rentalIncomes: [],
    dependents: 0,
    location: "rest_of_australia",
    useHemBenchmark: true,
    manualMonthlyExpenses: 2500,
    ownerOccupiedLoans: [{ balance: 500000, ratePct: 6.5, termYears: 30, termMonths: 0, monthlyRepayment: 3200 }],
    investmentLoans: [],
    fireLoan: { balance: 500000, ratePct: 6.09, termYears: 30, termMonths: 0, monthlyRepayment: 0 },
    carLoanMonthly: 0,
    personalLoanMonthly: 0,
    ...overrides,
  };
}

const scenarios = [
  {
    name: "1. Single applicant, no rental, no investment, no additional",
    input: baseInput(),
  },
  {
    name: "2. Two applicants + rental income, no investment loan",
    input: baseInput({
      applicants: [
        { grossSalary: 175000, additionalIncome: 0 },
        { grossSalary: 77200, additionalIncome: 0 },
      ],
      rentalIncomes: [{ weeklyRent: 1040 }],
      dependents: 1,
    }),
  },
  {
    name: "3. Boss's exact reference scenario (with investment loan IO + property expenses)",
    input: baseInput({
      applicants: [
        { grossSalary: 175000, additionalIncome: 0 },
        { grossSalary: 77200, additionalIncome: 0 },
      ],
      rentalIncomes: [{ weeklyRent: 1040 }],
      ownerOccupiedLoans: [{ balance: 1358000, ratePct: 6.31, termYears: 29, termMonths: 6, monthlyRepayment: 8507 }],
      fireLoan: { balance: 1358000, ratePct: 5.73, termYears: 29, termMonths: 0, monthlyRepayment: 0 },
      investmentLoans: [
        { balance: 625000, ratePct: 6.57, termYears: 29, termMonths: 0, monthlyRepayment: 0, repaymentType: "interest_only", expensesMonthly: 1000 },
      ],
    }),
  },
  {
    name: "4. Investment loan on P&I instead of IO",
    input: baseInput({
      investmentLoans: [
        { balance: 400000, ratePct: 6.2, termYears: 25, termMonths: 0, monthlyRepayment: 0, repaymentType: "principal_and_interest", expensesMonthly: 500 },
      ],
    }),
  },
  {
    name: "5. Multiple investment loans with different expenses each",
    input: baseInput({
      investmentLoans: [
        { balance: 300000, ratePct: 6.0, termYears: 20, termMonths: 0, monthlyRepayment: 0, repaymentType: "interest_only", expensesMonthly: 400 },
        { balance: 250000, ratePct: 6.8, termYears: 25, termMonths: 6, monthlyRepayment: 0, repaymentType: "principal_and_interest", expensesMonthly: 650 },
      ],
    }),
  },
  {
    name: "6. Car + personal loan repayments added",
    input: baseInput({ carLoanMonthly: 450, personalLoanMonthly: 300 }),
  },
  {
    name: "7. Manual living expenses instead of HEM",
    input: baseInput({ useHemBenchmark: false, manualMonthlyExpenses: 4200 }),
  },
  {
    name: "8. Four applicants, three rental incomes, two investment loans, additional repayments",
    input: baseInput({
      applicants: [
        { grossSalary: 120000, additionalIncome: 5000 },
        { grossSalary: 95000, additionalIncome: 0 },
        { grossSalary: 60000, additionalIncome: 2000 },
        { grossSalary: 40000, additionalIncome: 0 },
      ],
      rentalIncomes: [{ weeklyRent: 600 }, { weeklyRent: 450 }, { weeklyRent: 700 }],
      dependents: 2,
      investmentLoans: [
        { balance: 350000, ratePct: 6.4, termYears: 28, termMonths: 0, monthlyRepayment: 0, repaymentType: "interest_only", expensesMonthly: 300 },
        { balance: 500000, ratePct: 6.1, termYears: 30, termMonths: 0, monthlyRepayment: 0, repaymentType: "principal_and_interest", expensesMonthly: 800 },
      ],
      carLoanMonthly: 600,
      personalLoanMonthly: 200,
    }),
  },
  {
    name: "9. Zero income edge case (all outgoings, no income)",
    input: baseInput({
      applicants: [{ grossSalary: 0, additionalIncome: 0 }],
      investmentLoans: [
        { balance: 200000, ratePct: 6.5, termYears: 20, termMonths: 0, monthlyRepayment: 0, repaymentType: "interest_only", expensesMonthly: 200 },
      ],
    }),
  },
  {
    name: "10. Regional Cities location + fixed Fire Loan rate lower than owner-occ rate",
    input: baseInput({
      location: "remote",
      ownerOccupiedLoans: [{ balance: 620000, ratePct: 6.8, termYears: 27, termMonths: 0, monthlyRepayment: 4100 }],
      fireLoan: { balance: 620000, ratePct: 5.9, termYears: 27, termMonths: 0, monthlyRepayment: 0 },
    }),
  },
];

let failures = 0;

for (const { name, input } of scenarios) {
  const result = calculateFireVault(input);

  const expectedSurplus =
    result.totalNetMonthlyIncome -
    result.assessedMonthlyExpenses -
    result.investmentPropertyExpensesMonthly -
    result.fireLoanRepayment -
    result.investmentLoanMonthlyRepayment -
    result.additionalRepaymentsMonthly;

  const ok = approxEqual(result.monthlySurplus, expectedSurplus);
  if (!ok) failures++;

  console.log(`${ok ? "PASS" : "FAIL"} — ${name}`);
  console.log(
    `  income=${result.totalNetMonthlyIncome.toFixed(2)} hem/manual=${result.assessedMonthlyExpenses.toFixed(2)} ` +
      `propExp=${result.investmentPropertyExpensesMonthly.toFixed(2)} fireRepay=${result.fireLoanRepayment.toFixed(2)} ` +
      `investRepay=${result.investmentLoanMonthlyRepayment.toFixed(2)} addl=${result.additionalRepaymentsMonthly.toFixed(2)}`
  );
  console.log(`  surplus(reported)=${result.monthlySurplus.toFixed(2)}  surplus(recomputed)=${expectedSurplus.toFixed(2)}`);

  // Sanity invariant: current path must never use the investment loan's balance/rate.
  const ownerOccOnly = input.ownerOccupiedLoans.reduce((s, l) => s + l.balance, 0);
  if (!approxEqual(result.ownerOccupiedLoanBalance, ownerOccOnly, 1)) {
    console.log(`  FAIL — ownerOccupiedLoanBalance should equal owner-occ balance only`);
    failures++;
  }
  console.log("");
}

console.log(failures === 0 ? `All ${scenarios.length} scenarios passed.` : `${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
