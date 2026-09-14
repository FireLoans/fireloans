import { NextResponse } from "next/server";
import { FIRE_VAULT_COOKIE_NAME } from "@/lib/fire-vault/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Two Set-Cookie headers for the same name (current "/" path, plus the pre-migration
  // "/fire-vault" path so anyone with an old cookie gets a clean logout too)   appended as raw
  // headers because NextResponse's cookies.set() convenience API only keeps the last call per
  // cookie name, silently dropping the first one when called twice for the same name.
  response.headers.append("Set-Cookie", `${FIRE_VAULT_COOKIE_NAME}=; Path=/; Max-Age=0`);
  response.headers.append("Set-Cookie", `${FIRE_VAULT_COOKIE_NAME}=; Path=/fire-vault; Max-Age=0`);
  return response;
}
