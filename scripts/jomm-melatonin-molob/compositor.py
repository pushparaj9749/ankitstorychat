#!/usr/bin/env python3
"""Frame compositor for the from-scratch Molob-inspired Melatonin edits.

The input is an overscanned, colour-managed base cut. This pass choreographs the
camera, impact transitions, light effects and kinetic type independently for
every output frame. No part of the previous renderer's effect stack is used.
"""
from __future__ import annotations

from dataclasses import dataclass
import bisect
import math
from pathlib import Path
import random
import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1920
FPS = 30
BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-BoldOblique.ttf")
REGULAR = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
if not BOLD.exists():
    BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")


def rgb(hex_colour: str) -> tuple[int, int, int]:
    value = hex_colour.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def bgr(hex_colour: str) -> tuple[int, int, int]:
    return tuple(reversed(rgb(hex_colour)))


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease_out_back(value: float) -> float:
    value = clamp(value)
    c1 = 1.70158
    c3 = c1 + 1.0
    return 1.0 + c3 * (value - 1.0) ** 3 + c1 * (value - 1.0) ** 2


def fit_font(draw: ImageDraw.ImageDraw, text: str, maximum: int, width: int) -> ImageFont.FreeTypeFont:
    size = maximum
    while size > 34:
        font = ImageFont.truetype(str(BOLD), size)
        box = draw.textbbox((0, 0), text, font=font, stroke_width=2)
        if box[2] - box[0] <= width:
            return font
        size -= 3
    return ImageFont.truetype(str(BOLD), size)


def tracked_text(draw: ImageDraw.ImageDraw, position: tuple[int, int], text: str,
                 font: ImageFont.FreeTypeFont, fill: tuple[int, ...], spacing: int = 5) -> None:
    x, y = position
    for character in text:
        draw.text((x, y), character, font=font, fill=fill)
        box = draw.textbbox((x, y), character, font=font)
        x += box[2] - box[0] + spacing


def make_text_sprite(text: str, sub: str, accent: str, secondary: str) -> np.ndarray:
    """Create a bright, extruded title with a coloured rim and restrained glow."""
    canvas = Image.new("RGBA", (1040, 390), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    title = text.upper()
    font = fit_font(draw, title, 142 if len(title) < 12 else 116, 920)
    box = draw.textbbox((0, 0), title, font=font, stroke_width=4)
    text_width = box[2] - box[0]
    x = (1040 - text_width) // 2
    y = 70 - box[1]
    main = rgb(accent)
    second = rgb(secondary)
    dark = tuple(int(channel * 0.20) for channel in main)

    # A soft coloured aura lives inside the sprite, so no full-frame blur is needed.
    aura = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    aura_draw = ImageDraw.Draw(aura)
    aura_draw.text((x, y), title, font=font, fill=(*main, 180), stroke_width=12, stroke_fill=(*main, 130))
    aura = aura.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(18))
    canvas = Image.alpha_composite(canvas, aura)
    draw = ImageDraw.Draw(canvas)

    for offset in range(18, 1, -3):
        draw.text((x + offset, y + offset), title, font=font, fill=(*dark, 255),
                  stroke_width=5, stroke_fill=(5, 7, 14, 245))
    draw.text((x, y), title, font=font, fill=(248, 250, 255, 255),
              stroke_width=8, stroke_fill=(*main, 255))
    draw.text((x, y - 3), title, font=font, fill=(250, 252, 255, 255),
              stroke_width=2, stroke_fill=(12, 15, 24, 255))
    draw.line((x + 5, y + box[3] + 27, x + text_width - 5, y + box[3] + 27), fill=(*second, 255), width=5)

    small = ImageFont.truetype(str(BOLD), 27)
    sub = sub.upper()
    sub_width = draw.textbbox((0, 0), sub, font=small)[2] + max(0, len(sub) - 1) * 5
    tracked_text(draw, ((1040 - sub_width) // 2, 304), sub, small, (*second, 255), 5)
    micro = ImageFont.truetype(str(REGULAR), 18)
    label = "JOMM  /  MELATONIN"
    label_width = draw.textbbox((0, 0), label, font=micro)[2]
    draw.text(((1040 - label_width) // 2, 348), label, font=micro, fill=(225, 231, 242, 220))
    return cv2.cvtColor(np.asarray(canvas), cv2.COLOR_RGBA2BGRA)


@dataclass
class TextEvent:
    start: float
    end: float
    y: float
    angle: float
    sprite: np.ndarray


@dataclass
class Impact:
    shot: int
    style: str
    direction: int
    seed: int


class Compositor:
    def __init__(self, entry: dict, boundaries: list[float], frames: int, log_path: Path):
        self.entry = entry
        self.boundaries = boundaries
        self.frames = frames
        self.duration = frames / FPS
        self.log_path = log_path
        self.accent = bgr(entry["accent"])
        self.secondary = bgr(entry["secondary"])
        self.strength = float(entry.get("shakeStrength", 1.1))
        self.bloom = float(entry.get("bloom", 0.18))
        self.rng = random.Random(entry["seed"])
        major = set(entry["majorCuts"])
        styles = ["lightning", "shock", "glitch", "whip"]
        offset = int(entry.get("styleOffset", 0))
        self.impacts: dict[int, Impact] = {}
        major_number = 0
        for shot in range(1, len(boundaries) - 1):
            if shot in major:
                style = styles[(major_number + offset) % len(styles)]
                major_number += 1
            else:
                style = "kick"
            self.impacts[shot] = Impact(shot, style, 1 if shot % 2 == 0 else -1, entry["seed"] + shot * 97)
        self.text_events = []
        for event in entry["textEvents"]:
            start = boundaries[int(event["shot"])] + float(event.get("offset", 0.04))
            end = min(self.duration - 0.16, start + float(event.get("duration", 1.35)))
            self.text_events.append(TextEvent(
                start=start,
                end=end,
                y=float(event.get("y", 0.68)),
                angle=float(event.get("angle", -1.5)),
                sprite=make_text_sprite(event["text"], event["sub"], entry["accent"], entry["secondary"]),
            ))
        self.particles = []
        for _ in range(18):
            self.particles.append({
                "x": self.rng.uniform(0.03, 0.97),
                "y": self.rng.uniform(0.03, 0.97),
                "vx": self.rng.uniform(-0.018, 0.018),
                "vy": self.rng.uniform(-0.035, -0.008),
                "radius": self.rng.choice([1, 1, 2, 2, 3]),
                "phase": self.rng.uniform(0, math.tau),
                "colour": self.accent if self.rng.random() < 0.7 else self.secondary,
            })
        self.effect_counts = {
            "hardCameraCuts": len(boundaries) - 2,
            "majorImpacts": major_number,
            "lightning": sum(item.style == "lightning" for item in self.impacts.values()),
            "shockwaves": sum(item.style == "shock" for item in self.impacts.values()),
            "glitches": sum(item.style == "glitch" for item in self.impacts.values()),
            "whips": sum(item.style == "whip" for item in self.impacts.values()),
            "kineticTextEvents": len(self.text_events),
        }

    def camera(self, frame: np.ndarray, shot: int, local: float, t: float) -> tuple[np.ndarray, float, float]:
        impact = self.impacts.get(shot)
        major = impact is not None and impact.style != "kick"
        direction = impact.direction if impact else (1 if shot % 2 == 0 else -1)
        shot_duration = self.boundaries[shot + 1] - self.boundaries[shot]
        envelope = math.exp(-local * (12.0 if major else 18.0)) if local < 0.42 else 0.0
        amplitude = (62.0 if major else 25.0) * self.strength
        sx = direction * amplitude * math.sin(local * 97.0) * envelope + 3.2 * math.sin(t * 1.71)
        sy = amplitude * 0.72 * math.cos(local * 83.0) * envelope + 2.3 * math.cos(t * 1.33)
        rotation = direction * (1.65 if major else 0.62) * math.sin(local * 79.0) * envelope
        if impact and impact.style == "whip":
            sx += direction * 150.0 * math.exp(-local * 15.0)
            rotation += direction * 2.2 * math.exp(-local * 13.0)
        punch = (0.225 if major else 0.092) * math.exp(-local * 13.5)
        if shot == 0:
            punch += 0.12 * math.exp(-t * 4.5)
        drift = (0.040 if shot % 2 == 0 else -0.020) * clamp(local / max(0.1, shot_duration))
        zoom = 1.035 + 0.018 * (shot % 3) + punch + drift
        pan_x = direction * 46.0 * (local / max(0.1, shot_duration) - 0.5)
        pan_y = 23.0 * math.sin(shot * 1.37 + local * 2.2)
        angle = math.radians(rotation + 0.32 * math.sin(shot * 1.9))

        in_h, in_w = frame.shape[:2]
        scale = HEIGHT / in_h * zoom
        cos_a = math.cos(angle) * scale
        sin_a = math.sin(angle) * scale
        out_cx = WIDTH / 2 + sx + pan_x
        out_cy = HEIGHT / 2 + sy + pan_y
        matrix = np.array([
            [cos_a, -sin_a, out_cx - cos_a * in_w / 2 + sin_a * in_h / 2],
            [sin_a, cos_a, out_cy - sin_a * in_w / 2 - cos_a * in_h / 2],
        ], dtype=np.float32)
        transformed = cv2.warpAffine(
            frame, matrix, (WIDTH, HEIGHT), flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REFLECT_101,
        )
        return transformed, sx, sy

    def add_bloom(self, frame: np.ndarray) -> np.ndarray:
        if self.bloom <= 0:
            return frame
        small = cv2.resize(frame, (540, 960), interpolation=cv2.INTER_AREA)
        grey = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        threshold = 205 if self.entry["id"] == "tanjiro" else 222
        mask = cv2.threshold(grey, threshold, 255, cv2.THRESH_BINARY)[1]
        highlights = cv2.bitwise_and(small, small, mask=mask)
        glow = cv2.GaussianBlur(highlights, (0, 0), 7.5)
        glow = cv2.resize(glow, (WIDTH, HEIGHT), interpolation=cv2.INTER_LINEAR)
        return cv2.addWeighted(frame, 1.0, glow, self.bloom, 0)

    @staticmethod
    def rgb_split(frame: np.ndarray, amount: int, vertical: int = 0) -> np.ndarray:
        blue, green, red = cv2.split(frame)
        red_matrix = np.float32([[1, 0, amount], [0, 1, vertical]])
        blue_matrix = np.float32([[1, 0, -amount], [0, 1, -vertical]])
        red = cv2.warpAffine(red, red_matrix, (WIDTH, HEIGHT), borderMode=cv2.BORDER_REFLECT_101)
        blue = cv2.warpAffine(blue, blue_matrix, (WIDTH, HEIGHT), borderMode=cv2.BORDER_REFLECT_101)
        return cv2.merge((blue, green, red))

    @staticmethod
    def directional_blur(frame: np.ndarray, horizontal: bool = True) -> np.ndarray:
        kernel = np.zeros((11, 11), dtype=np.float32)
        if horizontal:
            kernel[5, :] = 1.0 / 11.0
        else:
            kernel[:, 5] = 1.0 / 11.0
        return cv2.filter2D(frame, -1, kernel)

    def glitch(self, frame: np.ndarray, impact: Impact, local: float) -> np.ndarray:
        rng = random.Random(impact.seed + int(local * 1000))
        result = frame.copy()
        for _ in range(9):
            y = rng.randrange(40, HEIGHT - 60)
            height = rng.randrange(8, 42)
            shift = rng.randrange(-85, 86)
            strip = np.roll(result[y:y + height], shift, axis=1)
            result[y:y + height] = strip
        return self.rgb_split(result, 18, 3)

    def draw_ambient_particles(self, frame: np.ndarray, t: float) -> np.ndarray:
        # Additive light preserves the underlying CC instead of stamping dark dots.
        overlay = np.zeros_like(frame)
        for index, particle in enumerate(self.particles):
            x = (particle["x"] + particle["vx"] * t + 0.008 * math.sin(t + particle["phase"])) % 1.0
            y = (particle["y"] + particle["vy"] * t) % 1.0
            pulse = 0.45 + 0.35 * math.sin(t * 2.4 + particle["phase"])
            colour = tuple(int(channel * pulse) for channel in particle["colour"])
            centre = (int(x * WIDTH), int(y * HEIGHT))
            cv2.circle(overlay, centre, particle["radius"] + 2, tuple(int(c * 0.22) for c in colour), -1, cv2.LINE_AA)
            cv2.circle(overlay, centre, particle["radius"], colour, -1, cv2.LINE_AA)
            if index % 5 == 0:
                cv2.circle(overlay, centre, 1, (150, 165, 175), -1, cv2.LINE_AA)
        return cv2.add(frame, overlay)

    def draw_impact(self, frame: np.ndarray, impact: Impact, local: float) -> np.ndarray:
        if impact.style == "kick" or local > 0.34:
            return frame
        decay = math.exp(-local * 10.5)
        rng = random.Random(impact.seed)
        centre = (WIDTH // 2 + impact.direction * 65, int(HEIGHT * 0.46))
        overlay = np.zeros_like(frame)
        if impact.style == "shock":
            radius = int(45 + local * 1550)
            colour = tuple(int(channel * decay) for channel in self.accent)
            cv2.circle(overlay, centre, radius, tuple(int(c * 0.20) for c in colour), 18, cv2.LINE_AA)
            cv2.circle(overlay, centre, radius, colour, 5, cv2.LINE_AA)
            cv2.circle(overlay, centre, max(1, radius - 22), tuple(int(c * 0.55) for c in self.secondary), 2, cv2.LINE_AA)
        elif impact.style == "lightning" and local <= 0.12:
            points = [(centre[0] - 270, -30)]
            x, y = points[0]
            for _ in range(10):
                x += rng.randint(-65, 85)
                y += rng.randint(125, 205)
                points.append((x, y))
            pts = np.asarray(points, dtype=np.int32)
            cv2.polylines(overlay, [pts], False, tuple(int(c * 0.24 * decay) for c in self.accent), 24, cv2.LINE_AA)
            cv2.polylines(overlay, [pts], False, tuple(int(c * decay) for c in self.accent), 10, cv2.LINE_AA)
            cv2.polylines(overlay, [pts], False, (245, 250, 255), 2, cv2.LINE_AA)
        if local <= 0.18:
            for ray in range(16):
                angle = rng.uniform(0, math.tau)
                inner = rng.randint(150, 310) + int(local * 400)
                length = rng.randint(55, 190)
                start = (int(centre[0] + math.cos(angle) * inner), int(centre[1] + math.sin(angle) * inner))
                end = (int(centre[0] + math.cos(angle) * (inner + length)), int(centre[1] + math.sin(angle) * (inner + length)))
                colour = self.accent if ray % 3 else self.secondary
                cv2.line(overlay, start, end, tuple(int(c * decay * 0.65) for c in colour), 2, cv2.LINE_AA)
        frame = cv2.add(frame, overlay)
        if impact.style in {"lightning", "whip"} and local <= 0.075:
            alpha = (0.26 if impact.style == "lightning" else 0.14) * decay
            solid = np.full_like(frame, self.accent if impact.style == "lightning" else (245, 248, 255))
            frame = cv2.addWeighted(frame, 1.0 - alpha, solid, alpha, 0)
        return frame

    def paste_sprite(self, frame: np.ndarray, event: TextEvent, t: float, shake_x: float, shake_y: float) -> np.ndarray:
        if not event.start <= t <= event.end:
            return frame
        local = t - event.start
        remaining = event.end - t
        enter = ease_out_back(local / 0.18)
        scale = 0.70 + 0.30 * enter + 0.010 * math.sin(local * 4.0)
        alpha = clamp(local / 0.07)
        x_shift = 0.0
        if remaining < 0.17:
            progress = clamp(1.0 - remaining / 0.17)
            scale += 0.16 * progress
            alpha *= 1.0 - progress
            x_shift = 170.0 * progress * (1 if event.angle > 0 else -1)
        sprite = event.sprite
        new_size = (max(2, int(sprite.shape[1] * scale)), max(2, int(sprite.shape[0] * scale)))
        scaled = cv2.resize(sprite, new_size, interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR)
        centre_x = WIDTH // 2 + int(x_shift + shake_x * 0.28)
        centre_y = int(HEIGHT * event.y + shake_y * 0.20)
        angle = math.radians(event.angle + 0.4 * math.sin(local * 2.0))
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        h, w = scaled.shape[:2]
        matrix = np.array([
            [cos_a, -sin_a, w / 2 - cos_a * w / 2 + sin_a * h / 2],
            [sin_a, cos_a, h / 2 - sin_a * w / 2 - cos_a * h / 2],
        ], dtype=np.float32)
        rotated = cv2.warpAffine(scaled, matrix, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        x0 = centre_x - w // 2
        y0 = centre_y - h // 2
        left, top = max(0, x0), max(0, y0)
        right, bottom = min(WIDTH, x0 + w), min(HEIGHT, y0 + h)
        if left >= right or top >= bottom:
            return frame
        sprite_roi = rotated[top - y0:bottom - y0, left - x0:right - x0]
        target = frame[top:bottom, left:right].astype(np.float32)
        opacity = (sprite_roi[:, :, 3:4].astype(np.float32) / 255.0) * alpha
        blended = sprite_roi[:, :, :3].astype(np.float32) * opacity + target * (1.0 - opacity)
        frame[top:bottom, left:right] = np.clip(blended, 0, 255).astype(np.uint8)
        return frame

    def render(self, base_path: Path, audio_path: Path, output_path: Path) -> dict:
        capture = cv2.VideoCapture(str(base_path))
        if not capture.isOpened():
            raise RuntimeError(f"Could not open base cut: {base_path}")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        command = [
            "ffmpeg", "-hide_banner", "-y",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
            "-i", str(audio_path),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-profile:v", "high", "-level", "4.2",
            "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-af", f"loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.05,afade=t=out:st={self.duration - 0.20:.6f}:d=0.20",
            "-t", f"{self.duration:.6f}", "-movflags", "+faststart", "-map_metadata", "-1", str(output_path),
        ]
        with self.log_path.open("a") as log:
            log.write("\n+ " + " ".join(command[:18]) + " ...\n")
            log.flush()
            process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=log, stderr=log)
            try:
                for index in range(self.frames):
                    ok, source = capture.read()
                    if not ok:
                        raise RuntimeError(f"Base cut ended at frame {index}/{self.frames}: {base_path}")
                    t = index / FPS
                    shot = min(len(self.boundaries) - 2, bisect.bisect_right(self.boundaries, t) - 1)
                    local = t - self.boundaries[shot]
                    frame, shake_x, shake_y = self.camera(source, shot, local, t)
                    frame = self.add_bloom(frame)
                    impact = self.impacts.get(shot)
                    if impact and impact.style != "kick" and local <= 0.20:
                        if impact.style in {"whip", "glitch"}:
                            frame = self.directional_blur(frame, horizontal=impact.direction > 0)
                        if impact.style == "glitch" and local <= 0.09:
                            frame = self.glitch(frame, impact, local)
                        elif impact.style in {"whip", "lightning"} and local <= 0.10:
                            frame = self.rgb_split(frame, 15, 3)
                        frame = self.draw_impact(frame, impact, local)
                    elif impact and impact.style == "shock" and local <= 0.34:
                        frame = self.draw_impact(frame, impact, local)
                    frame = self.draw_ambient_particles(frame, t)
                    for event in self.text_events:
                        frame = self.paste_sprite(frame, event, t, shake_x, shake_y)
                    if t < 0.09:
                        frame = cv2.addWeighted(frame, t / 0.09, np.zeros_like(frame), 1.0 - t / 0.09, 0)
                    if t > self.duration - 0.20:
                        alpha = clamp((self.duration - t) / 0.20)
                        frame = cv2.addWeighted(frame, alpha, np.zeros_like(frame), 1.0 - alpha, 0)
                    process.stdin.write(frame.tobytes())
                capture.release()
                process.stdin.close()
                result = process.wait()
            except Exception:
                capture.release()
                if process.stdin and not process.stdin.closed:
                    process.stdin.close()
                process.kill()
                process.wait()
                raise
        if result != 0:
            raise RuntimeError(f"Final encoder failed for {output_path}; see {self.log_path}")
        return {"frames": self.frames, **self.effect_counts}
