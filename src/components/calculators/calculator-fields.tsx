"use client";

import { useState, type FocusEvent, type ReactNode } from "react";

const inputClasses =
  "h-12 w-full rounded-xl border border-border bg-cream-muted px-4 text-sm font-semibold text-ink focus:border-pine-700 focus:outline-none focus:ring-2 focus:ring-pine-700/10";

/** Select the full value on focus, so typing replaces a pre-filled "0" instead of appending to it. */
function selectAllOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select();
}

function formatWithCommas(digitsOnly: string): string {
  if (!digitsOnly) return "";
  return Number(digitsOnly).toLocaleString("en-AU");
}

export function FieldGroup({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label className="text-sm font-semibold text-ink">{label}</label>
        {hint && <span className="text-xs text-ink-soft">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Currency input with a live comma-formatted display (e.g. 100000 -> "100,000") over a plain number value. */
export function CurrencyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(() => formatWithCommas(String(value || "")));
  // "Adjust state when a prop changes" pattern (react.dev)   a render-phase setState so an
  // external change (e.g. a form reset) is reflected immediately, without an effect round-trip.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplay(formatWithCommas(String(value || "")));
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">$</span>
      <input
        type="text"
        inputMode="decimal"
        className={`${inputClasses} pl-7`}
        value={display}
        placeholder={placeholder}
        onFocus={selectAllOnFocus}
        onChange={(e) => {
          const digitsOnly = e.target.value.replace(/[^\d]/g, "");
          setDisplay(formatWithCommas(digitsOnly));
          onChange(digitsOnly === "" ? 0 : Number(digitsOnly));
        }}
      />
    </div>
  );
}

export function PercentInput({ value, onChange, step = 0.01 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        className={`${inputClasses} pr-9`}
        value={Number.isFinite(value) ? value : ""}
        onFocus={selectAllOnFocus}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-soft">%</span>
    </div>
  );
}

export function NumberInput({
  value,
  onChange,
  suffix,
  min = 0,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        className={`${inputClasses} ${suffix ? "pr-16" : ""}`}
        value={Number.isFinite(value) ? value : ""}
        onFocus={selectAllOnFocus}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-soft">
          {suffix}
        </span>
      )}
    </div>
  );
}

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "/ week" },
  { value: "fortnightly", label: "/ fortnight" },
  { value: "monthly", label: "/ month" },
  { value: "annually", label: "/ year" },
] as const;

export type FieldFrequency = (typeof FREQUENCY_OPTIONS)[number]["value"];

/** A currency amount (comma-formatted as you type) paired with a frequency selector. */
export function CurrencyFrequencyInput({
  value,
  onChange,
  frequency,
  onFrequencyChange,
}: {
  value: number;
  onChange: (v: number) => void;
  frequency: FieldFrequency;
  onFrequencyChange: (f: FieldFrequency) => void;
}) {
  const [display, setDisplay] = useState(() => formatWithCommas(String(value || "")));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplay(formatWithCommas(String(value || "")));
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">$</span>
        <input
          type="text"
          inputMode="decimal"
          className={`${inputClasses} pl-7`}
          value={display}
          onFocus={selectAllOnFocus}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/[^\d]/g, "");
            setDisplay(formatWithCommas(digitsOnly));
            onChange(digitsOnly === "" ? 0 : Number(digitsOnly));
          }}
        />
      </div>
      <select
        className="h-12 shrink-0 rounded-xl border border-border bg-cream-muted px-2 text-sm font-semibold text-ink-soft focus:border-pine-700 focus:outline-none focus:ring-2 focus:ring-pine-700/10"
        value={frequency}
        onChange={(e) => onFrequencyChange(e.target.value as FieldFrequency)}
      >
        {FREQUENCY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      className={inputClasses}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function PillToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-border">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`h-12 flex-1 px-4 text-sm font-semibold transition-colors ${
            i > 0 ? "border-l border-border" : ""
          } ${value === opt.value ? "bg-pine-900 text-paper" : "bg-paper text-ink-soft hover:bg-cream-muted"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ResultStat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-cream/10 py-3 last:border-b-0">
      <span className="text-sm text-cream/70">{label}</span>
      <span className={emphasis ? "font-display text-2xl font-semibold text-gold-400" : "font-semibold text-paper"}>
        {value}
      </span>
    </div>
  );
}

export const formatCurrency = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

export const formatCurrency2 = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 });
