# CUBIC ORDEAL — CURRENT STATE

この文書を、PR #1に含まれる現行実装の正本とします。過去の監査報告や性能記録は判断経緯として残しますが、現在の達成状況はこの文書とCI結果を優先してください。

## 正本と生成物

| 対象 | 正本 | 派生物・検査 |
| --- | --- | --- |
| ゲーム規則・状態遷移 | `client/src/game/` | VitestとPlaywright |
| Stage/Wave/問題数 | `client/src/game/stagePlan.ts` | 9 Stage、88問を自動集計 |
| 問題生成規則 | `client/src/game/puzzles.ts` | `pnpm puzzles:write` |
| 実行時の問題アーカイブ | `client/public/data/puzzles.json` | 上記生成器から作る。手編集禁止 |
| 問題検証結果 | `LEVEL_VALIDATION_REPORT.md` | 上記生成器・再生検証から作る。手編集禁止 |
| 現行の検査結果 | GitHub Actionsの`CI` | `TEST_REPORT.md`に検査範囲を記録 |

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

旧`generate-puzzles.mjs`が独自のStage Planと別解法を持つ状態は廃止しました。互換用の3スクリプトはすべて同じ生成・検証モジュールを呼び出します。

## 現行機能

- TUTORIAL、CAMPAIGN、PRACTICE、CREATE、DUELの5モード
- NORMAL、VEIL、VOID、MARK、1回消費型AREA、MARK上VOID保護
- 9 Stage、4 Wave、合計88問
- 辺支点の回転、回転中の通過体積判定、盤外落下
- Campaignのversioned snapshot保存・復帰
- キーボード、ゲームパッド、縦横モバイル操作
- 初期UIとBabylon.jsランタイムの遅延境界
- 匿名RUMのローカル保存と、明示設定時だけの送信
- CREATEの検査、保存、JSON入出力、左右反転

## PR #1の削除監査

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
4. `pnpm format:check`
5. `pnpm check`
6. `pnpm test`
7. `pnpm build`
8. ChromiumとWebKitの`pnpm test:e2e`
9. 実ビルドをExpressで起動する`pnpm test:e2e:production`

直前の整理前head（`faed6d6c`）では、型検査、Vitest 23件、Playwright 26件、production E2E 1件が成功しています。この整理後の確定結果はPRの最新CIを正とします。

## 本番E2Eの環境差

`/manus-storage/*`はForge資格情報がある環境では署名URLへ`307`、ない環境では安全な`503`を返します。本番E2Eは資格情報の有無に応じて期待値を切り替え、どちらの場合もページ例外と機密情報漏えいがないことを確認します。

## 文書の扱い

- `README.md`、この文書、`TEST_REPORT.md`、`STRUCTURE.md`: 現行
- `LEVEL_VALIDATION_REPORT.md`: 自動生成された現行証跡
- `REQUIREMENTS_GAP_AUDIT.md`: 修正前の履歴監査
- `BUNDLE_OPTIMIZATION.md`、`RUNTIME_PERFORMANCE_PLAN.md`: 方針と過去計測の記録
- `PLAN.md`、`QUALITY_RECOVERY_REPORT.md`など: 判断経緯の記録

公開、PRのマージ、`main`への直接反映はこの整理の対象外です。
