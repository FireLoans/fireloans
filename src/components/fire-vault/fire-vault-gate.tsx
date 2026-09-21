"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AnimatePresence, motion } from "framer-motion";
import { sendCodeSchema, verifyCodeSchema, type SendCodeValues, type VerifyCodeValues } from "@/lib/fire-vault/schema";

const fieldClasses =
  "h-12 w-full rounded-lg border border-white/20 bg-white/10 px-4 text-sm text-paper placeholder:text-cream/40 backdrop-blur-md transition-colors focus:border-gold-400/60 focus:outline-none focus:ring-2 focus:ring-gold-400/20 [color-scheme:dark]";
const fieldErrorClasses =
  "h-12 w-full rounded-lg border border-error bg-error/10 px-4 text-sm text-paper placeholder:text-cream/40 backdrop-blur-md transition-colors focus:border-error focus:outline-none focus:ring-2 focus:ring-error/20 [color-scheme:dark]";
const labelClasses = "mb-1.5 block text-sm font-semibold text-cream/90";

type Step = "request" | "verify";

/**
 * FIRE Vault's access gate itself creates no account: entering a name, email and mobile number
 * gets a real, random 6-digit code emailed to that address (see src/app/api/fire-vault/send-code)
 * — the code itself lives only in a signed, short-lived cookie in the visitor's own browser
 * (src/lib/fire-vault/session.ts), never on a server. Before sending, the email's domain is
 * checked for actual mail servers (src/lib/fire-vault/email-domain.ts) — a free DNS lookup that
 * catches typo'd/fake domains, though it can't confirm the specific mailbox exists. Entering the
 * code back sets a second, longer-lived signed cookie that the server re-verifies on every
 * request to /fire-vault.
 *
 * One thing IS now persisted beyond the session, deliberately: the calculator numbers a verified
 * visitor enters are saved against their email (src/lib/fire-vault/profile-store.ts), so they get
 * their own numbers back if they return later instead of starting over. The copy below says so.
 */
export function FireVaultGate() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("request");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [devNotice, setDevNotice] = useState<string | null>(null);

  const requestForm = useForm<SendCodeValues>({ resolver: zodResolver(sendCodeSchema) });
  const verifyForm = useForm<Pick<VerifyCodeValues, "code">>({
    resolver: zodResolver(verifyCodeSchema.pick({ code: true })),
  });

  async function onRequestSubmit(values: SendCodeValues) {
    setServerError(null);
    setDevNotice(null);
    try {
      const res = await fetch("/api/fire-vault/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; field?: string; devNotice?: string } | null;
      if (!res.ok) {
        if (data?.field === "email") {
          requestForm.setError("email", { type: "server", message: data.error ?? "Enter a real email address." });
        } else {
          setServerError(data?.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      if (data?.devNotice) setDevNotice(data.devNotice);
      setName(values.name);
      setEmail(values.email);
      setMobile(values.mobile);
      setStep("verify");
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  async function onVerifySubmit(values: { code: string }) {
    setServerError(null);
    try {
      const res = await fetch("/api/fire-vault/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mobile, code: values.code }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setServerError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full rounded-3xl border border-gold-500/20 bg-pine-950 p-8 text-cream shadow-2xl shadow-pine-950/40 sm:p-10"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gold-400">FIRE Vault</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-paper">
          {step === "request" ? "Unlock the Vault" : "Check your email"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-cream/65">
          {step === "request"
            ? "A more powerful serviceability calculator for multi-property, multi-loan scenarios. Enter your details and we'll email you an access code. Your numbers are saved so you can pick up where you left off next time."
            : `We sent a code to ${email}. Enter it below to continue.`}
        </p>

        <AnimatePresence mode="wait">
          {step === "request" ? (
            <motion.form
              key="request"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onSubmit={requestForm.handleSubmit(onRequestSubmit)}
              className="mt-6 flex flex-col gap-4"
              noValidate
            >
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <label htmlFor="fv-company">Company</label>
                <input id="fv-company" type="text" tabIndex={-1} autoComplete="off" {...requestForm.register("company")} />
              </div>

              <div>
                <label className={labelClasses} htmlFor="fv-name">
                  Your Name
                </label>
                <input
                  id="fv-name"
                  className={fieldClasses}
                  placeholder="e.g. Jordan Smith"
                  {...requestForm.register("name")}
                />
                {requestForm.formState.errors.name && (
                  <p className="mt-1.5 text-sm text-error">{requestForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className={labelClasses} htmlFor="fv-email">
                  Email Address
                </label>
                <input
                  id="fv-email"
                  type="email"
                  className={requestForm.formState.errors.email ? fieldErrorClasses : fieldClasses}
                  placeholder="jordan@email.com"
                  {...requestForm.register("email")}
                />
                {requestForm.formState.errors.email && (
                  <p className="mt-1.5 text-sm text-error">{requestForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className={labelClasses} htmlFor="fv-mobile">
                  Mobile Number
                </label>
                <input
                  id="fv-mobile"
                  type="tel"
                  className={fieldClasses}
                  placeholder="04XX XXX XXX"
                  {...requestForm.register("mobile")}
                />
                {requestForm.formState.errors.mobile && (
                  <p className="mt-1.5 text-sm text-error">{requestForm.formState.errors.mobile.message}</p>
                )}
              </div>

              {serverError && (
                <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={requestForm.formState.isSubmitting}
                className="mt-2 inline-flex h-14 items-center justify-center rounded-full bg-gold-400 text-sm font-semibold text-pine-950 shadow-lg shadow-pine-950/30 transition-colors hover:bg-gold-300 disabled:opacity-60"
              >
                {requestForm.formState.isSubmitting ? "Sending…" : "Email me my access code"}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="verify"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onSubmit={verifyForm.handleSubmit(onVerifySubmit)}
              className="mt-6 flex flex-col gap-4"
              noValidate
            >
              {devNotice && (
                <p className="rounded-lg border border-gold-400/30 bg-gold-400/10 px-4 py-2.5 text-sm text-gold-300">
                  {devNotice}
                </p>
              )}

              <div>
                <label className={labelClasses} htmlFor="fv-code">
                  Access code
                </label>
                <input
                  id="fv-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className={`${fieldClasses} text-center text-lg font-semibold tracking-[0.3em]`}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  {...verifyForm.register("code")}
                />
                {verifyForm.formState.errors.code && (
                  <p className="mt-1.5 text-sm text-error">{verifyForm.formState.errors.code.message}</p>
                )}
              </div>

              {serverError && (
                <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-sm text-error">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={verifyForm.formState.isSubmitting}
                className="mt-2 inline-flex h-14 items-center justify-center rounded-full bg-gold-400 text-sm font-semibold text-pine-950 shadow-lg shadow-pine-950/30 transition-colors hover:bg-gold-300 disabled:opacity-60"
              >
                {verifyForm.formState.isSubmitting ? "Verifying…" : "Unlock FIRE Vault"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setServerError(null);
                  setStep("request");
                }}
                className="text-center text-xs text-cream/50 transition-colors hover:text-cream/80"
              >
                Use a different email
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
