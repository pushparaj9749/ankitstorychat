#!/usr/bin/env python3
"""Download and visually scout the seven public Twixtor source packs.

Raw anime footage and the song stay in work/ only. Only small review sheets,
metadata and audio-analysis files are published for editorial review.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import zipfile

import gdown
import librosa
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / "work/jomm-melatonin"
RAW = WORK / "source"
AUDIO = WORK / "audio"
SCOUT = WORK / "scout"
CONFIG = json.loads((ROOT / "scripts/jomm-melatonin/sources.json").read_text())
VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def run(args: list[str], *, capture: bool = False, timeout: int | None = None) -> subprocess.CompletedProcess:
    print("+", " ".join(str(arg) for arg in args[:14]), "..." if len(args) > 14 else "", flush=True)
    return subprocess.run(
        [str(arg) for arg in args], check=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        timeout=timeout,
    )


def probe(path: Path) -> dict:
    result = run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration,size,format_name:stream=index,codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels",
        "-of", "json", path,
    ], capture=True)
    return json.loads(result.stdout)


def safe_extract_zip(archive: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as handle:
        for member in handle.infolist():
            target = (destination / member.filename).resolve()
            if destination.resolve() not in target.parents and target != destination.resolve():
                raise RuntimeError(f"Unsafe archive path: {member.filename}")
        handle.extractall(destination)


def video_candidates(directory: Path) -> list[Path]:
    return sorted(
        (path for path in directory.rglob("*") if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS),
        key=lambda path: path.stat().st_size, reverse=True,
    )


def ensure_source(entry: dict) -> Path:
    """Download one Drive source and return the largest reviewable video."""
    destination = RAW / entry["id"]
    destination.mkdir(parents=True, exist_ok=True)
    candidates = video_candidates(destination)
    if not candidates:
        print(f"\n=== Downloading {entry['id']} from {entry['sourcePage']} ===", flush=True)
        if entry["kind"] == "drive_file":
            result = gdown.download(id=entry["driveId"], output=str(destination) + os.sep, quiet=False)
            print("gdown file result:", result, flush=True)
        elif entry["kind"] == "drive_folder":
            result = gdown.download_folder(
                id=entry["driveId"], output=str(destination), quiet=False, use_cookies=False,
            )
            print("gdown folder result:", result, flush=True)
        else:
            raise ValueError(f"Unknown source kind: {entry['kind']}")
        for archive in list(destination.rglob("*.zip")):
            safe_extract_zip(archive, destination / "extracted" / archive.stem)
        candidates = video_candidates(destination)
    if not candidates:
        files = [str(path.relative_to(destination)) for path in destination.rglob("*") if path.is_file()]
        raise RuntimeError(f"No video found for {entry['id']}; downloaded files: {files[:30]}")
    selected = candidates[0]
    print(f"Selected {entry['id']}: {selected.name} ({selected.stat().st_size:,} bytes)", flush=True)
    return selected


def convert_audio_source(original: Path, target: Path, metadata: dict) -> Path:
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", original,
        "-map", "0:a:0", "-vn", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", target,
    ])
    metadata = {**metadata, "convertedDuration": float(probe(target)["format"]["duration"])}
    (AUDIO / "source-info.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"Audio ready: {target} ({target.stat().st_size:,} bytes)", flush=True)
    return target


def ensure_apple_preview(target: Path) -> Path | None:
    """Use the artist-identical, publicly served Apple Music preview (no login/DRM)."""
    import requests

    lookup = CONFIG["audio"]["appleLookup"]
    print(f"\n=== Resolving official Apple Music preview: {lookup} ===", flush=True)
    response = requests.get(lookup, timeout=45)
    response.raise_for_status()
    results = response.json().get("results", [])
    track = next((item for item in results if item.get("trackId") == CONFIG["audio"]["appleTrackId"]), None)
    if not track or track.get("trackName") != "Melatonin" or "jomm" not in track.get("artistName", ""):
        raise RuntimeError("Apple lookup did not return the expected jomm Melatonin track")
    preview_url = track.get("previewUrl")
    if not preview_url:
        print("Apple Music has no downloadable preview for this track.", flush=True)
        return None
    original = AUDIO / "original-apple.m4a"
    with requests.get(preview_url, stream=True, timeout=60) as preview:
        preview.raise_for_status()
        with original.open("wb") as handle:
            for chunk in preview.iter_content(1024 * 1024):
                if chunk:
                    handle.write(chunk)
    if original.stat().st_size < 50_000:
        raise RuntimeError("Apple preview download was unexpectedly small")
    return convert_audio_source(original, target, {
        "sourceType": "Apple Music official preview",
        "trackId": track["trackId"],
        "title": track["trackName"],
        "artists": track["artistName"],
        "trackViewUrl": track["trackViewUrl"],
        "previewUrl": preview_url,
        "fullTrackSeconds": track.get("trackTimeMillis", 0) / 1000,
    })


def ensure_audio() -> Path:
    """Fetch an official original-audio segment without requesting user credentials."""
    target = AUDIO / "melatonin-48k.wav"
    if target.exists() and target.stat().st_size > 100_000:
        return target
    AUDIO.mkdir(parents=True, exist_ok=True)
    try:
        preview = ensure_apple_preview(target)
        if preview is not None:
            return preview
    except Exception as error:
        print("Apple preview fallback triggered:", type(error).__name__, error, flush=True)

    from yt_dlp import YoutubeDL

    errors = []
    for url in CONFIG["audio"]["sources"]:
        print(f"\n=== Fetching original Melatonin audio: {url} ===", flush=True)
        for partial in AUDIO.glob("original.*"):
            if partial.is_file():
                partial.unlink()
        options = {
            "format": "bestaudio/best",
            "outtmpl": str(AUDIO / "original.%(ext)s"),
            "noplaylist": True,
            "retries": 3,
            "fragment_retries": 3,
            "socket_timeout": 45,
            "quiet": False,
        }
        try:
            with YoutubeDL(options) as downloader:
                info = downloader.extract_info(url, download=True)
            originals = [
                path for path in AUDIO.glob("original.*")
                if path.suffix not in {".json", ".part", ".ytdl"} and path.stat().st_size > 100_000
            ]
            if not originals:
                raise RuntimeError("yt-dlp completed without an audio file")
            metadata = {
                key: info.get(key) for key in (
                    "id", "title", "webpage_url", "duration", "uploader", "channel", "extractor",
                )
            }
            return convert_audio_source(originals[0], target, metadata)
        except Exception as error:  # try the second official source with full diagnostics
            errors.append(f"{url}: {type(error).__name__}: {error}")
            print(errors[-1], flush=True)
    raise RuntimeError("Could not fetch any official audio source:\n" + "\n".join(errors))


def load_mono(path: Path) -> tuple[np.ndarray, int]:
    samples, sample_rate = sf.read(str(path), always_2d=True)
    mono = np.mean(samples, axis=1, dtype=np.float32)
    return mono, int(sample_rate)


def analyse_audio(path: Path) -> dict:
    print("\n=== Analysing tempo, beats and lyrics ===", flush=True)
    mono, sample_rate = load_mono(path)
    hop = 512
    onset = librosa.onset.onset_strength(y=mono, sr=sample_rate, hop_length=hop)
    tempo, frames = librosa.beat.beat_track(onset_envelope=onset, sr=sample_rate, hop_length=hop)
    beat_times = librosa.frames_to_time(frames, sr=sample_rate, hop_length=hop)
    onset_times = librosa.onset.onset_detect(
        onset_envelope=onset, sr=sample_rate, hop_length=hop, backtrack=True, units="time",
    )
    duration = len(mono) / sample_rate
    rms = librosa.feature.rms(y=mono, hop_length=hop)[0]
    frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sample_rate, hop_length=hop)
    windows = []
    window_duration = min(20.0, max(5.0, duration - 1.0))
    for start in np.arange(0.0, max(0.1, duration - window_duration), 2.5):
        mask = (frame_times >= start) & (frame_times < start + window_duration)
        if np.any(mask):
            windows.append({
                "start": round(float(start), 3),
                "duration": window_duration,
                "energy": round(float(np.mean(rms[mask])), 6),
                "onsetStrength": round(float(np.mean(onset[mask])), 6),
            })
    windows.sort(key=lambda row: row["energy"] * row["onsetStrength"], reverse=True)
    analysis = {
        "duration": round(duration, 3),
        "sampleRate": sample_rate,
        "tempoBpm": round(float(np.atleast_1d(tempo)[0]), 3),
        "beatTimes": [round(float(value), 3) for value in beat_times],
        "onsetTimes": [round(float(value), 3) for value in onset_times],
        "strongest20SecondWindows": windows[:12],
        "editReferenceStart": CONFIG["audio"]["editReferenceStart"] if duration > 100 else 0.0,
    }
    (SCOUT / "audio-analysis.json").write_text(json.dumps(analysis, indent=2) + "\n")
    make_waveform(mono, sample_rate, beat_times, duration)
    try:
        transcribe_lyrics(path)
    except Exception as error:
        (SCOUT / "audio-lyrics.txt").write_text(
            "Lyric transcription was unavailable; visual beat analysis is still valid.\n"
            f"{type(error).__name__}: {error}\n"
        )
        print("Lyric transcription warning:", error, flush=True)
    return analysis


def transcribe_lyrics(path: Path) -> None:
    from faster_whisper import WhisperModel

    model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
    segments, _ = model.transcribe(
        str(path), language="en", beam_size=5, best_of=5, vad_filter=True,
        condition_on_previous_text=False,
        initial_prompt="English indie pop song Melatonin by jomm and readyaimfire27. Transcribe sung lyrics only.",
    )
    rows = []
    for segment in segments:
        text = segment.text.strip()
        if text:
            rows.append({"start": round(segment.start, 3), "end": round(segment.end, 3), "text": text})
    (SCOUT / "audio-lyrics.json").write_text(json.dumps(rows, indent=2) + "\n")
    (SCOUT / "audio-lyrics.txt").write_text(
        "AUTO-TRANSCRIPTION FOR TIMING REVIEW — verify before displaying any lyric text.\n\n"
        + "\n".join(f"[{row['start']:07.2f} - {row['end']:07.2f}] {row['text']}" for row in rows) + "\n"
    )


def make_waveform(mono: np.ndarray, sample_rate: int, beats: np.ndarray, duration: float) -> None:
    width, height = 1500, 620
    image = Image.new("RGB", (width, height), "#0d1017")
    draw = ImageDraw.Draw(image)
    bold = ImageFont.truetype(BOLD, 30)
    small = ImageFont.truetype(FONT, 20)
    draw.text((28, 18), "jomm — Melatonin | waveform + detected beats", font=bold, fill="#f2d19b")
    edit_start = 30.0 if duration > 95 else 0.0
    edit_end = min(95.0, duration)
    panels = [
        (0.0, duration, 78, 280, "FULL AVAILABLE AUDIO"),
        (edit_start, edit_end, 340, 555, "EDIT REGION"),
    ]
    for start, end, top, bottom, label in panels:
        left, right = 50, width - 40
        draw.text((left, top - 28), f"{label}  {start:.1f}–{end:.1f}s", font=small, fill="white")
        draw.line((left, (top + bottom) // 2, right, (top + bottom) // 2), fill="#39404e", width=1)
        i0, i1 = int(start * sample_rate), min(len(mono), int(end * sample_rate))
        section = mono[i0:i1]
        bins = right - left
        if len(section) == 0:
            continue
        chunks = np.array_split(section, bins)
        for x, chunk in enumerate(chunks):
            peak = float(np.max(np.abs(chunk))) if len(chunk) else 0.0
            amplitude = min((bottom - top) * 0.48, peak * (bottom - top) * 1.7)
            cy = (top + bottom) / 2
            draw.line((left + x, cy - amplitude, left + x, cy + amplitude), fill="#82c7e5", width=1)
        for beat in beats:
            if start <= float(beat) <= end:
                x = left + (float(beat) - start) / max(0.001, end - start) * (right - left)
                draw.line((x, top, x, bottom), fill="#d7a35d", width=1)
        for second in np.arange(np.ceil(start / 10) * 10, end, 10):
            x = left + (second - start) / max(0.001, end - start) * (right - left)
            draw.text((x - 12, bottom + 7), f"{second:.0f}s", font=small, fill="#aab0bd")
    image.save(SCOUT / "audio-waveform.jpg", quality=92)


def crop_cover(frame: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(frame.convert("RGB"), size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def scout_video(entry: dict, video: Path) -> dict:
    print(f"\n=== Scouting {entry['id']}: {video.name} ===", flush=True)
    metadata = probe(video)
    duration = float(metadata["format"]["duration"])
    if duration < 12:
        raise RuntimeError(f"{entry['id']} source is too short: {duration:.2f}s")
    frame_dir = WORK / "frames" / entry["id"]
    frame_dir.mkdir(parents=True, exist_ok=True)
    times = [duration * (0.025 + 0.95 * index / 11) for index in range(12)]
    frames: list[Image.Image] = []
    for index, at in enumerate(times):
        target = frame_dir / f"{index:02d}.jpg"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{at:.3f}",
            "-i", video, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "2", target,
        ], timeout=120)
        with Image.open(target) as image:
            frames.append(image.convert("RGB").copy())

    tile_w, tile_h = 320, 210
    sheet = Image.new("RGB", (tile_w * 4, 94 + tile_h * 3), "#0d1017")
    draw = ImageDraw.Draw(sheet)
    draw.text((16, 12), f"{entry['character']} — {entry['sourceLabel']}", font=ImageFont.truetype(BOLD, 25), fill=entry["accent"])
    draw.text((16, 51), f"{video.name}  •  {duration:.2f}s  •  central 9:16 crop guide", font=ImageFont.truetype(FONT, 18), fill="white")
    for index, (frame, at) in enumerate(zip(frames, times)):
        tile = Image.new("RGB", (tile_w, tile_h), "#11151e")
        thumb = ImageOps.contain(frame, (320, 180), method=Image.Resampling.LANCZOS)
        x0, y0 = (320 - thumb.width) // 2, (180 - thumb.height) // 2
        tile.paste(thumb, (x0, y0))
        guide = ImageDraw.Draw(tile)
        # Show which central region survives a 9:16 cover crop.
        if thumb.width / thumb.height >= 9 / 16:
            guide_w = thumb.height * 9 / 16
            left = x0 + (thumb.width - guide_w) / 2
            guide.rectangle((left, y0, left + guide_w, y0 + thumb.height), outline="#f2d19b", width=2)
        else:
            guide_h = thumb.width * 16 / 9
            top = y0 + (thumb.height - guide_h) / 2
            guide.rectangle((x0, top, x0 + thumb.width, top + guide_h), outline="#f2d19b", width=2)
        guide.text((8, 185), f"{at:07.2f}s  •  source % {100 * at / duration:04.1f}", font=ImageFont.truetype(FONT, 16), fill="white")
        sheet.paste(tile, ((index % 4) * tile_w, 94 + (index // 4) * tile_h))
    full_sheet = SCOUT / f"{entry['id']}-scout.jpg"
    sheet.save(full_sheet, quality=91)

    crop_sheet = Image.new("RGB", (1080, 560), "#0d1017")
    crop_draw = ImageDraw.Draw(crop_sheet)
    crop_draw.text((16, 12), f"{entry['character']} — central vertical crops", font=ImageFont.truetype(BOLD, 25), fill=entry["accent"])
    crop_draw.text((16, 50), "Use these to judge face placement and action readability.", font=ImageFont.truetype(FONT, 18), fill="white")
    for column, index in enumerate((1, 4, 7, 10)):
        crop = crop_cover(frames[index], (270, 480))
        crop_sheet.paste(crop, (column * 270, 76))
        crop_draw.text((column * 270 + 10, 532), f"{times[index]:.2f}s", font=ImageFont.truetype(FONT, 17), fill="white")
    crop_sheet.save(SCOUT / f"{entry['id']}-vertical-crops.jpg", quality=91)
    return {
        **entry,
        "selectedVideo": str(video.relative_to(RAW)),
        "selectedBytes": video.stat().st_size,
        "duration": duration,
        "probe": metadata,
        "review": [full_sheet.name, f"{entry['id']}-vertical-crops.jpg"],
    }


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    if SCOUT.exists():
        shutil.rmtree(SCOUT)
    SCOUT.mkdir(parents=True)
    audio = ensure_audio()
    analysis = analyse_audio(audio)
    inventory = []
    for entry in CONFIG["videos"]:
        video = ensure_source(entry)
        candidates = video_candidates(RAW / entry["id"])
        item = scout_video(entry, video)
        item["allVideoCandidates"] = [
            {"file": str(path.relative_to(RAW / entry["id"])), "bytes": path.stat().st_size}
            for path in candidates
        ]
        inventory.append(item)
        (SCOUT / "inventory.json").write_text(json.dumps(inventory, indent=2) + "\n")
    (SCOUT / "source-info.json").write_text((AUDIO / "source-info.json").read_text())
    (SCOUT / "summary.json").write_text(json.dumps({
        "campaign": CONFIG["campaign"],
        "sourceCount": len(inventory),
        "audioDuration": analysis["duration"],
        "tempoBpm": analysis["tempoBpm"],
        "reviewSheets": len(list(SCOUT.glob("*.jpg"))),
    }, indent=2) + "\n")
    print(f"\nScouting complete: {len(inventory)} sources, {len(list(SCOUT.glob('*.jpg')))} review sheets.", flush=True)


if __name__ == "__main__":
    main()
