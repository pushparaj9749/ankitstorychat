#!/usr/bin/env python3
"""Inventory authorized Let Him Mansplain sources and fetch available subtitles."""
from __future__ import annotations

import json
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "work/lhm/inventory"
CHANNEL = "https://www.youtube.com/@LetHimMansplain/videos"
FRAME_IO = "https://next.frame.io/share/b0022fd0-2654-487c-8a5e-cfb20a7f755d/"
KNOWN = ["bcsE6jvH_dI", "rsHLnm7HMG0", "Dsj7KkEUrb0"]


def run(args: list[str]) -> subprocess.CompletedProcess:
    print("+", " ".join(args), flush=True)
    return subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "subs").mkdir(exist_ok=True)
    errors: list[str] = []
    ids = list(KNOWN)

    channel = run(["yt-dlp", "--flat-playlist", "--dump-single-json", "--no-warnings", CHANNEL])
    if channel.returncode == 0:
        (OUT / "channel.json").write_text(channel.stdout)
        try:
            data = json.loads(channel.stdout)
            for entry in data.get("entries", []):
                if entry and entry.get("id") and entry["id"] not in ids:
                    ids.append(entry["id"])
        except json.JSONDecodeError as exc:
            errors.append(f"Channel JSON: {exc}")
    else:
        errors.append("Channel inventory: " + channel.stderr[-4000:])

    summaries = []
    for video_id in ids:
        url = f"https://www.youtube.com/watch?v={video_id}"
        result = run([
            "yt-dlp", "--dump-single-json", "--skip-download", "--no-playlist", "--no-warnings", url,
        ])
        if result.returncode != 0:
            errors.append(f"Metadata {video_id}: {result.stderr[-3000:]}")
            summaries.append({"id": video_id, "url": url, "metadata_error": True})
            continue
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            errors.append(f"Metadata JSON {video_id}: {exc}")
            continue
        summaries.append({
            "id": video_id,
            "title": data.get("title"),
            "url": url,
            "duration": data.get("duration"),
            "upload_date": data.get("upload_date"),
            "uploader": data.get("uploader"),
            "view_count": data.get("view_count"),
            "availability": data.get("availability"),
            "subtitles": sorted((data.get("subtitles") or {}).keys()),
            "automatic_captions": sorted((data.get("automatic_captions") or {}).keys())[:30],
        })

    for video_id in KNOWN:
        result = run([
            "yt-dlp", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*,en",
            "--sub-format", "vtt", "--skip-download", "--no-playlist", "--no-warnings",
            "-o", str(OUT / "subs" / "%(id)s.%(ext)s"),
            f"https://www.youtube.com/watch?v={video_id}",
        ])
        if result.returncode != 0:
            errors.append(f"Subtitles {video_id}: {result.stderr[-3000:]}")

    try:
        request = urllib.request.Request(FRAME_IO, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=45) as response:
            (OUT / "frameio.html").write_bytes(response.read())
    except Exception as exc:  # Inventory fallback only; errors are visible in the report.
        errors.append(f"Frame.io: {exc}")

    (OUT / "summary.json").write_text(json.dumps({
        "channel": CHANNEL,
        "frame_io": FRAME_IO,
        "episodes": summaries,
        "subtitle_files": sorted(path.name for path in (OUT / "subs").glob("*")),
        "errors": errors,
    }, indent=2) + "\n")
    (OUT / "errors.log").write_text("\n\n".join(errors) + "\n")
    print(json.dumps({"episodes": len(summaries), "errors": len(errors)}, indent=2), flush=True)


if __name__ == "__main__":
    main()
