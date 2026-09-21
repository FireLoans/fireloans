import { randomInt } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { sendCodeSchema } from "@/lib/fire-vault/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { createPendingCodeCookie, FIRE_VAULT_PENDING_CODE_COOKIE, FIRE_VAULT_PENDING_CODE_MAX_AGE_SECONDS } from "@/lib/fire-vault/session";
import { isDeliverableEmailDomain } from "@/lib/fire-vault/email-domain";

export const runtime = "nodejs";

// Same verified sending domain as the contact form (src/app/api/contact/route.ts).
const FROM_ADDRESS = "Fire Loans <noreply@fireloans.com.au>";

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

const CANT_SEND_ERROR = "We couldn't send that right now. Please call 0478 933 786 or email broker@fireloans.com.au.";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // 3 send-code requests per 10 minutes per IP — nobody legitimately needs more to receive one email.
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

  // Free, no-account-needed check: does this domain even have mail servers? Catches typo'd or
  // made-up domains before we waste a send attempt. Can't confirm the specific mailbox exists —
  // see email-domain.ts for what this does and doesn't guarantee.
  const deliverable = await isDeliverableEmailDomain(data.email);
  if (!deliverable) {
    return NextResponse.json(
      { error: "This doesn't look like a real email address. Please enter one you can actually access.", field: "email" },
      { status: 400 }
    );
  }

  const code = String(randomInt(100000, 1000000));

  const setPendingCookie = (res: NextResponse) => {
    res.cookies.set(FIRE_VAULT_PENDING_CODE_COOKIE, createPendingCodeCookie(data.email, code), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: FIRE_VAULT_PENDING_CODE_MAX_AGE_SECONDS,
    });
    return res;
  };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("FIRE Vault send-code requested but RESEND_API_KEY is not configured — email not sent.", {
      name: data.name,
      email: data.email,
    });
    // Dev-only convenience: with no real mailbox connected yet, surface the code directly in the
    // response instead of a dead-end error, so the gate is still testable end-to-end locally.
    // Never done in production — a live site with no mail configured must fail loudly, not leak
    // the code to anyone who asks. The pending cookie is still set either way, since a real code
    // was genuinely committed to for this request.
    if (process.env.NODE_ENV !== "production") {
      return setPendingCookie(
        NextResponse.json({
          ok: true,
          devNotice: `Email isn't configured in this environment yet, so nothing was actually sent. Your code is: ${code}`,
        })
      );
    }
    return NextResponse.json({ error: CANT_SEND_ERROR }, { status: 503 });
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: data.email,
      subject: "Your FIRE Vault access code",
      html: `
        <h2>Your FIRE Vault access code</h2>
        <p>Hi ${escapeHtml(data.name)},</p>
        <p>Enter this code to unlock the FIRE Vault calculator:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:2px;">${code}</p>
        <p style="color:#888;font-size:12px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        <hr />
        <p style="color:#888;font-size:12px;">Sent from the Fire Loans website.</p>
      `,
    });

    if (error) {
      console.error("Resend failed to send FIRE Vault access code:", error);
      return NextResponse.json({ error: CANT_SEND_ERROR }, { status: 502 });
    }

    return setPendingCookie(NextResponse.json({ ok: true }));
  } catch (err) {
    console.error("Unexpected error sending FIRE Vault access code:", err);
    return NextResponse.json({ error: CANT_SEND_ERROR }, { status: 500 });
  }
}
