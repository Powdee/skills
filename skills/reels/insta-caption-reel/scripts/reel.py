#!/usr/bin/env python3
"""insta-caption-reel engine: storyboard captions + punch-in camera over the user's clips and voice.

  python3 reel.py check  <reel.json>          validate words/captions, print layout warnings
  python3 reel.py qa     <reel.json>          contact sheet (qa.jpg) with safe-zone guides
  python3 reel.py still  <reel.json> <t>      one frame -> still_<t>.png
  python3 reel.py render <reel.json>          final MP4 (voice at -14 LUFS, camera audio muted)

Paths in reel.json are relative to the file's folder. The base cut (base.mp4) is rebuilt only when
the clip list changes. See ../SKILL.md and ../references/style.md.
"""
import hashlib
import io
import json
import math
import os
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(SKILL, "fonts")
COLOURS = {"L": (244, 244, 244), "D": (3, 32, 40)}          # #f4f4f4, #032028
FACES = ("HI", "SI", "ST", "HU")
FORMATS = {
    "vertical": {"size": [1080, 1920], "bottom": 590, "top_min": 230, "left": 70, "right": 1010,
                 "ui_top": 220, "ui_bottom": 420},
    "landscape": {"size": [1920, 1080], "bottom": 330, "top_min": 60, "left": 110, "right": 1810,
                  "ui_top": 0, "ui_bottom": 0},
}
FPS = 30
LINE_GAP = 18
POP = 0.2            # word pop-in duration
SHRINK = 0.12        # caption shrink-out before a pause


# ---------------------------------------------------------------- config

def load(path):
    path = os.path.abspath(path)
    root = os.path.dirname(path)
    cfg = json.load(open(path))
    rel = lambda p: p if os.path.isabs(os.path.expanduser(p)) else os.path.join(root, p)
    cfg["_root"] = root
    fmt = dict(FORMATS[cfg.get("format", "vertical")])
    fmt.update(cfg.get("layout", {}))
    cfg["_fmt"] = fmt
    cfg["_W"], cfg["_H"] = fmt["size"]
    fmt.setdefault("center", (fmt["left"] + fmt["right"]) / 2)

    words = cfg["words"]
    if isinstance(words, str):
        wj = json.load(open(rel(words)))
        cfg["_words"], speech_end = wj["words"], wj["speech_end"]
        cfg.setdefault("voice", wj.get("voice"))
    else:
        cfg["_words"], speech_end = words, cfg["speech_end"]
    cfg["voice"] = os.path.expanduser(rel(cfg["voice"]))
    cfg["_speech_end"] = speech_end
    cfg["_duration"] = cfg.get("duration", round(speech_end + cfg.get("tail", 2.0), 2))

    # timeline
    t, cuts = 0.0, []
    for k, clip in enumerate(cfg["clips"]):
        clip["src"] = os.path.expanduser(rel(clip["src"]))
        speed = clip.setdefault("speed", 1.0)
        clip.setdefault("in", 0.0)
        src_len = probe_duration(clip["src"])
        if "out" not in clip:
            if k + 1 < len(cfg["clips"]):
                sys.exit(f"clip {k}: only the last clip may omit 'out'")
            clip["out"] = round(clip["in"] + (cfg["_duration"] - t) * speed, 3)
        if clip["out"] > src_len + 0.02:
            need = (cfg["_duration"] - t) / (src_len - clip["in"])
            sys.exit(f"clip {k} ({os.path.basename(clip['src'])}) needs {clip['out']:.2f}s but has {src_len:.2f}s – "
                     f"start it earlier or set \"speed\": {1 / need:.3f} (slow-motion)")
        clip["_t0"] = t
        t += (clip["out"] - clip["in"]) / speed
        clip["_t1"] = t
        cuts.append(round(t, 3))
    cfg["_cuts"] = cuts[:-1]
    if abs(t - cfg["_duration"]) > 0.05:
        print(f"note: clips run {t:.2f}s, film is {cfg['_duration']:.2f}s – the last frame holds" if t < cfg["_duration"]
              else f"note: clips run {t:.2f}s, film is cut at {cfg['_duration']:.2f}s")
    cfg["_base"] = os.path.join(root, "base.mp4")
    return cfg


def probe_duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"cannot read {path}")
    return float(r.stdout)


def probe_size(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    w, h = r.stdout.strip().split(",")[:2]
    return int(w), int(h)


def build_base(cfg):
    """Trim/speed/concat the clips into base.mp4 (+ room.wav when the camera audio is kept)."""
    key = hashlib.sha1(json.dumps([[c["src"], c["in"], c["out"], c["speed"]] for c in cfg["clips"]]).encode()).hexdigest()
    stamp = cfg["_base"] + ".key"
    if os.path.exists(cfg["_base"]) and os.path.exists(stamp) and open(stamp).read() == key:
        return
    sw, sh = probe_size(cfg["clips"][0]["src"])
    inputs, vf, af = [], [], []
    for k, c in enumerate(cfg["clips"]):
        inputs += ["-i", c["src"]]
        f = f"[{k}:v]trim={c['in']}:{c['out']},setpts=(PTS-STARTPTS)/{c['speed']}"
        if c["speed"] < 0.999:
            f += ",minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
        vf.append(f + f",scale={sw}:{sh},fps={FPS},format=yuv420p[v{k}]")
        af.append(f"[{k}:a]atrim={c['in']}:{c['out']},asetpts=PTS-STARTPTS,atempo={c['speed']},"
                  f"aresample=48000,aformat=channel_layouts=mono[a{k}]")
    n = len(cfg["clips"])
    graph = ";".join(vf) + ";" + "".join(f"[v{k}]" for k in range(n)) + f"concat=n={n}:v=1:a=0[v]"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs]
    if cfg.get("keep_video_audio"):
        graph += ";" + ";".join(af) + ";" + "".join(f"[a{k}]" for k in range(n)) + f"concat=n={n}:v=0:a=1[a]"
        cmd += ["-filter_complex", graph, "-map", "[v]", "-c:v", "libx264", "-crf", "10", "-preset", "fast",
                cfg["_base"], "-map", "[a]", "-c:a", "pcm_s16le", os.path.join(cfg["_root"], "room.wav")]
    else:
        cmd += ["-filter_complex", graph, "-map", "[v]", "-an", "-c:v", "libx264", "-crf", "10", "-preset", "fast",
                cfg["_base"]]
    print("building base cut …")
    subprocess.run(cmd, check=True)
    open(stamp, "w").write(key)


# ---------------------------------------------------------------- typography

_fonts, _sprites = {}, {}
FONT_FILES = ("Hellix-Bold.ttf", "LibreBodoni-Italic.ttf", "BigShouldersStencil.ttf")


def ensure_fonts():
    missing = [f for f in FONT_FILES if not os.path.exists(os.path.join(FONT_DIR, f))]
    if "Hellix-Bold.ttf" in missing:
        sys.exit(f"{FONT_DIR}/Hellix-Bold.ttf is missing. Hellix is a commercial typeface and is not shipped with "
                 f"this skill: copy your licensed Hellix-Bold.ttf there (see fonts/README.md for converting .woff2).")
    if missing:
        sys.exit(f"missing fonts in {FONT_DIR}: {', '.join(missing)} – reinstall the skill")


def font(face, size):
    key = (face, size)
    if key not in _fonts:
        if face in ("HI", "HU"):
            f = ImageFont.truetype(os.path.join(FONT_DIR, "Hellix-Bold.ttf"), size)
        elif face == "SI":
            f = ImageFont.truetype(os.path.join(FONT_DIR, "LibreBodoni-Italic.ttf"), size)
            f.set_variation_by_axes([430])
        else:
            f = ImageFont.truetype(os.path.join(FONT_DIR, "BigShouldersStencil.ttf"), size)
            f.set_variation_by_axes([900, 72])
        _fonts[key] = f
    return _fonts[key]


def sprite(text, face, size, colour):
    """Tight RGBA word image + baseline offset. HI = Hellix Bold sheared 11° and emboldened."""
    key = (text, face, size, colour)
    if key in _sprites:
        return _sprites[key]
    f = font(face, size)
    stroke = max(1, round(size * 0.018)) if face == "HI" else 0
    l, t, r, b = f.getbbox(text, anchor="ls", stroke_width=stroke)
    pad = int(size * 0.4)
    img = Image.new("RGBA", (r - l + 2 * pad, b - t + 2 * pad), (0, 0, 0, 0))
    base = pad - t
    ImageDraw.Draw(img).text((pad - l, base), text, font=f, anchor="ls", fill=colour,
                             stroke_width=stroke, stroke_fill=colour)
    if face == "HI":
        k = math.tan(math.radians(11))
        img = img.transform(img.size, Image.AFFINE, (1, k, -k * base, 0, 1, 0), resample=Image.BICUBIC)
    box = img.getchannel("A").getbbox()
    img = img.crop(box)
    _sprites[key] = (img, base - box[1])
    return _sprites[key]


TOKEN = re.compile(r"^(.+):(HI|SI|ST|HU)(\d+)([LD])$")


def parse_lines(lines):
    """["right | I’M:HI150L BUILDING:HI150D", …] -> [(align, [(text, face, size, colour)])]."""
    out = []
    for s in lines:
        align, _, rest = s.partition("|")
        align = align.strip()
        if align not in ("left", "right", "center"):
            sys.exit(f"caption line {s!r}: start with 'left |', 'right |' or 'center |'")
        toks = []
        for tok in rest.split():
            m = TOKEN.match(tok)
            if not m:
                sys.exit(f"caption token {tok!r}: write TEXT:FACESIZECOLOUR, e.g. HEY:HI330L")
            toks.append((m.group(1), m.group(2), int(m.group(3)), COLOURS[m.group(4)]))
        out.append((align, toks))
    return out


def norm(s):
    return re.sub(r"[^0-9a-zà-ž]", "", s.lower())


def layout(fmt, lines, starts, k=1.0):
    max_w = fmt["right"] - fmt["left"]
    while True:
        placed, rows, i = [], [], 0
        for align, toks in lines:
            row = []
            for text, face, size, colour in toks:
                row.append({"text": text, "face": face, "size": size * k, "colour": colour, "start": starts[i]})
                i += 1
            fit = 1.0
            while True:
                for w in row:
                    w["img"], w["base"] = sprite(w["text"], w["face"], round(w["size"] * fit), w["colour"])
                gaps = [0.2 * max(a["size"], b["size"]) * fit for a, b in zip(row, row[1:])]
                width = sum(w["img"].width for w in row) + sum(gaps)
                if width <= max_w:
                    break
                fit *= 0.95
            x = {"right": fmt["right"] - width, "left": fmt["left"], "center": fmt["center"] - width / 2}[align]
            for j, w in enumerate(row):
                w["x"], w["y"] = x, fmt["bottom"] - w["base"]
                x += w["img"].width + (gaps[j] if j < len(gaps) else 0)
            placed += row
            rows.append(row)
        for upper, lower in reversed(list(zip(rows, rows[1:]))):   # stack lines upward from the bottom
            lift = max(w["y"] + w["img"].height for w in upper) - (min(w["y"] for w in lower) - LINE_GAP)
            for w in upper:
                w["y"] -= lift
        if min(w["y"] for w in placed) >= fmt["top_min"] or k < 0.4:
            break
        k *= 0.95
    for w in placed:
        w["cx"], w["cy"] = w["x"] + w["img"].width / 2, w["y"] + w["img"].height / 2
    xs = [w["x"] for w in placed] + [w["x"] + w["img"].width for w in placed]
    ys = [w["y"] for w in placed] + [w["y"] + w["img"].height for w in placed]
    return {"words": placed, "centre": ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2),
            "box": (min(xs), min(ys), max(xs), max(ys)), "k": k}


def build_captions(cfg):
    fmt, words = cfg["_fmt"], cfg["_words"]
    caps, i, problems = [], 0, []
    for n, spec in enumerate(cfg["captions"]):
        lines = parse_lines(spec["lines"])
        count = sum(len(t) for _, t in lines)
        mine = words[i:i + count]
        if len(mine) < count:
            sys.exit(f"caption {n}: runs past the end of the words list")
        shown = [t[0] for _, toks in lines for t in toks]
        for s, (w, _) in zip(shown, mine):
            if norm(s) != norm(w):
                problems.append(f"caption {n}: shows {s!r} where the voice says {w!r}")
        starts = [s for _, s in mine]
        variants = [layout(fmt, lines, starts)]
        for alt in spec.get("alts", []):
            alines = parse_lines(alt)
            if sum(len(t) for _, t in alines) != count:
                sys.exit(f"caption {n}: every alt must show the same {count} words")
            variants.append(layout(fmt, alines, starts))
        cyc = spec.get("cycle")
        if cyc:
            at = cyc["at"] if "at" in cyc else max(starts) + cyc.get("after", 0.18)
            cyc = {"at": at, "step": cyc.get("step", 0.1), "seq": cyc["seq"]}
        caps.append({"variants": variants, "start": starts[0], "last": max(starts), "end": spec.get("end"),
                     "cycle": cyc, "n": n})
        i += count
    if i != len(words):
        problems.append(f"captions cover {i} of {len(words)} words – next uncovered: {words[i][0]!r}")
    for j, c in enumerate(caps):
        if c["end"] == "cut":
            c["end"] = min([x for x in cfg["_cuts"] if x > c["start"]], default=cfg["_duration"])
        if c["end"] is None:
            c["end"] = caps[j + 1]["start"] if j + 1 < len(caps) else min(cfg["_speech_end"] + 1.3,
                                                                           cfg["_duration"] - 0.5)
        nxt = caps[j + 1]["start"] if j + 1 < len(caps) else None
        c["hard"] = (nxt is not None and nxt <= c["end"] + 1e-6) or any(abs(c["end"] - x) < 1e-3 for x in cfg["_cuts"])
    return caps, problems


# ---------------------------------------------------------------- animation

def clamp(p):
    return max(0.0, min(1.0, p))


def ease_out(p):
    return 1 - (1 - clamp(p)) ** 3


def ease_out_back(p, s=1.3):
    p = clamp(p) - 1
    return 1 + (s + 1) * p ** 3 + s * p ** 2


def captions_at(cfg, caps, t):
    canvas = Image.new("RGBA", (cfg["_W"], cfg["_H"]), (0, 0, 0, 0))
    for c in caps:
        if not (c["start"] <= t < c["end"] + (0 if c["hard"] else SHRINK)):
            continue
        v = 0
        if c["cycle"] and t >= c["cycle"]["at"]:
            seq = c["cycle"]["seq"]
            v = seq[min(int((t - c["cycle"]["at"]) / c["cycle"]["step"]), len(seq) - 1)]
        var = c["variants"][v]
        bx, by = var["centre"]
        exit_scale = 1 - clamp((t - c["end"]) / SHRINK) ** 2 if t >= c["end"] else 1.0
        for w in var["words"]:
            if t < w["start"]:
                continue
            p = (t - w["start"]) / POP
            scale = (0.35 + 0.65 * ease_out_back(p)) * exit_scale
            if scale < 0.03:
                continue
            img = w["img"]
            if abs(scale - 1) > 1e-3:
                img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.BICUBIC)
            cx = bx + (w["cx"] - bx) * exit_scale
            cy = by + (w["cy"] - by) * exit_scale + (1 - ease_out(p)) * 24
            canvas.alpha_composite(img, (round(cx - img.width / 2), round(cy - img.height / 2)))
    return canvas


def camera(cfg, t):
    clip = next((c for c in cfg["clips"] if c["_t0"] <= t < c["_t1"]), cfg["clips"][-1])
    push = cfg.get("push", 0.04)
    zoom = 1.0 + push * (t - clip["_t0"]) / max(0.1, clip["_t1"] - clip["_t0"])
    for a, b, z in cfg.get("punches", []):
        if a <= t < (b if b is not None else 1e9):
            zoom = z
    dx = dy = 0.0
    for s in cfg.get("shakes", []):
        if s <= t < s + 0.25:
            e = 1 - (t - s) / 0.25
            dx, dy = 12 * e * math.sin((t - s) * 95), 8 * e * math.cos((t - s) * 80)
    return clip, zoom, dx, dy


def frame(cfg, caps, src, t):
    W, H = cfg["_W"], cfg["_H"]
    clip, zoom, dx, dy = camera(cfg, t)
    sw, sh = src.size
    s0 = max(W / sw, H / sh)                                   # cover
    fx, fy = clip.get("face", [sw / 2, sh / 2])
    x0 = min(max(fx - W / (2 * s0), 0), sw - W / s0)           # crop window, centred on the face
    y0 = min(max(fy - H / (2 * s0), 0), sh - H / s0)
    xf, yf = (fx - x0) * s0, (fy - y0) * s0                    # face in the output at zoom 1
    s = s0 * zoom
    data = (1 / s, 0, fx - (xf + dx) / s, 0, 1 / s, fy - (yf + dy) / s)
    shot = src.transform((W, H), Image.AFFINE, data, resample=Image.BICUBIC).convert("RGBA")
    return Image.alpha_composite(shot, captions_at(cfg, caps, t)).convert("RGB")


def source_at(cfg, t):
    png = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{max(0, min(t, cfg['_duration'] - 0.05)):.3f}",
                          "-i", cfg["_base"], "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                         capture_output=True).stdout
    return Image.open(io.BytesIO(png)).convert("RGB")


# ---------------------------------------------------------------- commands

def check(cfg, caps, problems):
    fmt = cfg["_fmt"]
    for c in caps:
        for v, var in enumerate(c["variants"]):
            tag = f"caption {c['n']}" + (f" alt {v}" if v else "")
            ws = var["words"]
            for a in range(len(ws)):
                for b in range(a + 1, len(ws)):
                    A, B = ws[a], ws[b]
                    if (A["x"] < B["x"] + B["img"].width and B["x"] < A["x"] + A["img"].width and
                            A["y"] < B["y"] + B["img"].height and B["y"] < A["y"] + A["img"].height):
                        problems.append(f"{tag}: {A['text']} overlaps {B['text']}")
            if var["k"] < 0.85:
                print(f"note: {tag} shrunk to {var['k']:.0%} to fit the zone – lower its sizes to keep control")
        if c["end"] - c["start"] < 0.3:
            problems.append(f"caption {c['n']}: on screen only {c['end'] - c['start']:.2f}s – merge it")
    for line in problems:
        print("⚠️ ", line)
    print(f"{len(caps)} captions, {len(cfg['_words'])} words, film {cfg['_duration']:.2f}s, cuts at {cfg['_cuts']}, "
          f"speech ends {cfg['_speech_end']:.2f}s" + ("" if problems else " – OK"))
    return not problems


def qa(cfg, caps):
    W, H = cfg["_W"], cfg["_H"]
    fmt = cfg["_fmt"]
    times = [min(c["end"] - 0.04, c["last"] + 0.3) for c in caps]
    for c in caps:
        if c["cycle"]:
            times += [c["cycle"]["at"] + c["cycle"]["step"] * (k + 0.5) for k in range(len(c["cycle"]["seq"]))]
    times.append(cfg["_duration"] - 0.1)
    tw = 270 if W < H else 480
    th = round(tw * H / W)
    tiles = []
    for t in times:
        im = frame(cfg, caps, source_at(cfg, t), t)
        d = ImageDraw.Draw(im)
        if fmt["ui_top"]:
            d.rectangle([0, 0, W - 1, fmt["ui_top"]], outline=(255, 0, 0), width=4)
        if fmt["ui_bottom"]:
            d.rectangle([0, H - fmt["ui_bottom"], W - 1, H - 1], outline=(255, 0, 0), width=4)
        d.text((16, fmt["ui_top"] + 10), f"{t:.2f}s", fill=(255, 0, 0), font=font("HU", 40))
        tiles.append(im.resize((tw, th)))
    cols = 7 if W < H else 4
    sheet = Image.new("RGB", (tw * cols, th * ((len(tiles) + cols - 1) // cols)), "black")
    for i, tl in enumerate(tiles):
        sheet.paste(tl, ((i % cols) * tw, (i // cols) * th))
    out = os.path.join(cfg["_root"], "qa.jpg")
    sheet.save(out, quality=88)
    print(out)


def render(cfg, caps):
    W, H = cfg["_W"], cfg["_H"]
    out = os.path.expanduser(cfg["output"])
    if not os.path.isabs(out):
        out = os.path.join(cfg["_root"], out)
    sw, sh = probe_size(cfg["_base"])
    voice = f"[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,apad[v]"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0",
           "-i", cfg["voice"]]
    if cfg.get("keep_video_audio"):
        cmd += ["-i", os.path.join(cfg["_root"], "room.wav"), "-filter_complex",
                voice + ";[2:a]aformat=sample_rates=48000:channel_layouts=mono[r];[v][r]amix=inputs=2:normalize=0:duration=longest[a]"]
    else:
        cmd += ["-filter_complex", voice.replace("[v]", "[a]")]
    cmd += ["-map", "0:v", "-map", "[a]", "-t", str(cfg["_duration"]), "-c:v", "libx264", "-crf", "17",
            "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    dec = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", cfg["_base"], "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    last = None
    for n in range(round(cfg["_duration"] * FPS)):
        buf = dec.stdout.read(sw * sh * 3)
        if len(buf) == sw * sh * 3:
            last = Image.frombytes("RGB", (sw, sh), buf)
        enc.stdin.write(frame(cfg, caps, last, n / FPS).tobytes())
    enc.stdin.close()
    dec.kill()
    if enc.wait():
        sys.exit("encode failed")
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    loud = " ".join(re.findall(r"(I:\s+-?[0-9.]+ LUFS|Peak:\s+-?[0-9.]+ dBFS)", log)[-2:])
    print(f"{out}  {W}x{H}  {cfg['_duration']:.2f}s  {loud}")


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("check", "qa", "still", "render"):
        sys.exit(__doc__)
    ensure_fonts()
    cfg = load(sys.argv[2])
    caps, problems = build_captions(cfg)
    if sys.argv[1] == "check":
        sys.exit(0 if check(cfg, caps, problems) else 1)
    build_base(cfg)
    if sys.argv[1] == "qa":
        check(cfg, caps, problems)
        qa(cfg, caps)
    elif sys.argv[1] == "still":
        t = float(sys.argv[3])
        out = os.path.join(cfg["_root"], f"still_{t}.png")
        frame(cfg, caps, source_at(cfg, t), t).save(out)
        print(out)
    else:
        render(cfg, caps)


if __name__ == "__main__":
    main()
