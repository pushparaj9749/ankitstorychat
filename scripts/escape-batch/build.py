#!/usr/bin/env python3
"""Build seven distinct, upload-ready Escape Halloween vertical clips."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/clips"))
import escape_halloween_scout as scout

WORK = ROOT / "work/escape-batch"
FINAL = WORK / "final"
REVIEW = WORK / "review"
RAW = WORK / "source"
SOURCES = ROOT / "scripts/escape-batch/sources.json"
EDITS = ROOT / "scripts/escape-batch/edits.json"
PACKAGE = FINAL / "Escape_Halloween_2026_7_Clip_Pack.zip"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
scout.RAW = RAW


def run(args: list[str], *, capture: bool = False) -> subprocess.CompletedProcess:
    print("+", " ".join(args[:10]), "..." if len(args) > 10 else "", flush=True)
    return subprocess.run(args, check=True, stdout=subprocess.PIPE if capture else None, stderr=subprocess.PIPE if capture else None)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def text_filter(source: str, target: str, path: Path, *, size: int, y: int, start: float, end: float, alpha: str, color: str, box: bool = False) -> str:
    options = [
        f"fontfile={FONT}", f"textfile={path}", f"fontsize={size}", f"fontcolor={color}",
        "x=(w-text_w)/2", f"y={y}", "borderw=2", "bordercolor=black@0.65",
        "shadowcolor=black@0.65", "shadowx=0", "shadowy=3",
    ]
    if box:
        options.extend(["box=1", "boxcolor=0x080a0f@0.62", "boxborderw=12"])
    options.extend([f"enable='between(t,{start:.2f},{end:.2f})'", f"alpha='{alpha}'"])
    return f"[{source}]drawtext={':'.join(options)}[{target}]"


def render(edit: dict, source_path: Path) -> tuple[Path, float, dict]:
    slug = edit["slug"]
    duration = round(sum(segment["duration"] for segment in edit["segments"]), 3)
    output = FINAL / f"{slug}.mp4"
    filters: list[str] = []
    labels: list[str] = []
    for index, segment in enumerate(edit["segments"]):
        filters.append(
            f"[0:v]trim=start={segment['start']:.3f}:duration={segment['duration']:.3f},"
            "setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,setsar=1,fps=30,eq=contrast=1.035:saturation=1.08:brightness=0.003,"
            f"unsharp=5:5:0.30:5:5:0.0[v{index}]"
        )
        filters.append(
            f"[0:a]atrim=start={segment['start']:.3f}:duration={segment['duration']:.3f},"
            "asetpts=PTS-STARTPTS,aresample=48000,"
            f"aformat=sample_fmts=fltp:channel_layouts=stereo[a{index}]"
        )
        labels.extend([f"[v{index}]", f"[a{index}]"])
    filters.append(f"{''.join(labels)}concat=n={len(edit['segments'])}:v=1:a=1[joined][audio]")

    text_dir = WORK / "text" / slug
    text_dir.mkdir(parents=True, exist_ok=True)
    values = {
        "event": "ESCAPE HALLOWEEN '26",
        "artist": edit["artist"].upper(),
        "stage": edit["stage"].upper(),
    }
    for name, value in values.items():
        (text_dir / f"{name}.txt").write_text(value, encoding="utf-8")
    hook_alpha = "if(lt(t,0.25),t/0.25,if(lt(t,3.0),1,if(lt(t,3.5),(3.5-t)/0.5,0)))"
    end_start = duration - 2.1
    end_alpha = (
        f"if(lt(t,{end_start:.2f}),0,if(lt(t,{end_start + 0.4:.2f}),"
        f"(t-{end_start:.2f})/0.4,if(lt(t,{duration - 0.35:.2f}),1,({duration:.2f}-t)/0.35)))"
    )
    artist_length = len(edit["artist"])
    artist_size = 94 if artist_length <= 11 else 72 if artist_length <= 18 else 50
    filters.extend([
        text_filter("joined", "text1", text_dir / "event.txt", size=32, y=112, start=0, end=3.5, alpha=hook_alpha, color=edit["accent"], box=True),
        text_filter("text1", "text2", text_dir / "artist.txt", size=artist_size, y=180, start=0, end=3.5, alpha=hook_alpha, color="white"),
        text_filter("text2", "text3", text_dir / "stage.txt", size=30, y=294, start=0, end=3.5, alpha=hook_alpha, color="white"),
        text_filter("text3", "vout", text_dir / "event.txt", size=32, y=124, start=end_start, end=duration, alpha=end_alpha, color=edit["accent"], box=True),
        "[audio]loudnorm=I=-14:TP=-1.0:LRA=11,aresample=48000[aout]",
    ])
    filter_path = WORK / "filters" / f"{slug}.txt"
    filter_path.parent.mkdir(parents=True, exist_ok=True)
    filter_path.write_text(";\n".join(filters) + "\n")
    run([
        "ffmpeg", "-hide_banner", "-y", "-i", str(source_path),
        "-filter_complex_script", str(filter_path), "-map", "[vout]", "-map", "[aout]",
        "-t", f"{duration:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-maxrate", "12M", "-bufsize", "24M", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", "-video_track_timescale", "30000",
        "-metadata", f"title=Escape Halloween '26 - {edit['artist']}",
        "-metadata", f"artist={edit['artist']}",
        "-metadata", f"comment=Campaign footage only; original supplied location audio; {edit['stage']}.",
        str(output),
    ])
    run(["ffmpeg", "-hide_banner", "-v", "error", "-i", str(output), "-f", "null", "-"])
    metadata = scout.probe(output)
    assert abs(float(metadata["format"]["duration"]) - duration) < 0.2
    return output, duration, metadata


def make_review(edit: dict, video: Path, duration: float) -> tuple[Path, Path]:
    slug = edit["slug"]
    qa_dir = WORK / "qa-frames" / slug
    qa_dir.mkdir(parents=True, exist_ok=True)
    times = [duration * (0.04 + 0.92 * index / 7) for index in range(8)]
    tiles: list[Image.Image] = []
    for index, at in enumerate(times):
        target = qa_dir / f"{index:02d}.jpg"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{at:.3f}",
            "-i", str(video), "-frames:v", "1", "-vf", "scale=270:480", "-q:v", "2", str(target),
        ])
        with Image.open(target) as frame:
            tile = Image.new("RGB", (270, 510), "#080a0f")
            tile.paste(frame.convert("RGB"), (0, 0))
            ImageDraw.Draw(tile).text((10, 486), f"{at:05.2f}s", font=ImageFont.truetype(FONT, 16), fill="white")
            tiles.append(tile)
    sheet = Image.new("RGB", (1080, 1110), "#080a0f")
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 14), f"{edit['artist'].upper()}  •  {edit['stage'].upper()}", font=ImageFont.truetype(FONT, 28), fill=edit["accent"].replace("0x", "#"))
    draw.text((18, 51), f"FINAL QA  •  1080×1920  •  30 fps  •  {duration:.2f}s  •  supplied audio", font=ImageFont.truetype(FONT_REGULAR, 19), fill="#e4e6ee")
    for index, tile in enumerate(tiles):
        sheet.paste(tile, ((index % 4) * 270, 90 + (index // 4) * 510))
    sheet_path = REVIEW / f"{slug}-qa.jpg"
    sheet.save(sheet_path, quality=92)
    cover = FINAL / "covers" / f"{slug}.jpg"
    cover.parent.mkdir(exist_ok=True)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "0.65", "-i", str(video),
        "-frames:v", "1", "-q:v", "2", str(cover),
    ])
    return sheet_path, cover


def write_caption(edit: dict) -> Path:
    artist_tag = "#" + "".join(character for character in edit["artist"].lower() if character.isalnum())
    path = FINAL / "captions" / f"{edit['slug']}.txt"
    path.parent.mkdir(exist_ok=True)
    path.write_text(
        "INSTAGRAM CAPTION\n"
        f"{edit['artist']} at {edit['stage']}—{edit['hook']} 🔥\n"
        "Escape Halloween ’26\n\n"
        f"#escapehalloween {artist_tag}\n\n"
        "YOUTUBE TITLE\n"
        f"{edit['artist']} at {edit['stage']} | Escape Halloween 2026\n\n"
        "YOUTUBE DESCRIPTION\n"
        f"A vertical recap of {edit['artist']} at {edit['stage']} during Escape Halloween 2026, "
        "featuring festival production, crowd moments and original location audio from the supplied event footage.\n\n"
        f"Artist: {edit['artist']}\nStage: {edit['stage']}\nEvent: Escape Halloween 2026\n\n"
        f"#EscapeHalloween {artist_tag}\n",
        encoding="utf-8",
    )
    return path


def main() -> None:
    for directory in (FINAL, REVIEW, RAW):
        if directory in (FINAL, REVIEW) and directory.exists():
            shutil.rmtree(directory)
        directory.mkdir(parents=True, exist_ok=True)
    source_list = json.loads(SOURCES.read_text())
    sources = {source["id"]: source for source in source_list}
    edits = json.loads(EDITS.read_text())
    assert len(edits) == 7
    required = sorted({edit["source"] for edit in edits})
    paths = {source_id: scout.download(sources[source_id]) for source_id in required}

    manifest_clips = []
    checksum_files: list[Path] = []
    for edit in edits:
        print(f"\n=== {edit['slug']} ===", flush=True)
        video, duration, metadata = render(edit, paths[edit["source"]])
        qa_sheet, cover = make_review(edit, video, duration)
        caption = write_caption(edit)
        checksum_files.extend([video, cover, caption])
        manifest_clips.append({
            "file": video.name,
            "artist": edit["artist"],
            "stage": edit["stage"],
            "duration_planned": duration,
            "source": sources[edit["source"]],
            "segments": edit["segments"],
            "external_music_added": False,
            "probe": metadata,
            "sha256": sha256(video),
        })
    (FINAL / "upload-notes.txt").write_text(
        "ESCAPE HALLOWEEN 2026 — SEVEN-CLIP PACK\n\n"
        "Seven distinct vertical edits for TikTok and Instagram Reels. Each includes an immediate\n"
        "hook, accurate artist/stage text and original audio from the supplied campaign footage.\n"
        "No external music or Track ID was added. Covers and platform captions are included.\n\n"
        "Keep likes and comments ON when posting. After 1,000 views, approval requires the\n"
        "video-specific analytics screen recording described in the campaign brief. Submit only\n"
        "if engagement exceeds 1% and the audience-tier requirements are met.\n",
        encoding="utf-8",
    )
    manifest = {"campaign": "Escape Halloween 2026", "clip_count": 7, "clips": manifest_clips}
    (FINAL / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (FINAL / "SHA256SUMS.txt").write_text("".join(f"{sha256(path)}  {path.relative_to(FINAL)}\n" for path in checksum_files))
    (REVIEW / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    shutil.copytree(FINAL / "captions", REVIEW / "captions", dirs_exist_ok=True)
    shutil.copytree(FINAL / "covers", REVIEW / "covers", dirs_exist_ok=True)
    shutil.copytree(REVIEW, FINAL / "qa", dirs_exist_ok=True, ignore=shutil.ignore_patterns("covers", "captions"))
    with zipfile.ZipFile(PACKAGE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(FINAL.rglob("*")):
            if path.is_file() and path != PACKAGE:
                archive.write(path, arcname=str(path.relative_to(FINAL)))
    package_hash = sha256(PACKAGE)
    (REVIEW / "package-sha256.txt").write_text(f"{package_hash}  {PACKAGE.name}\n")
    print(f"Package: {PACKAGE} ({PACKAGE.stat().st_size:,} bytes)")
    print(f"SHA-256: {package_hash}")


if __name__ == "__main__":
    main()
