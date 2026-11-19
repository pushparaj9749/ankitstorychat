#!/usr/bin/env bash
# CI-only helper: turn a Gradle log into GitHub check annotations, because this
# sandbox-less project is debugged from the Actions summary, not a terminal.
set -uo pipefail

log="${1:-/tmp/gradle.log}"
if [ ! -f "$log" ]; then
  echo "::error::gradle log missing ($log)"
  exit 0
fi

# Compiler errors and the first real cause are the only lines worth reading.
grep -aE "(^e: |error:|FAILURE:|^Caused by:|^> Task .*FAILED)" "$log" \
  | head -40 \
  | sed 's/\r$//' \
  | while IFS= read -r line; do
      line="${line//'%'/'%25'}"
      line="${line//$'\n'/ }"
      echo "::error::$line"
    done

echo "::group::tail of gradle log"
tail -80 "$log"
echo "::endgroup::"
