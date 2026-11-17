/** Shared helpers + palette for the hand-rolled SVG charts (no chart library → tiny bundle). */

export const CHART_COLORS = {
  olive: "#93AA88",
  gold: "#C49A45",
  sky: "#6BA8C9",
  violet: "#B38CD9",
  coral: "#E08A5C",
  mint: "#7FC6A4",
  danger: "#E05252",
  muted: "#6E7770",
} as const;

export const CATEGORY_PALETTE = [
  CHART_COLORS.olive,
  CHART_COLORS.gold,
  CHART_COLORS.sky,
  CHART_COLORS.violet,
  CHART_COLORS.coral,
  CHART_COLORS.mint,
];

/** Rounds `max` up to a "nice" axis ceiling (1, 2, 2.5, 5 × 10^n). */
export function niceMax(max: number): number {
  if (!isFinite(max) || max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = Math.pow(10, exp);
  const frac = max / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * base;
}

export interface Point {
  x: number;
  y: number;
}

export function linePath(points: Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)},${round(p.y)}`).join(" ");
}

export function areaPath(points: Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${round(last.x)},${round(baselineY)} L${round(first.x)},${round(baselineY)} Z`;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Maps values onto an x/y box; a single value is centred, a flat line sits mid-height. */
export function scalePoints(
  values: number[],
  width: number,
  height: number,
  min: number,
  max: number
): Point[] {
  const span = max - min || 1;
  return values.map((v, i) => ({
    x: values.length === 1 ? width / 2 : (i / (values.length - 1)) * width,
    y: height - ((v - min) / span) * height,
  }));
}
