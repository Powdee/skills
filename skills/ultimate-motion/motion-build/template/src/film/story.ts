import { loadFonts } from "../engine/brand";
import { AudioConfig } from "../engine/Soundtrack";
import { Story } from "../engine/Stage";
import sync from "./sync.json";

/*
 * The film's timeline, in story seconds. Title cards run at negative times so the
 * product walkthrough stays anchored at 0 (re-timing the intro never shifts it).
 * START/END bound the story; sync.json maps the voice-over's clock onto it
 * (motion-audio writes it; without a voice it is the identity START→END).
 */
export const START = -6;
export const END = 19;
export const LOCALE = "en";
export const NUMBER_LOCALE = "en-GB";
export const SYNC: number[][] = sync.pairs;

// Brand fonts: put woff2 files in public/fonts and list them here (weight -> path).
export const FONT_FAMILY = "Brand Sans";
export const FONT_FILES: Record<string, string> = {};
loadFonts(FONT_FAMILY, FONT_FILES);

export const STORY: Story = {
  stage: { width: 1280, height: 720 },
  camera: [
    { at: [0, 0], focus: "input", scale: 2.4, portrait: { scale: 1.9 } },
    { at: [3.45, 5.4], focus: "world", scale: 1, portrait: { focus: "dashboard", scale: undefined } },
    { at: [10.2, 11.2], focus: "chart", scale: 1.55, portrait: { scale: undefined } },
    { at: [12.3, 13.4], focus: "insight", scale: 1.7, portrait: { scale: undefined } },
    { at: [15.0, 16.2], focus: "world", scale: 1, portrait: { focus: "dashboard", scale: undefined } },
  ],
  // 9:16: the 1280×720 workspace is too wide to show whole, so visit one panel at a time.
  portraitCamera: [
    { at: [0, 0], focus: "input", scale: 1.9 },
    { at: [3.45, 5.4], focus: "list" },
    { at: [9.0, 10.0], focus: "detail" },
    { at: [10.2, 11.2], focus: "chart" },
    { at: [12.3, 13.4], focus: "insight" },
    { at: [15.0, 16.2], focus: "dashboard" },
  ],
  cursor: [
    { at: [7.7, 7.7], focus: "detail", ax: 0.4, ay: 0.55 },
    { at: [7.8, 8.7], focus: "row", ax: 0.45 },
  ],
  cursorVisible: [[7.7, 9.5]],
  clicks: [8.9],
};

// Sound: files live in public/ (voice from the user, sfx/music from the user or licensed).
// Missing files are simply skipped, so the film renders silently until they exist.
export const AUDIO: AudioConfig = {
  voice: sync.voice ?? undefined,
  music: sync.music ? { src: sync.music, volume: 0.12, duckUnderVoice: 0.6 } : undefined,
  speech: sync.speech as [number, number][],
  sfx: { click: "sfx/click.wav", typing: "sfx/typing.wav", pop: "sfx/pop.wav", count: "sfx/count.wav", chart: "sfx/chart.wav", answer: "sfx/answer.wav" },
  sfxVolume: 0.32,
  cues: [
    { at: -5.4, kind: "pop" },
    { at: 1.3, kind: "typing", dur: 1.7 },
    { at: 3.2, kind: "pop" },
    { at: 7.4, kind: "answer", dur: 2 },
    { at: 9.2, kind: "count", dur: 0.9 },
    { at: 9.6, kind: "chart", dur: 1.5 },
    { at: 12.4, kind: "pop" },
    { at: 16.2, kind: "pop" },
  ],
};
