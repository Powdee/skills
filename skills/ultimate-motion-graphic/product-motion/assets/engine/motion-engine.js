// @ts-check
// <motion-graphic> — a deterministic, scrubbable motion engine for product walkthroughs.
//
// Every frame is a pure function of time, so playback can be paused, scrubbed by chapter,
// rendered frame by frame to video, and locked to a soundtrack. No dependencies.
//
// Markup contract (see references/engine.md):
//   <motion-graphic data-number-locale="en-GB">
//     <script type="application/json" data-storyboard>{ ... }</script>
//     <div class="mg-frame"><div class="mg-stage" aria-hidden="true">
//       <div class="mg-world"> …product UI… </div>
//       …stage-space overlays (title cards, notices)…
//       <span class="mg-ripple"></span><svg class="mg-cursor">…</svg>
//     </div></div>
//     <div class="mg-controls">[data-mg-toggle] [data-mg-chapter]… [data-mg-mute]</div>
//     <audio data-sync="[[0,-6],[51,45]]" src="…" preload="none"></audio>   (optional)
//   </motion-graphic>
//
// Element timings live in the markup (storyboard seconds):
//   data-in / data-out   "start duration ease" → --p / --o (0..1)
//   data-pulse           "start duration"      → --k (0..1..0)
//   data-slot            "from to start duration ease" → --slot
//   data-type            "start end [clear]" + data-text → typed text, emptied at clear
//   data-count           "start duration ease" + data-value, data-from, data-decimals → counted number
//   data-scroll          "start duration ease" → scrolls the element to its end
// Eases: l (linear), o (out cubic, default), io (in-out cubic), b (out back).
// The camera and cursor follow [data-focus="name"] elements named in the storyboard.

/** @typedef {{ at: number, settle?: number, label?: string }} Chapter */
/** @typedef {{ at: [number, number], focus: string, scale?: number, pad?: number, ax?: number, ay?: number }} Shot */
/** @typedef {{ at: [number, number], focus: string, ax?: number, ay?: number, dx?: number, dy?: number }} CursorMove */
/**
 * @typedef {{
 *   stage?: { width: number, height: number },
 *   start?: number, duration: number,
 *   chapters?: Chapter[], camera?: Shot[],
 *   cursor?: { moves?: CursorMove[], visible?: [number, number][], clicks?: number[] }
 * }} Storyboard
 */

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (a, b, k) => a + (b - a) * k;
/** @type {Record<string, (x: number) => number>} */
const EASE = {
  l: x => x,
  o: x => 1 - (1 - x) ** 3,
  io: x => x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2,
  b: x => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2
};

/** @param {string} value */
function timing(value) {
  const [start, dur = "0.5", ease = "o"] = value.trim().split(/\s+/);
  return { start: Number(start), dur: Math.max(Number(dur), 0.001), ease: EASE[ease] ?? EASE.o };
}
/** @param {number} t @param {ReturnType<typeof timing>} span */
const progress = (t, { start, dur, ease }) => ease(clamp((t - start) / dur));

/** @param {HTMLElement | SVGElement} element @param {string} property */
function styleSetter(element, property) {
  let last = "";
  return (/** @type {number} */ value) => {
    const next = value.toFixed(3);
    if (next !== last) element.style.setProperty(property, (last = next));
  };
}

/** Per-character timestamps with a little rhythm, so typing does not look mechanical. Exported for sound cues. */
export function keystrokes(/** @type {string} */ text, /** @type {number} */ start, /** @type {number} */ end) {
  const gaps = [...text].map((char, index) => (char === " " ? 1.5 : 0.7) + 0.6 * Math.abs(Math.sin(index * 12.9898)));
  const scale = (end - start) / gaps.reduce((sum, gap) => sum + gap, 0);
  let time = start;
  return gaps.map(gap => (time += gap * scale));
}

/** Monotone cubic interpolation through [x, y] pairs (Fritsch–Carlson), clamped at both ends. */
function monotoneCurve(/** @type {number[][]} */ points) {
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]), last = points.length - 1;
  const secants = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const slopes = xs.map((_, i) => i === 0 ? secants[0] : i === last ? secants[last - 1] : (secants[i - 1] + secants[i]) / 2);
  secants.forEach((secant, i) => {
    if (secant === 0) { slopes[i] = slopes[i + 1] = 0; return; }
    const a = slopes[i] / secant, b = slopes[i + 1] / secant, length = Math.hypot(a, b);
    if (length > 3) [slopes[i], slopes[i + 1]] = [3 * a / length * secant, 3 * b / length * secant];
  });
  return (/** @type {number} */ x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[last]) return ys[last];
    const i = xs.findLastIndex(start => start <= x), h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    return (2 * t ** 3 - 3 * t ** 2 + 1) * ys[i] + (t ** 3 - 2 * t ** 2 + t) * h * slopes[i]
      + (-2 * t ** 3 + 3 * t ** 2) * ys[i + 1] + (t ** 3 - t ** 2) * h * slopes[i + 1];
  };
}

export class MotionGraphic extends HTMLElement {
  constructor() {
    super();
    /** @type {((t: number) => void)[]} */ this.tracks = [];
    /** @type {Map<string, HTMLElement>} */ this.targets = new Map();
    /** @type {HTMLElement[]} */ this.fills = [];
    /** @type {Storyboard} */ this.storyboard = { duration: 1 };
    this.time = 0;
    this.playing = false;
    this.frame = 0;
    this.lastNow = 0;
    /** @type {HTMLAudioElement | null} */ this.audio = null;
    // "waiting": play() was called on the soundtrack and has not started yet; the clock holds briefly.
    /** @type {"off" | "waiting" | "on" | "failed"} */ this.sound = "off";
    this.soundRequested = 0;
    /** Playback time → storyboard time. With a soundtrack, playback runs on the track's clock. */
    this.warp = (/** @type {number} */ time) => time;
    this.begin = 0;
    this.end = 1;
    /** @type {number[]} */ this.chapterStarts = [];
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  }

  connectedCallback() {
    const source = this.querySelector("script[data-storyboard]");
    const world = this.querySelector(".mg-world"), cursor = this.querySelector(".mg-cursor");
    const ripple = this.querySelector(".mg-ripple"), frame = this.querySelector(".mg-frame"), stage = this.querySelector(".mg-stage");
    if (!source || !(world instanceof HTMLElement) || !(frame instanceof HTMLElement) || !(stage instanceof HTMLElement)) {
      console.warn("motion-graphic: missing storyboard, .mg-frame, .mg-stage or .mg-world");
      return;
    }
    this.storyboard = JSON.parse(source.textContent ?? "{}");
    const { width = 1280, height = 720 } = this.storyboard.stage ?? {};
    this.stageWidth = width;
    this.stageHeight = height;
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    frame.style.aspectRatio = `${width} / ${height}`;
    this.world = world;
    this.cursor = /** @type {HTMLElement | null} */ (cursor);
    this.ripple = /** @type {HTMLElement | null} */ (ripple);
    this.tracks = this.buildTracks();
    this.querySelectorAll("[data-focus]").forEach(element => this.targets.set(/** @type {HTMLElement} */ (element).dataset.focus ?? "", /** @type {HTMLElement} */ (element)));

    const start = this.storyboard.start ?? 0, duration = this.storyboard.duration;
    this.audio = this.querySelector("audio[data-sync]");
    const sync = this.audio ? JSON.parse(this.audio.dataset.sync ?? "[]") : [[start, start], [duration, duration]];
    this.warp = monotoneCurve(sync);
    this.begin = sync[0][0];
    this.end = sync[sync.length - 1][0];
    this.chapters = this.storyboard.chapters?.length ? this.storyboard.chapters : [{ at: start }];
    this.chapterStarts = this.chapters.map(chapter => this.toPlayback(chapter.at));

    this.events?.abort();
    this.events = new AbortController();
    const options = { signal: this.events.signal };
    this.toggleButton = this.querySelector("[data-mg-toggle]");
    this.toggleButton?.addEventListener("click", () => this.toggle(), options);
    frame.addEventListener("click", () => this.toggle(), options);
    this.muteButton = this.querySelector("[data-mg-mute]");
    this.muteButton?.addEventListener("click", () => {
      if (!this.audio) return;
      this.audio.muted = !this.audio.muted;
      this.updateState();
    }, options);
    this.audio?.addEventListener("error", () => { this.sound = "failed"; }, options);
    const chapterButtons = [...this.querySelectorAll("[data-mg-chapter]")];
    this.fills = chapterButtons.map(button => /** @type {HTMLElement} */ (button.querySelector("i") ?? button));
    chapterButtons.forEach((button, index) => {
      /** @type {HTMLElement} */ (button).style.setProperty("--length", String(this.chapterEnd(index) - this.chapterStarts[index]));
      button.addEventListener("click", () => this.goTo(index), options);
    });
    this.addEventListener("keydown", event => {
      const current = this.chapterStarts.findLastIndex(chapterStart => chapterStart <= this.time);
      if (event.key === "ArrowRight") this.goTo(Math.min(this.chapterStarts.length - 1, current + 1));
      else if (event.key === "ArrowLeft") this.goTo(Math.max(0, this.time - this.chapterStarts[current] > 1 ? current : current - 1));
      else return;
      event.preventDefault();
    }, options);

    this.observer = new ResizeObserver(() => this.style.setProperty("--mg-scale", String(frame.clientWidth / width)));
    this.observer.observe(frame);
    this.render(this.begin);
  }

  disconnectedCallback() {
    this.pause();
    this.events?.abort();
    this.observer?.disconnect();
  }

  // ——— public API ———

  /** Starts from the beginning; with reduced motion it shows the first chapter's settled frame instead. */
  start() {
    // Decode images up front so they do not stall the frame they first appear in.
    this.querySelectorAll("img").forEach(image => image.decode().catch(() => {}));
    if (this.reducedMotion.matches) {
      this.pause();
      this.render(this.settle(0));
    } else {
      this.render(this.begin);
      this.play();
    }
  }

  stop() {
    this.pause();
    this.render(this.begin);
  }

  play() {
    if (this.playing) return;
    if (this.time >= this.end) this.render(this.begin);
    this.playing = true;
    this.lastNow = performance.now();
    this.frame = requestAnimationFrame(this.tick);
    this.startSound();
    this.updateState();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.frame);
    this.audio?.pause();
    if (this.sound !== "failed") this.sound = "off";
    this.updateState();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Jump to a storyboard time (used by QA and export scripts). */
  seek(/** @type {number} */ storyboardTime) {
    this.render(this.toPlayback(storyboardTime));
  }

  /** The first playback time that reaches a storyboard time (the warp never runs backwards). */
  toPlayback(/** @type {number} */ storyboardTime) {
    let low = this.begin, high = this.end;
    for (let step = 0; step < 40; step++) {
      const middle = (low + high) / 2;
      if (this.warp(middle) < storyboardTime) low = middle;
      else high = middle;
    }
    return high;
  }

  /** Renders a playback time; everything on stage is drawn at its storyboard time. */
  render(/** @type {number} */ time) {
    this.time = time;
    const t = this.warp(time);
    for (const track of this.tracks) track(t);
    const camera = this.camera(t);
    if (this.world) this.world.style.transform = `translate(${this.stageWidth / 2 - camera.x * camera.s}px, ${this.stageHeight / 2 - camera.y * camera.s}px) scale(${camera.s})`;
    this.renderCursor(t, camera);
    this.fills.forEach((fill, index) => fill.style.setProperty("--fill", clamp((time - this.chapterStarts[index]) / (this.chapterEnd(index) - this.chapterStarts[index])).toFixed(4)));
    if (!this.playing) this.updateState();
  }

  // ——— playback ———

  goTo(/** @type {number} */ index) {
    if (this.reducedMotion.matches && !this.playing) return this.render(this.settle(index));
    this.render(this.chapterStarts[index]);
    if (this.playing) this.startSound();
    else this.play();
  }

  chapterEnd(/** @type {number} */ index) {
    return this.chapterStarts[index + 1] ?? this.end;
  }

  settle(/** @type {number} */ index) {
    const settle = this.chapters?.[index]?.settle;
    return settle === undefined ? this.chapterEnd(index) - 0.01 : this.toPlayback(settle);
  }

  /** Plays the soundtrack from the current time; the animation follows it once it is running. */
  startSound() {
    const audio = this.audio;
    if (!audio || this.sound === "failed" || (audio.duration && this.time >= audio.duration)) return;
    this.sound = "waiting";
    this.soundRequested = performance.now();
    audio.currentTime = Math.max(0, this.time);
    audio.play().then(() => {
      if (!this.playing) return;
      // If the track started late, bring it to where the animation is now.
      if (Math.abs(audio.currentTime - this.time) > 0.08) audio.currentTime = Math.max(0, this.time);
      this.sound = "on";
    }, () => {
      if (this.sound === "waiting") this.sound = "off";
    });
  }

  tick = (/** @type {number} */ now) => {
    // Clamp long frames (background tabs, slow devices) so nothing is skipped.
    const delta = Math.min(0.05, (now - this.lastNow) / 1000);
    this.lastNow = now;
    let next = this.time + delta;
    if (this.sound === "waiting" && now - this.soundRequested < 2000) next = this.time;
    // The soundtrack is the master clock: follow it when the two drift apart (e.g. while it buffers).
    else if (this.sound === "on" && this.audio && !this.audio.paused && Math.abs(this.audio.currentTime - next) > 0.08) next = this.audio.currentTime;
    this.render(Math.min(this.end, next));
    if (this.time >= this.end) this.pause();
    else this.frame = requestAnimationFrame(this.tick);
  };

  updateState() {
    const state = this.playing ? "playing" : this.time >= this.end ? "ended" : "paused";
    this.dataset.state = state;
    const label = this.toggleButton?.dataset[`${state === "playing" ? "pause" : state === "ended" ? "replay" : "play"}Label`];
    if (label) this.toggleButton?.setAttribute("aria-label", label);
    this.toggleAttribute("data-muted", Boolean(this.audio?.muted));
    const muteLabel = this.muteButton?.dataset[this.audio?.muted ? "unmuteLabel" : "muteLabel"];
    if (muteLabel) this.muteButton?.setAttribute("aria-label", muteLabel);
  }

  // ——— tracks ———

  buildTracks() {
    /** @type {((t: number) => void)[]} */
    const tracks = [];
    const all = (/** @type {string} */ selector) => /** @type {(HTMLElement | SVGElement)[]} */ ([...this.querySelectorAll(selector)]);
    for (const element of all("[data-in]")) {
      const set = styleSetter(element, "--p"), span = timing(element.dataset.in ?? "0");
      tracks.push(t => set(progress(t, span)));
    }
    for (const element of all("[data-out]")) {
      const set = styleSetter(element, "--o"), span = timing(element.dataset.out ?? "0");
      tracks.push(t => set(progress(t, span)));
    }
    for (const element of all("[data-pulse]")) {
      const set = styleSetter(element, "--k"), span = { ...timing(element.dataset.pulse ?? "0"), ease: EASE.l };
      tracks.push(t => set(Math.sin(Math.PI * progress(t, span))));
    }
    for (const element of all("[data-slot]")) {
      const [from, to, ...rest] = (element.dataset.slot ?? "0 0 0").split(/\s+/);
      const set = styleSetter(element, "--slot"), span = timing(rest.join(" "));
      tracks.push(t => set(lerp(Number(from), Number(to), progress(t, span))));
    }
    for (const element of all("[data-type]")) {
      const text = element.dataset.text ?? "";
      const [start, end, clear = Infinity] = (element.dataset.type ?? "0 1").split(/\s+/).map(Number);
      const times = keystrokes(text, start, end);
      let shown = -1;
      tracks.push(t => {
        const count = times.findIndex(time => time > t);
        const next = t >= clear ? 0 : count === -1 ? text.length : count;
        if (next !== shown) element.textContent = text.slice(0, (shown = next));
      });
    }
    const locale = this.dataset.numberLocale;
    for (const element of all("[data-count]")) {
      const decimals = Number(element.dataset.decimals ?? 0);
      const format = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      const from = Number(element.dataset.from ?? 0), value = Number(element.dataset.value), span = timing(element.dataset.count ?? "0");
      let shown = "";
      tracks.push(t => {
        const next = format.format(lerp(from, value, progress(t, span)));
        if (next !== shown) element.textContent = (shown = next);
      });
    }
    // Scroll last: reading scroll sizes after the style writes keeps it to one layout per frame.
    for (const element of /** @type {HTMLElement[]} */ ([...this.querySelectorAll("[data-scroll]")])) {
      const span = timing(element.dataset.scroll ?? "0");
      tracks.push(t => { element.scrollTop = Math.round(progress(t, span) * (element.scrollHeight - element.clientHeight)); });
    }
    return tracks;
  }

  // ——— camera and cursor ———

  /** Layout position in world coordinates; ancestors' transforms (entrances) are ignored. */
  rect(/** @type {string} */ name) {
    if (name === "world") return { x: 0, y: 0, w: this.stageWidth, h: this.stageHeight };
    const element = this.targets.get(name);
    if (!element) console.warn(`motion-graphic: no [data-focus="${name}"]`);
    let x = 0, y = 0, node = /** @type {HTMLElement | null} */ (element ?? null);
    while (node && node !== this.world) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = /** @type {HTMLElement | null} */ (node.offsetParent);
    }
    return { x, y, w: element?.offsetWidth ?? 0, h: element?.offsetHeight ?? 0 };
  }

  shot(/** @type {Shot} */ { focus, scale, pad = 24, ax = 0.5, ay = 0.5 }) {
    const r = this.rect(focus);
    const s = scale ?? Math.min(this.stageWidth / (r.w + pad * 2), this.stageHeight / (r.h + pad * 2));
    return { x: r.x + r.w * ax, y: r.y + r.h * ay, s };
  }

  camera(/** @type {number} */ t) {
    const shots = this.storyboard.camera ?? [];
    if (!shots.length) return { x: this.stageWidth / 2, y: this.stageHeight / 2, s: 1 };
    let from = this.shot(shots[0]);
    for (const shot of shots) {
      const [start, end] = shot.at;
      if (t <= start) break;
      const to = this.shot(shot);
      if (t >= end) { from = to; continue; }
      const k = EASE.io((t - start) / (end - start));
      const s = from.s * (to.s / from.s) ** k;
      if (Math.abs(to.s - from.s) < 0.001) return { x: lerp(from.x, to.x, k), y: lerp(from.y, to.y, k), s };
      // Zoom around the one world point that holds still on screen between both shots.
      const px = (from.x * from.s - to.x * to.s) / (from.s - to.s);
      const py = (from.y * from.s - to.y * to.s) / (from.s - to.s);
      return { x: px - (px - from.x) * from.s / s, y: py - (py - from.y) * from.s / s, s };
    }
    return from;
  }

  renderCursor(/** @type {number} */ t, /** @type {{ x: number, y: number, s: number }} */ camera) {
    const { moves = [], visible: windows = [], clicks = [] } = this.storyboard.cursor ?? {};
    if (!this.cursor) return;
    const visible = Math.max(0, ...windows.map(([a, b]) => clamp((t - a) / 0.25) * clamp((b - t) / 0.3)));
    this.cursor.style.opacity = visible.toFixed(3);
    if (this.ripple) this.ripple.style.opacity = "0";
    if (!visible) return;
    /** @type {{ x: number, y: number } | null} */
    let point = null;
    for (const move of moves) {
      const [start, end] = move.at;
      if (t < start) break;
      const r = this.rect(move.focus);
      const to = { x: r.x + r.w * (move.ax ?? 0.5) + (move.dx ?? 0), y: r.y + r.h * (move.ay ?? 0.5) + (move.dy ?? 0) };
      if (!point || t >= end) { point = to; continue; }
      const k = EASE.io((t - start) / (end - start));
      point = { x: lerp(point.x, to.x, k), y: lerp(point.y, to.y, k) };
      break;
    }
    if (!point) return;
    const x = this.stageWidth / 2 + (point.x - camera.x) * camera.s;
    const y = this.stageHeight / 2 + (point.y - camera.y) * camera.s;
    const press = Math.max(0, ...clicks.map(click => Math.sin(Math.PI * clamp((t - click + 0.08) / 0.28))));
    this.cursor.style.transform = `translate(${x}px, ${y}px) scale(${1 - 0.16 * press})`;
    const click = clicks.findLast(time => time <= t && t - time < 0.6);
    if (click === undefined || !this.ripple) return;
    const k = (t - click) / 0.6;
    this.ripple.style.opacity = ((1 - k) * visible).toFixed(3);
    this.ripple.style.transform = `translate(${x}px, ${y}px) scale(${0.3 + 1.1 * EASE.o(k)})`;
  }
}

// Exposed for tooling (sound cue extraction) that runs in the page without importing this module.
MotionGraphic.keystrokes = keystrokes;

if (!customElements.get("motion-graphic")) customElements.define("motion-graphic", MotionGraphic);
