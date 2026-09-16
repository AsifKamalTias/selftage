/** Rounds `value` up to a "nice" axis maximum (1, 2, 2.5, 5 × 10^n). */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * exponent;
}

export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i);
}

/** Show at most `maxLabels` evenly spaced x-axis labels. */
export function labelStep(count: number, maxLabels: number): number {
  return Math.max(1, Math.ceil(count / maxLabels));
}

/** Path for a bar with rounded top corners. */
export function roundedTopBar(x: number, y: number, width: number, height: number, r: number) {
  if (height <= 0) return '';
  const radius = Math.min(r, width / 2, height);
  return [
    `M${x},${y + height}`,
    `L${x},${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `L${x + width - radius},${y}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `L${x + width},${y + height}`,
    'Z',
  ].join(' ');
}

/** Smooth line through points using a monotone cubic spline (no overshoot). */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  const n = points.length;
  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    slopes.push((points[i + 1].y - points[i].y) / (dx[i] || 1));
  }
  const tangents: number[] = [slopes[0]];
  for (let i = 1; i < n - 1; i++) {
    tangents.push(slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2);
  }
  tangents.push(slopes[n - 2]);

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const c1x = points[i].x + h;
    const c1y = points[i].y + tangents[i] * h;
    const c2x = points[i + 1].x - h;
    const c2y = points[i + 1].y - tangents[i + 1] * h;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${points[i + 1].x},${points[i + 1].y}`;
  }
  return d;
}

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG arc path between two angles (degrees, clockwise from 12 o'clock). */
export function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M${s.x},${s.y} A${r},${r} 0 ${large} 0 ${e.x},${e.y}`;
}
