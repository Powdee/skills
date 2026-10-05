import { ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE, clamp, keystrokes, lerp, makeClock, progress, timing } from "./time";
import "./fx.css";

/*
 * The stage runtime. Markup inside <Stage> animates through data attributes,
 * evaluated at every frame from story time (seconds):
 *   data-in / data-out   "start duration ease"  → CSS --p / --o (0..1); fx-* classes turn them into motion
 *   data-pulse           "start duration"       → --k (0..1..0), e.g. a press
 *   data-slot            "from to start duration ease" → --slot (re-ordering rows)
 *   data-type            "start end [clear]" + data-text → typed text (human rhythm), emptied at clear
 *   data-count           "start duration ease" + data-value [data-from data-decimals] → counted number
 *   data-scroll          "start duration ease"  → scrolls the element to its end
 *   data-focus="name"    a camera / cursor target
 * The camera moves the .mo-world between shots that frame named targets; the
 * cursor glides between targets and clicks. Never use CSS animations or
 * transitions (they run on wall-clock time); derive motion from --p/--o/--k or
 * the root's --t (story seconds), --spin, --shimmer and --caret.
 */

export type Shot = {
  at: [number, number]; // move window in story seconds
  focus: string; // data-focus target, or "world" for the whole stage
  scale?: number; // omit to fit the target (+ pad)
  pad?: number;
  ax?: number; // anchor inside the target (0..1)
  ay?: number;
  portrait?: Partial<Pick<Shot, "focus" | "scale" | "pad" | "ax" | "ay">>;
};
export type CursorMove = { at: [number, number]; focus: string; ax?: number; ay?: number; dx?: number; dy?: number };

export type Story = {
  stage: { width: number; height: number }; // landscape design size, e.g. 1280×720
  camera: Shot[];
  portraitCamera?: Shot[]; // a separate camera path for 9:16 (else camera + per-shot portrait overrides)
  cursor?: CursorMove[];
  cursorVisible?: [number, number][];
  clicks?: number[];
};

type Track = (t: number) => void;
type Rect = { x: number; y: number; w: number; h: number };

function styleSetter(el: HTMLElement | SVGElement, prop: string) {
  let last = "";
  return (v: number) => {
    const next = v.toFixed(3);
    if (next !== last) el.style.setProperty(prop, (last = next));
  };
}

function buildTracks(root: HTMLElement, locale: string): Track[] {
  const tracks: Track[] = [];
  const all = (sel: string) => [...root.querySelectorAll<HTMLElement | SVGElement>(sel)];
  for (const el of all("[data-in]")) {
    const set = styleSetter(el, "--p");
    const span = timing(el.dataset.in!);
    tracks.push((t) => set(progress(t, span)));
  }
  for (const el of all("[data-out]")) {
    const set = styleSetter(el, "--o");
    const span = timing(el.dataset.out!);
    tracks.push((t) => set(progress(t, span)));
  }
  for (const el of all("[data-pulse]")) {
    const set = styleSetter(el, "--k");
    const span = { ...timing(el.dataset.pulse!), ease: EASE.l };
    tracks.push((t) => set(Math.sin(Math.PI * progress(t, span))));
  }
  for (const el of all("[data-slot]")) {
    const [from, to, ...rest] = el.dataset.slot!.split(/\s+/);
    const set = styleSetter(el, "--slot");
    const span = timing(rest.join(" "));
    tracks.push((t) => set(lerp(Number(from), Number(to), progress(t, span))));
  }
  for (const el of all("[data-type]")) {
    const text = el.dataset.text ?? "";
    const [start, end, clear = Infinity] = el.dataset.type!.split(/\s+/).map(Number);
    const times = keystrokes(text, start, end);
    let shown = -1;
    tracks.push((t) => {
      const count = times.findIndex((time) => time > t);
      const next = t >= clear ? 0 : count === -1 ? text.length : count;
      if (next !== shown) el.textContent = text.slice(0, (shown = next));
    });
  }
  for (const el of all("[data-count]")) {
    const decimals = Number(el.dataset.decimals ?? 0);
    const fmt = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const from = Number(el.dataset.from ?? 0);
    const value = Number(el.dataset.value);
    const span = timing(el.dataset.count!);
    let shown = "";
    tracks.push((t) => {
      const next = fmt.format(lerp(from, value, progress(t, span)));
      if (next !== shown) el.textContent = (shown = next);
    });
  }
  // Scroll last: reading scroll sizes after the style writes keeps it to one layout.
  for (const el of root.querySelectorAll<HTMLElement>("[data-scroll]")) {
    const span = timing(el.dataset.scroll!);
    tracks.push((t) => {
      el.scrollTop = Math.round(progress(t, span) * (el.scrollHeight - el.clientHeight));
    });
  }
  return tracks;
}

export const Stage: React.FC<{
  story: Story;
  sync: number[][];
  format: "landscape" | "portrait";
  locale?: string;
  className?: string;
  world: ReactNode; // the workspace the camera moves across
  overlay?: ReactNode; // stage-space layer above the world: title cards, end card, notices
}> = ({ story, sync, format, locale = "en", className, world, overlay }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const portrait = format === "portrait";
  const SW = portrait ? story.stage.height : story.stage.width;
  const SH = portrait ? story.stage.width : story.stage.height;
  const clock = useMemo(() => makeClock(sync), [sync]);
  const t = clock.warp(clock.begin + frame / fps);
  const root = useRef<HTMLDivElement>(null);
  const state = useRef<{ tracks: Track[]; targets: Map<string, HTMLElement>; world: HTMLElement; cursor: HTMLElement; ripple: HTMLElement } | null>(null);

  useLayoutEffect(() => {
    const el = root.current!;
    if (!state.current) {
      const targets = new Map<string, HTMLElement>();
      el.querySelectorAll<HTMLElement>("[data-focus]").forEach((n) => targets.set(n.dataset.focus!, n));
      state.current = {
        tracks: buildTracks(el, locale),
        targets,
        world: el.querySelector<HTMLElement>(".mo-world")!,
        cursor: el.querySelector<HTMLElement>(".mo-cursor")!,
        ripple: el.querySelector<HTMLElement>(".mo-ripple")!,
      };
    }
    const s = state.current;
    el.style.setProperty("--t", t.toFixed(3));
    el.style.setProperty("--spin", `${((t * 90) % 360).toFixed(2)}deg`);
    el.style.setProperty("--shimmer", ((((t % 1.6) + 1.6) % 1.6) / 1.6).toFixed(3));
    el.style.setProperty("--caret", t % 1 < 0.5 ? "1" : "0");
    for (const track of s.tracks) track(t);

    const rect = (name: string): Rect => {
      if (name === "world") return { x: 0, y: 0, w: story.stage.width, h: story.stage.height };
      const target = s.targets.get(name);
      if (!target) throw new Error(`no [data-focus="${name}"] on stage`);
      let x = 0;
      let y = 0;
      let node: HTMLElement | null = target;
      while (node && node !== s.world) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return { x, y, w: target.offsetWidth, h: target.offsetHeight };
    };
    const shot = (sh: Shot) => {
      const o = portrait ? { ...sh, ...sh.portrait } : sh;
      const r = rect(o.focus);
      const pad = o.pad ?? 24;
      const sc = o.scale ?? Math.min(SW / (r.w + pad * 2), SH / (r.h + pad * 2));
      return { x: r.x + r.w * (o.ax ?? 0.5), y: r.y + r.h * (o.ay ?? 0.5), s: sc };
    };
    // Camera: between shots, zoom around the one world point that holds still on screen.
    const path = portrait && story.portraitCamera?.length ? story.portraitCamera : story.camera;
    const cam = (() => {
      let from = shot(path[0]);
      for (const sh of path) {
        const [a, b] = sh.at;
        if (t <= a) break;
        const to = shot(sh);
        if (t >= b) {
          from = to;
          continue;
        }
        const k = EASE.io((t - a) / (b - a));
        const sc = from.s * (to.s / from.s) ** k;
        if (Math.abs(to.s - from.s) < 0.001) return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), s: sc };
        const px = (from.x * from.s - to.x * to.s) / (from.s - to.s);
        const py = (from.y * from.s - to.y * to.s) / (from.s - to.s);
        return { x: px - ((px - from.x) * from.s) / sc, y: py - ((py - from.y) * from.s) / sc, s: sc };
      }
      return from;
    })();
    s.world.style.transform = `translate(${SW / 2 - cam.x * cam.s}px, ${SH / 2 - cam.y * cam.s}px) scale(${cam.s})`;

    // Cursor
    const vis = Math.max(0, ...(story.cursorVisible ?? []).map(([a, b]) => clamp((t - a) / 0.25) * clamp((b - t) / 0.3)));
    s.cursor.style.opacity = vis.toFixed(3);
    s.ripple.style.opacity = "0";
    if (vis > 0 && story.cursor?.length) {
      let point: { x: number; y: number } | null = null;
      for (const m of story.cursor) {
        const [a, b] = m.at;
        if (t < a) break;
        const r = rect(m.focus);
        const to = { x: r.x + r.w * (m.ax ?? 0.5) + (m.dx ?? 0), y: r.y + r.h * (m.ay ?? 0.5) + (m.dy ?? 0) };
        if (!point || t >= b) {
          point = to;
          continue;
        }
        const k = EASE.io((t - a) / (b - a));
        point = { x: lerp(point.x, to.x, k), y: lerp(point.y, to.y, k) };
        break;
      }
      if (point) {
        const x = SW / 2 + (point.x - cam.x) * cam.s;
        const y = SH / 2 + (point.y - cam.y) * cam.s;
        const clicks = story.clicks ?? [];
        const press = Math.max(0, ...clicks.map((c) => Math.sin(Math.PI * clamp((t - c + 0.08) / 0.28))));
        s.cursor.style.transform = `translate(${x}px, ${y}px) scale(${1 - 0.16 * press})`;
        const click = [...clicks].reverse().find((c) => c <= t && t - c < 0.6);
        if (click !== undefined) {
          const k = (t - click) / 0.6;
          s.ripple.style.opacity = ((1 - k) * vis).toFixed(3);
          s.ripple.style.transform = `translate(${x}px, ${y}px) scale(${0.3 + 1.1 * EASE.o(k)})`;
        }
      }
    }
  }, [t, locale, story, portrait, SW, SH]);

  return (
    <AbsoluteFill style={{ background: "var(--mo-bg, #eef0eb)" }}>
      <div
        ref={root}
        className={`mo ${portrait ? "is-portrait" : "is-landscape"} ${className ?? ""}`}
        style={{ width: SW, height: SH, transform: `scale(${width / SW})`, transformOrigin: "0 0", position: "absolute", overflow: "hidden" }}
      >
        <div className="mo-world" style={{ width: story.stage.width, height: story.stage.height }}>
          {world}
        </div>
        <div className="mo-overlay">{overlay}</div>
        <span className="mo-ripple" />
        <svg className="mo-cursor" viewBox="0 0 24 24" width="24" height="24">
          <path d="M5 2.5v17.2l4.3-4.2 2.9 6.6 3-1.3-2.9-6.5h6.1z" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

/** Words that rise one after another out of their own clip (title cards). */
export const Rise: React.FC<{ text: string; at: number; step?: number; dur?: number }> = ({ text, at, step = 0.07, dur = 0.7 }) => (
  <>
    {text.split(" ").map((word, i) => (
      <span key={i}>
        {i > 0 ? " " : null}
        <span className="mo-word">
          <span className="fx-rise" data-in={`${(at + i * step).toFixed(2)} ${dur}`}>
            {word}
          </span>
        </span>
      </span>
    ))}
  </>
);
