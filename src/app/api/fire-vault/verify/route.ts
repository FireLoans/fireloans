import { NextResponse, type NextRequest } from "next/server";
import { verifyCodeSchema, FIRE_VAULT_PASSCODE } from "@/lib/fire-vault/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSessionCookie, FIRE_VAULT_COOKIE_NAME, FIRE_VAULT_SESSION_MAX_AGE_SECONDS } from "@/lib/fire-vault/session";

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

  const cookieValue = createSessionCookie(data.name);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(FIRE_VAULT_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/fire-vault",
    maxAge: FIRE_VAULT_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
