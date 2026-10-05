// Timing primitives shared by the stage runtime and the audio cue sheet.
// Storyboard time ("story time") is the film's own clock in seconds; playback
// time is the voice-over's clock. sync pairs map one onto the other.

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const EASE: Record<string, (x: number) => number> = {
  l: (x) => x,
  o: (x) => 1 - (1 - x) ** 3,
  io: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  b: (x) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2, // slight overshoot
};

export type Timing = { start: number; dur: number; ease: (x: number) => number };

/** "start duration ease" → Timing (duration defaults to 0.5 s, ease to "o"). */
export function timing(value: string): Timing {
  const [start, dur = "0.5", ease = "o"] = value.trim().split(/\s+/);
  return { start: Number(start), dur: Math.max(Number(dur), 0.001), ease: EASE[ease] ?? EASE.o };
}

export const progress = (t: number, { start, dur, ease }: Timing) => ease(clamp((t - start) / dur));

/** Monotone cubic interpolation through [x, y] pairs (Fritsch–Carlson), clamped at both ends. */
export function monotoneCurve(points: number[][]) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const last = points.length - 1;
  if (last < 1) return () => ys[0] ?? 0;
  const secants = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const slopes = xs.map((_, i) => (i === 0 ? secants[0] : i === last ? secants[last - 1] : (secants[i - 1] + secants[i]) / 2));
  secants.forEach((secant, i) => {
    if (secant === 0) {
      slopes[i] = slopes[i + 1] = 0;
      return;
    }
    const a = slopes[i] / secant;
    const b = slopes[i + 1] / secant;
    const length = Math.hypot(a, b);
    if (length > 3) [slopes[i], slopes[i + 1]] = [(3 * a) / length * secant, (3 * b) / length * secant];
  });
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[last]) return ys[last];
    let i = 0;
    while (i < last - 1 && xs[i + 1] <= x) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    return (
      (2 * t ** 3 - 3 * t ** 2 + 1) * ys[i] +
      (t ** 3 - 2 * t ** 2 + t) * h * slopes[i] +
      (-2 * t ** 3 + 3 * t ** 2) * ys[i + 1] +
      (t ** 3 - t ** 2) * h * slopes[i + 1]
    );
  };
}

/** Playback ↔ story clocks for a sync map. */
export function makeClock(sync: number[][]) {
  const warp = monotoneCurve(sync);
  const begin = sync[0][0];
  const end = sync[sync.length - 1][0];
  /** First playback time that reaches a story time (the warp never runs backwards). */
  const toPlayback = (story: number) => {
    let low = begin;
    let high = end;
    for (let step = 0; step < 40; step++) {
      const mid = (low + high) / 2;
      if (warp(mid) < story) low = mid;
      else high = mid;
    }
    return high;
  };
  return { warp, begin, end, toPlayback };
}

/** Per-character timestamps with a little rhythm, so typing does not look mechanical. */
export function keystrokes(text: string, start: number, end: number) {
  const gaps = [...text].map((char, index) => (char === " " ? 1.5 : 0.7) + 0.6 * Math.abs(Math.sin(index * 12.9898)));
  const scale = (end - start) / gaps.reduce((sum, gap) => sum + gap, 0);
  let time = start;
  return gaps.map((gap) => (time += gap * scale));
}
