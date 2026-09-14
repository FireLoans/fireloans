import { NextResponse, type NextRequest } from "next/server";
import { leadSnapshotSchema, type LeadSnapshotValues } from "@/lib/fire-vault/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { FIRE_VAULT_COOKIE_NAME, verifySessionCookie } from "@/lib/fire-vault/session";
import { escapeHtml, FIRE_VAULT_BROKER_RECIPIENT, sendFireVaultNotification } from "@/lib/fire-vault/mailer";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const formatCurrency = (n: number) => n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

function buildEmailHtml(name: string, email: string, mobile: string, data: LeadSnapshotValues): string {
  const { input, summary } = data;

  const applicantsRows = input.applicants
    .map(
      (a, i) =>
        `<tr><td>Applicant #${i + 1}</td><td>${formatCurrency(a.grossSalary)} gross</td><td>${formatCurrency(a.additionalIncome)} additional</td></tr>`
    )
    .join("");

  const propertiesRows = input.properties.length
    ? input.properties
        .map(
          (p, i) =>
            `<tr><td>Property #${i + 1}</td><td>${formatCurrency(p.weeklyRent)}/week</td><td>${formatCurrency(p.monthlyExpenses)}/month expenses</td></tr>`
        )
        .join("")
    : "<tr><td colspan=\"3\">None entered</td></tr>";

  const loansRows = input.loans.length
    ? input.loans
        .map(
          (l, i) =>
            `<tr><td>Loan #${i + 1}</td><td>${formatCurrency(l.balance)}</td><td>${l.ratePct}%</td><td>${l.termYears}y ${l.termMonths}m left</td><td>${formatCurrency(l.monthlyRepayment)}/mo</td></tr>`
        )
        .join("")
    : "<tr><td colspan=\"5\">None entered</td></tr>";

  return `
    <h2>FIRE Vault results — ${escapeHtml(name)}</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Mobile:</strong> ${escapeHtml(mobile)}</p>
    <hr />
    <h3>Summary</h3>
    <p><strong>Total gross annual income:</strong> ${formatCurrency(summary.totalGrossAnnualIncome)}</p>
    <p><strong>Total net monthly income:</strong> ${formatCurrency(summary.totalNetMonthlyIncome)}</p>
    <p><strong>Combined loan balance:</strong> ${formatCurrency(summary.combinedLoanBalance)}</p>
    <p><strong>Monthly surplus:</strong> ${formatCurrency(summary.monthlySurplus)}</p>
    <p><strong>FIRE Vault rate used:</strong> ${input.fireVaultRatePct}%</p>
    ${
      summary.neverPaysOff
        ? "<p><strong>Result:</strong> Surplus doesn't cover interest at this rate — not a viable payoff path as entered.</p>"
        : `<p><strong>Current path payoff:</strong> ${escapeHtml(summary.currentPayoffLabel)}</p>
           <p><strong>FIRE Vault accelerated payoff:</strong> ${escapeHtml(summary.acceleratedPayoffLabel)}</p>
           <p><strong>Interest saved:</strong> ${formatCurrency(summary.interestSaved)}</p>`
    }
    <h3>Applicants</h3>
    <table cellpadding="4" cellspacing="0" border="1" style="border-collapse:collapse;">${applicantsRows}</table>
    <h3>Investment properties</h3>
    <table cellpadding="4" cellspacing="0" border="1" style="border-collapse:collapse;">${propertiesRows}</table>
    <h3>Existing loans</h3>
    <table cellpadding="4" cellspacing="0" border="1" style="border-collapse:collapse;">${loansRows}</table>
    <p><strong>Dependents:</strong> ${input.dependents} &middot; <strong>Location:</strong> ${input.location === "remote" ? "Remote" : "Rest of Australia"}</p>
    <p><strong>Living expenses:</strong> ${input.useHemBenchmark ? "HEM benchmark" : formatCurrency(input.manualMonthlyExpenses) + "/mo (manual)"}</p>
    <p><strong>Car loan:</strong> ${formatCurrency(input.carLoanMonthly)}/mo &middot; <strong>Personal loan:</strong> ${formatCurrency(input.personalLoanMonthly)}/mo &middot; <strong>Credit card limit:</strong> ${formatCurrency(input.creditCardLimit)}</p>
    <hr />
    <p style="color:#888;font-size:12px;">Captured automatically when they finished using the FIRE Vault calculator. Figures are estimates only.</p>
  `;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // sendBeacon can't receive a real response, but still guard against abuse.
  const { allowed } = checkRateLimit(`fire-vault-lead-snapshot:${ip}`, 10, 10 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  // Identity comes from the visitor's own verified session, never from the request body   the
  // body is only trusted for the calculator numbers themselves.
  const session = verifySessionCookie(req.cookies.get(FIRE_VAULT_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = leadSnapshotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await sendFireVaultNotification({
    to: FIRE_VAULT_BROKER_RECIPIENT,
    subject: `FIRE Vault results — ${session.name}`,
    html: buildEmailHtml(session.name, session.email, session.mobile, parsed.data),
  });

  return NextResponse.json({ ok: true });
}
