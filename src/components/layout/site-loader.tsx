"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const WORD_1 = "F.I.R.E".split("");
const WORD_2 = "LOANS".split("");
const ALL_LETTERS = [...WORD_1, ...WORD_2];

const MIN_ANIMATION_MS = 4500;
const SAFETY_MAX_MS = 8000;
const EXIT_TRANSITION_MS = 700;

type LetterOffset = { x: number; y: number; rotate: number };

// Deterministic (not Math.random) so server and client markup always match  
// spreads letters evenly around a circle so they converge in from every edge
// of the screen rather than all sliding in from one direction.
function computeOffsets(count: number): LetterOffset[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.PI / 5;
    const radius = 420 + (i % 3) * 90;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      rotate: (i % 2 === 0 ? 1 : -1) * (20 + (i % 4) * 12),
    };
  });
}

export function SiteLoader() {
  // The backdrop below renders unconditionally (including on the server) so it
  // paints as part of the very first HTML   a visitor sees the loader screen
  // before the real page, never the other way around. Only the framer-motion
  // letters/animations are gated behind `mounted`: those compute slightly
  // different inline style strings on the server vs. the client, which would
  // otherwise trigger a hydration mismatch   so they're deferred to a
  // client-only render instead of being part of the initial SSR output.
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const offsets = useMemo(() => computeOffsets(ALL_LETTERS.length), []);

  useEffect(() => {
    // setTimeout(0) defers these updates to a callback rather than running
    // them synchronously as the first lines of the effect body   unlike
    // requestAnimationFrame, it isn't throttled/paused in a backgrounded tab.
    const mountTimer = setTimeout(() => {
      setMounted(true);
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }, 0);

    let animationDone = false;
    let pageLoaded = document.readyState === "complete";

    const tryHide = () => {
      if (animationDone && pageLoaded) setHidden(true);
    };

    const minTimer = setTimeout(() => {
      animationDone = true;
      tryHide();
    }, MIN_ANIMATION_MS);

    const onLoad = () => {
      pageLoaded = true;
      tryHide();
    };
    if (!pageLoaded) window.addEventListener("load", onLoad);

    // Safety net so a slow network never traps a visitor on the loader.
    const safetyTimer = setTimeout(() => setHidden(true), SAFETY_MAX_MS);

    return () => {
      clearTimeout(mountTimer);
      clearTimeout(minTimer);
      clearTimeout(safetyTimer);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  // Unmount only after the CSS fade-out below has had time to finish.
  useEffect(() => {
    if (!hidden) return;
    const removeTimer = setTimeout(() => setRemoved(true), EXIT_TRANSITION_MS);
    return () => clearTimeout(removeTimer);
  }, [hidden]);

  useEffect(() => {
    if (hidden) {
      document.body.style.removeProperty("overflow");
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, [hidden]);

  if (removed) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-cream transition-opacity duration-700 ease-in-out ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden}
    >
      <div
        className="pointer-events-none absolute h-[36rem] w-[36rem] rounded-full bg-brand-100/40 blur-3xl"
        aria-hidden="true"
      />

      {mounted && (
        <div className="relative flex flex-col items-center px-6">
          {/* Arc, drawn in first */}
          <svg viewBox="0 0 300 40" className="mb-2 h-6 w-56 sm:w-64" aria-hidden="true">
            <motion.path
              d="M4 30 Q150 -6 296 30"
              fill="none"
              stroke="#006847"
              strokeWidth={3}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </svg>

          {/* Wordmark: letters converge from the edges of the screen */}
          <div
            className="flex flex-nowrap items-baseline justify-center font-display text-4xl font-bold tracking-tight sm:text-6xl"
            role="img"
            aria-label="Fire Loans"
          >
            {WORD_1.map((char, i) => (
              <motion.span
                key={`w1-${i}`}
                className="text-pine-700"
                initial={
                  reducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: offsets[i].x, y: offsets[i].y, rotate: offsets[i].rotate }
                }
                animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0.4, delay: 0.1 }
                    : { type: "spring", stiffness: 110, damping: 14, delay: 0.35 + i * 0.045 }
                }
              >
                {char}
              </motion.span>
            ))}
            <span className="inline-block w-3 sm:w-4" aria-hidden="true" />
            {WORD_2.map((char, i) => {
              const idx = WORD_1.length + i;
              return (
                <motion.span
                  key={`w2-${i}`}
                  className="text-brand-500"
                  initial={
                    reducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: offsets[idx].x, y: offsets[idx].y, rotate: offsets[idx].rotate }
                  }
                  animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                  transition={
                    reducedMotion
                      ? { duration: 0.4, delay: 0.1 }
                      : { type: "spring", stiffness: 110, damping: 14, delay: 0.35 + idx * 0.045 }
                  }
                >
                  {char}
                </motion.span>
              );
            })}
          </div>

          {/* Tagline, settles in after the wordmark */}
          <motion.p
            className="mt-4 text-center text-xs font-medium uppercase tracking-[0.2em] text-pine-700/80 sm:text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reducedMotion ? 0.3 : 1.05 }}
          >
            Helping Australians Achieve Financial Independence & Retire Early
          </motion.p>

          {/* Thin progress line */}
          <div className="mt-8 h-[3px] w-40 overflow-hidden rounded-full bg-border sm:w-48">
            <motion.div
              className="h-full bg-gradient-to-r from-pine-700 via-brand-500 to-gold-500"
              initial={{ x: "-100%" }}
              animate={{ x: "0%" }}
              transition={{ duration: MIN_ANIMATION_MS / 1000, ease: "easeInOut" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
