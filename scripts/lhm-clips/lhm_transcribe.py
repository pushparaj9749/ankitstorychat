#!/usr/bin/env python3
"""Transcribe authorized LHM episodes using lightweight streaming proxies."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess

from faster_whisper import WhisperModel
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work/lhm"
OUT = WORK / "transcripts"
RAW = WORK / "source180"
RESPONSES = WORK / "inventory/frameio-responses.json"


def run(args: list[str], *, capture: bool = False) -> subprocess.CompletedProcess:
    print("+", " ".join(args[:10]), "..." if len(args) > 10 else "", flush=True)
    return subprocess.run(args, check=True, stdout=subprocess.PIPE if capture else None, stderr=subprocess.PIPE if capture else None)


def assets() -> list[dict]:
    responses = json.loads(RESPONSES.read_text())
    found: dict[str, dict] = {}
    for response in responses:
        if not response.get("contentType", "").startswith("application/json"):
            continue
        try:
            data = json.loads(response["body"])
        except (json.JSONDecodeError, KeyError):
            continue
        nodes = (data.get("data", {}).get("share", {}).get("assets", {}) or {}).get("nodes", [])
        for node in nodes:
            transcodes = (node.get("media") or {}).get("videoTranscodes") or []
            if not node.get("name") or not transcodes:
                continue
            by_key = {item["key"]: item for item in transcodes}
            proxy = by_key.get("h264_360")
            high = by_key.get("h264_1080_best")
            if proxy and high:
                found[node["id"]] = {
                    "id": node["id"],
                    "name": node["name"],
                    "duration": node["media"]["duration"],
                    "proxy_url": proxy["downloadUrl"],
                    "high_url": high["downloadUrl"],
                }
    if len(found) != 4:
        raise RuntimeError(f"Expected 4 episodes with streaming transcodes, found {len(found)}")
    return list(found.values())


def probe_duration(path: Path) -> float:
    result = run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path),
    ], capture=True)
    return float(json.loads(result.stdout)["format"]["duration"])


def contact_sheet(source: str, slug: str, target: Path, duration: float) -> None:
    frames_dir = WORK / "frames" / slug
    frames_dir.mkdir(parents=True, exist_ok=True)
    tiles = []
    for index in range(12):
        at = duration * (0.03 + 0.94 * index / 11)
        frame_path = frames_dir / f"{index:02d}.jpg"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{at:.2f}",
            "-i", source, "-frames:v", "1", "-vf", "scale=360:-2", str(frame_path),
        ])
        with Image.open(frame_path) as frame:
            tile = Image.new("RGB", (360, 235), "#0b0c11")
            fitted = ImageOps.contain(frame.convert("RGB"), (360, 205), Image.Resampling.LANCZOS)
            tile.paste(fitted, ((360 - fitted.width) // 2, (205 - fitted.height) // 2))
            ImageDraw.Draw(tile).text((10, 211), f"{at / 60:05.1f} min", fill="white")
            tiles.append(tile)
    sheet = Image.new("RGB", (1440, 745), "#0b0c11")
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 12), slug.replace("_", " "), fill="#ffd0a1")
    for index, tile in enumerate(tiles):
        sheet.paste(tile, ((index % 4) * 360, 40 + (index // 4) * 235))
    sheet.save(target, quality=90)


def timestamp(seconds: float) -> str:
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(parents=True, exist_ok=True)
    episodes = assets()
    model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=4)
    info = []
    for episode in episodes:
        slug = episode["name"].replace(" Full Episode.mov", "").replace(" ", "_")
        print(f"\n=== {slug} ===", flush=True)
        proxy = RAW / f"{slug}.wav"
        if not proxy.exists():
            run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", episode["proxy_url"],
                "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", str(proxy),
            ])
        duration = probe_duration(proxy)
        segments, _ = model.transcribe(
            str(proxy), language="en", beam_size=1, best_of=1, vad_filter=True,
            condition_on_previous_text=False,
        )
        rows = [{"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text.strip()} for s in segments]
        (OUT / f"{slug}.json").write_text(json.dumps({"episode": episode["name"], "duration": duration, "segments": rows}, indent=2) + "\n")
        (OUT / f"{slug}.txt").write_text("\n".join(f"[{timestamp(row['start'])}] {row['text']}" for row in rows) + "\n")
        contact_sheet(episode["proxy_url"], slug, OUT / f"{slug}-contact.jpg", duration)
        info.append({"slug": slug, "episode": episode["name"], "asset_id": episode["id"], "duration": duration, "segments": len(rows)})
        print(f"{slug}: {len(rows)} transcript segments", flush=True)
    (OUT / "episode-info.json").write_text(json.dumps(info, indent=2) + "\n")


if __name__ == "__main__":
    main()
