import { resolveMx, resolve4, resolve6 } from "node:dns/promises";

/**
 * Checks whether an email's domain can actually receive mail — a free DNS lookup, no paid
 * verification service needed. Catches typo'd/made-up domains (e.g. "gmial.com", "test.test")
 * before we waste a send attempt (and before the visitor wastes a step waiting for an email
 * that will never arrive).
 *
 * This can NOT confirm the specific mailbox exists (e.g. "doesnotexist@gmail.com" passes, since
 * gmail.com itself is a real, deliverable domain) — that requires an SMTP handshake or a paid
 * verification API, neither of which this does. It's a first-line filter against obviously fake
 * addresses, not a guarantee the address is real.
 */
export async function isDeliverableEmailDomain(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;

  // A domain can receive mail via an explicit MX record, or — per RFC 5321 §5.1 — by falling
  // back to its own A/AAAA record when no MX exists. Checked in that order.
  try {
    const mx = await resolveMx(domain);
    if (mx.length > 0) return true;
  } catch {
    // no MX record — fall through to the A/AAAA fallback below
  }

  try {
    const a = await resolve4(domain);
    if (a.length > 0) return true;
  } catch {
    // no A record
  }

  try {
    const aaaa = await resolve6(domain);
    return aaaa.length > 0;
  } catch {
    return false;
  }
}
