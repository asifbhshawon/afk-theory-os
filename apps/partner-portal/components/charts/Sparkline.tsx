import { areaPath, linePath, scalePoints } from "./chart-utils";

/** Tiny trend line for stat cards. Pure SVG, renders on the server. */
export function Sparkline({
  values: rawValues,
  color = "#93AA88",
  width = 96,
  height = 32,
  label,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  label?: string;
}) {
  const values = rawValues.length ? rawValues : [0];
  const hasData = values.length > 1 && values.some((v) => v !== values[0]);
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = scalePoints(values, width - pad * 2, height - pad * 2, min, max).map((p) => ({
    x: p.x + pad,
    y: p.y + pad,
  }));
  const gradId = `spark-${color.replace("#", "")}-${width}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label ?? "Trend"}
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {hasData ? (
        <>
          <path d={areaPath(pts, height - pad)} fill={`url(#${gradId})`} />
          <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={2.25} fill={color} />
        </>
      ) : (
        <line x1={pad} x2={width - pad} y1={height / 2} y2={height / 2} stroke={color} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="3 3" />
      )}
    </svg>
  );
}
