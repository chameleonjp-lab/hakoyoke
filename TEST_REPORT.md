# TEST REPORT

検査項目の正本です。件数は2026-08-31のランキング連携候補を基準にし、合否は常に対象コミットの最新GitHub Actions runを優先します。

## 自動検査

| 区分           | コマンド                   | 検査範囲                                              | 直前の成功実績          |
| -------------- | -------------------------- | ----------------------------------------------------- | ----------------------- |
| リポジトリ衛生 | `pnpm repo:check`          | ローカル設定、scaffold snapshot、埋込資格情報の再混入 | PASS                    |
| 問題生成物     | `pnpm puzzles:check`       | TS正本とJSON・レポートの完全一致、全88問の再生検証    | PASS — 88問             |
| ランキング契約 | `pnpm ranking:check`       | manifestのJSON Schema、HTML、実装定数の一致           | PASS                    |
| 書式           | `pnpm format:check`        | client、server、E2E、script、主要設定                 | PASS                    |
| 型検査         | `pnpm check`               | client、server                                        | PASS                    |
| 単体・問題検査 | `pnpm test`                | 16ファイル                                            | PASS — 116件            |
| 本番ビルド     | `pnpm build`               | Vite静的出力、Express bundle                          | PASS                    |
| ブラウザ操作   | `pnpm test:e2e`            | Chromium 25件、WebKit 25件                            | 最新CIを正とする — 50件 |
| 本番経路       | `pnpm test:e2e:production` | 実ビルド、Express、storage proxy                      | PASS — 1件              |
| 公開受入       | iPhone Safari + Pages URL  | `/hakoyoke/` asset、manifest、Supabase登録値の突合    | BLOCKED — 外部受入待ち  |

PR更新時の共通検査は同じ順序で実行し、ブラウザ検査はPRではChromium、`main`更新時はChromium＋WebKit＋productionへ分岐します。ローカルの個別成功だけではPRを成功扱いにしません。

公開受入のBLOCKEDはコード検査の失敗ではなく、現行の`public.games`登録値・GitHub Pages設定・正式URL配下のasset経路を管理者が確認するまでの保留です。このPRでは本番データや公開設定を変更していません。

## ビルド出力

| 出力             |         raw |      gzip |
| ---------------- | ----------: | --------: |
| `index.html`     |   368.11 kB | 105.84 kB |
| 初期CSS          |    34.69 kB |   8.23 kB |
| 初期JS           |   277.05 kB |  84.55 kB |
| 遅延`GameCanvas` | 1,256.26 kB | 309.59 kB |

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
- Stage 1全12問（AREAなし→AREA導入→6つの手設計ルート）、Stage 2 Wave 1–2のAREAなしルート6問、序盤18問の手設計タグ
- JSONと検証レポートが正本から生成した内容と完全一致

問題ごとの値は[LEVEL_VALIDATION_REPORT.md](./LEVEL_VALIDATION_REPORT.md)に自動出力します。

## 単体検査の対象

- キューブの整数グリッド移動と手前下辺支点の90度回転
- 回転区間の通過体積とプレイヤー衝突
- MARK一致、AREA 3×3、複数AREA、MARK上VOID保護
- MARK対象不在時の待機、専用CLEAR、盤面内セルスナップ
- AREAアンカーの対象時だけの1回消費、空撃ち保持、VEILによる再生成
- FAST中も着地待ち時間を短縮しない回転進行
- NORMAL/VEIL取り逃し、VOID捕獲、足場増減
- PERFECTの3得点帯、通常捕獲、AREA捕獲、MIND INDEX
- Stage Plan、PRACTICEの問題番号、DUELの同問再試行
- TUTORIALの8ゲート順序、操作ロック、GameWorldでの全ゲート達成
- 88問すべての登録解法、移動可能性、全回収、VOID非捕獲
- 表示名の前後空白・Unicode文字数・制御文字・20文字上限
- 同じ`start_id`の開始再送、開始ボタン連打の単一化
- 開始RPC障害時の結果保存、再読込後の開始再送、同じ`submission_id`への移行
- 同じ`submission_id`による通信断・再読込後の冪等再送
- RPC応答値の一致検査と、サーバー`rank_no`による同率順位

## ブラウザ検査の対象

- TUTORIAL、CAMPAIGN、PRACTICE、CREATE、DUELの開始
- HUD、PAUSE/RESUME、MENU、設定保存
- Campaignの保存、再読込、PAUSED復帰
- CREATEのセル編集、保存、IMPORT、MIRROR
- 盤外移動から`FALL INTO VOID`への遷移
- 1280×720、375×812、400×870、870×400の表示と操作
- フローティング移動キー、MARK/CAPTURE/CLEAR、AREAの待機・VOID警告、FAST
- `pointerdown`、`pointerup`、`pointercancel`
- RUM表示、ページ例外なし
- CAMPAIGNの空名拒否、対象外モードの名前なし開始とRPC未呼出し、開始RPC受付までの待機
- CAMPAIGN開始の一時障害後のローカル継続と結果画面からの再送
- GAME OVER結果画面の自動送信、再送、同率順位、再戦導線
- FINAL RESULTから新しい開始記録を作る新規キャンペーン導線
- メニューへ戻った後も未送信結果を再送できる導線
- CREATEの1280×720、870×400、320×480で最終操作までスクロールできること

Supabase RPCはE2E内でモックし、本番のプレイ数・スコアを自動試験で増やしません。ランキングフロー5件のうち3件ではBabylonランタイムを小さなcanvas境界へ差し替え、通信・画面状態を決定的に検査します。実3Dランタイムの既存検査は従来どおり別の16件で維持します。

## 本番経路の環境差

production E2Eはcanvas、HUD、タッチ操作、ページ例外なしに加え、`/manus-storage/*`を検査します。

- Forge資格情報あり: 署名URLへの`307`
- Forge資格情報なし: 機密情報を含まない`503`

資格情報がないCIで`307`を固定期待しないことが、PR #1のCI失敗に対する修正点です。

## 手動確認

過去にデスクトップ・縦画面・横画面の`?demo`で、盤面、キューブ、プレイヤー、HUD、タッチ操作を確認しています。ただし手動確認は最新CIの代替ではなく、視覚変更時に追加する確認です。
