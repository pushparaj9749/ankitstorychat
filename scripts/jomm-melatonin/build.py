#!/usr/bin/env python3
"""Build seven polished vertical anime edits from the independently sourced packs."""
from __future__ import annotations

import hashlib
import json
import math
import shutil
import textwrap
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

import scout

ROOT = scout.ROOT
WORK = scout.WORK
AUDIO = scout.AUDIO
SOURCE = scout.RAW
RENDER = WORK / "render"
REVIEW = WORK / "review"
FINAL = WORK / "final"
CLIPS = FINAL / "clips"
COVERS = FINAL / "covers"
DOCS = FINAL / "posting"
PLAN_PATH = ROOT / "scripts" / "jomm-melatonin" / "edits.json"
ANALYSIS_PATH = ROOT / "scripts" / "jomm-melatonin" / "audio-analysis.json"
BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
REGULAR = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")


def load_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_name(value: str) -> str:
    return "".join(character if character.isalnum() else "_" for character in value).strip("_")


def fit_text(draw: ImageDraw.ImageDraw, text: str, font_path: Path, maximum: int, width: int) -> ImageFont.FreeTypeFont:
    size = maximum
    while size > 24:
        font = ImageFont.truetype(str(font_path), size)
        if draw.textbbox((0, 0), text, font=font)[2] <= width:
            return font
        size -= 2
    return ImageFont.truetype(str(font_path), size)


def make_title_overlay(entry: dict, number: int, path: Path) -> None:
    image = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    accent = entry["accent"]
    small = ImageFont.truetype(str(REGULAR), 25)
    micro = ImageFont.truetype(str(BOLD), 20)
    title = fit_text(draw, entry["title"].upper(), BOLD, 67, 940)
    draw.rounded_rectangle((62, 92, 342, 137), radius=22, fill=(10, 13, 22, 188), outline=accent, width=2)
    draw.text((84, 102), "JOMM  /  MELATONIN", font=micro, fill="white")
    draw.text((62, 164), entry["title"].upper(), font=title, fill="white", stroke_width=3, stroke_fill=(0, 0, 0, 150))
    draw.rectangle((64, 253, 176, 258), fill=accent)
    draw.text((194, 239), f"ANIME EDIT  /  {number:02d}", font=small, fill=(235, 238, 245, 235), stroke_width=1, stroke_fill="black")
    image.save(path)


def segment_filter(index: int, segment: dict, start: float, duration: float, grade: dict) -> str:
    center_x = float(segment.get("centerX", 0.5))
    zoom = float(segment.get("zoom", 1.1))
    phase = float(segment.get("phase", index * 0.83))
    scale_w = max(1080, int(round(1080 * zoom / 2) * 2))
    scale_h = int(round(scale_w * 16 / 9 / 2) * 2)
    source_start = float(segment["sourceStart"])
    source_end = source_start + duration
    x_expr = f"(in_w-out_w)/2+(in_w-out_w)*0.28*sin(t*0.72+{phase:.3f})"
    y_expr = f"(in_h-out_h)/2+(in_h-out_h)*0.22*cos(t*0.57+{phase:.3f})"
    return (
        f"[vsrc{index}]trim=start={source_start:.3f}:end={source_end:.3f},setpts=PTS-STARTPTS,"
        f"fps=30,crop=w='trunc(ih*9/16/2)*2':h=ih:x='(iw-ow)*{center_x:.4f}':y=0,"
        f"scale={scale_w}:{scale_h}:flags=lanczos,"
        f"crop=1080:1920:x='{x_expr}':y='{y_expr}',"
        f"eq=contrast={grade.get('contrast', 1.06):.3f}:saturation={grade.get('saturation', 1.1):.3f}:"
        f"brightness={grade.get('brightness', 0.0):.3f}:gamma={grade.get('gamma', 1.0):.3f},"
        f"setsar=1[v{index}]"
    )


def render_clip(entry: dict, source: Path, audio: Path, beat_times: list[float], number: int) -> tuple[Path, dict]:
    cut_beats = entry["cutBeats"]
    if len(cut_beats) != len(entry["segments"]):
        raise ValueError(f"{entry['id']}: cutBeats and segments must have the same length")
    if any(int(index) >= len(beat_times) for index in cut_beats):
        raise ValueError(f"{entry['id']}: cut beat exceeds available audio")
    boundaries = [0.0] + [float(beat_times[int(index)]) for index in cut_beats]
    if any(boundaries[i + 1] <= boundaries[i] for i in range(len(boundaries) - 1)):
        raise ValueError(f"{entry['id']}: beat boundaries are not increasing")
    duration = boundaries[-1]
    if not 12 <= duration <= 60 or duration > 29.95:
        raise ValueError(f"{entry['id']}: invalid final duration {duration}")

    overlay = RENDER / f"{entry['id']}-title.png"
    make_title_overlay(entry, number, overlay)
    filters = [f"[0:v]split={len(cut_beats)}" + "".join(f"[vsrc{i}]" for i in range(len(cut_beats)))]
    for index, segment in enumerate(entry["segments"]):
        segment_duration = boundaries[index + 1] - boundaries[index]
        filters.append(segment_filter(index, segment, boundaries[index], segment_duration, entry.get("grade", {})))
    filters.append("".join(f"[v{i}]" for i in range(len(cut_beats))) + f"concat=n={len(cut_beats)}:v=1:a=0[cut]")
    filters.extend([
        "[cut]split=2[clean][glowsource]",
        "[glowsource]gblur=sigma=16[glow]",
        "[clean][glow]blend=all_mode=screen:all_opacity=0.075,unsharp=5:5:0.32:5:5:0.0[graded]",
    ])
    previous = "graded"
    flash_cuts = set(entry.get("flashCuts", []))
    for flash_number, cut_index in enumerate(sorted(flash_cuts)):
        if not 0 <= cut_index < len(cut_beats) - 1:
            continue
        cut_time = boundaries[cut_index + 1]
        output = f"flash{flash_number}"
        filters.append(
            f"[{previous}]drawbox=x=0:y=0:w=iw:h=ih:color=white@0.48:t=fill:"
            f"enable='between(t,{max(0, cut_time - 0.034):.3f},{cut_time + 0.034:.3f})'[{output}]"
        )
        previous = output
    filters.append(
        f"[{previous}]vignette=angle=PI/6,noise=alls=2:allf=t,"
        f"fade=t=in:st=0:d=0.10,fade=t=out:st={duration - 0.18:.3f}:d=0.18[base]"
    )
    filters.append("[2:v]format=rgba,fade=t=in:st=0:d=0.20:alpha=1,fade=t=out:st=2.0:d=0.50:alpha=1[title]")
    filters.append("[base][title]overlay=0:0:enable='lt(t,2.50)',format=yuv420p[outv]")
    filters.append(
        f"[1:a]atrim=start=0:end={duration:.3f},asetpts=PTS-STARTPTS,"
        f"loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.06,"
        f"afade=t=out:st={duration - 0.22:.3f}:d=0.22[aout]"
    )

    output = CLIPS / f"{number:02d}_{safe_name(entry['title'])}.mp4"
    command = [
        "ffmpeg", "-hide_banner", "-y", "-i", source, "-i", audio,
        "-loop", "1", "-framerate", "30", "-i", overlay,
        "-filter_complex", ";".join(filters),
        "-map", "[outv]", "-map", "[aout]", "-t", f"{duration:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.2",
        "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", "-map_metadata", "-1", output,
    ]
    print(f"\n=== Rendering {number}/7: {entry['title']} ({duration:.3f}s) ===", flush=True)
    scout.run(command)
    return output, {
        "durationPlanned": round(duration, 3),
        "cutTimes": [round(value, 3) for value in boundaries[1:-1]],
        "segments": [
            {
                **segment,
                "outputStart": round(boundaries[index], 3),
                "outputEnd": round(boundaries[index + 1], 3),
                "sourceEnd": round(float(segment["sourceStart"]) + boundaries[index + 1] - boundaries[index], 3),
            }
            for index, segment in enumerate(entry["segments"])
        ],
    }


def make_cover(clip: Path, entry: dict, number: int) -> Path:
    base_path = RENDER / f"{entry['id']}-cover-base.png"
    cover_time = min(float(entry.get("coverTime", 1.0)), float(scout.probe(clip)["format"]["duration"]) - 0.1)
    scout.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{cover_time:.3f}", "-i", clip,
        "-frames:v", "1", "-vf", "scale=1080:1920", base_path,
    ])
    base = Image.open(base_path).convert("RGB")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    pixels = overlay.load()
    for y in range(1080, 1920):
        alpha = int(220 * ((y - 1080) / 840) ** 1.25)
        for x in range(1080):
            pixels[x, y] = (5, 8, 15, alpha)
    top = Image.new("RGBA", base.size, (0, 0, 0, 0))
    top_draw = ImageDraw.Draw(top)
    top_draw.rectangle((0, 0, 1080, 240), fill=(5, 8, 15, 85))
    composed = Image.alpha_composite(base.convert("RGBA"), overlay)
    composed = Image.alpha_composite(composed, top)
    draw = ImageDraw.Draw(composed)
    accent = entry["accent"]
    title = fit_text(draw, entry["title"].upper(), BOLD, 82, 950)
    label = ImageFont.truetype(str(BOLD), 25)
    detail = ImageFont.truetype(str(REGULAR), 29)
    draw.rounded_rectangle((62, 82, 354, 134), radius=25, fill=(7, 10, 18, 195), outline=accent, width=2)
    draw.text((86, 94), f"ANIME EDIT  /  {number:02d}", font=label, fill="white")
    draw.rectangle((64, 1402, 188, 1410), fill=accent)
    draw.text((62, 1442), entry["title"].upper(), font=title, fill="white", stroke_width=2, stroke_fill="black")
    draw.text((66, 1555), "JOMM  —  MELATONIN", font=detail, fill=(238, 240, 247, 245))
    output = COVERS / f"{number:02d}_{safe_name(entry['title'])}.jpg"
    composed.convert("RGB").save(output, quality=94, subsampling=0)
    return output


def make_contact_sheet(clip: Path, entry: dict, number: int) -> Path:
    duration = float(scout.probe(clip)["format"]["duration"])
    frames = []
    for index, fraction in enumerate(np.linspace(0.04, 0.96, 8)):
        timestamp = duration * float(fraction)
        path = RENDER / f"{entry['id']}-review-{index:02d}.jpg"
        scout.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{timestamp:.3f}", "-i", clip,
            "-frames:v", "1", "-vf", "scale=216:384", "-q:v", "2", path,
        ])
        frames.append((Image.open(path).convert("RGB"), timestamp))
    sheet = Image.new("RGB", (900, 970), "#0d1017")
    draw = ImageDraw.Draw(sheet)
    title_font = fit_text(draw, f"{number:02d}  {entry['title'].upper()}", BOLD, 34, 840)
    small = ImageFont.truetype(str(REGULAR), 19)
    draw.text((24, 20), f"{number:02d}  {entry['title'].upper()}", font=title_font, fill=entry["accent"])
    draw.text((24, 63), f"FINAL 1080×1920  •  {duration:.3f}s  •  beat-cut review", font=small, fill="white")
    for index, (frame, timestamp) in enumerate(frames):
        x = 24 + (index % 4) * 216
        y = 108 + (index // 4) * 420
        sheet.paste(frame, (x, y))
        draw.text((x, y + 388), f"{timestamp:06.2f}s", font=small, fill="#d8dce5")
    output = REVIEW / f"{number:02d}_{entry['id']}-contact.jpg"
    sheet.save(output, quality=91)
    return output


def make_cover_sheet(covers: list[Path], entries: list[dict]) -> None:
    sheet = Image.new("RGB", (960, 930), "#0d1017")
    draw = ImageDraw.Draw(sheet)
    title = ImageFont.truetype(str(BOLD), 34)
    small = ImageFont.truetype(str(REGULAR), 19)
    draw.text((24, 20), "JOMM — MELATONIN  /  COVER REVIEW", font=title, fill="#f2d19b")
    for index, (path, entry) in enumerate(zip(covers, entries)):
        image = Image.open(path).convert("RGB").resize((216, 384), Image.Resampling.LANCZOS)
        x = 24 + (index % 4) * 228
        y = 92 + (index // 4) * 414
        sheet.paste(image, (x, y))
        draw.text((x, y + 388), f"{index + 1:02d}  {entry['title']}", font=small, fill=entry["accent"])
    sheet.save(REVIEW / "covers-contact.jpg", quality=92)


def probe_and_verify(clip: Path) -> dict:
    data = scout.probe(clip)
    video = next(stream for stream in data["streams"] if stream["codec_type"] == "video")
    audio = next(stream for stream in data["streams"] if stream["codec_type"] == "audio")
    duration = float(data["format"]["duration"])
    fps = eval(video["r_frame_rate"], {"__builtins__": {}}, {})
    checks = {
        "duration12To60": 12 <= duration <= 60,
        "portrait1080x1920": (video.get("width"), video.get("height")) == (1080, 1920),
        "fps30": math.isclose(float(fps), 30.0, abs_tol=0.01),
        "h264": video.get("codec_name") == "h264",
        "aac": audio.get("codec_name") == "aac",
        "stereo48k": audio.get("channels") == 2 and int(audio.get("sample_rate", 0)) == 48000,
    }
    if not all(checks.values()):
        raise RuntimeError(f"QA failed for {clip.name}: {checks}")
    scout.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", clip, "-f", "null", "-"])
    return {
        "file": clip.name,
        "bytes": clip.stat().st_size,
        "duration": round(duration, 3),
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
    credit_lines = ["# Clip source credits", ""]
    for number, entry in enumerate(entries, 1):
        captions.append({
            "clip": f"{number:02d}_{safe_name(entry['title'])}.mp4",
            "cover": f"{number:02d}_{safe_name(entry['title'])}.jpg",
            "caption": entry["caption"],
            "sourceCredit": entry["credit"],
        })
        credit_lines.extend([
            f"## {number:02d} — {entry['title']}",
            f"- Credit: **{entry['credit']}**",
            f"- Source page: {entry['sourcePage']}",
            f"- Source label: {entry['sourceLabel']}",
            "",
        ])
    write_json(DOCS / "captions.json", captions)
    (DOCS / "captions.txt").write_text("\n\n".join(
        f"{index:02d} — {entry['title']}\n{entry['caption']}" for index, entry in enumerate(entries, 1)
    ) + "\n")
    (DOCS / "CREDITS.md").write_text("\n".join(credit_lines))
    guide = f"""# jomm — Melatonin | posting checklist

## 1. Mandatory TikTok sound — do this for every post

The MP4s contain a **reference edit mix of the official Apple Music preview** of jomm & readyaimfire27's original recording. The campaign does **not** accept that embedded reference as the posting sound by itself.

1. Open TikTok's official campaign sound: {scout.CONFIG['campaign']['officialTikTokAudio']}
2. Add that exact sound to the uploaded video. Do not use a re-upload, sped-up, slowed, cover or fan-audio version.
3. Align its first audible transient with the reference at 0:00, then set **original video audio to 0%** and the **official added sound to 100%**.
4. Watch the full preview before posting to confirm the cuts still land on the beat. If TikTok cannot align the sound precisely, re-edit from the official in-app sound rather than posting a mismatched version.

Optional Instagram audio supplied by the brief: {scout.CONFIG['campaign']['instagramAudio']}

## 2. Post cleanly

- Use the matching JPG in `covers/`; keep likes and comments **ON**.
- Use the supplied English caption; hashtags are optional, not a reason to spam.
- Preserve the listed source-editor credit. For Levi, the original video handle is unavailable, so retain the source URL in the first comment/credit rather than inventing a handle.
- Do not use NSFW, sexual, rude, mean or targeted aggressive text; do not boost, make dedicated accounts, collab-post or repost the same clip across accounts.
- Multiple different clips may be posted. Maximum **20% of campaign budget per person**.

## 3. Submit only after the metrics genuinely pass

- Engagement must be **above 5%**. Use TikTok's own video analytics; do not invent or estimate missing data.
- Audience must be Tier 1 majority plus Tier 2/3, with **40% USA views**.
- At **2,000 views**, screen-record **that video's** analytics: watch times, every view graph and all location pages. Scroll so every required page is visible.
- Account-level analytics are rejected. Submit only the individual video's recording after engagement and audience-tier checks pass.

## 4. Package contents

- Seven distinct 1080×1920, 30fps H.264/AAC edits; durations are listed in `QA.json`.
- Seven matching portrait covers, English captions, source credits and this checklist.
- No source packs, alternate songs or account/analytics claims are included.
"""
    (DOCS / "POSTING_GUIDE.md").write_text(guide)
    write_json(DOCS / "QA.json", {
        "campaign": "jomm — Melatonin",
        "requiredTikTokAudio": scout.CONFIG["campaign"]["officialTikTokAudio"],
        "automatedChecks": qa,
        "manualBeforePosting": [
            "Select the exact official TikTok sound and mute the reference video audio.",
            "Review every frame and caption for platform suitability.",
            "Verify engagement and audience tiers from real video analytics; this package makes no performance claim.",
        ],
    })


def copy_review_docs() -> None:
    for directory in (COVERS, DOCS):
        destination = REVIEW / directory.name
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(directory, destination)


def make_zip() -> Path:
    FINAL.mkdir(parents=True, exist_ok=True)
    archive = FINAL / "Jomm_Melatonin_7_Anime_Clip_Pack.zip"
    if archive.exists():
        archive.unlink()
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for path in sorted(FINAL.rglob("*")):
            if path.is_file() and path != archive and path.name != "ZIP_SHA256.txt":
                bundle.write(path, Path("Jomm_Melatonin_7_Anime_Clip_Pack") / path.relative_to(FINAL))
    checksum = sha256(archive)
    (FINAL / "ZIP_SHA256.txt").write_text(f"{checksum}  {archive.name}\n")
    (REVIEW / "ZIP_SHA256.txt").write_text(f"{checksum}  {archive.name}\n")
    print(f"ZIP ready: {archive} ({archive.stat().st_size:,} bytes) SHA-256 {checksum}", flush=True)
    return archive


def main() -> None:
    for directory in (RENDER, REVIEW, CLIPS, COVERS, DOCS):
        directory.mkdir(parents=True, exist_ok=True)
    plan = load_json(PLAN_PATH)
    analysis = load_json(ANALYSIS_PATH)
    beat_times = analysis["beatTimes"]
    entries = []
    by_id = {entry["id"]: entry for entry in scout.CONFIG["videos"]}
    if len(plan["videos"]) != 7 or len({entry["id"] for entry in plan["videos"]}) != 7:
        raise ValueError("The production plan must contain exactly seven distinct edits")
    for item in plan["videos"]:
        source_entry = by_id[item["id"]]
        entries.append({**source_entry, **item, "accent": source_entry["accent"]})

    audio = scout.ensure_audio()
    audio_duration = float(scout.probe(audio)["format"]["duration"])
    if abs(audio_duration - float(analysis["duration"])) > 0.1:
        raise RuntimeError("Pinned beat analysis does not match the downloaded official preview")
    qa = []
    covers = []
    for number, entry in enumerate(entries, 1):
        source = scout.ensure_source(entry)
        source_duration = float(scout.probe(source)["format"]["duration"])
        clip, timing = render_clip(entry, source, audio, beat_times, number)
        for segment in timing["segments"]:
            if segment["sourceEnd"] > source_duration + 0.06:
                raise RuntimeError(f"{entry['id']}: source segment exceeds {source_duration:.3f}s")
        cover = make_cover(clip, entry, number)
        covers.append(cover)
        result = probe_and_verify(clip)
        result.update({"id": entry["id"], "title": entry["title"], "timing": timing, "sourceDuration": source_duration})
        qa.append(result)
        make_contact_sheet(clip, entry, number)
        print(f"QA passed: {clip.name} — {result['duration']}s, {result['bytes']:,} bytes", flush=True)
    make_cover_sheet(covers, entries)
    write_posting_docs(entries, qa)
    copy_review_docs()
    write_json(REVIEW / "build-manifest.json", {
        "clips": qa,
        "covers": [path.name for path in covers],
        "sourceMediaCommitted": False,
        "officialTikTokAudioStillRequiredAtPosting": True,
    })
    make_zip()


if __name__ == "__main__":
    main()
