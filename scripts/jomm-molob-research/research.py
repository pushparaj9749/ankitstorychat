#!/usr/bin/env python3
"""Download public Molob references for visual analysis; never publish raw videos."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work" / "jomm-molob-research"
RAW = WORK / "raw"
OUT = WORK / "review"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
REFERENCES = [
    {"id": "itachi_maki", "videoId": "wlOEeM7CDMQ", "title": "This Itachi & Maki EDIT Took Me 10+ Hours", "seconds": 20},
    {"id": "sukuna_now_or_never", "videoId": "sKm9KqNu064", "title": "Sukuna — Now Or Never", "seconds": 32},
    {"id": "hashira_wannabe", "videoId": "4sZP4zxl5Bg", "title": "Hashira — Wannabe", "seconds": 28},
    {"id": "sukuna_two", "videoId": "ZbWoJXmX9mI", "title": "Ryomen Sukuna — Two", "seconds": 27},
]


def run(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    print("+", " ".join(str(arg) for arg in args), flush=True)
    return subprocess.run([str(arg) for arg in args], check=check)


def probe(path: Path) -> dict:
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,width,height,r_frame_rate",
        "-of", "json", path,
    ], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def download_reference(entry: dict) -> tuple[Path | None, list[str]]:
    video_id = entry["videoId"]
    url = f"https://www.youtube.com/watch?v={video_id}"
    errors = []
    attempts = [
        [],
        ["--extractor-args", "youtube:player_client=android,web_embedded"],
        ["--extractor-args", "youtube:player_client=ios,web_embedded"],
    ]
    for extra in attempts:
        for old in RAW.glob(f"{entry['id']}.*"):
            old.unlink()
        command = [
            "yt-dlp", "--js-runtimes", "deno", "--no-playlist",
            "--retries", "2", "--socket-timeout", "35",
            "-f", "bv*[height<=1080]/b[height<=1080]/best",
            *extra, "-o", str(RAW / f"{entry['id']}.%(ext)s"), url,
        ]
        result = run(command, check=False)
        if result.returncode == 0:
            files = [path for path in RAW.glob(f"{entry['id']}.*") if path.suffix != ".part"]
            if files and files[0].stat().st_size > 100_000:
                return files[0], errors
        error = f"Attempt {len(errors) + 1} failed with exit {result.returncode}: {' '.join(extra) or 'default client'}"
        errors.append(error)
        print(error, flush=True)
    return None, errors


def thumbnail_fallback(entry: dict) -> list[Path]:
    paths = []
    for name in ["maxresdefault", "hq1", "hq2", "hq3", "sd1", "sd2", "sd3"]:
        url = f"https://i.ytimg.com/vi/{entry['videoId']}/{name}.jpg"
        response = requests.get(url, timeout=35)
        if response.status_code != 200 or len(response.content) < 8_000:
            continue
        path = RAW / f"{entry['id']}-{name}.jpg"
        path.write_bytes(response.content)
        try:
            with Image.open(path) as image:
                image.verify()
        except Exception:
            path.unlink(missing_ok=True)
            continue
        paths.append(path)
        if len(paths) == 4:
            break
    return paths


def make_sheet(entry: dict, frames: list[tuple[Image.Image, str]], status: str) -> Path:
    tile_w, tile_h = 320, 240
    rows = (len(frames) + 3) // 4
    sheet = Image.new("RGB", (4 * tile_w + 32, 110 + rows * (tile_h + 34) + 20), "#0c0f16")
    draw = ImageDraw.Draw(sheet)
    title_font = ImageFont.truetype(BOLD, 25)
    small = ImageFont.truetype(FONT, 17)
    draw.text((16, 14), entry["title"], font=title_font, fill="#f0d39d")
    draw.text((16, 52), f"Molob @mol0b  •  {status}  •  research only, raw video not published", font=small, fill="white")
    for index, (frame, label) in enumerate(frames):
        x = 16 + (index % 4) * tile_w
        y = 94 + (index // 4) * (tile_h + 34)
        fitted = ImageOps.contain(frame.convert("RGB"), (tile_w - 8, tile_h - 8), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (tile_w - 8, tile_h - 8), "black")
        canvas.paste(fitted, ((canvas.width - fitted.width) // 2, (canvas.height - fitted.height) // 2))
        sheet.paste(canvas, (x, y))
        draw.text((x, y + tile_h - 3), label, font=small, fill="#cdd3df")
    path = OUT / f"{entry['id']}-contact.jpg"
    sheet.save(path, quality=92)
    return path


def video_sheet(entry: dict, video: Path) -> tuple[Path, dict]:
    metadata = probe(video)
    duration = float(metadata["format"]["duration"])
    frames = []
    for index, fraction in enumerate(np.linspace(0.04, 0.96, 12)):
        timestamp = duration * float(fraction)
        path = RAW / f"{entry['id']}-frame-{index:02d}.jpg"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{timestamp:.3f}",
            "-i", video, "-frames:v", "1", "-vf", "scale=960:-2", "-q:v", "2", path,
        ])
        frames.append((Image.open(path).convert("RGB"), f"{timestamp:06.2f}s"))
    sheet = make_sheet(entry, frames, f"FULL VIDEO  {duration:.2f}s")
    return sheet, metadata


def fallback_sheet(entry: dict, images: list[Path]) -> Path:
    frames = [(Image.open(path).convert("RGB"), path.stem.split("-")[-1]) for path in images]
    return make_sheet(entry, frames, "PUBLIC THUMBNAIL FALLBACK")


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    for entry in REFERENCES:
        print(f"\n=== Molob research: {entry['title']} ===", flush=True)
        video, errors = download_reference(entry)
        if video is not None:
            sheet, metadata = video_sheet(entry, video)
            report.append({**entry, "status": "full_video_analysed", "sheet": sheet.name, "probe": metadata})
            continue
        print("Video download unavailable; using public YouTube frame thumbnails.", flush=True)
        images = thumbnail_fallback(entry)
        if not images:
            raise RuntimeError(f"No video or public thumbnails available for {entry['videoId']}: {errors}")
        sheet = fallback_sheet(entry, images)
        report.append({**entry, "status": "thumbnail_fallback", "sheet": sheet.name, "downloadErrors": errors})
    (OUT / "research.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print("Research review ready:", OUT, flush=True)


if __name__ == "__main__":
    main()
