#!/usr/bin/env python3
"""Generate the default sound-effect kit when the person has no effects of their own.

    python3 make-sfx.py [output-dir]          # default: ./sfx
    python3 make-sfx.py --measure file.wav …  # level of your own effects, to set their gainDb

Writes typing.wav, click.wav, chime.wav, tick.wav, pop.wav (48 kHz mono) and kit.json with the
modes, onsets and gains mix.py expects, so `"kit": "sfx"` in soundtrack.json just works. The
sounds are synthesized here (no samples, no licence strings attached), deterministic, and meant
as good-enough placeholders: recorded or ElevenLabs-generated effects sound better — swap any
file and keep its kit.json entry (or override it in soundtrack.json).
--measure prints each file's loudest 50 ms RMS; set gainDb = target − measured, with the targets
in references/mixing.md. Generating needs Python 3 only; measuring also needs ffmpeg ($FFMPEG).
"""
import json
import math
import os
import random
import struct
import sys
import wave

RATE = 48000

if sys.argv[1:2] == ["--measure"]:
    import array
    import subprocess
    for path in sys.argv[2:]:
        raw = subprocess.run([os.environ.get("FFMPEG", "ffmpeg"), "-v", "error", "-i", path, "-ac", "1", "-ar", str(RATE),
                              "-f", "s16le", "-"], check=True, capture_output=True).stdout
        samples, window = [v / 32768 for v in array.array("h", raw)], int(0.05 * RATE)
        loudest = max((sum(v * v for v in samples[i:i + window]) / window for i in range(0, max(1, len(samples) - window), RATE // 200)), default=0)
        print(f"{path}: loudest 50 ms RMS {10 * math.log10(loudest + 1e-12):.1f} dBFS")
    sys.exit()

out_dir = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "sfx")
os.makedirs(out_dir, exist_ok=True)
rng = random.Random(7)


def silence(seconds):
    return [0.0] * int(seconds * RATE)


def add(buffer, at, samples, gain=1.0):
    start = int(at * RATE)
    for i, value in enumerate(samples):
        if 0 <= start + i < len(buffer):
            buffer[start + i] += value * gain


def tone(freq, tau, seconds, attack=0.001, sweep=None):
    """A decaying sine; `sweep(t)` returns the frequency over time for pitch glides."""
    samples, phase = [], 0.0
    for i in range(int(seconds * RATE)):
        t = i / RATE
        phase += 2 * math.pi * (sweep(t) if sweep else freq) / RATE
        release = min(1.0, (seconds - t) / 0.02)  # fade the cut-off so it does not click
        samples.append(math.sin(phase) * min(1.0, t / attack) * math.exp(-t / tau) * release)
    return samples


def bandpass(samples, centre, q):
    """RBJ biquad band-pass (constant peak gain)."""
    w = 2 * math.pi * centre / RATE
    alpha = math.sin(w) / (2 * q)
    b0, b2, a0, a1, a2 = alpha, -alpha, 1 + alpha, -2 * math.cos(w), 1 - alpha
    out, x1, x2, y1, y2 = [], 0.0, 0.0, 0.0, 0.0
    for x in samples:
        y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0
        out.append(y)
        x2, x1, y2, y1 = x1, x, y1, y
    return out


def noise_burst(centre, q, tau, seconds):
    raw = [rng.uniform(-1, 1) * math.exp(-(i / RATE) / tau) for i in range(int(seconds * RATE))]
    return bandpass(raw, centre, q)


def room(samples, taps=((0.007, 0.22), (0.011, 0.16), (0.017, 0.11), (0.026, 0.07))):
    """A few early reflections so dry synthesis sounds like it happened in a space."""
    out = samples + [0.0] * int(0.03 * RATE)
    for delay, gain in taps:
        offset = int(delay * RATE)
        for i, value in enumerate(samples):
            out[i + offset] += value * gain
    return out


def reverb(samples, mix=0.18, seconds=0.9):
    """Small Schroeder reverb (parallel combs + one all-pass) for the chime's tail."""
    length = len(samples) + int(seconds * RATE)
    dry = samples + [0.0] * (length - len(samples))
    wet = [0.0] * length
    for delay_ms, feedback in ((29.7, 0.77), (37.1, 0.75), (41.1, 0.73), (43.7, 0.71)):
        d, line = int(delay_ms * RATE / 1000), [0.0] * length
        for i in range(length):
            line[i] = dry[i] + (line[i - d] * feedback if i >= d else 0.0)
            wet[i] += line[i] / 4
    d, g, out = int(5.0 * RATE / 1000), 0.6, [0.0] * length
    for i in range(length):
        delayed_in = wet[i - d] if i >= d else 0.0
        delayed_out = out[i - d] if i >= d else 0.0
        out[i] = -g * wet[i] + delayed_in + g * delayed_out
    return [a + b * mix for a, b in zip(dry, out)]


def write(name, samples, peak_db=-1.0):
    peak = max(abs(s) for s in samples) or 1.0
    scale = 10 ** (peak_db / 20) / peak
    fade = int(0.01 * RATE)
    for i in range(min(fade, len(samples))):  # no click at the very end
        samples[-1 - i] *= i / fade
    with wave.open(os.path.join(out_dir, name), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * scale)) * 32767)) for s in samples))


# Keyboard: soft laptop keys, ~9 keystrokes a second with a longer space every few words.
typing, t, keys = silence(8.0), 0.03, []
while t < 7.7:
    space = rng.random() < 0.16
    down = [a * 0.75 + b * 0.35 for a, b in zip(noise_burst(rng.uniform(2200, 3400), 1.4, 0.006, 0.05),
                                                tone(rng.uniform(170, 250) * (0.8 if space else 1), 0.012, 0.05))]
    up = noise_burst(rng.uniform(3000, 4200), 1.6, 0.003, 0.03)
    level = rng.uniform(0.7, 1.0) * (1.15 if space else 1.0)
    add(typing, t, down, level)
    add(typing, t + rng.uniform(0.035, 0.06), up, level * 0.35)
    keys.append(round(t, 3))
    t += rng.uniform(0.07, 0.15) + (0.1 if space else 0)
write("typing.wav", room(typing))
offsets = [round(max(0.0, min(keys, key=lambda k: abs(k - target)) - 0.01), 3) for target in (0.0, 2.0, 3.6)]

# Click: a press and a release of a soft UI button.
click = silence(0.3)
for at, level, pitch in ((0.0, 1.0, 1450), (0.075, 0.55, 1750)):
    body = [a * 0.6 + b * 0.35 + c * 0.25 for a, b, c in zip(noise_burst(3200, 1.2, 0.003, 0.04),
                                                             tone(pitch, 0.01, 0.04), tone(220, 0.018, 0.04))]
    add(click, at, body, level)
write("click.wav", room(click))

# Chime: two bell-like notes a fifth apart, with a short tail.
chime = silence(1.2)
for at, freq in ((0.0, 1046.5), (0.085, 1568.0)):
    for ratio, amp, tau in ((1.0, 1.0, 0.38), (2.0, 0.18, 0.2), (3.0, 0.06, 0.12), (4.2, 0.04, 0.08), (5.4, 0.05, 0.04)):
        add(chime, at, tone(freq * ratio, tau, 1.1, attack=0.004), amp * (0.85 if at else 1.0))
write("chime.wav", reverb(chime))

# Tick: twelve slightly different mechanical ticks for counters (one slice per change).
tick_onsets = [round(0.05 + 0.3 * i, 3) for i in range(12)]
tick = silence(3.7)
for at in tick_onsets:
    shape = [a * 0.5 + b * 0.6 + c * 0.2 for a, b, c in zip(noise_burst(rng.uniform(4800, 5600), 2.0, 0.001, 0.03),
                                                            tone(rng.uniform(3000, 3600), 0.0025, 0.03),
                                                            tone(900, 0.006, 0.03))]
    add(tick, at, shape, rng.uniform(0.85, 1.0))
write("tick.wav", room(tick))

# Pop: a short rising bubble for items that pop into place.
pop = silence(0.25)
add(pop, 0.005, tone(0, 0.03, 0.2, attack=0.001, sweep=lambda t: 320 + 820 * (1 - math.exp(-t / 0.012))))
add(pop, 0.005, noise_burst(2500, 1.0, 0.0015, 0.01), 0.25)
write("pop.wav", room(pop))

kit = {
    "about": "Default kit synthesized by make-sfx.py. Gains are applied in mix.py and sit the effects under a "
             "voice-over whose speech is around -20 dBFS RMS; positions are seconds inside each file.",
    "sounds": {
        "typing": {"path": "typing.wav", "mode": "span", "gainDb": -10, "offsets": offsets},
        "click": {"path": "click.wav", "gainDb": -13, "onset": 0},
        "chime": {"path": "chime.wav", "gainDb": -16, "onset": 0},
        "tick": {"path": "tick.wav", "mode": "slices", "gainDb": -11, "slice": 0.24, "onsets": tick_onsets},
        "pop": {"path": "pop.wav", "gainDb": -19, "onset": 0.005},
    },
}
json.dump(kit, open(os.path.join(out_dir, "kit.json"), "w"), indent=2)
print(f"wrote typing, click, chime, tick, pop and kit.json to {out_dir}")
