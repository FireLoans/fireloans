import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * FIRE Vault deliberately stores nothing server-side: no accounts, no database, no file on
 * disk. The only state is a signed, expiring cookie the visitor's own browser holds. This
 * module signs/verifies that cookie with HMAC-SHA256 so it can't be forged or replayed past
 * its expiry, without needing any persistence layer at all.
 */
export const FIRE_VAULT_COOKIE_NAME = "fire_vault_session";
export const FIRE_VAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

function getSecret(): string {
  const secret = process.env.FIRE_VAULT_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FIRE_VAULT_SESSION_SECRET must be set in production   see .env.example.");
  }
  console.warn(
    "FIRE_VAULT_SESSION_SECRET is not set   using an insecure development-only fallback. Set it in .env.local before deploying."
  );
  return "dev-only-insecure-fire-vault-secret";
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export type FireVaultSession = { name: string; email: string; mobile: string; exp: number };

export function createSessionCookie(name: string, email: string, mobile: string): string {
  const exp = Date.now() + FIRE_VAULT_SESSION_MAX_AGE_SECONDS * 1000;
  const payload = base64UrlEncode(JSON.stringify({ name, email, mobile, exp } satisfies FireVaultSession));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionCookie(cookieValue: string | undefined | null): FireVaultSession | null {
  if (!cookieValue) return null;
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as FireVaultSession;
    if (typeof session.exp !== "number" || Date.now() > session.exp) return null;
    if (typeof session.name !== "string" || typeof session.email !== "string" || typeof session.mobile !== "string") return null;
    return session;
  } catch {
    return null;
  }
}
