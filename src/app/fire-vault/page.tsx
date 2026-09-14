import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CalculatorLayout } from "@/components/calculators/calculator-layout";
import { FireVaultCalculator } from "@/components/fire-vault/fire-vault-calculator";
import { FireVaultGate } from "@/components/fire-vault/fire-vault-gate";
import { FIRE_VAULT_COOKIE_NAME, verifySessionCookie } from "@/lib/fire-vault/session";

export const metadata: Metadata = {
  title: "FIRE Vault",
  description:
    "FIRE Vault: a serviceability calculator for multi-applicant, multi-property borrowers   see how fast a combined loan balance could be paid off by redirecting your full household surplus.",
  alternates: { canonical: "/fire-vault" },
};

export default async function FireVaultPage() {
  const cookieStore = await cookies();
  const session = verifySessionCookie(cookieStore.get(FIRE_VAULT_COOKIE_NAME)?.value);

  return (
    <CalculatorLayout
      title="FIRE Vault"
      description="A serviceability calculator built for multi-applicant, multi-property borrowers   up to 4 applicants, 10 investment properties and 10 existing loans, combined into one accelerated payoff comparison."
    >
      {session ? <FireVaultCalculator name={session.name} email={session.email} /> : <FireVaultGate />}
    </CalculatorLayout>
  );
}
