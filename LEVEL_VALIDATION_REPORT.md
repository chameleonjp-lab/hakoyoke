# LEVEL VALIDATION REPORT

> このファイルは `client/src/game/puzzles.ts` と `client/src/game/stagePlan.ts` から自動生成されます。手編集せず、`pnpm puzzles:write` で更新してください。

## 検証結果

- 問題数: 88
- AREAを使用する問題: 67
- AREAを2回以上使用する連鎖問題: 64
- 検査内容: 問題数、ID・seedの一意性、Stage Plan、全マス形成、配置範囲、保存件数、MARK到達性、AREAの一回使用と再生成、必要キューブ全回収、VOID非捕獲、規定回転数
- 結果: **PASS**

| ID | Stage | Wave | Size | Required rolls | Tag | Seed | Required | VOID | AREA uses | Validation |
| --- | --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| STAGE-1-W1-P01 | Stage 1 | 1 | 4×2 | 1 | intro-read | 101017 | 4 | 4 | 0 | PASS |
| STAGE-1-W1-P02 | Stage 1 | 1 | 4×2 | 1 | intro-shift | 101034 | 4 | 4 | 0 | PASS |
| STAGE-1-W1-P03 | Stage 1 | 1 | 4×2 | 1 | intro-avoid | 101051 | 4 | 4 | 0 | PASS |
| STAGE-1-W2-P01 | Stage 1 | 2 | 4×2 | 1 | area-intro-range | 102017 | 8 | 0 | 1 | PASS |
| STAGE-1-W2-P02 | Stage 1 | 2 | 4×2 | 1 | area-intro-timing | 102034 | 8 | 0 | 1 | PASS |
| STAGE-1-W2-P03 | Stage 1 | 2 | 4×2 | 1 | area-intro-edge | 102051 | 8 | 0 | 1 | PASS |
| STAGE-1-W3-P01 | Stage 1 | 3 | 4×3 | 2 | read-branch | 103017 | 8 | 4 | 0 | PASS |
| STAGE-1-W3-P02 | Stage 1 | 3 | 4×3 | 2 | read-cross | 103034 | 7 | 5 | 0 | PASS |
| STAGE-1-W3-P03 | Stage 1 | 3 | 4×3 | 2 | read-corner | 103051 | 6 | 6 | 0 | PASS |
| STAGE-1-W4-P01 | Stage 1 | 4 | 4×4 | 3 | read-braid | 104017 | 9 | 7 | 0 | PASS |
| STAGE-1-W4-P02 | Stage 1 | 4 | 4×4 | 3 | read-return | 104034 | 9 | 7 | 0 | PASS |
| STAGE-1-W4-P03 | Stage 1 | 4 | 4×4 | 3 | read-ring | 104051 | 8 | 8 | 0 | PASS |
| STAGE-2-W1-P01 | Stage 2 | 1 | 4×5 | 4 | route-stagger | 201017 | 10 | 10 | 0 | PASS |
| STAGE-2-W1-P02 | Stage 2 | 1 | 4×5 | 4 | route-split | 201034 | 10 | 10 | 0 | PASS |
| STAGE-2-W1-P03 | Stage 2 | 1 | 4×5 | 4 | route-thread | 201051 | 8 | 12 | 0 | PASS |
| STAGE-2-W2-P01 | Stage 2 | 2 | 4×5 | 4 | route-weave | 202017 | 10 | 10 | 0 | PASS |
| STAGE-2-W2-P02 | Stage 2 | 2 | 4×5 | 4 | route-gate | 202034 | 10 | 10 | 0 | PASS |
| STAGE-2-W2-P03 | Stage 2 | 2 | 4×5 | 4 | route-return | 202051 | 9 | 11 | 0 | PASS |
| STAGE-2-W3-P01 | Stage 2 | 3 | 4×6 | 5 | area-ribbon | 203017 | 21 | 3 | 3 | PASS |
| STAGE-2-W3-P02 | Stage 2 | 3 | 4×6 | 4 | area-edge | 203034 | 21 | 3 | 3 | PASS |
| STAGE-2-W3-P03 | Stage 2 | 3 | 4×6 | 5 | area-reverse | 203051 | 21 | 3 | 3 | PASS |
| STAGE-2-W4-P01 | Stage 2 | 4 | 4×6 | 4 | chain-pulse | 204017 | 21 | 3 | 3 | PASS |
| STAGE-2-W4-P02 | Stage 2 | 4 | 4×6 | 4 | chain-switch | 204034 | 21 | 3 | 3 | PASS |
| STAGE-2-W4-P03 | Stage 2 | 4 | 4×6 | 5 | chain-ladder | 204051 | 21 | 3 | 3 | PASS |
| STAGE-3-W1-P01 | Stage 3 | 1 | 5×4 | 3 | wide-center | 301017 | 13 | 7 | 0 | PASS |
| STAGE-3-W1-P02 | Stage 3 | 1 | 5×4 | 3 | wide-split | 301034 | 12 | 8 | 0 | PASS |
| STAGE-3-W1-P03 | Stage 3 | 1 | 5×4 | 3 | wide-cross | 301051 | 13 | 7 | 0 | PASS |
| STAGE-3-W2-P01 | Stage 3 | 2 | 5×5 | 4 | long-braid | 302017 | 16 | 9 | 0 | PASS |
| STAGE-3-W2-P02 | Stage 3 | 2 | 5×5 | 4 | long-gate | 302034 | 16 | 9 | 0 | PASS |
| STAGE-3-W2-P03 | Stage 3 | 2 | 5×5 | 4 | long-return | 302051 | 15 | 10 | 0 | PASS |
| STAGE-3-W3-P01 | Stage 3 | 3 | 5×6 | 5 | wide-area-ribbon | 303017 | 22 | 8 | 3 | PASS |
| STAGE-3-W3-P02 | Stage 3 | 3 | 5×6 | 4 | wide-area-edge | 303034 | 21 | 9 | 3 | PASS |
| STAGE-3-W3-P03 | Stage 3 | 3 | 5×6 | 5 | wide-area-switch | 303051 | 22 | 8 | 3 | PASS |
| STAGE-3-W4-P01 | Stage 3 | 4 | 5×6 | 4 | wide-area-pulse | 304017 | 21 | 9 | 3 | PASS |
| STAGE-3-W4-P02 | Stage 3 | 4 | 5×6 | 4 | wide-area-return | 304034 | 21 | 9 | 3 | PASS |
| STAGE-3-W4-P03 | Stage 3 | 4 | 5×6 | 4 | wide-area-ladder | 304051 | 21 | 9 | 3 | PASS |
| STAGE-4-W1-P01 | Stage 4 | 1 | 5×7 | 6 | long-chain-ribbon | 401017 | 26 | 9 | 4 | PASS |
| STAGE-4-W1-P02 | Stage 4 | 1 | 5×7 | 6 | long-chain-mirror | 401034 | 26 | 9 | 4 | PASS |
| STAGE-4-W2-P01 | Stage 4 | 2 | 5×7 | 6 | long-chain-pulse | 402017 | 26 | 9 | 4 | PASS |
| STAGE-4-W2-P02 | Stage 4 | 2 | 5×7 | 6 | long-chain-return | 402034 | 25 | 10 | 4 | PASS |
| STAGE-4-W3-P01 | Stage 4 | 3 | 5×8 | 7 | long-chain-ladder | 403017 | 29 | 11 | 4 | PASS |
| STAGE-4-W3-P02 | Stage 4 | 3 | 5×8 | 7 | long-chain-switchback | 403034 | 29 | 11 | 4 | PASS |
| STAGE-4-W4-P01 | Stage 4 | 4 | 5×8 | 7 | long-chain-delay | 404017 | 29 | 11 | 4 | PASS |
| STAGE-4-W4-P02 | Stage 4 | 4 | 5×8 | 7 | long-chain-braid | 404034 | 29 | 11 | 4 | PASS |
| STAGE-5-W1-P01 | Stage 5 | 1 | 6×6 | 5 | chain | 501017 | 20 | 16 | 3 | PASS |
| STAGE-5-W1-P02 | Stage 5 | 1 | 6×6 | 3 | chain | 501034 | 19 | 17 | 3 | PASS |
| STAGE-5-W1-P03 | Stage 5 | 1 | 6×6 | 3 | chain | 501051 | 19 | 17 | 3 | PASS |
| STAGE-5-W2-P01 | Stage 5 | 2 | 6×6 | 5 | chain | 502017 | 19 | 17 | 3 | PASS |
| STAGE-5-W2-P02 | Stage 5 | 2 | 6×6 | 5 | chain | 502034 | 20 | 16 | 3 | PASS |
| STAGE-5-W2-P03 | Stage 5 | 2 | 6×6 | 5 | chain | 502051 | 20 | 16 | 3 | PASS |
| STAGE-5-W3-P01 | Stage 5 | 3 | 6×7 | 6 | chain | 503017 | 23 | 19 | 4 | PASS |
| STAGE-5-W3-P02 | Stage 5 | 3 | 6×7 | 4 | chain | 503034 | 22 | 20 | 4 | PASS |
| STAGE-5-W3-P03 | Stage 5 | 3 | 6×7 | 4 | chain | 503051 | 22 | 20 | 4 | PASS |
| STAGE-5-W4-P01 | Stage 5 | 4 | 6×7 | 6 | chain | 504017 | 22 | 20 | 4 | PASS |
| STAGE-5-W4-P02 | Stage 5 | 4 | 6×7 | 6 | chain | 504034 | 23 | 19 | 4 | PASS |
| STAGE-5-W4-P03 | Stage 5 | 4 | 6×7 | 6 | chain | 504051 | 23 | 19 | 4 | PASS |
| STAGE-6-W1-P01 | Stage 6 | 1 | 6×8 | 7 | chain-protect | 601017 | 26 | 22 | 4 | PASS |
| STAGE-6-W1-P02 | Stage 6 | 1 | 6×8 | 7 | chain-protect | 601034 | 26 | 22 | 4 | PASS |
| STAGE-6-W2-P01 | Stage 6 | 2 | 6×8 | 6 | chain-protect | 602017 | 25 | 23 | 4 | PASS |
| STAGE-6-W2-P02 | Stage 6 | 2 | 6×8 | 5 | chain-protect | 602034 | 25 | 23 | 4 | PASS |
| STAGE-6-W3-P01 | Stage 6 | 3 | 6×9 | 8 | chain-protect | 603017 | 29 | 25 | 5 | PASS |
| STAGE-6-W3-P02 | Stage 6 | 3 | 6×9 | 8 | chain-protect | 603034 | 29 | 25 | 5 | PASS |
| STAGE-6-W4-P01 | Stage 6 | 4 | 6×9 | 5 | chain-protect | 604017 | 28 | 26 | 5 | PASS |
| STAGE-6-W4-P02 | Stage 6 | 4 | 6×9 | 4 | chain-protect | 604034 | 28 | 26 | 5 | PASS |
| STAGE-7-W1-P01 | Stage 7 | 1 | 7×7 | 6 | chain-protect | 701017 | 22 | 27 | 4 | PASS |
| STAGE-7-W1-P02 | Stage 7 | 1 | 7×7 | 6 | chain-protect | 701034 | 23 | 26 | 4 | PASS |
| STAGE-7-W1-P03 | Stage 7 | 1 | 7×7 | 6 | chain-protect | 701051 | 22 | 27 | 4 | PASS |
| STAGE-7-W2-P01 | Stage 7 | 2 | 7×7 | 6 | chain-protect | 702017 | 23 | 26 | 4 | PASS |
| STAGE-7-W2-P02 | Stage 7 | 2 | 7×7 | 4 | chain-protect | 702034 | 22 | 27 | 4 | PASS |
| STAGE-7-W2-P03 | Stage 7 | 2 | 7×7 | 6 | chain-protect | 702051 | 23 | 26 | 4 | PASS |
| STAGE-7-W3-P01 | Stage 7 | 3 | 7×8 | 7 | chain-protect | 703017 | 26 | 30 | 4 | PASS |
| STAGE-7-W3-P02 | Stage 7 | 3 | 7×8 | 7 | chain-protect | 703034 | 25 | 31 | 4 | PASS |
| STAGE-7-W3-P03 | Stage 7 | 3 | 7×8 | 7 | chain-protect | 703051 | 26 | 30 | 4 | PASS |
| STAGE-7-W4-P01 | Stage 7 | 4 | 7×8 | 3 | chain-protect | 704017 | 25 | 31 | 4 | PASS |
| STAGE-7-W4-P02 | Stage 7 | 4 | 7×8 | 7 | chain-protect | 704034 | 26 | 30 | 4 | PASS |
| STAGE-7-W4-P03 | Stage 7 | 4 | 7×8 | 6 | chain-protect | 704051 | 25 | 31 | 4 | PASS |
| STAGE-8-W1-P01 | Stage 8 | 1 | 7×8 | 7 | chain-protect | 801017 | 26 | 30 | 4 | PASS |
| STAGE-8-W1-P02 | Stage 8 | 1 | 7×8 | 3 | chain-protect | 801034 | 25 | 31 | 4 | PASS |
| STAGE-8-W2-P01 | Stage 8 | 2 | 7×9 | 8 | chain-protect | 802017 | 29 | 34 | 5 | PASS |
| STAGE-8-W2-P02 | Stage 8 | 2 | 7×9 | 8 | chain-protect | 802034 | 29 | 34 | 5 | PASS |
| STAGE-8-W3-P01 | Stage 8 | 3 | 7×9 | 5 | chain-protect | 803017 | 28 | 35 | 5 | PASS |
| STAGE-8-W3-P02 | Stage 8 | 3 | 7×9 | 8 | chain-protect | 803034 | 29 | 34 | 5 | PASS |
| STAGE-8-W4-P01 | Stage 8 | 4 | 7×9 | 8 | chain-protect | 804017 | 29 | 34 | 5 | PASS |
| STAGE-8-W4-P02 | Stage 8 | 4 | 7×9 | 7 | chain-protect | 804034 | 28 | 35 | 5 | PASS |
| FINAL-W1-P01 | Final | 1 | 7×9 | 6 | chain-protect | 901017 | 28 | 35 | 5 | PASS |
| FINAL-W2-P01 | Final | 2 | 7×9 | 4 | chain-protect | 902017 | 28 | 35 | 5 | PASS |
| FINAL-W3-P01 | Final | 3 | 7×9 | 8 | chain-protect | 903017 | 29 | 34 | 5 | PASS |
| FINAL-W4-P01 | Final | 4 | 7×9 | 8 | chain-protect | 904017 | 29 | 34 | 5 | PASS |
