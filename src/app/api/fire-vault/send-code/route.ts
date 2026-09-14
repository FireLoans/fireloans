import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { FIRE_VAULT_PASSCODE, sendCodeSchema } from "@/lib/fire-vault/schema";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // 3 send-code requests per 10 minutes per IP   nobody legitimately needs more to receive one email.
  const { allowed, retryAfterMs } = checkRateLimit(`fire-vault-send-code:${ip}`, 3, 10 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = sendCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  const data = parsed.data;

  // Honeypot: pretend success so bots don't learn what tripped them up.
  if (data.company) {
    return NextResponse.json({ ok: true });
  }

  // Sent via Gmail SMTP (not Resend, which the rest of the site's contact form uses)   requires a
  // Gmail account with 2-Step Verification on and an App Password generated for it (a normal Gmail
  // password is rejected by Google's SMTP servers). See .env.example for setup notes.
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) {
    console.error("FIRE Vault send-code requested but GMAIL_USER/GMAIL_APP_PASSWORD are not configured   email not sent.", {
      name: data.name,
      email: data.email,
    });
    // Dev-only convenience: with no real mailbox connected yet, surface the code directly in the
    // response instead of a dead-end error, so the gate is still testable end-to-end locally.
    // Never done in production   a live site with no mail configured must fail loudly, not leak
    // the passcode to anyone who asks.
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        ok: true,
        devNotice: `Email isn't configured in this environment yet, so nothing was actually sent. Your code is: ${FIRE_VAULT_PASSCODE}`,
      });
    }
    return NextResponse.json(
      { error: "We couldn't send that right now. Please call 0478 933 786 or email broker@fireloans.com.au." },
      { status: 503 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailAppPassword },
    });

    await transporter.sendMail({
      from: `Fire Loans <${gmailUser}>`,
      to: data.email,
      subject: "Your FIRE Vault access code",
      html: `
        <h2>Your FIRE Vault access code</h2>
        <p>Hi ${escapeHtml(data.name)},</p>
        <p>Enter this code to unlock the FIRE Vault calculator:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:2px;">${FIRE_VAULT_PASSCODE}</p>
        <p style="color:#888;font-size:12px;">If you didn't request this, you can ignore this email.</p>
        <hr />
        <p style="color:#888;font-size:12px;">Sent from the Fire Loans website.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Gmail SMTP failed to send FIRE Vault access code:", err);
    return NextResponse.json(
      { error: "We couldn't send that right now. Please call 0478 933 786 or email broker@fireloans.com.au." },
      { status: 502 }
    );
  }
}
