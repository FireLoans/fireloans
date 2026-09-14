import type { Metadata } from "next";
import {
  LegalHero,
  LegalSection,
  LegalProse,
  LegalPullQuote,
  LegalFactGrid,
} from "@/components/legal/legal-page";
import { LegalDocumentShell, ReadingProgressBar, type LegalSectionMeta } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Fire Loans collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy" },
};

const sections: LegalSectionMeta[] = [
  { id: "what-we-collect", number: "01", label: "What We Collect" },
  { id: "how-we-use-it", number: "02", label: "How We Use It" },
  { id: "who-we-share-with", number: "03", label: "Who We Share It With" },
  { id: "your-rights", number: "04", label: "Your Rights" },
  { id: "cookies-security", number: "05", label: "Cookies & Security" },
  { id: "contact", number: "06", label: "Contact & Complaints" },
];

export default function PrivacyPage() {
  return (
    <div className="bg-cream">
      <ReadingProgressBar />
      <LegalHero
        eyebrow="Privacy Policy"
        title="How we handle your information"
        intro="A plain-English account of what we collect, why, and what say you have over it   written to the Australian Privacy Principles, not around them."
        reference="FIN-PP-2026"
        updated="September 2026"
        tldr="Short version: we only collect what's needed to find you a loan, we never sell it, and you can ask to see or correct it at any time."
        image="/images/privcy.jpg"
      />

      <LegalDocumentShell sections={sections}>
        <LegalSection
          id="what-we-collect"
          number="01"
          title="What we collect, and why"
          description="As a mortgage and finance broker, we need real financial detail to assess your options properly."
        >
          <LegalProse>
            <p>
              When you enquire, apply, or use a calculator on this site, we may collect your{" "}
              <strong>name, contact details, employment, income, expenses, assets and liabilities</strong>   the
              same information a lender would eventually ask for, just gathered once, by us, on your behalf.
            </p>
            <p>
              Calculator inputs stay in your browser unless you choose to send us the result   using a
              calculator alone doesn&apos;t put you on our mailing list or in our CRM.
            </p>
          </LegalProse>
        </LegalSection>

        <LegalSection id="how-we-use-it" number="02" title="How we use it">
          <LegalProse>
            <p>
              We use your information to assess your borrowing options, compare suitable lenders on your
              behalf, prepare and lodge applications, and keep you updated as they progress.
            </p>
          </LegalProse>
          {/* sjdgfksjdcj */}
          <LegalPullQuote>
            We don&apos;t use your financial information for anything beyond finding and managing your loan.
          </LegalPullQuote>
        </LegalSection>

        <LegalSection id="who-we-share-with" number="03" title="Who we share it with">
          <LegalProse>
            <p>
              Only the parties genuinely involved in getting your loan approved   never sold or handed to
              third parties for marketing.
            </p>
          </LegalProse>
          <LegalFactGrid
            facts={[
              { term: "Lenders", detail: "To assess and process the application you've asked us to submit." },
              { term: "Aggregator", detail: "Our lending platform, which lodges applications on our panel." },
              { term: "Credit bureaus", detail: "For credit checks required as part of responsible lending." },
              { term: "Marketing", detail: "Never   your data is not sold or shared for third-party advertising." },
            ]}
          />
        </LegalSection>

        <LegalSection
          id="your-rights"
          number="04"
          title="Your rights"
          description="Under the Privacy Act 1988 (Cth), you have real, enforceable rights over your own information."
        >
          <LegalFactGrid
            facts={[
              { term: "Access", detail: "Ask to see the personal information we hold about you, at any time." },
              { term: "Correction", detail: "Request a correction if anything is out of date or inaccurate." },
              {
                term: "Complaint",
                detail: "Escalate to the Office of the Australian Information Commissioner (OAIC) if unresolved with us.",
              },
            ]}
          />
        </LegalSection>

        <LegalSection id="cookies-security" number="05" title="Cookies & security">
          <LegalProse>
            <p>
              This site may use basic analytics cookies to understand how it&apos;s used   nothing that
              identifies you personally, and no third-party ad tracking.
            </p>
            <p>
              We take reasonable technical and organisational steps to keep your information secure, and only
              retain it for as long as needed for your file or as required by law.
            </p>
          </LegalProse>
        </LegalSection>

        <LegalSection id="contact" number="06" title="Contact & complaints">
          <LegalProse>
            <p>
              Contact us directly first   we reply to privacy enquiries within one business day. If
              you&apos;re not satisfied with how we&apos;ve handled your information, you&apos;re free to
              escalate to the OAIC.
            </p>
          </LegalProse>
        </LegalSection>
      </LegalDocumentShell>
    </div>
  );
}
