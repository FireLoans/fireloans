"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loanTypes } from "@/content/loan-types";

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (servicesRef.current && !servicesRef.current.contains(e.target as Node)) {
        setServicesOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center" onClick={() => setMobileOpen(false)}>
          <Image
            src="/images/logo.png"
            alt="Fire Loans"
            width={220}
            height={110}
            priority
            className="h-11 w-auto sm:h-12"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link
            href="/about"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-brand-600"
          >
            About
          </Link>

          <div className="relative" ref={servicesRef}>
            <button
              type="button"
              onClick={() => setServicesOpen((v) => !v)}
              aria-expanded={servicesOpen}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-brand-600"
            >
              Services
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 transition-transform ${servicesOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {servicesOpen && (
              <div className="absolute left-1/2 top-full mt-2 w-72 -translate-x-1/2 rounded-2xl border border-border bg-paper p-2 shadow-xl">
                <div className="grid grid-cols-1 gap-0.5">
                  {loanTypes.map((loan) => (
                    <Link
                      key={loan.slug}
                      href={`/loans/${loan.slug}`}
                      onClick={() => setServicesOpen(false)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
                    >
                      {loan.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/news"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-brand-600"
          >
            News
          </Link>

          <Link
            href="/articles"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-brand-600"
          >
            Articles
          </Link>

          <Link
            href="/calculators"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-brand-600"
          >
            Calculator
          </Link>

          <Link
            href="/fire-vault"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-brand-600"
          >
            FIRE Vault
          </Link>
        </nav>

        <div className="hidden lg:block">
          <Link
            href="/#contact"
            className="inline-flex items-center justify-center rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-paper shadow-sm transition-colors hover:bg-brand-600"
          >
            Contact Us
          </Link>
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-paper lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            <Link
              href="/about"
              className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
              onClick={() => setMobileOpen(false)}
            >
              About
            </Link>

            <p className="mt-2 px-3 text-xs font-semibold uppercase tracking-wide text-ink-soft/50">
              Services
            </p>
            {loanTypes.map((loan) => (
              <Link
                key={loan.slug}
                href={`/loans/${loan.slug}`}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
                onClick={() => setMobileOpen(false)}
              >
                {loan.title}
              </Link>
            ))}

            <Link
              href="/news"
              className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
              onClick={() => setMobileOpen(false)}
            >
              News
            </Link>
            <Link
              href="/articles"
              className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
              onClick={() => setMobileOpen(false)}
            >
              Articles
            </Link>

            <Link
              href="/calculators"
              className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
              onClick={() => setMobileOpen(false)}
            >
              Calculator
            </Link>

            <Link
              href="/fire-vault"
              className="rounded-lg px-3 py-2.5 text-base font-medium text-ink-soft hover:bg-brand-50 hover:text-brand-700"
              onClick={() => setMobileOpen(false)}
            >
              FIRE Vault
            </Link>

            <Link
              href="/#contact"
              className="mt-3 rounded-full bg-brand-500 px-5 py-3 text-center text-base font-semibold text-paper"
              onClick={() => setMobileOpen(false)}
            >
              Contact Us
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
