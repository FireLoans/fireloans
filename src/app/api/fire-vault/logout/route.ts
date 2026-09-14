import { NextResponse } from "next/server";
import { FIRE_VAULT_COOKIE_NAME } from "@/lib/fire-vault/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(FIRE_VAULT_COOKIE_NAME, "", { path: "/fire-vault", maxAge: 0 });
  return response;
}
