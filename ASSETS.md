# Assets

**Art direction:** Obsidian Observatory。深い青黒の虚空、冷たい玄武岩、計測用の細い測量線、捕獲用のObservatory Cyan（#28BEEB）、範囲捕獲の鉱物的エメラルド、危険な抑制されたマゼンタ亀裂。巨大物の重量感と盤面可読性を最優先にする。

| Asset | Role | Source / URL | Usage |
|---|---|---|---|
| Visual target | 実装・目視検査の構図基準 | `/manus-storage/cubic-ordeal-visual-target_5b1317c0.png` | ASSETS台帳・画面検証 |
| Title background | タイトルとメニューの背景 | `/manus-storage/cubic-ordeal-title-background_f2798952.png` | `GameShell`タイトル背景 |
| Symbol logo | ヘッダー、タイトル、favicon用シンボル | `/manus-storage/cubic-ordeal-logo_b0288b12.png` | `GameShell`、`index.html` |
| Basalt tile | 足場素材のベーステクスチャ | `/manus-storage/cubic-ordeal-basalt-tile_1a919528.png` | Babylon StandardMaterial |
| Signal panel | HUD・制御面の背景 | `/manus-storage/cubic-ordeal-signal-panel_78bc2974.png` | React HUD |

すべての画像は本タスクで生成したオリジナル素材であり、第三者のゲーム画面、ロゴ、音楽、モデル、フォント、問題データは含まない。大型アセットをプロジェクトツリーへ保存せず、上記ストレージURLで参照する。

## GitHub完全移行用の原本アーカイブ

実行時には上記のストレージURLを継続して使用する。完全移行リポジトリには、再利用・監査・バックアップ向けに同一アセットの原本またはストレージ由来のベクター書き出しを `assets/original/` へ収録する。ラスターの視覚ターゲットはローカルの生成原本を保管し、他の4点はストレージから取得したSVG書き出しとして保管する。

| Asset | GitHubアーカイブパス | 収録形式 |
|---|---|---|
| Visual target | `assets/original/cubic-ordeal-visual-target.png` | 生成時のラスター原本 |
| Title background | `assets/original/cubic-ordeal-title-background.svg` | ストレージ由来SVG書き出し |
| Symbol logo | `assets/original/cubic-ordeal-logo.svg` | ストレージ由来SVG書き出し |
| Basalt tile | `assets/original/cubic-ordeal-basalt-tile.svg` | ストレージ由来SVG書き出し |
| Signal panel | `assets/original/cubic-ordeal-signal-panel.svg` | ストレージ由来SVG書き出し |
