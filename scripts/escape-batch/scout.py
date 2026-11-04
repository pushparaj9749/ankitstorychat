#!/usr/bin/env python3
"""Run the established visual/audio scout against the second Escape batch."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/clips"))
import escape_halloween_scout as scout

scout.SOURCES = ROOT / "scripts/escape-batch/sources.json"
scout.WORK = ROOT / "work/escape-batch"
scout.RAW = scout.WORK / "source"
scout.OUT = scout.WORK / "scout"
scout.FRAMES = scout.WORK / "frames"

if __name__ == "__main__":
    raise SystemExit(scout.main())
