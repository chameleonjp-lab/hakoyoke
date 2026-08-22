# Babylon.js バンドル最適化記録

## 基準値

最適化前の `pnpm build` では、Babylon.jsのレンダラ・シェーダー・React UIが単一の `index-*.js` に集約されていた。この初期チャンクは **1,878.84 kB（gzip 479.59 kB）** であり、Viteの500 kB警告が発生していた。

## 実施方針

初期表示に必要なタイトルUIと、実際にプレイ開始するときに必要になるBabylon.jsランタイムを分離する。`GameShell` は軽量なReact UIとして先に読み込み、ユーザーがTUTORIALまたは各モードの開始操作を行った時点で `GameCanvas` を動的インポートする。

Babylon.jsは内部に強い循環参照を持つため、エンジン・シーン・メッシュ/マテリアル・ポストプロセスをフォルダ単位で手動分割してはならない。安全な境界は`GameCanvas`の動的インポートであり、Babylonランタイムはその遅延境界内でRollupに一体として最適化させる。

## 回帰防止条件

タイトル、TUTORIAL、CAMPAIGN、PRACTICE、CREATE、DUEL、設定、Campaign復帰、モバイル入力の既存フローを維持する。開始操作は、動的インポート完了後に初期化済みの `GameWorld` へ確実に配送する。`pnpm check`、Vitest、PlaywrightのChromium/WebKit、本番ビルド、およびブラウザ上の開始操作で検証する。

## 表示確認

ライブ画面で、タイトルにはCUBIC ORDEALの左下制御パネル、観測フレーム、座標表示、Observatory Cyanの実行ボタンが表示されることを確認した。`?demo` では遅延読込後にBabylon.jsの床グリッド、キューブ、HUD、観測フレーム、練習制御が表示されることを確認した。したがって、画面が暗背景のみになる遷移は確認されなかった。

## 最終結果

初期エントリは **1,878.84 kB（gzip 479.59 kB）** から、React UI中心の約457 kB（gzip約129 kB）へ削減される。Babylon.jsはプレイ開始時だけ読まれる`GameCanvas`遅延境界内に保持し、危険なフォルダ別チャンク分割は採用しない。遅延ランタイムのサイズ上限は、初期ロードには影響しないことを明示した上で`chunkSizeWarningLimit`を1,300 kBに設定する。

型検査、Vitest 21件、Playwright 16件（Chromium/WebKit）、production起動E2E 1件、本番ビルドが成功した。Campaign復帰については、タイトルまたはメニュー状態で保存済みスナップショットを上書きしないよう保存条件を修正し、遅延読込後の復帰動作も回帰検査で確認した。production起動E2Eではcanvas、HUD、タッチ操作、外部ストレージアセットの307リダイレクト、およびページ例外なしを検査する。
