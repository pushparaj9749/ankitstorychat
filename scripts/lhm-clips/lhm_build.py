#!/usr/bin/env python3
"""Build seven original, subtitled LHM vertical clips from authorized episodes."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
import textwrap
import zipfile

from faster_whisper import WhisperModel
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work/lhm"
FINAL = WORK / "final"
REVIEW = WORK / "review"
EDITS = json.loads((ROOT / "scripts/lhm-clips/edits.json").read_text())
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def run(args: list[str], *, capture: bool = False, timeout: int | None = None) -> subprocess.CompletedProcess:
    print("+", " ".join(args[:12]), "..." if len(args) > 12 else "", flush=True)
    return subprocess.run(
        args, check=True, stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None, timeout=timeout,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sources() -> dict[str, dict]:
    responses = json.loads((WORK / "inventory/frameio-responses.json").read_text())
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
            by_key = {item["key"]: item for item in transcodes}
            if node.get("name") and by_key.get("h264_360") and by_key.get("h264_1080_best"):
                slug = node["name"].replace(" Full Episode.mov", "").replace(" ", "_")
                found[slug] = {
                    "asset_id": node["id"], "episode": node["name"],
                    "proxy": by_key["h264_360"]["downloadUrl"],
                    "high": by_key["h264_1080_best"]["downloadUrl"],
                    "fallback": by_key["h264_720"]["downloadUrl"],
                }
    if len(found) != 4:
        raise RuntimeError(f"Expected four transcoded episodes, found {len(found)}")
    return found


def esc(text: str) -> str:
    return (text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
            .replace(",", "\\,").replace("%", "\\%").replace("[", "\\[").replace("]", "\\]"))


def ass_time(seconds: float) -> str:
    centis = max(0, round(seconds * 100))
    hours, centis = divmod(centis, 360000)
    minutes, centis = divmod(centis, 6000)
    secs, centis = divmod(centis, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centis:02d}"


def srt_time(seconds: float) -> str:
    millis = max(0, round(seconds * 1000))
    hours, millis = divmod(millis, 3600000)
    minutes, millis = divmod(millis, 60000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def wrap_caption(text: str) -> str:
    lines = textwrap.wrap(text, width=19, break_long_words=False)
    if len(lines) <= 2:
        return "\\N".join(lines)
    midpoint = max(1, len(lines) // 2)
    return "\\N".join([" ".join(lines[:midpoint]), " ".join(lines[midpoint:])])


def words_to_cues(words: list[dict], offset: float) -> list[dict]:
    cues: list[dict] = []
    current: list[dict] = []
    for word in words:
        token = word["word"].strip()
        if not token:
            continue
        candidate = " ".join([w["word"].strip() for w in current] + [token])
        too_long = len(candidate) > 37
        too_slow = current and word["end"] - current[0]["start"] > 2.7
        punctuation_break = current and current[-1]["word"].rstrip().endswith((".", "?", "!")) and len(current) >= 3
        if current and (too_long or too_slow or punctuation_break):
            cues.append(current)
            current = []
        current.append(word)
    if current:
        cues.append(current)
    rows = []
    for index, cue in enumerate(cues):
        start = offset + max(0, cue[0]["start"] - 0.04)
        end = offset + cue[-1]["end"] + 0.08
        rows.append({"start": round(start, 3), "end": round(end, 3), "text": " ".join(w["word"].strip() for w in cue)})
    return rows


def transcribe_parts(model: WhisperModel, source_map: dict[str, dict]) -> dict[str, list[dict]]:
    audio_dir = WORK / "build-audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    all_cues: dict[str, list[dict]] = {}
    for edit in EDITS:
        cues: list[dict] = []
        offset = 0.0
        for index, part in enumerate(edit["parts"]):
            guest = part["guest"]
            audio = audio_dir / f"{edit['slug']}-{index}.wav"
            run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(part["start"]),
                "-t", str(part["duration"]), "-i", source_map[guest]["proxy"],
                "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", str(audio),
            ])
            segments, _ = model.transcribe(
                str(audio), language="en", beam_size=5, best_of=5, vad_filter=True,
                word_timestamps=True, condition_on_previous_text=False,
                initial_prompt=f"Let Him Mansplain podcast with {guest.replace('_', ' ')}.",
            )
            words = []
            for segment in segments:
                words.extend({"word": w.word, "start": w.start, "end": w.end} for w in (segment.words or []))
            part_cues = words_to_cues(words, offset)
            if not part_cues:
                raise RuntimeError(f"No subtitles generated for {edit['slug']} part {index}")
            cues.extend(part_cues)
            offset += part["duration"]
        replacements = edit.get("subtitle_replacements", {})
        for cue in cues:
            for old, new in replacements.items():
                cue["text"] = cue["text"].replace(old, new)
        all_cues[edit["slug"]] = cues
    return all_cues


def write_subtitles(edit: dict, cues: list[dict], directory: Path) -> tuple[Path, Path]:
    ass = directory / f"{edit['slug']}.ass"
    srt = directory / f"{edit['slug']}.srt"
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,62,&H00FFFFFF,&H000000FF,&H00101014,&H96000000,-1,0,0,0,100,100,0,0,1,4,1,2,70,70,405,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    srt_rows = []
    for index, cue in enumerate(cues, start=1):
        text = wrap_caption(cue["text"].replace("{", "(").replace("}", ")"))
        events.append(f"Dialogue: 0,{ass_time(cue['start'])},{ass_time(cue['end'])},Default,,0,0,0,,{text}")
        srt_rows.append(f"{index}\n{srt_time(cue['start'])} --> {srt_time(cue['end'])}\n{text.replace(chr(92) + 'N', chr(10))}\n")
    ass.write_text(header + "\n".join(events) + "\n")
    srt.write_text("\n".join(srt_rows))
    return ass, srt


def filter_graph(edit: dict, ass: Path) -> str:
    filters = []
    labels = []
    hook_lines = textwrap.wrap(edit["hook"], width=21, break_long_words=False)
    if len(hook_lines) > 3:
        raise ValueError(f"Hook too long: {edit['hook']}")
    for index, part in enumerate(edit["parts"]):
        guest_label = part["guest"].replace("_", " ").upper()
        hook_draw = "".join(
            f",drawtext=fontfile={BOLD}:text='{esc(line)}':fontcolor={edit['accent']}:fontsize=64:borderw=2:bordercolor=black@0.5:x=(w-text_w)/2:y={154 + line_index * 80}"
            for line_index, line in enumerate(hook_lines)
        )
        filters.append(
            f"[{index}:v]split=2[bg{index}][fg{index}];"
            f"[bg{index}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=34,eq=brightness=-0.22:saturation=0.72[bgb{index}];"
            f"[fg{index}]scale=1080:-2[fgs{index}];"
            f"[bgb{index}][fgs{index}]overlay=(W-w)/2:430,"
            f"drawbox=x=0:y=0:w=iw:h=380:color=black@0.18:t=fill,"
            f"drawtext=fontfile={BOLD}:text='LET HIM MANSPLAIN':fontcolor=white@0.85:fontsize=28:x=(w-text_w)/2:y=72"
            f"{hook_draw},drawtext=fontfile={FONT}:text='{esc(guest_label)}':fontcolor=white@0.9:fontsize=28:x=(w-text_w)/2:y=1090,setsar=1[v{index}];"
            f"[{index}:a]aresample=48000[a{index}]"
        )
        labels.extend([f"[v{index}]", f"[a{index}]"])
    filters.append("".join(labels) + f"concat=n={len(edit['parts'])}:v=1:a=1[vc][ac]")
    filters.append(f"[vc]subtitles=filename='{ass}'[vout]")
    filters.append("[ac]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[aout]")
    return ";".join(filters)


def make_command(edit: dict, ass: Path, inputs: list[str], output: Path) -> list[str]:
    command = ["ffmpeg", "-hide_banner", "-y", "-threads", "8"]
    for part, source in zip(edit["parts"], inputs):
        if source.startswith("http"):
            command.extend(["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"])
        command.extend(["-ss", str(part["start"]), "-t", str(part["duration"]), "-i", source])
    command.extend([
        "-filter_complex", filter_graph(edit, ass), "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", "30", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(output),
    ])
    return command


def probe(path: Path) -> dict:
    result = run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels",
        "-of", "json", str(path),
    ], capture=True)
    return json.loads(result.stdout)


def qa_sheet(edit: dict, video: Path, target: Path, duration: float) -> None:
    frame_dir = WORK / "qa-frames" / edit["slug"]
    frame_dir.mkdir(parents=True, exist_ok=True)
    tiles = []
    for index in range(8):
        at = duration * (0.04 + 0.92 * index / 7)
        frame_path = frame_dir / f"{index}.jpg"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{at:.2f}", "-i", str(video), "-frames:v", "1", str(frame_path)])
        with Image.open(frame_path) as frame:
            tiles.append(frame.convert("RGB").resize((270, 480), Image.Resampling.LANCZOS))
    sheet = Image.new("RGB", (1080, 1110), "#101117")
    draw = ImageDraw.Draw(sheet)
    title = ImageFont.truetype(BOLD, 30)
    small = ImageFont.truetype(FONT, 24)
    guests = " + ".join(dict.fromkeys(part["guest"].replace("_", " ") for part in edit["parts"]))
    draw.text((18, 15), f"{edit['slug'].replace('_', ' ')} • {guests}", font=title, fill=edit["accent"])
    draw.text((18, 57), f"FINAL QA • 1080x1920 • 30 fps • {duration:.2f}s • subtitles + supplied audio", font=small, fill="white")
    for index, tile in enumerate(tiles):
        x, y = (index % 4) * 270, 90 + (index // 4) * 510
        sheet.paste(tile, (x, y))
        at = duration * (0.04 + 0.92 * index / 7)
        draw.text((x + 10, y + 484), f"{at:05.2f}s", font=small, fill="white")
    sheet.save(target, quality=91)


def main() -> None:
    if len(EDITS) != 7:
        raise ValueError("Exactly seven edits are required")
    FINAL.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    for directory in [FINAL / "covers", FINAL / "captions", FINAL / "subtitles", REVIEW / "covers", REVIEW / "captions", REVIEW / "subtitles"]:
        directory.mkdir(parents=True, exist_ok=True)
    source_map = sources()
    model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
    cue_map = transcribe_parts(model, source_map)
    (WORK / "subtitles").mkdir(parents=True, exist_ok=True)
    manifest = []
    for edit in EDITS:
        print(f"\n=== Building {edit['slug']} ===", flush=True)
        ass, srt = write_subtitles(edit, cue_map[edit["slug"]], WORK / "subtitles")
        output = FINAL / f"{edit['slug']}.mp4"
        high_inputs = [source_map[part["guest"]]["high"] for part in edit["parts"]]
        try:
            run(make_command(edit, ass, high_inputs, output), timeout=900)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            print("High-resolution seek failed; downloading 720p fallback(s).", flush=True)
            if output.exists():
                output.unlink()
            fallback_dir = WORK / "source720"
            fallback_dir.mkdir(parents=True, exist_ok=True)
            local_inputs = []
            for part in edit["parts"]:
                local = fallback_dir / f"{part['guest']}.mp4"
                if not local.exists():
                    run([
                        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", source_map[part["guest"]]["fallback"],
                        "-map", "0:v:0", "-map", "0:a:0", "-c", "copy", str(local),
                    ], timeout=1200)
                local_inputs.append(str(local))
            run(make_command(edit, ass, local_inputs, output), timeout=900)
        run(["ffmpeg", "-v", "error", "-i", str(output), "-f", "null", "-"], timeout=600)
        metadata = probe(output)
        video_stream = next(stream for stream in metadata["streams"] if stream["codec_type"] == "video")
        if (video_stream["width"], video_stream["height"], video_stream["r_frame_rate"]) != (1080, 1920, "30/1"):
            raise RuntimeError(f"Invalid output geometry for {edit['slug']}: {video_stream}")
        duration = float(metadata["format"]["duration"])
        expected = sum(part["duration"] for part in edit["parts"])
        if abs(duration - expected) > 0.35:
            raise RuntimeError(f"Duration mismatch for {edit['slug']}: {duration} vs {expected}")
        qa = REVIEW / f"{edit['slug']}-qa.jpg"
        qa_sheet(edit, output, qa, duration)
        cover = FINAL / "covers" / f"{edit['slug']}.jpg"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{duration * 0.2:.2f}", "-i", str(output), "-frames:v", "1", "-q:v", "2", str(cover)])
        caption_text = f"@lethimmansplain\n{edit['caption']}\n#LetHimMansplain #PodcastClips #Relationships\n"
        caption = FINAL / "captions" / f"{edit['slug']}.txt"
        caption.write_text(
            "INSTAGRAM / TIKTOK CAPTION\n" + caption_text +
            f"\nYOUTUBE SHORTS TITLE\n{edit['youtube_title']}\n\nYOUTUBE DESCRIPTION\n" + caption_text
        )
        (FINAL / "subtitles" / srt.name).write_text(srt.read_text())
        (REVIEW / "subtitles" / f"{edit['slug']}.json").write_text(json.dumps(cue_map[edit["slug"]], indent=2) + "\n")
        manifest.append({
            "file": output.name, "duration_seconds": round(duration, 3),
            "size_bytes": output.stat().st_size, "sha256": sha256(output),
            "format": "1080x1920, 30fps, H.264/AAC, +faststart",
            "hook": edit["hook"], "youtube_title": edit["youtube_title"],
            "caption_first_line": "@lethimmansplain",
            "parts": [{**part, "asset_id": source_map[part["guest"]]["asset_id"], "episode": source_map[part["guest"]]["episode"]} for part in edit["parts"]],
            "cover": str(cover.relative_to(FINAL)), "captions": str(caption.relative_to(FINAL)),
            "subtitles": f"subtitles/{srt.name}", "qa": qa.name,
        })
    (FINAL / "manifest.json").write_text(json.dumps({
        "package": "Let Him Mansplain — 7 original vertical clips",
        "source": "Authorized public Frame.io episode library",
        "external_music": False,
        "upload_notes": [
            "Keep every clip live for at least 30 days.",
            "Account must be dedicated/approved; follow required warm-up process for new accounts.",
            "Audience requirement: 40% USA.",
            "Submit clip URL within 30 minutes of posting.",
            "Submit analytics after the campaign minimum-view threshold; approval precedes payment.",
        ],
        "clips": manifest,
    }, indent=2) + "\n")
    archive = FINAL / "Let_Him_Mansplain_7_Clip_Pack.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=5) as bundle:
        for path in sorted(FINAL.rglob("*")):
            if path.is_file() and path != archive:
                bundle.write(path, path.relative_to(FINAL))
    (REVIEW / "package-sha256.txt").write_text(f"{sha256(archive)}  {archive.name}\n")
    for subdir in ["covers", "captions"]:
        for path in (FINAL / subdir).iterdir():
            if path.is_file():
                (REVIEW / subdir / path.name).write_bytes(path.read_bytes())
    (REVIEW / "manifest.json").write_bytes((FINAL / "manifest.json").read_bytes())
    print(json.dumps(manifest, indent=2), flush=True)


if __name__ == "__main__":
    main()
