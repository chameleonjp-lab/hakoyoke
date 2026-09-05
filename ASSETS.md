# Assets

**Art direction:** Obsidian Observatory。深い青黒の虚空、冷たい玄武岩、計測用の細い測量線、捕獲用のObservatory Cyan（#28BEEB）、範囲捕獲の鉱物的エメラルド、危険な抑制されたマゼンタ亀裂。巨大物の重量感と盤面可読性を最優先にする。

## 現行ランタイム

ゲームプレイは外部画像ストレージに依存しません。タイトルの背景・パネル・測量線は`client/src/index.css`、床・キューブ・プレイヤー・発光表現は`client/src/game/scene.ts`のCSS／Babylon手続き生成で描画します。`client/index.html`のfaviconもリポジトリ内の`client/public/favicon.svg`を参照します。

| Runtime source              | Role                              | Current usage                   |
| --------------------------- | --------------------------------- | ------------------------------- |
| `client/src/index.css`      | タイトル背景、フレーム、HUDパネル | GitHub Pagesを含む全環境で同梱  |
| `client/src/game/scene.ts`  | 床、キューブ、プレイヤー、光      | Babylonランタイムで生成         |
| `client/public/favicon.svg` | ブラウザタブのシンボル            | `client/index.html`から相対参照 |

## 目視検査・アーカイブ

`assets/original/`は目視検査・履歴保管用であり、ビルドやゲームの実行経路ではありません。現行SVGは生成失敗時のプレースホルダーを含むアーカイブなので、ランタイム素材として扱わないでください。大型のvisual target PNGも画面表示へ自動配信しません。

`/manus-storage/*`はExpressの検査・互換ルートです。Forge資格情報がある環境では署名URLへ`307`、ない環境では機密情報を含まない`503`を返しますが、ゲームのタイトル表示や3D描画をこのルートへ接続しないことを現行仕様とします。
