import { useMemo } from "react";
import { Html5Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { makeClock } from "./time";

/** A sound effect at a story time. kind names a file in AudioConfig.sfx. */
export type Cue = { at: number; kind: string; dur?: number; volume?: number };

export type AudioConfig = {
  voice?: string; // public path of the voice-over (playback clock starts at its 0)
  voiceVolume?: number;
  music?: { src: string; volume: number; trimBefore?: number; duckUnderVoice?: number };
  sfx?: Record<string, string>; // kind -> public path, e.g. { click: "sfx/click.wav" }
  sfxVolume?: number;
  cues?: Cue[];
  speech?: [number, number][]; // voice activity in playback seconds (motion-audio writes it) — music ducks there
};

/**
 * Voice-over, music bed and sound effects on one clock. Effects are placed in
 * story time and moved onto the voice's clock through the sync map, so they stay
 * glued to the picture when the timing is re-synced. Every click in the story
 * gets the "click" sound automatically.
 */
export const Soundtrack: React.FC<{ config: AudioConfig; sync: number[][]; clicks?: number[] }> = ({ config, sync, clicks = [] }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const clock = useMemo(() => makeClock(sync), [sync]);
  const frameOf = (story: number) => Math.max(0, Math.round((clock.toPlayback(story) - clock.begin) * fps));
  const voiceFrom = Math.max(0, Math.round(-clock.begin * fps));
  const cues: Cue[] = [...clicks.map((at) => ({ at, kind: "click" })), ...(config.cues ?? [])];
  const vol = config.sfxVolume ?? 0.35;

  const music = config.music;
  const duck = music?.duckUnderVoice ?? 0.6;
  const speech = (config.speech ?? []).map(([a, b]) => [voiceFrom + a * fps, voiceFrom + b * fps] as const);
  const musicVolume = (f: number) => {
    if (!music) return 0;
    let v = interpolate(f, [0, fps, durationInFrames - 1.5 * fps, durationInFrames], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    for (const [a, b] of speech) {
      v *= 1 - (1 - duck) * interpolate(f, [a - 6, a, b, b + 9], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    }
    return music.volume * v;
  };

  return (
    <>
      {config.voice ? (
        <Sequence from={voiceFrom} name="voice-over" layout="none">
          <Html5Audio src={staticFile(config.voice)} volume={config.voiceVolume ?? 1} />
        </Sequence>
      ) : null}
      {music ? <Html5Audio src={staticFile(music.src)} trimBefore={music.trimBefore ?? 0} volume={musicVolume} /> : null}
      {cues.map((c, i) => {
        const src = config.sfx?.[c.kind];
        if (!src) return null;
        return (
          <Sequence key={i} from={frameOf(c.at)} durationInFrames={Math.max(1, Math.round((c.dur ?? 1.5) * fps))} name={`sfx ${c.kind}`} layout="none">
            <Html5Audio src={staticFile(src)} volume={c.volume ?? vol} />
          </Sequence>
        );
      })}
    </>
  );
};
