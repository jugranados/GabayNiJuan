#!/usr/bin/env bash
# Runs a command and, if it fails, repeats the end of its output as a GitHub error
# annotation, so the cause is visible on the run summary without opening the logs.
#   scripts/ci-run.sh "<label>" <command> [args...]
set -uo pipefail
label="$1"
shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  tail_text="$(tail -c 3000 "$log" | sed -e 's/%/%25/g' | sed -e ':a' -e 'N' -e '$!ba' -e 's/\n/%0A/g')"
  echo "::error title=${label} failed::${tail_text}"
fi
exit "$status"
