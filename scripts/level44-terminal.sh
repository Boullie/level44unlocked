#!/bin/sh
# LEVEL 44 — herkenbare Terminal-titels voor bestaande lokale processen.
# Gebruik: sh scripts/level44-terminal.sh "Spotify Bridge" python3 /pad/naar/bridge.py
# Of:     sh scripts/level44-terminal.sh "Party TV" bash /pad/naar/start.sh
set -eu
if [ "$#" -lt 2 ]; then
  printf 'Gebruik: sh %s "Naam proces" commando [argumenten...]\n' "$0" >&2
  exit 2
fi
name=$1
shift
# Verwijder terminal-controltekens uit een vrij ingevoerde titel.
name=$(printf '%s' "$name" | tr -cd '[:alnum:] ._/-')
printf '\033]0;LEVEL 44 — %s\007' "$name"
printf 'LEVEL 44 — %s\n' "$name"
exec "$@"
