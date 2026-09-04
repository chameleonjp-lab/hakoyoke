# CUBIC ORDEAL — CURRENT STATE

この文書を現行実装の正本とします。過去の監査報告や性能記録は判断経緯として残しますが、現在の達成状況はこの文書と最新のGitHub Actions結果を優先してください。

## 正本と生成物

| 対象                   | 正本                              | 派生物・検査                                                        |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------- |
| ゲーム規則・状態遷移   | `client/src/game/`                | VitestとPlaywright                                                  |
| Stage/Wave/問題数      | `client/src/game/stagePlan.ts`    | 9 Stage、88問を自動集計                                             |
| 問題生成規則           | `client/src/game/puzzles.ts`      | Stage 1序盤6問は手設計、残りは決定的生成。`pnpm puzzles:write`         |
| 実行時の問題アーカイブ | `client/public/data/puzzles.json` | 上記生成器から作る。手編集禁止                                      |
| 問題検証結果           | `LEVEL_VALIDATION_REPORT.md`      | 上記生成器・再生検証から作る。手編集禁止                            |
| ランキング連携値       | `ranking-manifest.json`           | JSON Schema、HTML、`ranking.ts`との一致を`pnpm ranking:check`で検査 |
| 現行の検査結果         | GitHub Actionsの`CI`              | `TEST_REPORT.md`に検査範囲を記録                                    |

問題データの流れは次の1本だけです。

```text
stagePlan.ts + puzzles.ts
          ↓ pnpm puzzles:write
puzzles.json + LEVEL_VALIDATION_REPORT.md
          ↓ pnpm puzzles:check
      CIで完全一致を検査
          ↓
ゲーム開始時にpuzzles.jsonを読み込む
```

Stage 1のWave 1はAREAを使わず、VOIDを捕獲せずに通す読みと列移動を学ぶ3問です。Wave 2は先頭のVEILからAREAを作り、3×3範囲の外側だけを手動捕獲する3問です。この序盤6問は`puzzles.ts`内の`HAND_AUTHORED_DESIGNS`を正本とし、Wave 3以降は既存の制約付き決定的生成を使います。保護・連鎖・持ち越しAREAは後続Waveで段階的に扱います。

旧`generate-puzzles.mjs`が独自のStage Planと別解法を持つ状態は廃止しました。互換用の3スクリプトはすべて同じ生成・検証モジュールを呼び出します。

## 現行機能

- TUTORIAL、CAMPAIGN、PRACTICE、CREATE、DUELの5モード
- NORMAL、VEIL、VOID、MARK、対象捕獲時だけ消費するAREA、MARK上VOID保護
- 9 Stage、4 Wave、合計88問
- Stage 1序盤6問の手設計導入（Wave 1: AREAなし、Wave 2: AREA導入）
- 辺支点の回転、回転中の通過体積判定、盤外落下
- MARK対象不在時の待機、専用CLEAR、盤面内セルスナップ
- FASTは回転区間だけを加速し、着地待ち・捕獲停止時間は維持
- プレイ中のカメラ固定と、画面方向に統一したタッチ移動
- Campaignのversioned snapshot保存・復帰
- キーボード、ゲームパッド、縦横モバイル操作
- 初期UIとBabylon.jsランタイムの遅延境界
- 匿名RUMのローカル計測・保存・表示（外部送信なし）
- CREATEの検査、保存、JSON入出力、左右反転
- 表示名必須化、正式URL固定のゲーム・結果共有
- CAMPAIGNの開始・終了記録、冪等スコア送信、再読込後も同じIDを使う手動再送
- サーバーの`rank_no`を使うベストスコア上位10件表示

## ランキング連携

ランキング対象はCAMPAIGNの`clear`と`game_over`だけです。TUTORIAL、PRACTICE、CREATE、DUELおよび途中結果は送信しません。

1プレイにつきブラウザ生成の`start_id`を1つ保存し、`start_game_play_v1`が返す`play_id`を終了まで使います。結果確定時は通信前に`submission_id`と確定結果を保存し、`finish_game_play_v1`、`submit_score_idempotent_v1`の順に自動送信します。通信断・時間切れ・HTTP 408/425/429/5xxは同じ内容で再送でき、恒久エラーでは再送ボタンを出しません。成功応答の内容を検査した後だけpendingを削除し、submission_id別の完了receipt（集約表示は最新50件）で再読込時の二重送信を防ぎます。複数タブのreceipt更新はfresh mergeし、別保存の完了情報を上書きしません。複数の未送信結果は同じ導線で順番に再送し、送信中断の`submitting`は再読込時に再送可能へ復元します。ランキング通信の失敗は結果、共有、再戦、メニュー導線を塞ぎません。

正式URL、公開版、ゲーム識別子、名前保存キー、RPC名、8秒の時間切れは`ranking-manifest.json`と`client/src/lib/ranking.ts`で一致させます。公開SupabaseキーはブラウザRPC呼出しに限って使用し、secret/service-roleキーは含めません。

公開受入には未完了の外部確認があります。現行のSupabase `public.games`登録値とmanifest（説明、シェア文、スコア範囲）の一致、およびGitHub Pagesの`/hakoyoke/`配下でのVite asset参照を確認する必要があります。リポジトリ側ではPages設定・デプロイworkflowをこのPRから変更せず、公開・`is_active`変更は受入担当の明示承認後に行います。

## PR #1で行った削除監査（履歴）

PR全体の削除行が大きく見えた主因は、ゲーム本体の削除ではなく次の3群です。

1. 到達経路のない生成済みテンプレートUI 52ファイル、旧ページ・hookなどの関連scaffold 13ファイル、および未使用依存関係
2. 依存関係整理に伴う`pnpm-lock.yaml`の機械的縮小
3. 旧問題JSONを一時的にメタデータだけへ置換した差分

3は実行時データの所在とREADMEを不一致にしたため、この整理で撤回しました。現行生成器から作った88問の完全なJSONを復元し、CIでTypeScript正本との完全一致を強制します。

ゲーム中核は削っていません。`main`との比較では`GameWorld.ts`は追加666行・削除153行で、回転・衝突・保存復帰・モード処理・検査は追加側です。今後も削除は「実行経路なし」「参照なし」「代替経路あり」を静的検索とテストで確認できるものに限定します。

ローカル実行環境の設定とscaffold原本はアプリの実行経路ではありません。資格情報を持ち得る`.project-config.json`と、削除済み旧テンプレートを内包する`template.json`は追跡対象から外し、`.gitignore`と`pnpm repo:check`で再混入を防止します。Git履歴に入った資格情報はファイル削除だけでは無効化されないため、別途ローテーションが必要です。

## 検証の基準

PRを更新するたび、次を同じCIで通します。

1. `pnpm install --frozen-lockfile`
2. `pnpm repo:check`
3. `pnpm puzzles:check`
4. `pnpm ranking:check`
5. `pnpm format:check`
6. `pnpm check`
7. `pnpm test`
8. `pnpm build`
9. Pull RequestではChromiumの`pnpm test:e2e`
10. `main`更新時はChromiumとWebKitの`pnpm test:e2e`
11. `main`更新時は実ビルドをExpressで起動する`pnpm test:e2e:production`

ローカル検証だけでは完了扱いにせず、PR更新後は常に最新CIを正とします。現行の件数と検査対象は`TEST_REPORT.md`を参照してください。

2026-08-31の候補ビルドの主要出力は、初期HTML 368.11 kB（gzip 105.84 kB）、CSS 34.69 kB（gzip 8.23 kB）、初期JS 277.05 kB（gzip 84.55 kB）、遅延`GameCanvas` 1,256.26 kB（gzip 309.59 kB）です。88問JSONは静的データとして別に配信します。

## 本番E2Eの環境差

`/manus-storage/*`はForge資格情報がある環境では署名URLへ`307`、ない環境では安全な`503`を返します。本番E2Eは資格情報の有無に応じて期待値を切り替え、どちらの場合もページ例外と機密情報漏えいがないことを確認します。

## 文書の扱い

- `README.md`、この文書、`TEST_REPORT.md`、`STRUCTURE.md`: 現行
- `LEVEL_VALIDATION_REPORT.md`: 自動生成された現行証跡
- `REQUIREMENTS_GAP_AUDIT.md`: 修正前の履歴監査
- `BUNDLE_OPTIMIZATION.md`、`RUNTIME_PERFORMANCE_PLAN.md`: 方針と過去計測の記録
- `PLAN.md`、`QUALITY_RECOVERY_REPORT.md`など: 判断経緯の記録

PRのマージ、`main`への直接反映、公開・デプロイは、明示的な承認と公開前受入確認なしには行いません。
