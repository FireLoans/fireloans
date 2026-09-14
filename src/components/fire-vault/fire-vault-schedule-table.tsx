import type { ScheduleRow } from "@/lib/calculators/fire-vault";
import { formatCurrency, formatCurrency2 } from "@/components/calculators/calculator-fields";

export function FireVaultScheduleTable({ title, rows }: { title: string; rows: ScheduleRow[] }) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-cream-muted text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Principal remaining</th>
              <th className="px-4 py-3">Monthly income</th>
              <th className="px-4 py-3">Monthly expenses</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Annual repayment</th>
              <th className="px-4 py-3">Interest this year</th>
              <th className="px-4 py-3">Principal this year</th>
              <th className="px-4 py-3">Avg monthly principal</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-ink-soft">
                  No data
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.year} className="border-t border-border">
                  <td className="px-4 py-2.5 font-semibold text-ink">{row.year}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatCurrency(row.principalRemaining)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatCurrency(row.monthlyIncome)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatCurrency(row.monthlyExpenses)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{row.interestRatePct.toFixed(2)}%</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatCurrency(row.totalAnnualRepayment)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatCurrency(row.interestPaidThisYear)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatCurrency(row.principalRepaidThisYear)}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{formatCurrency2(row.averageMonthlyPrincipalRepaid)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
