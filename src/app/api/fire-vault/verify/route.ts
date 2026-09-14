import { NextResponse, type NextRequest } from "next/server";
import { verifyCodeSchema, FIRE_VAULT_PASSCODE } from "@/lib/fire-vault/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSessionCookie, FIRE_VAULT_COOKIE_NAME, FIRE_VAULT_SESSION_MAX_AGE_SECONDS } from "@/lib/fire-vault/session";
import { escapeHtml, FIRE_VAULT_BROKER_RECIPIENT, sendFireVaultNotification } from "@/lib/fire-vault/mailer";

export const runtime = "nodejs";

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const { allowed, retryAfterMs } = checkRateLimit(`fire-vault-verify:${ip}`, 8, 10 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = verifyCodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }
  const data = parsed.data;

  if (data.code.trim().toUpperCase() !== FIRE_VAULT_PASSCODE) {
    return NextResponse.json({ error: "That code doesn't match. Check your email and try again." }, { status: 401 });
  }

  const cookieValue = createSessionCookie(data.name, data.email, data.mobile);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(FIRE_VAULT_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Root path, not "/fire-vault"   the API routes that need to read this cookie live under
    // "/api/fire-vault/*", a sibling path the browser would never send a "/fire-vault"-scoped
    // cookie to.
    path: "/",
    maxAge: FIRE_VAULT_SESSION_MAX_AGE_SECONDS,
  });

  // Fire-and-forget: let the visitor into the calculator immediately, don't make them wait on
  // this email to complete.
  void sendFireVaultNotification({
    to: FIRE_VAULT_BROKER_RECIPIENT,
    subject: `New FIRE Vault signup — ${data.name}`,
    html: `
      <h2>New FIRE Vault signup</h2>
      <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Mobile:</strong> ${escapeHtml(data.mobile)}</p>
      <p><strong>Signed up:</strong> ${new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" })} AEST</p>
      <hr />
      <p style="color:#888;font-size:12px;">They now have access to the FIRE Vault calculator. You'll get a second email with their numbers once they finish using it.</p>
    `,
  });

  return response;
}
