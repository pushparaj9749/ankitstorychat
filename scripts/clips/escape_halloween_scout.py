#!/usr/bin/env python3
"""Download selected campaign footage and build visual/audio scouting reports.

Sources stay in the Actions runner only. The uploaded artifact contains just
contact sheets and a small JSON report, never the raw footage.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "scripts/clips/escape_halloween_sources.json"
WORK = ROOT / "work/escape-halloween"
RAW = WORK / "source"
OUT = WORK / "scout"
FRAMES = WORK / "frames"


def run(args: list[str], *, capture: bool = False) -> subprocess.CompletedProcess:
    print("+", " ".join(args[:8]), "..." if len(args) > 8 else "", flush=True)
    return subprocess.run(args, check=True, stdout=subprocess.PIPE if capture else None, stderr=subprocess.PIPE if capture else None)


def download(source: dict) -> Path:
    suffix = Path(source["filename"]).suffix.lower() or ".mp4"
    target = RAW / f"{source['id']}{suffix}"
    if target.exists() and target.stat().st_size > 1_000_000:
        return target
    run([
        "curl", "-fL", "--retry", "4", "--retry-delay", "3", "--connect-timeout", "30",
        "-A", "Mozilla/5.0", source["url"], "-o", str(target),
    ])
    if target.stat().st_size < 100_000:
        raise RuntimeError(f"Download too small (probably HTML): {source['id']}")
    with target.open("rb") as handle:
        if handle.read(32).lstrip().startswith(b"<"):
            raise RuntimeError(f"Dropbox returned HTML instead of media: {source['id']}")
    return target


def probe(path: Path) -> dict:
    result = run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
        "-of", "json", str(path),
    ], capture=True)
    return json.loads(result.stdout)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    path = Path("/usr/share/fonts/truetype/dejavu") / name
    try:
        return ImageFont.truetype(str(path), size)
    except OSError:
        return ImageFont.load_default()


def extract_frame(path: Path, at: float, target: Path) -> None:
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{at:.3f}",
        "-i", str(path), "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "2", str(target),
    ])


def contact_sheet(source: dict, path: Path, duration: float) -> None:
    times = [duration * (0.04 + 0.92 * i / 11) for i in range(12)]
    tiles: list[Image.Image] = []
    for index, at in enumerate(times):
        frame_path = FRAMES / f"{source['id']}-{index:02d}.jpg"
        extract_frame(path, at, frame_path)
        with Image.open(frame_path) as frame:
            tile = Image.new("RGB", (360, 250), "#08090d")
            fitted = ImageOps.contain(frame.convert("RGB"), (360, 220), Image.Resampling.LANCZOS)
            tile.paste(fitted, ((360 - fitted.width) // 2, (220 - fitted.height) // 2))
            draw = ImageDraw.Draw(tile)
            draw.text((10, 226), f"{at:05.2f}s", font=font(16, True), fill="#ffffff")
            tiles.append(tile)
    sheet = Image.new("RGB", (1440, 820), "#08090d")
    draw = ImageDraw.Draw(sheet)
    draw.text((20, 14), f"{source['artist']}  •  {source['stage']}", font=font(28, True), fill="#ffcf5a")
    draw.text((20, 50), f"{source['filename']}  •  {duration:.2f}s", font=font(18), fill="#d9dbe5")
    for index, tile in enumerate(tiles):
        sheet.paste(tile, ((index % 4) * 360, 70 + (index // 4) * 250))
    sheet.save(OUT / f"{source['id']}-contact.jpg", quality=92)


def audio_peaks(path: Path, duration: float) -> list[dict]:
    result = run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-vn",
        "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1",
    ], capture=True)
    samples = np.frombuffer(result.stdout, dtype=np.float32)
    if not samples.size:
        return []
    sample_rate = 16000
    window = sample_rate // 10
    usable = samples[: samples.size // window * window]
    if not usable.size:
        return []
    rms = np.sqrt(np.mean(usable.reshape(-1, window).astype(np.float64) ** 2, axis=1) + 1e-12)
    smooth = np.convolve(rms, np.ones(3) / 3, mode="same")
    baseline = max(float(np.median(smooth)), 1e-6)
    candidates = np.argsort(smooth)[::-1]
    selected: list[int] = []
    for index in candidates:
        at = index / 10
        if at < 0.3 or at > duration - 0.2:
            continue
        if any(abs(at - old / 10) < 1.5 for old in selected):
            continue
        selected.append(int(index))
        if len(selected) >= 12:
            break
    return [
        {
            "time": round(index / 10, 2),
            "rms_db": round(20 * math.log10(max(float(smooth[index]), 1e-6)), 2),
            "above_median_db": round(20 * math.log10(float(smooth[index]) / baseline), 2),
        }
        for index in sorted(selected)
    ]


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    FRAMES.mkdir(parents=True, exist_ok=True)
    sources = json.loads(SOURCES.read_text())
    report: list[dict] = []
    for source in sources:
        print(f"\n=== {source['id']} ===", flush=True)
        path = download(source)
        metadata = probe(path)
        duration = float(metadata["format"]["duration"])
        video = next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")
        contact_sheet(source, path, duration)
        peaks = audio_peaks(path, duration)
        entry = {
            **{key: source[key] for key in ("id", "artist", "stage", "filename", "url")},
            "duration": round(duration, 3),
            "width": video.get("width"),
            "height": video.get("height"),
            "fps": video.get("r_frame_rate"),
            "codec": video.get("codec_name"),
            "size_bytes": int(metadata["format"]["size"]),
            "audio_peaks": peaks,
        }
        report.append(entry)
        print(json.dumps(entry, indent=2), flush=True)
    (OUT / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(f"\nScout complete: {len(report)} sources -> {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
