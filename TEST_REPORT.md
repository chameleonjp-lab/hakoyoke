# TEST REPORT

検査項目の正本です。結果はPR #1の整理実装head `e9afbaad`に対するGitHub Actions `CI` run #13（2026-08-23 JST）です。以後は最新runを優先します。

## 自動検査

| 区分 | コマンド | 検査範囲 | 直前の成功実績 |
| --- | --- | --- | --- |
| リポジトリ衛生 | `pnpm repo:check` | ローカル設定、scaffold snapshot、埋込資格情報の再混入 | PASS |
| 問題生成物 | `pnpm puzzles:check` | TS正本とJSON・レポートの完全一致、全88問の再生検証 | PASS — 88問 |
| 書式 | `pnpm format:check` | client、server、E2E、script、主要設定 | PASS |
| 型検査 | `pnpm check` | client、server、test、設定 | PASS |
| 単体・問題検査 | `pnpm test` | 4ファイル | PASS — 23件 |
| 本番ビルド | `pnpm build` | Vite静的出力、Express bundle | PASS |
| ブラウザ操作 | `pnpm test:e2e` | Chromium 13件、WebKit 13件 | PASS — 26件 |
| 本番経路 | `pnpm test:e2e:production` | 実ビルド、Express、storage proxy | PASS — 1件 |

CIは上記を毎回同じ順序で実行します。ローカルの個別成功だけではPRを成功扱いにしません。

## ビルド出力

| 出力 | raw | gzip |
| --- | ---: | ---: |
| `index.html` | 367.96 kB | 105.77 kB |
| 初期CSS | 29.36 kB | 7.46 kB |
| 初期JS | 238.31 kB | 73.26 kB |
| 遅延`GameCanvas` | 1,251.73 kB | 308.55 kB |

`client/public/data/puzzles.json`はJSへ重複同梱せず、ゲーム開始時に読む静的データです。

## 問題アーカイブ検査

`client/src/game/stagePlan.ts`と`client/src/game/puzzles.ts`から88問を生成し、次を検査します。

- Stage/Wave/問題数、幅、奥行の計画一致
- IDとseedの一意性
- 幅×奥行の全マス形成、重複・範囲外配置なし
- NORMAL、VEIL、VOIDの保存件数一致
- NORMAL/VEILの必要密度と、VEIL/VOIDの機構配置
- MARK位置までの移動可能性
- AREAの1回消費、VEIL捕獲によるアンカー再生成
- 必要キューブ全回収、VOID非捕獲
- 登録済み規定回転数とヘッドレス再生結果の一致
- JSONと検証レポートが正本から生成した内容と完全一致

問題ごとの値は[LEVEL_VALIDATION_REPORT.md](./LEVEL_VALIDATION_REPORT.md)に自動出力します。

## 単体検査の対象

- キューブの整数グリッド移動と手前下辺支点の90度回転
- 回転区間の通過体積とプレイヤー衝突
- MARK一致、AREA 3×3、複数AREA、MARK上VOID保護
- AREAアンカーの1回消費とVEILによる再生成
- NORMAL/VEIL取り逃し、VOID捕獲、足場増減
- PERFECTの3得点帯、通常捕獲、AREA捕獲、MIND INDEX
- Stage Plan、PRACTICEの問題番号、DUELの同問再試行
- 88問すべての登録解法、移動可能性、全回収、VOID非捕獲

## ブラウザ検査の対象

- TUTORIAL、CAMPAIGN、PRACTICE、CREATE、DUELの開始
- HUD、PAUSE/RESUME、MENU、設定保存
- Campaignの保存、再読込、PAUSED復帰
- CREATEのセル編集、保存、IMPORT、MIRROR
- 盤外移動から`FALL INTO VOID`への遷移
- 1280×720、375×812、400×870、870×400の表示と操作
- フローティング移動キー、MARK/CAPTURE、AREA、FAST
- `pointerdown`、`pointerup`、`pointercancel`
- RUM表示、ページ例外なし

## 本番経路の環境差

production E2Eはcanvas、HUD、タッチ操作、ページ例外なしに加え、`/manus-storage/*`を検査します。

- Forge資格情報あり: 署名URLへの`307`
- Forge資格情報なし: 機密情報を含まない`503`

資格情報がないCIで`307`を固定期待しないことが、PR #1のCI失敗に対する修正点です。

## 手動確認

過去にデスクトップ・縦画面・横画面の`?demo`で、盤面、キューブ、プレイヤー、HUD、タッチ操作を確認しています。ただし手動確認は最新CIの代替ではなく、視覚変更時に追加する確認です。
