"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateFireVault,
  emptyApplicant,
  emptyInvestmentLoan,
  emptyLoan,
  emptyRentalIncome,
  timeSavedYearsMonths,
  type Applicant,
  type ExistingLoan,
  type FireVaultInput,
  type InvestmentLoan,
  type RentalIncome,
  type RepaymentType,
} from "@/lib/calculators/fire-vault";
import {
  CurrencyInput,
  FieldGroup,
  NumberInput,
  PercentInput,
  PillToggle,
  ResultStat,
  formatCurrency,
  formatCurrency2,
} from "@/components/calculators/calculator-fields";
import { DualAreaChart } from "@/components/calculators/dual-area-chart";
import type { HemLocation } from "@/lib/calculators/hem-table";
import { FireVaultScheduleTable } from "./fire-vault-schedule-table";
import { estimateAnnualNetIncome, marginalTaxRateFor, MEDICARE_LEVY_RATE } from "@/lib/calculators/borrowing-power";

const CURRENT_PATH_COLOR = "#8a8f95"; // ink-soft — "keep doing what you're doing"
const ACCELERATED_PATH_COLOR = "#0e8f68"; // brand-500 — the FIRE Vault path

function resize<T>(arr: T[], size: number, factory: () => T): T[] {
  if (arr.length === size) return arr;
  if (arr.length > size) return arr.slice(0, size);
  return [...arr, ...Array.from({ length: size - arr.length }, factory)];
}

function yearsMonthsLabel(t: { years: number; months: number }): string {
  return `${t.years} year${t.years === 1 ? "" : "s"} ${t.months} month${t.months === 1 ? "" : "s"}`;
}

/** Same net-income mechanic as calculateFireVault's own applicant breakdown, so what's shown
 *  under each applicant field updates live without waiting on the full result recompute path. */
function applicantNetAnnual(a: Applicant): number {
  const additionalNet = a.additionalIncome > 0 ? a.additionalIncome * (1 - (marginalTaxRateFor(a.grossSalary) + MEDICARE_LEVY_RATE)) : 0;
  return estimateAnnualNetIncome(a.grossSalary) + additionalNet;
}

type UIState = FireVaultInput;

const DEFAULT_STATE: UIState = {
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
};

function ApplicantFields({
  index,
  applicant,
  onChange,
}: {
  index: number;
  applicant: Applicant;
  onChange: (next: Applicant) => void;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="mb-3 text-sm font-semibold text-ink">Applicant #{index + 1}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldGroup label="Gross annual income">
          <CurrencyInput value={applicant.grossSalary} onChange={(v) => onChange({ ...applicant, grossSalary: v })} />
        </FieldGroup>
        <FieldGroup label="Additional income" hint="Bonus/OT — optional">
          <CurrencyInput
            value={applicant.additionalIncome}
            onChange={(v) => onChange({ ...applicant, additionalIncome: v })}
          />
        </FieldGroup>
      </div>
      <p className="mt-3 text-xs text-ink-soft">
        Net monthly income: <span className="font-semibold text-ink">{formatCurrency2(applicantNetAnnual(applicant) / 12)}</span>
      </p>
    </div>
  );
}

function RentalIncomeFields({
  index,
  rentalIncome,
  onChange,
}: {
  index: number;
  rentalIncome: RentalIncome;
  onChange: (next: RentalIncome) => void;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <FieldGroup label={`Rental income #${index + 1}`} hint={formatCurrency2(rentalIncome.grossAnnualRent / 12) + " / month gross"}>
        <CurrencyInput
          value={rentalIncome.grossAnnualRent}
          onChange={(v) => onChange({ ...rentalIncome, grossAnnualRent: v })}
        />
      </FieldGroup>
    </div>
  );
}

function LoanFields({
  index,
  loan,
  onChange,
}: {
  index: number;
  loan: ExistingLoan;
  onChange: (next: ExistingLoan) => void;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="mb-3 text-sm font-semibold text-ink">Loan #{index + 1}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Balance</label>
          <CurrencyInput value={loan.balance} onChange={(v) => onChange({ ...loan, balance: v })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Rate</label>
          <PercentInput value={loan.ratePct} onChange={(v) => onChange({ ...loan, ratePct: v })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Term (years)</label>
          <NumberInput value={loan.termYears} onChange={(v) => onChange({ ...loan, termYears: v })} suffix="yrs" max={40} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Term (months)</label>
          <NumberInput value={loan.termMonths} onChange={(v) => onChange({ ...loan, termMonths: v })} suffix="mo" max={11} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Repayment</label>
          <CurrencyInput
            value={loan.monthlyRepayment}
            onChange={(v) => onChange({ ...loan, monthlyRepayment: v })}
          />
        </div>
      </div>
    </div>
  );
}

function InvestmentLoanFields({
  index,
  loan,
  onChange,
}: {
  index: number;
  loan: InvestmentLoan;
  onChange: (next: InvestmentLoan) => void;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-ink">Loan #{index + 1}</p>
        <PillToggle<RepaymentType>
          value={loan.repaymentType}
          onChange={(v) => onChange({ ...loan, repaymentType: v })}
          options={[
            { value: "interest_only", label: "Interest Only" },
            { value: "principal_and_interest", label: "P&I" },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Balance</label>
          <CurrencyInput value={loan.balance} onChange={(v) => onChange({ ...loan, balance: v })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Rate</label>
          <PercentInput value={loan.ratePct} onChange={(v) => onChange({ ...loan, ratePct: v })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Term (years)</label>
          <NumberInput value={loan.termYears} onChange={(v) => onChange({ ...loan, termYears: v })} suffix="yrs" max={40} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-soft">Term (months)</label>
          <NumberInput value={loan.termMonths} onChange={(v) => onChange({ ...loan, termMonths: v })} suffix="mo" max={11} />
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1 block text-xs text-ink-soft">Repayment</label>
        <CurrencyInput value={loan.monthlyRepayment} onChange={(v) => onChange({ ...loan, monthlyRepayment: v })} />
      </div>
    </div>
  );
}

export function FireVaultCalculator({ name, email }: { name: string; email: string }) {
  const [input, setInput] = useState<UIState>(DEFAULT_STATE);
  const hasInteracted = useRef(false);

  function set<K extends keyof UIState>(key: K, value: UIState[K]) {
    hasInteracted.current = true;
    setInput((prev) => ({ ...prev, [key]: value }));
  }

  const result = useMemo(() => calculateFireVault(input), [input]);
  const timeSaved = timeSavedYearsMonths(result.timeSavedMonths);

  // Broker lead capture: when the visitor leaves (switches tabs, closes, navigates away), send
  // their latest numbers to the broker inbox via a beacon — fire-and-forget, works even during
  // unload, and only fires once (and only if they actually changed something from the demo
  // defaults, so idle page-opens don't generate noise).
  const latestSnapshot = useRef({ input, result });
  useEffect(() => {
    latestSnapshot.current = { input, result };
  }, [input, result]);
  const snapshotSent = useRef(false);

  useEffect(() => {
    function sendSnapshot() {
      if (snapshotSent.current || !hasInteracted.current) return;
      const { input: currentInput, result: currentResult } = latestSnapshot.current;
      const payload = {
        name,
        email,
        input: currentInput,
        summary: {
          totalGrossAnnualIncome: currentResult.totalGrossAnnualIncome,
          totalNetMonthlyIncome: currentResult.totalNetMonthlyIncome,
          existingLoanBalance: currentResult.existingLoanBalance,
          fireLoanBalance: currentResult.fireLoanBalance,
          monthlySurplus: currentResult.monthlySurplus,
          currentPayoffLabel: yearsMonthsLabel(currentResult.currentPath.yearsToPayOff),
          acceleratedPayoffLabel: currentResult.acceleratedPath.neverPaysOff
            ? "Not viable at this rate"
            : yearsMonthsLabel(currentResult.acceleratedPath.yearsToPayOff),
          interestSaved: currentResult.interestSaved,
          neverPaysOff: currentResult.acceleratedPath.neverPaysOff,
        },
      };
      const sent = navigator.sendBeacon(
        "/api/fire-vault/lead-snapshot",
        new Blob([JSON.stringify(payload)], { type: "application/json" })
      );
      if (sent) snapshotSent.current = true;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") sendSnapshot();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", sendSnapshot);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", sendSnapshot);
    };
  }, [name, email]);

  return (
    <div className="flex flex-col gap-8">
      {/* All inputs — one full-width card, stacked top to bottom */}
      <div className="flex flex-col gap-7 rounded-3xl bg-paper p-6 shadow-xl shadow-ink/5 sm:p-8">
        <div>
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-ink">Applicants</h2>
            <div className="text-right">
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Number of Applicants</label>
              <PillToggle
                value={String(input.applicants.length) as "1" | "2" | "3" | "4"}
                onChange={(v) => set("applicants", resize(input.applicants, Number(v), emptyApplicant))}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                  { value: "4", label: "4" },
                ]}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {input.applicants.map((applicant, i) => (
              <ApplicantFields
                key={i}
                index={i}
                applicant={applicant}
                onChange={(next) =>
                  set(
                    "applicants",
                    input.applicants.map((a, idx) => (idx === i ? next : a))
                  )
                }
              />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-ink">Rental income</h2>
            <div className="w-28 text-right">
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Number of Rental Income</label>
              <NumberInput
                value={input.rentalIncomes.length}
                onChange={(v) => set("rentalIncomes", resize(input.rentalIncomes, v, emptyRentalIncome))}
                max={10}
              />
            </div>
          </div>
          {input.rentalIncomes.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {input.rentalIncomes.map((rentalIncome, i) => (
                <RentalIncomeFields
                  key={i}
                  index={i}
                  rentalIncome={rentalIncome}
                  onChange={(next) =>
                    set(
                      "rentalIncomes",
                      input.rentalIncomes.map((r, idx) => (idx === i ? next : r))
                    )
                  }
                />
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-cream-muted px-4 py-3">
            <span className="text-sm font-semibold text-ink">Total monthly income</span>
            <span className="font-display text-lg font-semibold text-ink">{formatCurrency2(result.totalNetMonthlyIncome)}</span>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Household</h2>
          <div className="mt-4">
            <FieldGroup label="Number of dependents">
              <PillToggle
                value={String(Math.min(input.dependents, 3)) as "0" | "1" | "2" | "3"}
                onChange={(v) => set("dependents", Number(v))}
                options={[
                  { value: "0", label: "0" },
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3+" },
                ]}
              />
            </FieldGroup>
          </div>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink">HEM</h2>
          <div className="mt-4 flex flex-col gap-5">
            <FieldGroup label="Location" hint="Used for the HEM benchmark">
              <PillToggle<HemLocation>
                value={input.location}
                onChange={(v) => set("location", v)}
                options={[
                  { value: "rest_of_australia", label: "Capital Cities" },
                  { value: "remote", label: "Regional Cities" },
                ]}
              />
            </FieldGroup>
            <FieldGroup label="Living expenses" hint="Choose a benchmark or enter your own">
              <PillToggle
                value={input.useHemBenchmark ? "hem" : "manual"}
                onChange={(v) => set("useHemBenchmark", v === "hem")}
                options={[
                  { value: "hem", label: `Use HEM (${formatCurrency(result.hemMonthlyBenchmark)}/mo)` },
                  { value: "manual", label: "Enter manually" },
                ]}
              />
            </FieldGroup>
            {!input.useHemBenchmark && (
              <FieldGroup label="Monthly living expenses">
                <CurrencyInput
                  value={input.manualMonthlyExpenses}
                  onChange={(v) => set("manualMonthlyExpenses", v)}
                />
              </FieldGroup>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-ink">Existing owner occupied home loan</h2>
            <div className="w-28 text-right">
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Number of Loans</label>
              <NumberInput
                value={input.ownerOccupiedLoans.length}
                onChange={(v) => set("ownerOccupiedLoans", resize(input.ownerOccupiedLoans, v, emptyLoan))}
                max={10}
              />
            </div>
          </div>
          {input.ownerOccupiedLoans.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {input.ownerOccupiedLoans.map((loan, i) => (
                <LoanFields
                  key={i}
                  index={i}
                  loan={loan}
                  onChange={(next) =>
                    set(
                      "ownerOccupiedLoans",
                      input.ownerOccupiedLoans.map((l, idx) => (idx === i ? next : l))
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Fire loan</h2>
          <p className="mt-1 text-xs text-ink-soft">
            The single consolidated loan being proposed — the FIRE Vault path below redirects 100% of
            household surplus against this loan.
          </p>
          <div className="mt-4">
            <LoanFields index={0} loan={input.fireLoan} onChange={(next) => set("fireLoan", next)} />
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-ink">Existing investment home loan</h2>
            <div className="w-28 text-right">
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Number of Loans</label>
              <NumberInput
                value={input.investmentLoans.length}
                onChange={(v) => set("investmentLoans", resize(input.investmentLoans, v, emptyInvestmentLoan))}
                max={10}
              />
            </div>
          </div>
          {input.investmentLoans.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {input.investmentLoans.map((loan, i) => (
                <InvestmentLoanFields
                  key={i}
                  index={i}
                  loan={loan}
                  onChange={(next) =>
                    set(
                      "investmentLoans",
                      input.investmentLoans.map((l, idx) => (idx === i ? next : l))
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Additional repayments</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldGroup label="Car loan repayment / month">
              <CurrencyInput value={input.carLoanMonthly} onChange={(v) => set("carLoanMonthly", v)} />
            </FieldGroup>
            <FieldGroup label="Personal loan repayment / month">
              <CurrencyInput value={input.personalLoanMonthly} onChange={(v) => set("personalLoanMonthly", v)} />
            </FieldGroup>
          </div>
        </div>
      </div>

      {/* Chart (light card) + summary (dark card) — side by side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-3xl bg-paper p-6 shadow-xl shadow-ink/5 sm:p-8 lg:col-span-7">
          <h2 className="font-display text-lg font-semibold text-ink">Principal remaining vs. time</h2>
          <p className="mt-1 text-xs text-ink-soft">Hover the chart to see the balance at any point in time.</p>
          <div className="mt-4">
            <DualAreaChart
              theme="light"
              height={260}
              series={[
                { label: "Your current path", color: CURRENT_PATH_COLOR, points: result.currentPath.chartPoints },
                {
                  label: "FIRE Vault accelerated path",
                  color: ACCELERATED_PATH_COLOR,
                  points: result.acceleratedPath.chartPoints,
                },
              ]}
              formatX={(x) => `Yr ${x}`}
              formatY={(y) => formatCurrency(y)}
            />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-pine-900 p-6 text-cream shadow-2xl shadow-pine-950/40 sm:p-8 lg:col-span-5">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            aria-hidden="true"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg, transparent, transparent 68px, currentColor 68px, currentColor 69px)",
            }}
          />
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/10 blur-[90px]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-6">
            <div>
              {result.acceleratedPath.neverPaysOff ? (
                <>
                  <p className="text-sm text-cream/60">Your current surplus</p>
                  <p className="font-display text-3xl font-semibold text-error">Not enough to pay this off</p>
                  <p className="mt-2 text-sm text-cream/70">
                    Your monthly surplus doesn&apos;t cover interest on the FIRE loan at{" "}
                    {input.fireLoan.ratePct}%. Try lowering the rate, or reducing expenses/existing debts, to see a
                    real payoff path.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-cream/60">With FIRE Vault, you could be debt-free in</p>
                  <p className="font-display text-4xl font-semibold text-gold-400">
                    {yearsMonthsLabel(result.acceleratedPath.yearsToPayOff)}
                  </p>
                  <p className="mt-2 text-sm text-cream/70">
                    vs {yearsMonthsLabel(result.currentPath.yearsToPayOff)} on your current repayments
                  </p>
                </>
              )}
            </div>

            <div>
              <ResultStat label="Existing loan balance" value={formatCurrency(result.existingLoanBalance)} />
              <ResultStat label="Fire loan balance" value={formatCurrency(result.fireLoanBalance)} />
              <ResultStat label="Household net monthly income" value={formatCurrency(result.totalNetMonthlyIncome)} />
              <ResultStat label="Monthly surplus" value={formatCurrency(result.monthlySurplus)} emphasis />
              {!result.currentPath.neverPaysOff && !result.acceleratedPath.neverPaysOff && (
                <>
                  <ResultStat label="Interest saved" value={formatCurrency(result.interestSaved)} />
                  <ResultStat label="Time saved" value={yearsMonthsLabel(timeSaved)} />
                </>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm text-cream/60">How this was assessed</p>
              <ResultStat label="Total gross annual income" value={formatCurrency(result.totalGrossAnnualIncome)} />
              <ResultStat label="Assessed living expenses / mo" value={formatCurrency(result.assessedMonthlyExpenses)} />
              {result.additionalRepaymentsMonthly > 0 && (
                <ResultStat label="Additional repayments / mo" value={formatCurrency(result.additionalRepaymentsMonthly)} />
              )}
              {result.netServiceabilityRatio !== null && (
                <ResultStat label="Net serviceability ratio (NSR)" value={`${result.netServiceabilityRatio.toFixed(2)}x`} />
              )}
              {result.loanToIncome !== null && (
                <ResultStat label="Loan to income (LTI)" value={`${result.loanToIncome.toFixed(2)}x`} />
              )}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 text-sm font-semibold text-cream transition-colors hover:bg-white/10"
            >
              Print / save as PDF
            </button>

            <p className="text-xs text-cream/50">
              FIRE Vault models redirecting 100% of your household surplus against the FIRE loan above, at
              its own rate. It is a general estimate based on the figures entered, not a credit decision —
              talk to a Fire Loans broker for an assessment specific to you.
            </p>
          </div>
        </div>
      </div>

      {/* Applicant + rental income breakdown — always shown so every applicant's net income is visible, per the FIRE Vault spec */}
      <div className="grid grid-cols-1 gap-6 rounded-3xl bg-paper p-6 shadow-xl shadow-ink/5 sm:p-8 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">Applicant breakdown</h3>
          <div className="mt-3 flex flex-col gap-2">
            {result.applicantBreakdown.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
                <span className="font-semibold text-ink">Applicant #{i + 1}</span>
                <span className="text-ink-soft">
                  {formatCurrency(a.netAnnual)} net / year · {formatCurrency2(a.netAnnual / 12)} net / month
                </span>
              </div>
            ))}
          </div>
        </div>
        {result.rentalIncomeBreakdown.length > 0 && (
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Rental income breakdown</h3>
            <div className="mt-3 flex flex-col gap-2">
              {result.rentalIncomeBreakdown.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
                  <span className="font-semibold text-ink">Rental income #{i + 1}</span>
                  <span className="text-ink-soft">
                    {formatCurrency(r.grossAnnualRent)} / year · {formatCurrency2(r.grossAnnualRent / 12)} / month
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-8 rounded-3xl bg-paper p-6 shadow-xl shadow-ink/5 sm:p-8">
        <FireVaultScheduleTable title="Your current path" rows={result.currentPath.schedule} />
        <FireVaultScheduleTable title="FIRE Vault accelerated path" rows={result.acceleratedPath.schedule} />
      </div>
    </div>
  );
}
