# CUBIC ORDEAL — Architecture

> **Layering principle:** React = picture frame. Babylon = 3D canvas. `client/src/game` = deterministic game.

## Runtime boundaries

| Layer | Responsibilities | Does not own |
|---|---|---|
| `components/GameCanvas.tsx` | Babylon Engineの1回初期化、リサイズ、破棄 | ゲームルール、UI状態 |
| `game/GameWorld.ts` | 固定ステップ、状態機械、問題進行、スナップショット | React描画 |
| `game/systems/*` | キューブ、プレイヤー、MARK、AREA、足場、得点、音、入力、保存 | JSX、DOMレイアウト |
| `game/render/*` | Mesh、Material、Particle、Camera、HUDイベント | 勝敗・スコアの判定 |
| `components/GameShell.tsx` | React HUD、メニュー、タッチ操作、アクセシビリティ | 3D Sceneの所有 |
| `data/*` | 問題JSON、生成・検証、難易度定義 | Babylon Mesh |

## State machine

`BOOT → TITLE → MENU → (TUTORIAL | STAGE_INTRO | EDITOR)`

`STAGE_INTRO → COUNTDOWN → PLAYING ↔ CAPTURE_PAUSE`

`PLAYING → (PUZZLE_RESULT | CRUSHED | PAUSED | GAME_OVER)`

`PUZZLE_RESULT → (PLAYING | WAVE_RESULT) → (PLAYING | STAGE_RESULT) → (STAGE_INTRO | FINAL_RESULT)`

`PAUSED → PLAYING`。`CRUSHED → PLAYING`はAGAIN用、または`GAME_OVER`へ進む。

## Core logical model

`GridPosition = { x: integer, z: integer }` とし、`z`は奥から手前に増加する。`CubeType = normal | veil | void`。キューブ、MARK、AREA、足場行、得点、回転数は整数で保存する。`RenderCube`だけが回転角・補間位置・沈下量を持つ。

## Main objects

| Module | Ownership | Key responsibility |
|---|---|---|
| `GameWorld` | state and systems | fixed update、state遷移、イベント発火 |
| `CubeSystem` | logical cubes + cube meshes | 回転開始、前進、捕獲、落下、描画補間 |
| `PlayerSystem` | player state + mesh | 自由移動、タイル選択、向き、踏み潰し |
| `MarkerSystem` | one MARK + AREA marks | 設置、手動捕獲、保護、3×3範囲 |
| `PlatformSystem` | active rows + instances | 足場生成、列増減、崩壊、境界 |
| `ScoreSystem` | run statistics | 回転数、パーフェクト、MIND INDEX |
| `PuzzleSystem` | problem descriptor | 88問読み込み、解法検証、進行 |
| `RewindSystem` | ring buffer snapshots | 10秒履歴、quick save/load |
| `InputManager` | action state | keyboard/gamepad/touchからの統一入力 |
| `AudioManager` | Web Audio graph | 初回入力解除、SFX、環境リズム |
| `SceneController` | Babylon nodes | 光、カメラ、粒子、debug overlay |

## Data flow

Input action → `GameWorld.fixedUpdate()` → logical state → typed game event → renderer / React store → Babylon meshes / HUD。

すべてのイベントは`GameEvent`の判別可能ユニオンとして表現する。React側は`CustomEvent`で軽量なスナップショットを購読し、ゲームロジックを変更しない。

