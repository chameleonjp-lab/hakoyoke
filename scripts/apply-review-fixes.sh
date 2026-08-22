#!/usr/bin/env bash
set -euo pipefail

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT

cat .review-payload/review-fixes.part.* | base64 --decode > "$payload"
printf '%s  %s\n' 'f1659265f6d18b3d3fd605136e8546d905ae65e0b7cf120b884dd984d1fa62fc' "$payload" | sha256sum --check --status

tar -xzf "$payload"

# Verify the reviewed payload before applying the post-review typo correction.
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

# The reviewed GameWorld payload accidentally referenced a non-existent `Hint`
# member. Correct it before committing the actual source files.
python3 - <<'PY'
from pathlib import Path
path = Path('client/src/game/GameWorld.ts')
text = path.read_text()
source = 'hint: this.Hint,'
target = 'hint: this.hint,'
if source not in text:
    raise SystemExit('expected GameWorld hint typo was not found')
path.write_text(text.replace(source, target, 1))
PY

grep -Fq 'hint: this.hint,' client/src/game/GameWorld.ts
! grep -Fq 'this.Hint' client/src/game/GameWorld.ts

mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'YAML'
name: CI

on:
  workflow_dispatch:
  pull_request:
  push:
    branches:
      - main
      - perf/runtime-streaming-rum-deps

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 35
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.4.1

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm check

      - name: Unit and puzzle validation tests
        run: pnpm test

      - name: Production build
        run: pnpm build

      - name: Install browser runtimes
        run: pnpm exec playwright install --with-deps chromium webkit

      - name: Browser interaction tests
        run: pnpm exec playwright test

      - name: Production-server browser test
        run: pnpm test:e2e:production
YAML
