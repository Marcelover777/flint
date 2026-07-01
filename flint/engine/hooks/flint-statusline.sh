#!/bin/bash
# flint — statusline badge (project-local). Reads the engine state dir relative
# to this script — no dependency on ~/.claude or CLAUDE_CONFIG_DIR.
#
# Usage in <project>/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "bash /abs/path/.claude/flint/hooks/flint-statusline.sh" }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="${FLINT_STATE_DIR:-$SCRIPT_DIR/../state}"
FLAG="$STATE_DIR/.flint-active"

# Refuse symlinks — a local attacker could point the flag at ~/.ssh/id_rsa and
# have the statusline render its bytes (including ANSI escape sequences) to
# the terminal every keystroke.
[ -L "$FLAG" ] && exit 0
[ ! -f "$FLAG" ] && exit 0

# Hard-cap the read at 64 bytes and strip anything outside [a-z0-9-] — blocks
# terminal-escape injection and OSC hyperlink spoofing via the flag contents.
MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
MODE=$(printf '%s' "$MODE" | tr -cd 'a-z0-9-')

# Whitelist. Anything else → render nothing rather than echo attacker bytes.
case "$MODE" in
  off|lite|full|ultra|commit|review|compress) ;;
  *) exit 0 ;;
esac

if [ -z "$MODE" ] || [ "$MODE" = "full" ]; then
  printf '\033[38;5;214m[FLINT]\033[0m'
else
  SUFFIX=$(printf '%s' "$MODE" | tr '[:lower:]' '[:upper:]')
  printf '\033[38;5;214m[FLINT:%s]\033[0m' "$SUFFIX"
fi

# Savings suffix: on by default. Opt out via FLINT_STATUSLINE_SAVINGS=0.
# Reads a pre-rendered string written by flint-stats.js. Refuses symlinks and
# strips control bytes. Absent until /flint-stats has run once — no fake
# numbers on fresh installs.
if [ "${FLINT_STATUSLINE_SAVINGS:-1}" != "0" ]; then
  SAVINGS_FILE="$STATE_DIR/.flint-statusline-suffix"
  if [ -f "$SAVINGS_FILE" ] && [ ! -L "$SAVINGS_FILE" ]; then
    SAVINGS=$(head -c 64 "$SAVINGS_FILE" 2>/dev/null | tr -d '\000-\037')
    [ -n "$SAVINGS" ] && printf ' \033[38;5;214m%s\033[0m' "$SAVINGS"
  fi
fi
