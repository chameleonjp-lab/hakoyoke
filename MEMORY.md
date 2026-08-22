# CUBIC ORDEAL — Build Memory

## Research decisions

- 参考作品の公開説明から、床印を置いて接近物を捕獲する時空間パズル、通常・有利・禁止の3区分、3×3範囲処理、足場損失、完全攻略と回転数の概念だけを抽象化した。
- 固有名詞、ロゴ、画面、楽曲、モデル、配置、攻略例、評価名は使わない。評価は**MIND INDEX**とする。
- 詳細はプロジェクト外の`/home/ubuntu/cubic-ordeal-research.md`に記録している。

## Technical decisions

- ユーザー指定の3Dゲーム要件と、制作環境のブラウザゲーム指針を両立するため、React + Viteの静的プロジェクト内でBabylon.jsを採用する。ReactはUIのみ、シミュレーションはフレームワーク非依存のTypeScriptに分離する。
- 固定ステップ30Hzと整数グリッドでゲームの決定性を確保する。
- 音楽・効果音はWeb Audio APIの合成で新規制作し、最初のユーザー入力でAudioContextを解除する。
- 公開はユーザーの指示により保留する。ローカルで遊べるゲーム、検査、完成ソースを優先する。

## Visual decisions

- Obsidian Observatory。中心は盤面、情報は画面端、軽いUIアニメーション、重いゲーム内アニメーション。
- 通常: 石灰色の粗い石、VEIL: エメラルド線、VOID: 黒曜石とマゼンタ亀裂。色だけでなく材質と記号で識別する。

