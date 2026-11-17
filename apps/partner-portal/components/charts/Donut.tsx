export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** Share-of-total ring with a centre label. Pure SVG, renders on the server. */
export function Donut({
  segments,
  size = 148,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const positive = segments.filter((s) => s.value > 0);
  const total = positive.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = positive.length > 1 ? 3 : 0;

  let offset = 0;
  const arcs = positive.map((s) => {
    const len = (s.value / total) * c;
    const arc = { ...s, dash: Math.max(0, len - gap), offset };
    offset += len;
    return arc;
  });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel ?? "Distribution"}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262C2F" strokeWidth={thickness} />
        {total > 0 &&
          arcs.map((a) => (
            <circle
              key={a.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={thickness}
              strokeDasharray={`${a.dash} ${c - a.dash}`}
              strokeDashoffset={-a.offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${a.label}: ${Math.round((a.value / total) * 100)}%`}</title>
            </circle>
          ))}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
          {centerValue && <span className="text-md font-bold text-afk-offwhite tabular-nums leading-tight">{centerValue}</span>}
          {centerLabel && <span className="text-2xs text-afk-muted uppercase tracking-wider mt-0.5">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
