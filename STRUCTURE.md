# CUBIC ORDEAL — Architecture

> Reactは画面枠、Babylon.jsは3D描画、`client/src/game`は決定的なゲーム状態を担当します。

## 実行経路

```text
main.tsx
  └─ App.tsx
      ├─ GameShell.tsx        常時表示するメニュー・HUD・タッチ操作
      └─ RuntimeBoundary
          └─ GameCanvas.tsx   プレイ開始時だけ遅延読込
              └─ scene.ts    Babylon Sceneと描画同期
                  ├─ puzzles.jsonを読み込む
                  └─ GameWorld.tsを生成する
```

`App.tsx`は開始コマンドを一時保持し、遅延ランタイムの準備完了後に`cubic:command`として配送します。描画モジュールの読込・初期化に失敗した場合は`RuntimeBoundary`または`GameCanvas`内の再試行UIを表示します。

## 現在の責務

| ファイル | 責務 |
| --- | --- |
| `components/GameShell.tsx` | タイトル、モード選択、HUD、結果、CREATE、タッチ操作 |
| `components/GameCanvas.tsx` | Babylon Engineの生成、resize、render loop、破棄 |
| `game/scene.ts` | Scene、固定camera、light、mesh、material、描画補間、遅延演出 |
| `game/GameWorld.ts` | 30Hz固定更新、状態機械、問題進行、保存復帰、スナップショット |
| `game/InputManager.ts` | keyboard、gamepad、touchの意味論的な入力統合 |
| `game/AudioManager.ts` | Web Audioの初回入力解除、効果音、設定反映 |
| `game/rules.ts` | 捕獲、AREA、得点、MIND INDEXの純粋規則 |
| `game/rollPhysics.ts` | 辺支点回転と通過体積の純粋計算 |
| `game/solutionSimulation.ts` | 登録解法の決定的なヘッドレス再生 |
| `game/puzzleValidation.ts` | 1問・88問アーカイブの構造と解法検査 |
| `game/stagePlan.ts` | Stage/Wave/サイズ/問題数の正本 |
| `game/puzzles.ts` | 問題生成規則と実行時JSONローダー |
| `lib/rum.ts` | 匿名性能指標の収集、ローカル保存、任意送信 |
| `server/index.ts` | 静的配信、SPA fallback、storage proxy |

以前の文書にあった`game/systems/*`や`game/render/*`は現リポジトリには存在しません。将来案を現行構成として記載しないよう、この表は実ファイルだけに限定しています。

## データの正本

`stagePlan.ts`と`puzzles.ts`が編集元です。`pnpm puzzles:write`が次の2ファイルを生成します。

- `client/public/data/puzzles.json`: ゲームが開始時に読み込む88問
- `LEVEL_VALIDATION_REPORT.md`: 問題ごとの検査結果

`pnpm puzzles:check`は生成し直した内容との完全一致を確認するため、JSONだけ、レポートだけ、または旧スクリプトだけが変わる状態をCIで拒否します。

## イベント境界

| Event | 方向 | 内容 |
| --- | --- | --- |
| `cubic:command` | React → GameWorld | start、pause、resume、MARK、AREAなど |
| `cubic:snapshot` | GameWorld → React/scene | 描画とHUD用の読み取り専用状態 |
| `cubic:signal` | GameWorld → AudioManager | 効果音の種類 |
| `cubic:settings` | React → scene/audio | quality、audio設定 |
| `cubic:user-gesture` | React → AudioManager | Web Audioの有効化 |

## 状態機械

```text
BOOT → TITLE → MENU
MENU → TUTORIAL | STAGE_INTRO | EDITOR
STAGE_INTRO → COUNTDOWN → PLAYING ↔ CAPTURE_PAUSE
PLAYING → PUZZLE_RESULT | CRUSHED | PAUSED | GAME_OVER
PUZZLE_RESULT → PLAYING | WAVE_RESULT
WAVE_RESULT → PLAYING | STAGE_RESULT
STAGE_RESULT → STAGE_INTRO | FINAL_RESULT
PAUSED → PLAYING | MENU
CRUSHED → PLAYING | GAME_OVER
```

論理状態は整数グリッドを正とし、Babylon側の補間位置、回転角、沈下、粒子、camera shakeは勝敗判定へ戻しません。
