#!/usr/bin/env python3
"""Mix a motion soundtrack — voice-over, background music and sound effects — on the motion's clock.

    python3 mix.py soundtrack.json

Config (paths relative to the config file):
{
  "events": "events.json",            # from events.cjs (playback time; must start at 0)
  "output": "soundtrack.mp3",         # .mp3 / .m4a / .wav
  "length": 61.2,                      # optional, default: events end
  "voice": {"path": "voice.mp3", "gainDb": 0},                         # optional
  "music": {"path": "music.wav", "at": 5.2, "offset": 0, "gainDb": -14,
            "fadeIn": 0.4, "fadeOut": 0.8, "duck": true, "carveDb": -4},  # optional
  "kit": "sfx",                       # optional: folder with kit.json (make-sfx.py writes one)
  "sounds": {"click": {"gainDb": -16}, "pop": {"path": "my-pop.wav", "onset": 0.03}}
}

Sound modes:  one-shot (default): placed so its onset lands on the cue; "trim" seconds, "fadeOut".
              span: typing — plays from "offsets"[i] for exactly as long as each input is typed.
              slices: cuts successive "onsets" out of one file, one slice per cue (count ticks).
Music ducks under the voice with sidechain compression and gets a gentle EQ carve where speech
sits (≈2.5 kHz). Mono voice is copied to both channels at full level. Needs ffmpeg ($FFMPEG).
"""
import json
import os
import re
import subprocess
import sys

if len(sys.argv) != 2:
    sys.exit(__doc__)
config_path = os.path.abspath(sys.argv[1])
base = os.path.dirname(config_path)
config = json.load(open(config_path))
ffmpeg = os.environ.get("FFMPEG", "ffmpeg")
here = lambda path: path if os.path.isabs(path) else os.path.normpath(os.path.join(base, path))

events = json.load(open(here(config["events"])))
if abs(events.get("begin", 0)) > 0.01:
    print(f"warning: events start at {events['begin']} s; give the motion a soundtrack sync that starts at 0", file=sys.stderr)
length = float(config.get("length") or events["end"])

sounds = {}
if config.get("kit"):
    kit_dir = here(config["kit"])
    for name, sound in json.load(open(os.path.join(kit_dir, "kit.json")))["sounds"].items():
        sounds[name] = {**sound, "path": os.path.join(kit_dir, sound["path"])}
for name, sound in config.get("sounds", {}).items():
    merged = {**sounds.get(name, {}), **sound}
    if "path" in sound:
        merged["path"] = here(sound["path"])
    sounds[name] = merged

inputs, parts, labels = [], [], []
ms = lambda t: max(0, int(round(t * 1000)))


def add_input(path):
    inputs.append(path)
    return len(inputs) - 1


def channels(path):
    probe = subprocess.run([ffmpeg, "-hide_banner", "-i", path], capture_output=True, text=True).stderr
    return 1 if re.search(r"Audio:.*\bmono\b", probe) else 2


def fade_tail(duration, fade):
    return f"afade=t=out:st={max(0.0, duration - fade):.3f}:d={fade:.3f}"


# Voice-over
voice_label = None
if config.get("voice"):
    voice = config["voice"]
    index = add_input(here(voice["path"]))
    stereo = "pan=stereo|c0=c0|c1=c0" if channels(inputs[index]) == 1 else "aformat=channel_layouts=stereo"
    parts.append(f"[{index}:a]aresample=48000,{stereo},volume={voice.get('gainDb', 0)}dB,asplit=2[voice][voicekey0]")
    parts.append("[voicekey0]apad[voicekey]")
    voice_label = "[voice]"

# Music
voice_label_used = False
if config.get("music"):
    music = config["music"]
    index = add_input(here(music["path"]))
    chain = [f"aresample=48000,aformat=channel_layouts=stereo,atrim=start={music.get('offset', 0)}", "asetpts=PTS-STARTPTS",
             f"afade=t=in:d={music.get('fadeIn', 0.4)}"]
    if voice_label and music.get("carveDb", -4):
        chain.append(f"equalizer=f=2500:t=q:w=1.2:g={music.get('carveDb', -4)}")
    chain += [f"volume={music.get('gainDb', -14)}dB", f"adelay=delays={ms(music.get('at', 0))}:all=1",
              fade_tail(length, music.get("fadeOut", 0.8))]
    parts.append(f"[{index}:a]{','.join(chain)}[musicdry]")
    if voice_label and music.get("duck", True):
        parts.append("[musicdry][voicekey]sidechaincompress=threshold=0.025:ratio=4:attack=20:release=600[music]")
        voice_label_used = True
    else:
        parts.append("[musicdry]anull[music]")
    labels.append("[music]")
if voice_label and not voice_label_used:
    parts.append("[voicekey]anullsink")

# Sound effects
cues_by_sound = {}
for cue in events.get("cues", []):
    cues_by_sound.setdefault(cue["sound"], []).append(cue["at"])
if events.get("typing"):
    cues_by_sound.setdefault("typing", [])

for name, times in cues_by_sound.items():
    sound = sounds.get(name)
    if not sound:
        print(f"warning: no sound configured for '{name}' ({len(times) or len(events.get('typing', []))} cues skipped)", file=sys.stderr)
        continue
    index = add_input(sound["path"])
    gain = sound.get("gainDb", -14)
    prep = f"[{index}:a]aresample=48000,aformat=channel_layouts=stereo"
    mode = sound.get("mode", "one-shot")
    if mode == "span":
        spans = events.get("typing", [])
        offsets = sound.get("offsets", [0])
        parts.append(f"{prep},asplit={len(spans)}" + "".join(f"[{name}s{i}]" for i in range(len(spans))))
        for i, span in enumerate(spans):
            dur = span["to"] - span["from"]
            parts.append(f"[{name}s{i}]atrim=start={offsets[i % len(offsets)]}:duration={dur + 0.14:.3f},asetpts=PTS-STARTPTS,"
                         f"afade=t=in:d=0.01,afade=t=out:st={dur:.3f}:d=0.14,volume={gain}dB,adelay=delays={ms(span['from'])}:all=1[{name}{i}]")
            labels.append(f"[{name}{i}]")
    elif mode == "slices":
        onsets, slice_len = sound["onsets"], sound.get("slice", 0.24)
        parts.append(f"{prep},asplit={len(times)}" + "".join(f"[{name}s{i}]" for i in range(len(times))))
        for i, at in enumerate(times):
            onset = onsets[i % len(onsets)]
            parts.append(f"[{name}s{i}]atrim=start={max(0, onset - 0.02):.3f}:duration={slice_len},asetpts=PTS-STARTPTS,"
                         f"{fade_tail(slice_len, 0.1)},volume={gain}dB,adelay=delays={ms(at - 0.02)}:all=1[{name}{i}]")
            labels.append(f"[{name}{i}]")
    else:
        trim = f",atrim=duration={sound['trim']}" if sound.get("trim") else ""
        tail = f",{fade_tail(sound['trim'], sound.get('fadeOut', 0.12))}" if sound.get("trim") else ""
        parts.append(f"{prep}{trim}{tail},volume={gain}dB,asplit={len(times)}" + "".join(f"[{name}s{i}]" for i in range(len(times))))
        for i, at in enumerate(times):
            parts.append(f"[{name}s{i}]adelay=delays={ms(at - sound.get('onset', 0))}:all=1[{name}{i}]")
            labels.append(f"[{name}{i}]")

mix_inputs = ([voice_label] if voice_label else []) + labels
if not mix_inputs:
    sys.exit("nothing to mix")
parts.append("".join(mix_inputs) + f"amix=inputs={len(mix_inputs)}:duration=longest:normalize=0[out]")

output = here(config.get("output", "soundtrack.mp3"))
codec = {".mp3": ["-c:a", "libmp3lame", "-b:a", "160k"], ".m4a": ["-c:a", "aac", "-b:a", "192k"], ".wav": ["-c:a", "pcm_s16le"]}[os.path.splitext(output)[1]]
command = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error"] + sum((["-i", path] for path in inputs), []) + \
          ["-filter_complex", ";".join(parts), "-map", "[out]", "-t", f"{length:.3f}", *codec, output]
subprocess.run(command, check=True)
levels = subprocess.run([ffmpeg, "-hide_banner", "-i", output, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
mean = re.search(r"mean_volume: (\S+) dB", levels).group(1)
peak = re.search(r"max_volume: (\S+) dB", levels).group(1)
print(f"{output}: {length:.2f} s, mean {mean} dB, peak {peak} dB")
