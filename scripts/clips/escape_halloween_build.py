#!/usr/bin/env python3
"""Build the selected vertical Escape Halloween edit from campaign footage only."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

from PIL import Image, ImageDraw, ImageFont, ImageOps

from escape_halloween_scout import download, probe

ROOT = Path(__file__).resolve().parents[2]
SOURCES_PATH = ROOT / "scripts/clips/escape_halloween_sources.json"
PLAN_PATH = ROOT / "scripts/clips/escape_halloween_edit.json"
WORK = ROOT / "work/escape-halloween"
OUT = WORK / "final"
QA = WORK / "qa"
VIDEO = OUT / "Escape_Halloween_2026_Excision_1080x1920.mp4"
PACKAGE = OUT / "Escape_Halloween_2026_Excision_Upload.zip"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def run(args: list[str], *, capture: bool = False) -> subprocess.CompletedProcess:
    print("+", " ".join(args[:10]), "..." if len(args) > 10 else "", flush=True)
    return subprocess.run(
        args,
        check=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def drawtext(
    source: str,
    target: str,
    textfile: Path,
    *,
    size: int,
    y: int,
    start: float,
    end: float,
    alpha: str,
    color: str = "white",
    box: bool = False,
) -> str:
    options = [
        f"fontfile={FONT}",
        f"textfile={textfile}",
        f"fontsize={size}",
        f"fontcolor={color}",
        "x=(w-text_w)/2",
        f"y={y}",
        "borderw=2",
        "bordercolor=black@0.65",
        "shadowcolor=black@0.65",
        "shadowx=0",
        "shadowy=3",
    ]
    if box:
        options.extend(["box=1", "boxcolor=0x080a0f@0.62", "boxborderw=12"])
    options.extend([f"enable='between(t,{start:.2f},{end:.2f})'", f"alpha='{alpha}'"])
    return f"[{source}]drawtext={':'.join(options)}[{target}]"


def build_video(sources: dict[str, dict], paths: dict[str, Path], plan: dict) -> None:
    order = ["excision-04", "excision-05", "excision-07"]
    indices = {source_id: index for index, source_id in enumerate(order)}
    command = ["ffmpeg", "-hide_banner", "-y"]
    for source_id in order:
        command.extend(["-i", str(paths[source_id])])

    filters: list[str] = []
    labels: list[str] = []
    for index, segment in enumerate(plan["segments"]):
        source_index = indices[segment["source"]]
        label = f"clip{index}"
        labels.append(f"[{label}]")
        filters.append(
            f"[{source_index}:v]trim=start={segment['start']:.3f}:duration={segment['duration']:.3f},"
            "setpts=PTS-STARTPTS,"
            "scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,setsar=1,fps=30,"
            "eq=contrast=1.035:saturation=1.09:brightness=0.003,"
            "unsharp=5:5:0.35:5:5:0.0"
            f"[{label}]"
        )
    filters.append(f"{''.join(labels)}concat=n={len(labels)}:v=1:a=0[joined]")
    filters.append(
        "[joined]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.18:t=fill:"
        "enable='between(t,14.10,14.18)'[flashed]"
    )

    text_dir = WORK / "text"
    text_dir.mkdir(parents=True, exist_ok=True)
    text_files = {
        "hook_event": "ESCAPE HALLOWEEN '26",
        "hook_artist": "EXCISION",
        "hook_stage": "SEWER DISTRICT",
        "end_event": "ESCAPE HALLOWEEN '26  •  EXCISION",
    }
    for name, value in text_files.items():
        (text_dir / f"{name}.txt").write_text(value, encoding="utf-8")

    hook_alpha = "if(lt(t,0.25),t/0.25,if(lt(t,3.0),1,if(lt(t,3.5),(3.5-t)/0.5,0)))"
    end_alpha = "if(lt(t,20.25),0,if(lt(t,20.65),(t-20.25)/0.4,if(lt(t,22.0),1,(22.35-t)/0.35)))"
    filters.extend([
        drawtext("flashed", "text1", text_dir / "hook_event.txt", size=32, y=112, start=0, end=3.5, alpha=hook_alpha, color="0xFFD98E", box=True),
        drawtext("text1", "text2", text_dir / "hook_artist.txt", size=94, y=180, start=0, end=3.5, alpha=hook_alpha),
        drawtext("text2", "text3", text_dir / "hook_stage.txt", size=30, y=294, start=0, end=3.5, alpha=hook_alpha),
        drawtext("text3", "vout", text_dir / "end_event.txt", size=29, y=124, start=20.25, end=22.35, alpha=end_alpha, color="0xFFD98E", box=True),
    ])
    audio = plan["audio"]
    audio_index = indices[audio["source"]]
    filters.append(
        f"[{audio_index}:a]atrim=start={audio['start']:.3f}:duration={audio['duration']:.3f},"
        "asetpts=PTS-STARTPTS,loudnorm=I=-14:TP=-1.0:LRA=11,aresample=48000[aout]"
    )
    filter_path = WORK / "edit-filter.txt"
    filter_path.write_text(";\n".join(filters) + "\n")
    command.extend([
        "-filter_complex_script", str(filter_path),
        "-map", "[vout]", "-map", "[aout]",
        "-t", f"{plan['duration']:.2f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-maxrate", "14M", "-bufsize", "28M", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", "-video_track_timescale", "30000",
        "-metadata", "title=Escape Halloween '26 - Excision",
        "-metadata", "artist=Excision",
        "-metadata", "comment=Campaign footage only; original supplied location audio; Sewer District.",
        str(VIDEO),
    ])
    run(command)


def make_qa(plan: dict) -> None:
    QA.mkdir(parents=True, exist_ok=True)
    times = [0.20, 1.00, 2.20, 3.80, 5.20, 6.80, 8.20, 10.10, 12.80, 14.30, 16.90, 20.80]
    tiles: list[Image.Image] = []
    for index, at in enumerate(times):
        target = QA / f"final-{index:02d}.jpg"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{at:.2f}",
            "-i", str(VIDEO), "-frames:v", "1", "-vf", "scale=270:480", "-q:v", "2", str(target),
        ])
        with Image.open(target) as frame:
            tile = Image.new("RGB", (270, 510), "#080a0f")
            tile.paste(frame.convert("RGB"), (0, 0))
            draw = ImageDraw.Draw(tile)
            draw.text((10, 486), f"{at:05.2f}s", font=ImageFont.truetype(FONT, 16), fill="white")
            tiles.append(tile)
    sheet = Image.new("RGB", (1080, 1620), "#080a0f")
    draw = ImageDraw.Draw(sheet)
    draw.text((18, 14), "FINAL QA  •  EXCISION  •  SEWER DISTRICT", font=ImageFont.truetype(FONT, 28), fill="#ffd98e")
    draw.text((18, 51), "1080×1920  •  30 fps  •  original supplied audio  •  22.35s", font=ImageFont.truetype(FONT_REGULAR, 19), fill="#e4e6ee")
    for index, tile in enumerate(tiles):
        sheet.paste(tile, ((index % 4) * 270, 90 + (index // 4) * 510))
    sheet.save(OUT / "qa-contact-sheet.jpg", quality=93)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", "0.65", "-i", str(VIDEO),
        "-frames:v", "1", "-q:v", "2", str(OUT / "cover.jpg"),
    ])


def write_package(sources: dict[str, dict], plan: dict) -> None:
    metadata = probe(VIDEO)
    video_stream = next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")
    audio_stream = next(stream for stream in metadata["streams"] if stream["codec_type"] == "audio")
    assert (video_stream["width"], video_stream["height"]) == (1080, 1920)
    assert abs(float(metadata["format"]["duration"]) - plan["duration"]) < 0.15
    assert int(audio_stream["sample_rate"]) == 48000
    assert int(audio_stream["channels"]) == 2
    (OUT / "caption.txt").write_text("Escape Halloween '26\n#escapehalloween\n", encoding="utf-8")
    (OUT / "upload-notes.txt").write_text(
        "ESCAPE HALLOWEEN 2026 — EXCISION / SEWER DISTRICT\n\n"
        "Upload the MP4 vertically to TikTok and Instagram Reels. The cover.jpg is optional.\n"
        "Keep likes and comments ON. Use the supplied caption, or your own respectful caption.\n"
        "No external music or official-audio tag was added; audio comes from the supplied footage.\n\n"
        "After 1,000 views, approval requires a video-specific analytics screen recording showing\n"
        "watch times, all view graphs and locations. Submit only if engagement exceeds 1% and the\n"
        "campaign's audience-tier requirements are met.\n",
        encoding="utf-8",
    )
    manifest = {
        "title": plan["title"],
        "artist": plan["artist"],
        "stage": plan["stage"],
        "duration_seconds": plan["duration"],
        "canvas": "1080x1920",
        "fps": 30,
        "audio": plan["audio"],
        "external_music_added": False,
        "hook": "Wide-stage drop begins immediately; first audio peak at approximately 0.20s.",
        "text": ["ESCAPE HALLOWEEN '26", "EXCISION", "SEWER DISTRICT"],
        "segments": [
            {**segment, "source_url": sources[segment["source"]]["url"]}
            for segment in plan["segments"]
        ],
        "probe": metadata,
        "video_sha256": sha256(VIDEO),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    checksum_files = [VIDEO, OUT / "cover.jpg", OUT / "caption.txt", OUT / "upload-notes.txt", OUT / "manifest.json"]
    (OUT / "SHA256SUMS.txt").write_text("".join(f"{sha256(path)}  {path.name}\n" for path in checksum_files))
    package_files = [*checksum_files, OUT / "SHA256SUMS.txt"]
    with zipfile.ZipFile(PACKAGE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in package_files:
            archive.write(path, arcname=path.name)
    (OUT / "package-sha256.txt").write_text(f"{sha256(PACKAGE)}  {PACKAGE.name}\n")


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True, exist_ok=True)
    source_list = json.loads(SOURCES_PATH.read_text())
    sources = {source["id"]: source for source in source_list}
    plan = json.loads(PLAN_PATH.read_text())
    required = sorted({segment["source"] for segment in plan["segments"]} | {plan["audio"]["source"]})
    paths = {source_id: download(sources[source_id]) for source_id in required}
    build_video(sources, paths, plan)
    run(["ffmpeg", "-hide_banner", "-v", "error", "-i", str(VIDEO), "-f", "null", "-"])
    make_qa(plan)
    write_package(sources, plan)
    print(f"Final video: {VIDEO} ({VIDEO.stat().st_size:,} bytes)")
    print(f"Upload package: {PACKAGE} ({PACKAGE.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
