import nodemailer from "nodemailer";

/** Where FIRE Vault lead notifications go   distinct from the general contact form's recipient. */
export const FIRE_VAULT_BROKER_RECIPIENT = "broker@fireloans.com.au";

export function getGmailCredentials(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return { user, pass };
}

/**
 * Fire-and-forget helper for the two broker-facing notifications (new signup, calculation
 * snapshot on exit)   distinct from send-code/route.ts's own transporter, which needs to
 * return a devNotice to the caller when unconfigured rather than just failing silently.
 * Never throws: a failed notification shouldn't break the visitor-facing flow that triggered it.
 */
export async function sendFireVaultNotification(params: { to: string; subject: string; html: string }): Promise<void> {
  const creds = getGmailCredentials();
  if (!creds) {
    console.warn("FIRE Vault notification skipped   GMAIL_USER/GMAIL_APP_PASSWORD not configured.", {
      subject: params.subject,
    });
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: creds.user, pass: creds.pass },
    });
    await transporter.sendMail({
      from: `Fire Loans <${creds.user}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    console.log(`FIRE Vault notification sent: "${params.subject}" -> ${params.to}`);
  } catch (err) {
    console.error("Failed to send FIRE Vault notification email:", err);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
