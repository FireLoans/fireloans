"use client";

import { useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

type Point = { x: number; y: number };
type Series = { label: string; color: string; points: Point[] };

/** Linear interpolation of a series' y-value at an arbitrary x, clamped to the series' own domain. */
function interpolateY(points: Point[], x: number): number {
  if (points.length === 0) return 0;
  if (x <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return last.y;
}

/** Overlays up to two balance-over-time series (e.g. with vs. without extra repayments) on one chart, with a colour-coded legend and an interactive hover tooltip showing each series' value at the hovered point in time. */
export function DualAreaChart({
  series,
  height = 200,
  formatX,
  formatY,
  theme = "dark",
}: {
  series: Series[];
  height?: number;
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  /** "dark" (default) assumes a dark card background (e.g. the sticky results panel); "light" is for placing the chart on a paper/white card instead. Only affects the legend text colour. */
  theme?: "dark" | "light";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const longest = series.reduce((a, b) => (b.points.length > a.points.length ? b : a), series[0]);
  if (!longest || longest.points.length < 2) return null;

  const width = 480;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxX = Math.max(...series.flatMap((s) => s.points.map((p) => p.x)));
  const maxY = Math.max(...series.flatMap((s) => s.points.map((p) => p.y)), 1);

  // Rounded to 2dp: SSR and client can otherwise serialize the same float with a last-digit difference and trigger a hydration mismatch.
  const round = (n: number) => Math.round(n * 100) / 100;
  const toSvgX = (x: number) => round(padding.left + (x / maxX) * innerW);
  const toSvgY = (y: number) => round(padding.top + innerH - (y / maxY) * innerH);

  const yTicks = [0, 0.5, 1].map((f) => f * maxY);
  const xTicks = [0, Math.round(maxX / 2), maxX];

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * width;
    const dataX = ((svgX - padding.left) / innerW) * maxX;
    setHoverX(Math.max(0, Math.min(maxX, Math.round(dataX))));
  }

  const hoverEntries = hoverX === null ? null : series.map((s) => ({ series: s, y: interpolateY(s.points, hoverX) }));
  const tooltipLeftPct = hoverX === null ? 0 : (toSvgX(hoverX) / width) * 100;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverX(null)}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.label} id={`dual-chart-${s.color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {yTicks.map((t) => (
          <line
            key={t}
            x1={padding.left}
            x2={width - padding.right}
            y1={toSvgY(t)}
            y2={toSvgY(t)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
          />
        ))}

        {series.map((s) => {
          const linePath = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${toSvgX(p.x)} ${toSvgY(p.y)}`).join(" ");
          const areaPath = `${linePath} L ${toSvgX(s.points[s.points.length - 1].x)} ${padding.top + innerH} L ${toSvgX(0)} ${padding.top + innerH} Z`;
          return (
            <g key={s.label}>
              <path d={areaPath} fill={`url(#dual-chart-${s.color.replace("#", "")})`} />
              <path d={linePath} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}

        {xTicks.map((t) => (
          <text
            key={t}
            x={toSvgX(t)}
            y={height - 6}
            fontSize={11}
            textAnchor={t === 0 ? "start" : t === maxX ? "end" : "middle"}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {formatX ? formatX(t) : t}
          </text>
        ))}
        {formatY && (
          <text x={padding.left} y={padding.top + 10} fontSize={11} fill="currentColor" fillOpacity={0.5}>
            {formatY(maxY)}
          </text>
        )}

        {hoverEntries && hoverX !== null && (
          <g>
            <line
              x1={toSvgX(hoverX)}
              x2={toSvgX(hoverX)}
              y1={padding.top}
              y2={padding.top + innerH}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {hoverEntries.map(({ series: s, y }) => (
              <circle
                key={s.label}
                cx={toSvgX(hoverX)}
                cy={toSvgY(y)}
                r={4}
                fill={s.color}
                stroke="white"
                strokeWidth={1.5}
              />
            ))}
          </g>
        )}
      </svg>

      {hoverEntries && hoverX !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[9rem] -translate-x-1/2 rounded-lg border border-border bg-paper px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.min(85, Math.max(15, tooltipLeftPct))}%` }}
        >
          <p className="font-semibold text-ink">{formatX ? formatX(hoverX) : hoverX}</p>
          <div className="mt-1 flex flex-col gap-0.5">
            {hoverEntries.map(({ series: s, y }) => (
              <div key={s.label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-ink-soft">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  {s.label}
                </span>
                <span className="font-semibold text-ink">{formatY ? formatY(y) : y.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span
              key={s.label}
              className={`flex items-center gap-1.5 text-xs ${theme === "light" ? "text-ink-soft" : "text-cream/60"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
