import json
import textwrap
from pathlib import Path

root = Path(__file__).parent
data = json.load(open(root / "transcript.json"))
plan = json.load(open(root / "clip_plan.json"))
plan["clips"][0]["parts"][0]["start"] = 62.74
plan["clips"][2]["parts"][0]["start"] = 1924.83


def ass_time(seconds):
    centis = round(max(0, seconds) * 100)
    hours, rem = divmod(centis, 360000)
    minutes, rem = divmod(rem, 6000)
    secs, cs = divmod(rem, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{cs:02d}"


header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,DejaVu Sans,30,&H0037AFD4,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,0,0,8,30,30,82,1
Style: Caption,DejaVu Sans,58,&H00FFFFFF,&H000000FF,&H00101823,&H96000000,-1,0,0,0,100,100,0,0,1,5,1,2,70,70,500,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

for clip in plan["clips"]:
    events = []
    plain = []
    timeline = 0.0
    sentence_start = True
    for part in clip["parts"]:
        words = []
        for segment in data["segments"]:
            for word in segment["words"]:
                if word["end"] > part["start"] and word["start"] < part["end"]:
                    words.append({
                        "start": max(word["start"], part["start"]),
                        "end": min(word["end"], part["end"]),
                        "word": word["word"].strip(),
                    })
        if clip["id"].startswith("04_"):
            fixed = []
            index = 0
            while index < len(words):
                if (
                    index + 1 < len(words)
                    and words[index]["word"] == "a"
                    and words[index + 1]["word"] == "shame"
                    and fixed
                    and fixed[-1]["word"] == "not"
                ):
                    fixed.append({
                        "start": words[index]["start"],
                        "end": words[index + 1]["end"],
                        "word": "ashamed",
                    })
                    index += 2
                else:
                    fixed.append(words[index])
                    index += 1
            words = fixed

        cues = []
        group = []

        def flush():
            if not group:
                return
            text = " ".join(item["word"] for item in group).strip()
            start = timeline + max(0, group[0]["start"] - part["start"])
            end = timeline + group[-1]["end"] - part["start"]
            cues.append([start, end, text])
            group.clear()

        for word in words:
            prospective = group + [word]
            text = " ".join(item["word"] for item in prospective)
            duration = word["end"] - prospective[0]["start"]
            if group and (len(prospective) > 4 or len(text) > 38 or duration > 3.0):
                flush()
            group.append(word)
            if group[-1]["word"].endswith((".", "?", "!")):
                flush()
        flush()

        for index, cue in enumerate(cues):
            if index + 1 < len(cues):
                cue[1] = min(cue[1], cues[index + 1][0] - 0.02)
            if cue[1] <= cue[0]:
                cue[1] = cue[0] + 0.04
            text = cue[2].replace("fun And", "fun. And").replace("not I'll", "not— I'll")
            if sentence_start and text:
                text = text[0].upper() + text[1:]
            sentence_start = text.endswith((".", "?", "!"))
            wrapped = "\\N".join(textwrap.wrap(
                text, width=27, break_long_words=False, break_on_hyphens=False
            ))
            events.append(
                f"Dialogue: 0,{ass_time(cue[0])},{ass_time(cue[1])},Caption,,0,0,0,,{wrapped}"
            )
            plain.append(f"[{cue[0]:05.2f}-{cue[1]:05.2f}] {text}")
        timeline += part["end"] - part["start"]

    clip["render_duration"] = round(timeline, 3)
    title = (
        f"Dialogue: 0,{ass_time(0)},{ass_time(timeline)},Title,,0,0,0,,"
        "THE WORLD'S FIRST PODCAST"
    )
    (root / f"{clip['id']}.ass").write_text(
        header + title + "\n" + "\n".join(events) + "\n", encoding="utf-8"
    )
    (root / f"{clip['id']}_captions.txt").write_text(
        "\n".join(plain) + "\n", encoding="utf-8"
    )
    print(clip["id"], "duration", timeline, "caption_events", len(events))

json.dump(plan, open(root / "clip_plan.json", "w"), indent=2)
