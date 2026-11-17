"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { areaPath, linePath, niceMax, scalePoints } from "./chart-utils";
import { formatAxis, formatBdt } from "@/lib/format";

export interface AreaSeries {
  key: string;
  name: string;
  color: string;
  values: number[];
  /** Soft gradient under the line (default true for the first series). */
  fill?: boolean;
}

const M = { top: 10, right: 12, bottom: 24, left: 42 };

function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Multi-series line/area chart with a hover crosshair + tooltip.
 * `labels` are YYYY-MM-DD day keys, one per data point.
 */
export function AreaChart({
  labels,
  series,
  height = 240,
  formatValue = formatBdt,
  ariaLabel = "Trend chart",
}: {
  labels: string[];
  series: AreaSeries[];
  height?: number;
  formatValue?: (n: number) => string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // null until measured: the chart is drawn client-side at the real width (no oversized first frame)
  const [measured, setMeasured] = useState<number | null>(null);
  const width = measured ?? 320;
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setMeasured(Math.max(260, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = width - M.left - M.right;
  const innerH = height - M.top - M.bottom;
  const n = labels.length;

  const { yMin, yMax, ticks } = useMemo(() => {
    const all = series.flatMap((s) => s.values);
    const max = Math.max(0, ...all);
    const min = Math.min(0, ...all);
    const top = niceMax(max);
    const bottom = min < 0 ? -niceMax(-min) : 0;
    const count = 4;
    const t = Array.from({ length: count + 1 }, (_, i) => bottom + ((top - bottom) / count) * i);
    return { yMin: bottom, yMax: top, ticks: t };
  }, [series]);

  const paths = useMemo(
    () =>
      series.map((s) => {
        const pts = scalePoints(s.values, innerW, innerH, yMin, yMax);
        return { s, pts };
      }),
    [series, innerW, innerH, yMin, yMax]
  );

  const zeroY = innerH - ((0 - yMin) / (yMax - yMin || 1)) * innerH;
  const step = Math.max(1, Math.ceil(n / (width < 460 ? 4 : 8)));
  const hasAnyData = series.some((s) => s.values.some((v) => v !== 0));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = n === 1 ? 0 : Math.round((x / rect.width) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, idx)));
  }

  const hx = hover !== null ? (n === 1 ? innerW / 2 : (hover / (n - 1)) * innerW) : 0;
  const tipLeft = Math.min(Math.max(M.left + hx - 90, 4), Math.max(4, width - 184));

  return (
    <div ref={wrapRef} className="relative w-full select-none overflow-hidden" style={{ height }}>
      {measured !== null && (
      <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`area-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        <g transform={`translate(${M.left},${M.top})`}>
          {/* grid + y axis */}
          {ticks.map((t, i) => {
            const y = innerH - ((t - yMin) / (yMax - yMin || 1)) * innerH;
            return (
              <g key={i}>
                <line x1={0} x2={innerW} y1={y} y2={y} stroke={t === 0 ? "#424B47" : "#262C2F"} strokeDasharray={t === 0 ? undefined : "3 4"} />
                <text x={-8} y={y + 4} textAnchor="end" fontSize={11} fill="#8E9890">
                  {formatAxis(t)}
                </text>
              </g>
            );
          })}

          {/* x axis labels */}
          {labels.map((l, i) =>
            (n - 1 - i) % step === 0 ? (
              <text
                key={l}
                x={n === 1 ? innerW / 2 : (i / (n - 1)) * innerW}
                y={innerH + 17}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                fontSize={11}
                fill="#8E9890"
              >
                {format(parseDay(l), "d MMM")}
              </text>
            ) : null
          )}

          {/* series */}
          {hasAnyData &&
            paths.map(({ s, pts }, si) => (
              <g key={s.key}>
                {(s.fill ?? si === 0) && <path d={areaPath(pts, Math.min(innerH, Math.max(0, zeroY)))} fill={`url(#area-${s.key})`} />}
                <path d={linePath(pts)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            ))}

          {!hasAnyData && (
            <text x={innerW / 2} y={innerH / 2} textAnchor="middle" fontSize={13} fill="#6E7770">
              No activity in this period
            </text>
          )}

          {/* hover */}
          {hover !== null && hasAnyData && (
            <g>
              <line x1={hx} x2={hx} y1={0} y2={innerH} stroke="#515C56" strokeDasharray="3 3" />
              {paths.map(({ s, pts }) => (
                <circle key={s.key} cx={pts[hover].x} cy={pts[hover].y} r={4} fill="#0E1011" stroke={s.color} strokeWidth={2} />
              ))}
            </g>
          )}

          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </g>
      </svg>
      )}

      {hover !== null && hasAnyData && (
        <div
          className="pointer-events-none absolute z-10 w-[180px] rounded-lg border border-afk-borderLight bg-afk-elevated/95 px-3 py-2 shadow-xl backdrop-blur"
          style={{ left: tipLeft, top: 0 }}
        >
          <p className="text-2xs font-semibold text-afk-offwhite mb-1">{format(parseDay(labels[hover]), "EEE, d MMM yyyy")}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-2 text-2xs">
              <span className="flex items-center gap-1.5 text-afk-secondary">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="font-mono tabular-nums text-afk-offwhite">{formatValue(s.values[hover] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
