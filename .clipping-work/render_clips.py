import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
SOURCE = REPO / "work" / "episode-1.mp4"
OUTPUT = REPO / "docs" / "clips" / "worlds-first-podcast"
OUTPUT.mkdir(parents=True, exist_ok=True)
PLAN = json.load(open(ROOT / "clip_plan.json"))


def run(command):
    print("RUN", " ".join(str(item) for item in command), flush=True)
    subprocess.run([str(item) for item in command], cwd=REPO, check=True)


def probe(path):
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries",
            "stream=codec_type,codec_name,width,height,pix_fmt,sample_rate,channels,r_frame_rate:format=duration,size",
            "-of", "json", str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


qa = {"status": "PASS", "clips": []}
preview_rows = []
for clip in PLAN["clips"]:
    destination = OUTPUT / f"{clip['id']}.mp4"
    command = ["ffmpeg", "-y", "-loglevel", "warning"]
    for part in clip["parts"]:
        duration = part["end"] - part["start"]
        command += ["-ss", f"{part['start']:.3f}", "-t", f"{duration:.3f}", "-i", SOURCE]

    filters = []
    for index in range(len(clip["parts"])):
        filters.append(f"[{index}:v]setpts=PTS-STARTPTS,fps=30,format=yuv420p[v{index}]")
        filters.append(f"[{index}:a]asetpts=PTS-STARTPTS[a{index}]")
    concat_inputs = "".join(f"[v{i}][a{i}]" for i in range(len(clip["parts"])))
    filters.append(f"{concat_inputs}concat=n={len(clip['parts'])}:v=1:a=1[catv][cata]")
    filters += [
        "[catv]split=2[bg][fg]",
        "[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,gblur=sigma=12,scale=1080:1920,eq=brightness=-0.32:saturation=0.70[bgv]",
        "[fg]scale=1080:-2[fgv]",
        f"[bgv][fgv]overlay=(W-w)/2:400,drawbox=x=0:y=0:w=iw:h=190:color=0x0B1220@0.88:t=fill,ass=filename=.clipping-work/{clip['id']}.ass[vout]",
        "[cata]loudnorm=I=-14:TP=-1.5:LRA=11[aout]",
    ]
    filter_path = ROOT / f"{clip['id']}.filter"
    filter_path.write_text(";\n".join(filters) + ";\n")
    expected = sum(part["end"] - part["start"] for part in clip["parts"])
    command += [
        "-filter_complex_script", filter_path,
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
        "-movflags", "+faststart", "-t", f"{expected:.3f}",
        "-metadata", f"title={clip['title']} — The World's First Podcast",
        destination,
    ]
    run(command)
    run(["ffmpeg", "-v", "error", "-i", destination, "-f", "null", "-"])

    metadata = probe(destination)
    streams = metadata["streams"]
    video = next(stream for stream in streams if stream["codec_type"] == "video")
    audio = next(stream for stream in streams if stream["codec_type"] == "audio")
    actual = float(metadata["format"]["duration"])
    assert video["codec_name"] == "h264"
    assert (video["width"], video["height"], video["pix_fmt"]) == (1080, 1920, "yuv420p")
    assert video["r_frame_rate"] == "30/1"
    assert audio["codec_name"] == "aac" and audio["sample_rate"] == "48000"
    assert abs(actual - expected) < 0.35, (actual, expected)
    assert destination.stat().st_size > 100_000

    frames = []
    for position in (0.12, 0.50, 0.88):
        frame_path = ROOT / f"{clip['id']}_{int(position * 100)}.jpg"
        run([
            "ffmpeg", "-y", "-loglevel", "error", "-ss", f"{actual * position:.3f}",
            "-i", destination, "-frames:v", "1", "-vf", "scale=360:640", frame_path,
        ])
        frames.append(Image.open(frame_path).convert("RGB"))
    preview_rows.append((clip["id"], actual, frames))
    qa["clips"].append({
        "file": destination.name,
        "duration_seconds": round(actual, 3),
        "expected_seconds": round(expected, 3),
        "width": video["width"],
        "height": video["height"],
        "fps": video["r_frame_rate"],
        "video_codec": video["codec_name"],
        "audio_codec": audio["codec_name"],
        "audio_sample_rate": audio["sample_rate"],
        "bytes": destination.stat().st_size,
        "decode_validation": "PASS",
    })
    print("CLIP_PASS", destination.name, actual, destination.stat().st_size, flush=True)

font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 23)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
sheet = Image.new("RGB", (1080, len(preview_rows) * 700), "#0B1220")
draw = ImageDraw.Draw(sheet)
for row, (name, duration, frames) in enumerate(preview_rows):
    y = row * 700
    draw.text((18, y + 15), f"{name}  |  {duration:.1f}s", font=font, fill="#F8FAFC")
    for column, frame in enumerate(frames):
        sheet.paste(frame, (column * 360, y + 60))
sheet.save(OUTPUT / "Preview_Contact_Sheet.jpg", quality=90)
json.dump(qa, open(OUTPUT / "QA.json", "w"), indent=2)
print("ALL_CLIPS_PASS", len(qa["clips"]), flush=True)
