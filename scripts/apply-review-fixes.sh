#!/usr/bin/env bash
set -euo pipefail

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

cat .review-payload/review-fixes.part.* | base64 --decode > "$payload"
printf '%s  %s\n' 'f1659265f6d18b3d3fd605136e8546d905ae65e0b7cf120b884dd984d1fa62fc' "$payload" | sha256sum --check --status

tar -xzf "$payload"

test "$(git hash-object client/src/game/GameWorld.ts)" = '47952afad238840e36a6f14bccfbd880972f765f'
test "$(git hash-object client/src/components/GameShell.tsx)" = 'ba82714efd7ce7db3747f033346176126a014e7d'
python3 - <<'PY'
import json
from pathlib import Path
root = Path('client/public/data')
manifest = json.loads((root / 'puzzles.json').read_text())
assert manifest['count'] == 88
puzzles = []
for relative in manifest['files']:
    puzzles.extend(json.loads((root / relative).read_text()))
assert len(puzzles) == 88
assert len({item['id'] for item in puzzles}) == 88
assert all(len(item['layout']) == item['width'] * item['depth'] for item in puzzles)
PY
