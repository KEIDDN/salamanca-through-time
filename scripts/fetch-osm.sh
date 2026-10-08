#!/usr/bin/env bash
# Downloads the OpenStreetMap extracts used by scripts/build-city.mjs into scripts/.cache/.
# Data © OpenStreetMap contributors, ODbL. Be gentle with the public Overpass servers.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .cache
API="${OVERPASS_API:-https://overpass-api.de/api/interpreter}"
UA="salamanca-through-time (portfolio project)"
BBOX="40.948,-5.682,40.974,-5.650"

fetch() {
  local out="$1" query="$2"
  for attempt in 1 2 3 4; do
    curl -s -m 280 -A "$UA" --data-urlencode "data=$query" "$API" -o ".cache/$out"
    if tail -c 20 ".cache/$out" | grep -q ']'; then echo "✓ $out"; return; fi
    echo "  retrying $out ($attempt)…"; sleep 10
  done
  echo "✗ could not download $out" >&2; exit 1
}

fetch osm-buildings.json "[out:json][timeout:180];way[\"building\"]($BBOX);out tags geom qt;"
fetch osm-relations.json "[out:json][timeout:180];relation[\"building\"]($BBOX);out geom qt;"
fetch osm-misc.json "[out:json][timeout:180];(way[\"waterway\"=\"river\"](40.940,-5.700,40.980,-5.630);way[\"place\"=\"square\"]($BBOX);way[\"highway\"=\"pedestrian\"][\"area\"=\"yes\"]($BBOX);way[\"bridge\"][\"highway\"](40.950,-5.680,40.962,-5.660););out tags geom qt;"
