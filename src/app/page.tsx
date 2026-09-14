import type { Metadata } from "next";
import Link from "next/link";
import { loanTypes } from "@/content/loan-types";
import { OfferGrid } from "@/components/conversion/offer-grid";
import { ServicesTabs } from "@/components/conversion/services-tabs";
import { BorrowingPowerCalculator } from "@/components/calculators/borrowing-power-calculator";
import { ContactForm } from "@/components/conversion/contact-form";
import { FireStoriesSlider } from "@/components/stories/fire-stories-slider";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      {/* Hero */}

<section className="relative isolate min-h-[92vh] overflow-hidden bg-pine-900 text-cream">
  {/* Full-strength background video */}
  <video
    className="absolute inset-0 h-full w-full object-cover object-center"
    autoPlay
    muted
    loop
    playsInline
    preload="metadata"
    aria-hidden="true"
  >
    <source src="/videos/hero-loop.mp4" type="video/mp4" />
  </video>

  {/* Hero content */}
  <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl items-center px-6 py-20 sm:px-8 lg:px-12">
    <div className="w-full max-w-2xl">
      {/* Subtle content backdrop only */}
      <div className="max-w-2xl rounded-[2rem] border border-cream/10 bg-pine-950/30 p-7 backdrop-blur-[3px] sm:p-10 lg:p-12">
        {/* Eyebrow */}
        <div className="mb-7 flex items-center gap-3">
          <span className="h-px w-10 bg-gold-400" />

          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-400">
            Australian Mortgage &amp; Finance Broker
          </span>
        </div>

        {/* Heading */}
        <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-[-0.025em] text-paper sm:text-5xl md:text-6xl lg:text-[4.25rem]">
          Australia&apos;s mortgage
          <br />
          broking firm,
          <br />
          <span className="text-gold-400">
            built around you.
          </span>
        </h1>

        {/* Elegant divider */}
        <div className="my-8 flex items-center gap-3">
          <span className="h-px w-16 bg-gold-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
        </div>

        {/* Description */}
        <p className="max-w-xl text-base leading-8 text-cream/90 sm:text-lg">
          From your first home to your next investment, we structure every
          loan around one goal: getting you closer to financial independence 
          not just a settled loan.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/#contact"
            className="group inline-flex items-center justify-center gap-3 rounded-full bg-gold-400 px-8 py-4 text-sm font-semibold text-pine-950 shadow-lg shadow-pine-950/20 transition-all duration-300 hover:bg-gold-300 hover:shadow-xl"
          >
            Speak With a Broker

            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                d="M5 12h14M13 6l6 6-6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <Link
            href="/#services"
            className="group inline-flex items-center justify-center gap-3 rounded-full border border-cream/50 bg-cream/5 px-8 py-4 text-sm font-semibold text-cream backdrop-blur-sm transition-all duration-300 hover:border-gold-400 hover:bg-cream/10 hover:text-gold-400"
          >
            Explore Our Services

            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                d="M12 5v14M6 13l6 6 6-6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* hrfgwkjdsfsjdfh */}
            </svg>
          </Link>
        </div>

       
      </div>
    </div>
  </div>
</section>



      {/* Services Tabs */}
      <section
        id="services"
        className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">
            How We Help
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Four ways we get you there
          </h2>
          <p className="mt-3 text-ink-soft">
            Real lending strategy matched to where you are in life   not a generic rate
            comparison.
          </p>
        </div>
        <div className="mt-10">
          <ServicesTabs />
        </div>
      </section>

      {/* What We Offer */}
      <section
        className="relative border-y border-border bg-cream-muted bg-cover bg-center bg-scroll lg:bg-fixed"
        style={{ backgroundImage: "url(/images/services.png)" }}
      >
        {/* Low-opacity veil so the photo reads as texture, not a busy background */}
        <div className="absolute inset-0 bg-cream-muted/80" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">
              What We Offer
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Every loan type, one broker
            </h2>
          </div>
          <div className="mt-10">
            <OfferGrid loans={loanTypes} />
          </div>
        </div>
      </section>

      {/* Fire Stories */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">
            Fire Stories
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            See yourself in someone else&apos;s journey
          </h2>
          <p className="mt-4 text-ink-soft">
            Composite, anonymised illustrations of situations we help clients
            work through   not verbatim testimonials.
          </p>
        </div>
        <div className="mt-10">
          <FireStoriesSlider />
        </div>
      </section>

      {/* Borrowing Power Calculator */}
      <section id="borrowing-power" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">
            Free Borrowing Power Calculator
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Know your number before you fall in love with a property.
          </h2>
          <p className="mt-3 text-ink-soft">
            Real tax brackets, a genuine household expenditure benchmark, and a proper rate
            buffer   the same serviceability approach real lenders use. Enter your numbers
            below for a real answer in minutes.
          </p>
        </div>
        <div className="mt-10">
          <BorrowingPowerCalculator />
        </div>
        <p className="mx-auto mt-8 max-w-3xl rounded-xl bg-cream-muted p-4 text-center text-sm leading-relaxed text-ink-soft">
          This calculator provides estimates only, based on the figures you enter and general
          assumptions   it doesn&apos;t take into account your full financial situation and isn&apos;t
          formal lending or financial advice. Talk to a Fire Loans broker for an assessment
          specific to you.
        </p>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-cream-muted/50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-pine-900 p-6 shadow-xl shadow-ink/10 sm:p-10 lg:p-14">
            {/* Colour behind the glass panels below */}
            <div
              className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-brand-500/25 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-gold-500/20 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-12">
              {/* Left: context & assurances */}
              <div className="flex flex-col justify-between gap-10 lg:col-span-5">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gold-400">
                    Free Loan Assessment
                  </p>
                  <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-paper sm:text-4xl">
                    Tell us where you&apos;re at.
                  </h2>
                  <p className="mt-4 leading-relaxed text-cream/75">
                    A few details now means a broker can review it and call you back with a
                    real, tailored answer   not a generic quote.
                  </p>

                  <div className="mt-8 flex flex-col gap-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-gold-400 backdrop-blur-sm">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div>
                        <p className="font-semibold text-paper">One business day response</p>
                        <p className="text-sm text-cream/65">We reply to every enquiry within one business day.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-gold-400 backdrop-blur-sm">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <rect x="4" y="10" width="16" height="10" rx="2" />
                          <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
                        </svg>
                      </span>
                      <div>
                        <p className="font-semibold text-paper">Your privacy protected</p>
                        <p className="text-sm text-cream/65">
                          Your details go only to Fire Loans   never sold or shared with third-party marketers.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-gold-400 backdrop-blur-sm">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M4 5c0 8.5 6.5 15 15 15l3-4-6-3-2 2c-2-1-4-3-5-5l2-2-3-6-4 3Z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <div>
                        <p className="font-semibold text-paper">Prefer to talk now?</p>
                        <p className="text-sm text-cream/65">
                          Call{" "}
                          <a href="tel:0478933786" className="font-semibold text-gold-400">
                            0478 933 786
                          </a>{" "}
                          or email{" "}
                          <a href="mailto:broker@fireloans.com.au" className="font-semibold text-gold-400">
                            broker@fireloans.com.au
                          </a>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-sm text-cream/70 backdrop-blur-sm">
                  <span className="font-semibold text-paper">No impact on your credit score: </span>
                  this form is an initial conversation, not a credit application   it doesn&apos;t
                  record an enquiry on your credit file.
                </div>
              </div>

              {/* Right: form */}
              <div className="lg:col-span-7">
                <ContactForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
