# LEVEL VALIDATION REPORT

> このファイルは `client/src/game/puzzles.ts` と `client/src/game/stagePlan.ts` から自動生成されます。手編集せず、`pnpm puzzles:write` で更新してください。

## 検証結果

- 問題数: 88
- AREAを使用する問題: 88
- AREAを2回以上使用する連鎖問題: 82
- 検査内容: 問題数、ID・seedの一意性、Stage Plan、全マス形成、配置範囲、保存件数、MARK到達性、AREAの一回使用と再生成、必要キューブ全回収、VOID非捕獲、規定回転数
- 結果: **PASS**

| ID | Stage | Wave | Size | Required rolls | Tag | Seed | Required | VOID | AREA uses | Validation |
| --- | --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| STAGE-1-W1-P01 | Stage 1 | 1 | 4×2 | 1 | read | 101017 | 6 | 2 | 1 | PASS |
| STAGE-1-W1-P02 | Stage 1 | 1 | 4×2 | 1 | read | 101034 | 7 | 1 | 1 | PASS |
| STAGE-1-W1-P03 | Stage 1 | 1 | 4×2 | 1 | read | 101051 | 6 | 2 | 1 | PASS |
| STAGE-1-W2-P01 | Stage 1 | 2 | 4×2 | 0 | read | 102017 | 6 | 2 | 1 | PASS |
| STAGE-1-W2-P02 | Stage 1 | 2 | 4×2 | 1 | read | 102034 | 7 | 1 | 1 | PASS |
| STAGE-1-W2-P03 | Stage 1 | 2 | 4×2 | 1 | read | 102051 | 6 | 2 | 1 | PASS |
| STAGE-1-W3-P01 | Stage 1 | 3 | 4×3 | 2 | read | 103017 | 9 | 3 | 2 | PASS |
| STAGE-1-W3-P02 | Stage 1 | 3 | 4×3 | 1 | read | 103034 | 10 | 2 | 2 | PASS |
| STAGE-1-W3-P03 | Stage 1 | 3 | 4×3 | 2 | read | 103051 | 9 | 3 | 2 | PASS |
| STAGE-1-W4-P01 | Stage 1 | 4 | 4×4 | 1 | read | 104017 | 12 | 4 | 2 | PASS |
| STAGE-1-W4-P02 | Stage 1 | 4 | 4×4 | 2 | read | 104034 | 13 | 3 | 2 | PASS |
| STAGE-1-W4-P03 | Stage 1 | 4 | 4×4 | 2 | read | 104051 | 12 | 4 | 2 | PASS |
| STAGE-2-W1-P01 | Stage 2 | 1 | 4×5 | 3 | route | 201017 | 15 | 5 | 3 | PASS |
| STAGE-2-W1-P02 | Stage 2 | 1 | 4×5 | 2 | route | 201034 | 15 | 5 | 3 | PASS |
| STAGE-2-W1-P03 | Stage 2 | 1 | 4×5 | 2 | route | 201051 | 16 | 4 | 3 | PASS |
| STAGE-2-W2-P01 | Stage 2 | 2 | 4×5 | 2 | route | 202017 | 15 | 5 | 3 | PASS |
| STAGE-2-W2-P02 | Stage 2 | 2 | 4×5 | 3 | route | 202034 | 15 | 5 | 3 | PASS |
| STAGE-2-W2-P03 | Stage 2 | 2 | 4×5 | 2 | route | 202051 | 16 | 4 | 3 | PASS |
| STAGE-2-W3-P01 | Stage 2 | 3 | 4×6 | 3 | route | 203017 | 18 | 6 | 3 | PASS |
| STAGE-2-W3-P02 | Stage 2 | 3 | 4×6 | 2 | route | 203034 | 18 | 6 | 3 | PASS |
| STAGE-2-W3-P03 | Stage 2 | 3 | 4×6 | 4 | route | 203051 | 19 | 5 | 3 | PASS |
| STAGE-2-W4-P01 | Stage 2 | 4 | 4×6 | 2 | route | 204017 | 18 | 6 | 3 | PASS |
| STAGE-2-W4-P02 | Stage 2 | 4 | 4×6 | 3 | route | 204034 | 18 | 6 | 3 | PASS |
| STAGE-2-W4-P03 | Stage 2 | 4 | 4×6 | 2 | route | 204051 | 19 | 5 | 3 | PASS |
| STAGE-3-W1-P01 | Stage 3 | 1 | 5×4 | 1 | route | 301017 | 12 | 8 | 2 | PASS |
| STAGE-3-W1-P02 | Stage 3 | 1 | 5×4 | 1 | route | 301034 | 13 | 7 | 2 | PASS |
| STAGE-3-W1-P03 | Stage 3 | 1 | 5×4 | 1 | route | 301051 | 12 | 8 | 2 | PASS |
| STAGE-3-W2-P01 | Stage 3 | 2 | 5×5 | 3 | route | 302017 | 15 | 10 | 3 | PASS |
| STAGE-3-W2-P02 | Stage 3 | 2 | 5×5 | 4 | route | 302034 | 16 | 9 | 3 | PASS |
| STAGE-3-W2-P03 | Stage 3 | 2 | 5×5 | 3 | route | 302051 | 15 | 10 | 3 | PASS |
| STAGE-3-W3-P01 | Stage 3 | 3 | 5×6 | 4 | route | 303017 | 18 | 12 | 3 | PASS |
| STAGE-3-W3-P02 | Stage 3 | 3 | 5×6 | 2 | route | 303034 | 19 | 11 | 3 | PASS |
| STAGE-3-W3-P03 | Stage 3 | 3 | 5×6 | 4 | route | 303051 | 18 | 12 | 3 | PASS |
| STAGE-3-W4-P01 | Stage 3 | 4 | 5×6 | 2 | route | 304017 | 18 | 12 | 3 | PASS |
| STAGE-3-W4-P02 | Stage 3 | 4 | 5×6 | 4 | route | 304034 | 19 | 11 | 3 | PASS |
| STAGE-3-W4-P03 | Stage 3 | 4 | 5×6 | 2 | route | 304051 | 18 | 12 | 3 | PASS |
| STAGE-4-W1-P01 | Stage 4 | 1 | 5×7 | 5 | chain | 401017 | 21 | 14 | 4 | PASS |
| STAGE-4-W1-P02 | Stage 4 | 1 | 5×7 | 3 | chain | 401034 | 22 | 13 | 4 | PASS |
| STAGE-4-W2-P01 | Stage 4 | 2 | 5×7 | 3 | chain | 402017 | 21 | 14 | 4 | PASS |
| STAGE-4-W2-P02 | Stage 4 | 2 | 5×7 | 5 | chain | 402034 | 22 | 13 | 4 | PASS |
| STAGE-4-W3-P01 | Stage 4 | 3 | 5×8 | 5 | chain | 403017 | 24 | 16 | 4 | PASS |
| STAGE-4-W3-P02 | Stage 4 | 3 | 5×8 | 3 | chain | 403034 | 25 | 15 | 4 | PASS |
| STAGE-4-W4-P01 | Stage 4 | 4 | 5×8 | 3 | chain | 404017 | 24 | 16 | 4 | PASS |
| STAGE-4-W4-P02 | Stage 4 | 4 | 5×8 | 5 | chain | 404034 | 25 | 15 | 4 | PASS |
| STAGE-5-W1-P01 | Stage 5 | 1 | 6×6 | 2 | chain | 501017 | 18 | 18 | 3 | PASS |
| STAGE-5-W1-P02 | Stage 5 | 1 | 6×6 | 5 | chain | 501034 | 19 | 17 | 3 | PASS |
| STAGE-5-W1-P03 | Stage 5 | 1 | 6×6 | 2 | chain | 501051 | 19 | 17 | 3 | PASS |
| STAGE-5-W2-P01 | Stage 5 | 2 | 6×6 | 3 | chain | 502017 | 18 | 18 | 3 | PASS |
| STAGE-5-W2-P02 | Stage 5 | 2 | 6×6 | 3 | chain | 502034 | 19 | 17 | 3 | PASS |
| STAGE-5-W2-P03 | Stage 5 | 2 | 6×6 | 4 | chain | 502051 | 19 | 17 | 3 | PASS |
| STAGE-5-W3-P01 | Stage 5 | 3 | 6×7 | 6 | chain | 503017 | 22 | 20 | 4 | PASS |
| STAGE-5-W3-P02 | Stage 5 | 3 | 6×7 | 3 | chain | 503034 | 21 | 21 | 4 | PASS |
| STAGE-5-W3-P03 | Stage 5 | 3 | 6×7 | 6 | chain | 503051 | 23 | 19 | 4 | PASS |
| STAGE-5-W4-P01 | Stage 5 | 4 | 6×7 | 5 | chain | 504017 | 22 | 20 | 4 | PASS |
| STAGE-5-W4-P02 | Stage 5 | 4 | 6×7 | 6 | chain | 504034 | 21 | 21 | 4 | PASS |
| STAGE-5-W4-P03 | Stage 5 | 4 | 6×7 | 5 | chain | 504051 | 23 | 19 | 4 | PASS |
| STAGE-6-W1-P01 | Stage 6 | 1 | 6×8 | 7 | chain-protect | 601017 | 24 | 24 | 4 | PASS |
| STAGE-6-W1-P02 | Stage 6 | 1 | 6×8 | 6 | chain-protect | 601034 | 26 | 22 | 4 | PASS |
| STAGE-6-W2-P01 | Stage 6 | 2 | 6×8 | 4 | chain-protect | 602017 | 24 | 24 | 4 | PASS |
| STAGE-6-W2-P02 | Stage 6 | 2 | 6×8 | 7 | chain-protect | 602034 | 26 | 22 | 4 | PASS |
| STAGE-6-W3-P01 | Stage 6 | 3 | 6×9 | 7 | chain-protect | 603017 | 28 | 26 | 5 | PASS |
| STAGE-6-W3-P02 | Stage 6 | 3 | 6×9 | 4 | chain-protect | 603034 | 28 | 26 | 5 | PASS |
| STAGE-6-W4-P01 | Stage 6 | 4 | 6×9 | 6 | chain-protect | 604017 | 28 | 26 | 5 | PASS |
| STAGE-6-W4-P02 | Stage 6 | 4 | 6×9 | 7 | chain-protect | 604034 | 28 | 26 | 5 | PASS |
| STAGE-7-W1-P01 | Stage 7 | 1 | 7×7 | 4 | chain-protect | 701017 | 22 | 27 | 4 | PASS |
| STAGE-7-W1-P02 | Stage 7 | 1 | 7×7 | 5 | chain-protect | 701034 | 22 | 27 | 4 | PASS |
| STAGE-7-W1-P03 | Stage 7 | 1 | 7×7 | 3 | chain-protect | 701051 | 22 | 27 | 4 | PASS |
| STAGE-7-W2-P01 | Stage 7 | 2 | 7×7 | 5 | chain-protect | 702017 | 22 | 27 | 4 | PASS |
| STAGE-7-W2-P02 | Stage 7 | 2 | 7×7 | 4 | chain-protect | 702034 | 23 | 26 | 4 | PASS |
| STAGE-7-W2-P03 | Stage 7 | 2 | 7×7 | 5 | chain-protect | 702051 | 23 | 26 | 4 | PASS |
| STAGE-7-W3-P01 | Stage 7 | 3 | 7×8 | 3 | chain-protect | 703017 | 24 | 32 | 4 | PASS |
| STAGE-7-W3-P02 | Stage 7 | 3 | 7×8 | 5 | chain-protect | 703034 | 25 | 31 | 4 | PASS |
| STAGE-7-W3-P03 | Stage 7 | 3 | 7×8 | 3 | chain-protect | 703051 | 26 | 30 | 4 | PASS |
| STAGE-7-W4-P01 | Stage 7 | 4 | 7×8 | 7 | chain-protect | 704017 | 25 | 31 | 4 | PASS |
| STAGE-7-W4-P02 | Stage 7 | 4 | 7×8 | 3 | chain-protect | 704034 | 26 | 30 | 4 | PASS |
| STAGE-7-W4-P03 | Stage 7 | 4 | 7×8 | 5 | chain-protect | 704051 | 25 | 31 | 4 | PASS |
| STAGE-8-W1-P01 | Stage 8 | 1 | 7×8 | 5 | chain-protect | 801017 | 25 | 31 | 4 | PASS |
| STAGE-8-W1-P02 | Stage 8 | 1 | 7×8 | 6 | chain-protect | 801034 | 24 | 32 | 4 | PASS |
| STAGE-8-W2-P01 | Stage 8 | 2 | 7×9 | 8 | chain-protect | 802017 | 28 | 35 | 5 | PASS |
| STAGE-8-W2-P02 | Stage 8 | 2 | 7×9 | 5 | chain-protect | 802034 | 28 | 35 | 5 | PASS |
| STAGE-8-W3-P01 | Stage 8 | 3 | 7×9 | 4 | chain-protect | 803017 | 27 | 36 | 5 | PASS |
| STAGE-8-W3-P02 | Stage 8 | 3 | 7×9 | 6 | chain-protect | 803034 | 27 | 36 | 5 | PASS |
| STAGE-8-W4-P01 | Stage 8 | 4 | 7×9 | 8 | chain-protect | 804017 | 28 | 35 | 5 | PASS |
| STAGE-8-W4-P02 | Stage 8 | 4 | 7×9 | 5 | chain-protect | 804034 | 28 | 35 | 5 | PASS |
| FINAL-W1-P01 | Final | 1 | 7×9 | 6 | chain-protect | 901017 | 28 | 35 | 5 | PASS |
| FINAL-W2-P01 | Final | 2 | 7×9 | 7 | chain-protect | 902017 | 28 | 35 | 5 | PASS |
| FINAL-W3-P01 | Final | 3 | 7×9 | 4 | chain-protect | 903017 | 27 | 36 | 5 | PASS |
| FINAL-W4-P01 | Final | 4 | 7×9 | 7 | chain-protect | 904017 | 28 | 35 | 5 | PASS |
