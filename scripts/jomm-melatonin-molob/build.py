#!/usr/bin/env python3
"""Build the fresh, reference-informed jomm Melatonin anime edit pack."""
from __future__ import annotations

import hashlib
import json
import math
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "jomm-melatonin"))
import scout  # Source acquisition and official-preview verification only.

from compositor import Compositor, FPS, HEIGHT, WIDTH, BOLD, make_text_sprite

WORK = ROOT / "work" / "jomm-melatonin-molob"
RENDER = WORK / "render"
REVIEW = WORK / "review"
FINAL = WORK / "final"
CLIPS = FINAL / "clips"
COVERS = FINAL / "covers"
DOCS = FINAL / "posting"
PLAN_PATH = ROOT / "scripts" / "jomm-melatonin-molob" / "shots.json"
ANALYSIS_PATH = ROOT / "scripts" / "jomm-melatonin" / "audio-analysis.json"
REGULAR = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
ARCHIVE_NAME = "Jomm_Melatonin_Molob_Inspired_7_Edits.zip"


def read_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def safe_name(value: str) -> str:
    return "".join(character if character.isalnum() else "_" for character in value).strip("_")


def fit_text(draw: ImageDraw.ImageDraw, text: str, maximum: int, width: int) -> ImageFont.FreeTypeFont:
    size = maximum
    while size > 28:
        font = ImageFont.truetype(str(BOLD), size)
        if draw.textbbox((0, 0), text, font=font)[2] <= width:
            return font
        size -= 2
    return ImageFont.truetype(str(BOLD), size)


def resolve_boundaries(steps: list[int], beat_times: list[float]) -> list[float]:
    if not steps or any(step not in {1, 2} for step in steps):
        raise ValueError("Cut steps must contain only one- or two-beat intervals")
    positions = [0]
    for step in steps:
        position = positions[-1] + step
        if position > len(beat_times):
            raise ValueError("Shot plan exceeds the pinned audio beat analysis")
        positions.append(position)
    raw = [0.0] + [beat_times[position - 1] for position in positions[1:]]
    # Quantize once, before rendering, so concatenated shots and compositing share a clock.
    boundaries = [round(value * FPS) / FPS for value in raw]
    if any(boundaries[index + 1] <= boundaries[index] for index in range(len(boundaries) - 1)):
        raise ValueError("Beat boundaries collapsed during frame quantization")
    if not 12 <= boundaries[-1] <= 29.90:
        raise ValueError(f"Invalid edit duration: {boundaries[-1]}")
    return boundaries


def shot_count_frames(base: Path) -> int:
    result = scout.run([
        "ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
        "-show_entries", "stream=nb_read_frames", "-of", "default=noprint_wrappers=1:nokey=1", str(base),
    ], capture=True)
    return int(result.stdout.decode().strip())


def colour_filter(entry: dict) -> str:
    grade = entry["cc"]
    return (
        f"eq=contrast={grade['contrast']:.3f}:saturation={grade['saturation']:.3f}:"
        f"brightness={grade.get('brightness', 0):.3f}:gamma={grade.get('gamma', 1):.3f},"
        f"curves=all='{grade['curve']}',colorbalance={grade['balance']},"
        "unsharp=5:5:0.58:5:5:0.0,noise=alls=2:allf=t+u,vignette=angle=PI/6.5"
    )


def render_base(entry: dict, source: Path, boundaries: list[float], source_duration: float) -> tuple[Path, list[dict]]:
    shot_dir = RENDER / entry["id"] / "shots"
    if shot_dir.exists():
        shutil.rmtree(shot_dir)
    shot_dir.mkdir(parents=True, exist_ok=True)
    cues = entry["cues"]
    order = entry["cueOrder"]
    speeds = entry["speedCycle"]
    expected_shots = len(boundaries) - 1
    if len(order) != expected_shots:
        raise ValueError(f"{entry['id']}: {len(order)} cue indices for {expected_shots} shots")
    if any(not 0 <= int(cue) < len(cues) for cue in order):
        raise ValueError(f"{entry['id']}: cueOrder contains an invalid index")
    concat_rows = []
    timing = []
    for shot in range(expected_shots):
        start_frame = round(boundaries[shot] * FPS)
        end_frame = round(boundaries[shot + 1] * FPS)
        frame_count = end_frame - start_frame
        output_duration = frame_count / FPS
        cue_index = int(order[shot])
        source_start = float(cues[cue_index])
        speed = float(speeds[shot % len(speeds)])
        source_end = source_start + output_duration * speed + 0.08
        if source_end > source_duration + 0.03:
            raise ValueError(
                f"{entry['id']} shot {shot}: source end {source_end:.3f}s exceeds {source_duration:.3f}s"
            )
        focus = float(entry.get("cueFocus", {}).get(str(cue_index), 0.5))
        output = shot_dir / f"{shot:03d}.mp4"
        filters = (
            f"setpts=(PTS-STARTPTS)/{speed:.5f},fps={FPS},"
            f"crop=w='trunc(ih*9/16/2)*2':h=ih:x='(iw-ow)*{focus:.4f}':y=0,"
            "scale=1296:2304:flags=lanczos," + colour_filter(entry)
        )
        scout.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{source_start:.3f}", "-i", str(source),
            "-vf", filters, "-frames:v", str(frame_count), "-an",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "10",
            "-pix_fmt", "yuv420p", "-r", str(FPS), "-video_track_timescale", "15360", str(output),
        ], timeout=240)
        concat_rows.append(f"file '{output.as_posix()}'")
        timing.append({
            "shot": shot,
            "outputStart": boundaries[shot],
            "outputEnd": boundaries[shot + 1],
            "frames": frame_count,
            "sourceStart": source_start,
            "sourceEndApprox": round(source_end, 3),
            "speed": speed,
            "focusX": focus,
            "transitionIn": "opening" if shot == 0 else ("major" if shot in entry["majorCuts"] else "camera-kick"),
        })
    concat_file = shot_dir / "concat.txt"
    concat_file.write_text("\n".join(concat_rows) + "\n")
    base = RENDER / entry["id"] / "base.mp4"
    scout.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-c", "copy", "-movflags", "+faststart", str(base),
    ], timeout=240)
    expected_frames = round(boundaries[-1] * FPS)
    actual_frames = shot_count_frames(base)
    if actual_frames != expected_frames:
        raise RuntimeError(f"{entry['id']}: base has {actual_frames} frames; expected {expected_frames}")
    return base, timing


def review_times(entry: dict, boundaries: list[float], compositor: Compositor) -> list[float]:
    duration = boundaries[-1]
    times = [duration * fraction for fraction in (0.04, 0.20, 0.38, 0.57, 0.76, 0.93)]
    times.extend(event.start + min(0.30, (event.end - event.start) / 2) for event in compositor.text_events)
    for shot in entry["majorCuts"][:3]:
        times.append(min(duration - 0.05, boundaries[shot] + 0.055))
    unique = []
    for value in sorted(times):
        if all(abs(value - existing) > 0.12 for existing in unique):
            unique.append(value)
    while len(unique) < 12:
        candidate = duration * (0.08 + 0.84 * len(unique) / 11)
        if all(abs(candidate - existing) > 0.08 for existing in unique):
            unique.append(candidate)
        else:
            candidate += 0.037
            unique.append(min(duration - 0.03, candidate))
    return sorted(unique[:12])


def make_contact_sheet(clip: Path, entry: dict, number: int, times: list[float]) -> Path:
    frames = []
    for index, timestamp in enumerate(times):
        target = RENDER / entry["id"] / f"review-{index:02d}.jpg"
        scout.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{timestamp:.3f}",
            "-i", str(clip), "-frames:v", "1", "-vf", "scale=216:384", "-q:v", "2", str(target),
        ], timeout=90)
        frames.append((Image.open(target).convert("RGB"), timestamp))
    sheet = Image.new("RGB", (900, 1390), "#0b0e15")
    draw = ImageDraw.Draw(sheet)
    title = fit_text(draw, f"{number:02d}  {entry['title'].upper()}", 34, 850)
    small = ImageFont.truetype(str(REGULAR), 18)
    draw.text((24, 20), f"{number:02d}  {entry['title'].upper()}", font=title, fill=entry["accent"])
    draw.text((24, 63), "FRESH CAMERA + CC + IMPACT + TYPE REVIEW  •  1080×1920 / 30fps", font=small, fill="white")
    for index, (frame, timestamp) in enumerate(frames):
        x = 24 + (index % 4) * 216
        y = 108 + (index // 4) * 420
        sheet.paste(frame, (x, y))
        draw.text((x, y + 388), f"{timestamp:06.2f}s", font=small, fill="#d8dce5")
    output = REVIEW / f"{number:02d}_{entry['id']}-contact.jpg"
    sheet.save(output, quality=92)
    return output


def make_cover(clip: Path, entry: dict, number: int) -> Path:
    capture = cv2.VideoCapture(str(clip))
    capture.set(cv2.CAP_PROP_POS_MSEC, float(entry["coverTime"]) * 1000)
    ok, frame = capture.read()
    capture.release()
    if not ok:
        raise RuntimeError(f"Could not extract cover for {entry['id']}")
    base = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert("RGBA")
    shade = Image.new("RGBA", base.size, (0, 0, 0, 0))
    pixels = shade.load()
    for y in range(1100, HEIGHT):
        alpha = int(205 * ((y - 1100) / (HEIGHT - 1100)) ** 1.15)
        for x in range(WIDTH):
            pixels[x, y] = (4, 6, 13, alpha)
    base = Image.alpha_composite(base, shade)
    sprite = make_text_sprite(entry["coverTitle"], entry["coverSub"], entry["accent"], entry["secondary"])
    sprite_image = Image.fromarray(cv2.cvtColor(sprite, cv2.COLOR_BGRA2RGBA))
    base.alpha_composite(sprite_image, (20, 1270))
    draw = ImageDraw.Draw(base)
    micro = ImageFont.truetype(str(BOLD), 23)
    draw.rounded_rectangle((56, 72, 365, 124), radius=23, fill=(5, 8, 16, 205), outline=entry["accent"], width=2)
    draw.text((78, 84), f"ANIME EDIT  /  {number:02d}", font=micro, fill="white")
    output = COVERS / f"{number:02d}_{safe_name(entry['title'])}.jpg"
    base.convert("RGB").save(output, quality=95, subsampling=0)
    return output


def make_cover_sheet(covers: list[Path], entries: list[dict]) -> None:
    sheet = Image.new("RGB", (960, 930), "#0b0e15")
    draw = ImageDraw.Draw(sheet)
    title = ImageFont.truetype(str(BOLD), 34)
    small = ImageFont.truetype(str(REGULAR), 18)
    draw.text((24, 20), "JOMM — MELATONIN  /  FRESH COVER REVIEW", font=title, fill="#f2d19b")
    for index, (path, entry) in enumerate(zip(covers, entries)):
        image = Image.open(path).convert("RGB").resize((216, 384), Image.Resampling.LANCZOS)
        x = 24 + (index % 4) * 228
        y = 92 + (index // 4) * 414
        sheet.paste(image, (x, y))
        draw.text((x, y + 388), f"{index + 1:02d}  {entry['title']}", font=small, fill=entry["accent"])
    sheet.save(REVIEW / "covers-contact.jpg", quality=93)


def probe_and_verify(clip: Path, expected_frames: int) -> dict:
    data = scout.probe(clip)
    video = next(stream for stream in data["streams"] if stream["codec_type"] == "video")
    audio = next(stream for stream in data["streams"] if stream["codec_type"] == "audio")
    duration = float(data["format"]["duration"])
    fps = eval(video["r_frame_rate"], {"__builtins__": {}}, {})
    actual_frames = shot_count_frames(clip)
    checks = {
        "duration12To60": 12 <= duration <= 60,
        "portrait1080x1920": (video.get("width"), video.get("height")) == (WIDTH, HEIGHT),
        "fps30": math.isclose(float(fps), FPS, abs_tol=0.01),
        "exactFrameCount": actual_frames == expected_frames,
        "h264": video.get("codec_name") == "h264",
        "aac": audio.get("codec_name") == "aac",
        "stereo48k": audio.get("channels") == 2 and int(audio.get("sample_rate", 0)) == 48000,
    }
    if not all(checks.values()):
        raise RuntimeError(f"QA failed for {clip.name}: {checks}; frames={actual_frames}/{expected_frames}")
    scout.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(clip), "-f", "null", "-"], timeout=300)
    return {
        "file": clip.name,
        "bytes": clip.stat().st_size,
        "duration": round(duration, 3),
        "frames": actual_frames,
        "width": video["width"],
        "height": video["height"],
        "fps": float(fps),
        "videoCodec": video["codec_name"],
        "audioCodec": audio["codec_name"],
        "sampleRate": int(audio["sample_rate"]),
        "channels": audio["channels"],
        "sha256": sha256(clip),
        "checks": checks,
        "fullDecode": "passed",
    }


def write_posting_docs(entries: list[dict], qa: list[dict]) -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    captions = []
    credits = ["# Clip source and visual-reference credits", ""]
    for number, entry in enumerate(entries, 1):
        filename = f"{number:02d}_{safe_name(entry['title'])}.mp4"
        captions.append({
            "clip": filename,
            "cover": f"{number:02d}_{safe_name(entry['title'])}.jpg",
            "caption": entry["caption"],
            "sourceCredit": entry["credit"],
        })
        credits.extend([
            f"## {number:02d} — {entry['title']}",
            f"- Footage credit: **{entry['credit']}**",
            f"- Footage source: {entry['sourcePage']}",
            f"- Source label: {entry['sourceLabel']}",
            "",
        ])
    credits.extend([
        "## Style research",
        "",
        "The new visual design was informed by the publicly available official frames of Molob (@mol0b) uploads listed in `REFERENCE_NOTES.md`. No Molob project file, preset pack, raw reference video or rendered reference footage is included.",
        "",
    ])
    write_json(DOCS / "captions.json", captions)
    (DOCS / "captions.txt").write_text("\n\n".join(
        f"{index:02d} — {entry['title']}\n{entry['caption']}" for index, entry in enumerate(entries, 1)
    ) + "\n")
    (DOCS / "CREDITS.md").write_text("\n".join(credits))
    guide = f"""# jomm — Melatonin | fresh edit pack posting checklist

## Mandatory official TikTok sound — every post

The MP4s contain a **reference edit mix of the official Apple Music preview** of jomm & readyaimfire27's original recording. That embedded reference does **not** replace TikTok's required campaign sound.

1. Open the exact official sound: {scout.CONFIG['campaign']['officialTikTokAudio']}
2. Add that sound to the uploaded video. Never substitute a re-upload, sped-up, slowed, cover or fan-audio version.
3. Align its first audible transient with the reference at 0:00. Set **original video audio to 0%** and the **official added sound to 100%**.
4. Watch the entire preview before posting. If the cuts drift, re-edit from the official in-app sound rather than posting a mismatched version.

Optional Instagram audio from the brief: {scout.CONFIG['campaign']['instagramAudio']}

## Clean posting

- Use the matching portrait cover and supplied English caption; likes and comments stay **ON**.
- Preserve the listed source-editor credits. Levi's handle could not be verified, so retain the source URL rather than inventing one.
- No NSFW, sexual, rude, mean or targeted aggressive text; no boosting, dedicated accounts, collab posts or reposting one clip across accounts.
- Multiple different clips may be posted. Maximum **20% of campaign budget per person**.

## Analytics gate

- Engagement must be **above 5%**; audience must be Tier 1 majority plus Tier 2/3, with **40% USA views**.
- At **2,000 views**, screen-record **that video's** analytics: watch times, every view graph and every location page. Account analytics are rejected.
- Submit only after the actual metrics pass. This package makes no performance or analytics claim.

## Package

Seven distinct 1080×1920, 30fps H.264/AAC edits with new camera choreography, character-specific CC, impact transitions, particles, kinetic type, covers, captions, credits and QA. Raw anime sources and Molob reference videos are not included.
"""
    (DOCS / "POSTING_GUIDE.md").write_text(guide)
    research = ROOT / "docs" / "clips" / "jomm-molob-research" / "research.json"
    if research.exists():
        shutil.copy2(research, DOCS / "reference-research.json")
    reference_notes = ROOT / "scripts" / "jomm-melatonin-molob" / "REFERENCE_NOTES.md"
    shutil.copy2(reference_notes, DOCS / "REFERENCE_NOTES.md")
    write_json(DOCS / "QA.json", {
        "campaign": "jomm — Melatonin",
        "renderer": "from-scratch overscan camera + impact compositor",
        "requiredTikTokAudio": scout.CONFIG["campaign"]["officialTikTokAudio"],
        "automatedChecks": qa,
        "manualBeforePosting": [
            "Select the exact official TikTok sound and mute the embedded reference audio.",
            "Review all frames, flashes and captions for platform suitability.",
            "Verify engagement and audience tiers from real individual-video analytics.",
        ],
    })


def make_zip() -> Path:
    archive = FINAL / ARCHIVE_NAME
    if archive.exists():
        archive.unlink()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for path in sorted(FINAL.rglob("*")):
            if path.is_file() and path != archive and path.name != "MOLOB_ZIP_SHA256.txt":
                bundle.write(path, Path("Jomm_Melatonin_Molob_Inspired_7_Edits") / path.relative_to(FINAL))
    checksum = sha256(archive)
    content = f"{checksum}  {archive.name}\n"
    (FINAL / "MOLOB_ZIP_SHA256.txt").write_text(content)
    (REVIEW / "MOLOB_ZIP_SHA256.txt").write_text(content)
    print(f"ZIP ready: {archive} ({archive.stat().st_size:,} bytes) SHA-256 {checksum}", flush=True)
    return archive


def main() -> None:
    for directory in (RENDER, REVIEW, CLIPS, COVERS, DOCS):
        directory.mkdir(parents=True, exist_ok=True)
    plan = read_json(PLAN_PATH)
    analysis = read_json(ANALYSIS_PATH)
    beat_times = analysis["beatTimes"]
    by_id = {entry["id"]: entry for entry in scout.CONFIG["videos"]}
    if len(plan["videos"]) != 7 or len({entry["id"] for entry in plan["videos"]}) != 7:
        raise ValueError("Exactly seven distinct edits are required")
    entries = [{**by_id[item["id"]], **item} for item in plan["videos"]]
    audio = scout.ensure_audio()
    audio_duration = float(scout.probe(audio)["format"]["duration"])
    if abs(audio_duration - float(analysis["duration"])) > 0.1:
        raise RuntimeError("Pinned beat analysis does not match the official preview")
    qa = []
    covers = []
    for number, entry in enumerate(entries, 1):
        print(f"\n========== {number}/7  {entry['title']} — FRESH BUILD ==========", flush=True)
        boundaries = resolve_boundaries(entry["cutSteps"], beat_times)
        source = scout.ensure_source(entry)
        source_duration = float(scout.probe(source)["format"]["duration"])
        base, timing = render_base(entry, source, boundaries, source_duration)
        frames = round(boundaries[-1] * FPS)
        output = CLIPS / f"{number:02d}_{safe_name(entry['title'])}.mp4"
        compositor = Compositor(entry, boundaries, frames, RENDER / entry["id"] / "encoder.log")
        effects = compositor.render(base, audio, output)
        result = probe_and_verify(output, frames)
        result.update({
            "id": entry["id"], "title": entry["title"], "sourceDuration": source_duration,
            "ccProfile": entry["cc"]["name"], "effects": effects, "shots": timing,
        })
        qa.append(result)
        cover = make_cover(output, entry, number)
        covers.append(cover)
        times = review_times(entry, boundaries, compositor)
        make_contact_sheet(output, entry, number, times)
        write_json(REVIEW / f"{number:02d}_{entry['id']}-timing.json", {
            "boundaries": boundaries, "reviewTimes": times, "effects": effects, "shots": timing,
        })
        print(f"QA passed: {output.name} — {result['duration']}s / {frames} frames / {result['bytes']:,} bytes", flush=True)
    make_cover_sheet(covers, entries)
    write_posting_docs(entries, qa)
    for directory in (COVERS, DOCS):
        destination = REVIEW / directory.name
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(directory, destination)
    write_json(REVIEW / "build-manifest.json", {
        "clips": qa,
        "covers": [path.name for path in covers],
        "renderer": "scripts/jomm-melatonin-molob",
        "sourceMediaCommitted": False,
        "referenceVideoCommitted": False,
        "officialTikTokAudioStillRequiredAtPosting": True,
    })
    make_zip()


if __name__ == "__main__":
    main()
