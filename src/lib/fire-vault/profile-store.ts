import { Redis } from "@upstash/redis";
import type { FireVaultInput } from "@/lib/calculators/fire-vault";

/**
 * The one piece of FIRE Vault state that IS persisted: a verified visitor's last calculator
 * inputs, keyed by their email, so they don't have to re-enter everything if they come back
 * later. Everything else about FIRE Vault (the access code, the session) stays the
 * signed-cookie-only design described elsewhere — this is a deliberate, narrow exception to it.
 */
const PROFILE_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

export type FireVaultProfile = {
  name: string;
  mobile: string;
  input: FireVaultInput;
  updatedAt: number;
};

let cachedClient: Redis | null | undefined;

function getClient(): Redis | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  cachedClient = url && token ? new Redis({ url, token }) : null;
  return cachedClient;
}

function keyFor(email: string): string {
  return `fire-vault:profile:${email.trim().toLowerCase()}`;
}

/** No-ops (rather than throwing) when KV isn't configured — losing the "remember me" feature
 *  should never break the calculator itself. */
export async function saveFireVaultProfile(email: string, profile: FireVaultProfile): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    await client.set(keyFor(email), profile, { ex: PROFILE_TTL_SECONDS });
  } catch (err) {
    console.error("Failed to save FIRE Vault profile:", err);
  }
}

export async function getFireVaultProfile(email: string): Promise<FireVaultProfile | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const profile = await client.get<FireVaultProfile>(keyFor(email));
    return profile ?? null;
  } catch (err) {
    console.error("Failed to load FIRE Vault profile:", err);
    return null;
  }
}
