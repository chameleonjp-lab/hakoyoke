# 現在の作業状態

過去の完了チェックリストはGit履歴に残っています。このファイルは未完了事項だけを管理し、完了済みフェーズを追記し続けません。

## ランキング連携 PR #25

- [x] 名前を勝手に切り詰めず、空名・21文字以上・制御文字を開始前に拒否する。
- [x] 正式URL、公開版、ランキング値をmanifestと単一設定へ固定する。
- [x] `start_id`、Supabase発行`play_id`、`submission_id`を保存して冪等送信する（複数pending、完了receipt、再読込復元を含む）。
- [x] 通信断・時間切れを同じ結果で再送し、恒久エラーと分ける。
- [x] GAME OVERの二重overlayを統合し、共有・順位・再戦を同じ画面へ残す。
- [x] RPCをモックしたunit/E2Eと、PR向けChromium gateを追加する。
- [ ] 最新のPR CIを全件成功させる。
- [ ] 正式URLをiPhone Safariで確認し、候補SHAと公開版を受入記録へ残す。
- [ ] Supabase登録値とmanifestの差分を解消し、実データを汚さない受入試験を行う。
- [ ] GitHub Pagesの`/hakoyoke/`配下でVite asset参照を確認し、必要なら公開方式を確定する。

## セキュリティ（最優先の後続）

- [ ] 公開Git履歴に露出したForge/JWT等を失効・ローテーションし、利用ログを確認する。
- [ ] Viteとpnpmを修正版へ更新し、依存監査をCIへ追加する。
- [ ] Manus runtimeを許可された開発・プレビューだけに限定する。
- [ ] `/manus-storage/*`を公開資産allowlistへ限定し、timeout・rate limit・redirect先検査を追加する。
- [ ] main保護、必須CI、secret scanning、Actionsのcommit SHA固定を設定する。

## ゲーム内容の次段階

- [x] Stage 1を「MARKのみ → 単発AREA → AREA連鎖 → MARK保護」の12問へ再設計する（`puzzles.ts`の手設計と回帰検査で確認済み）。
- [x] Stage 2以降を小分けに再設計し、各段階で30Hz実GameWorld再生を通す（88問×5難易度の再生ゲートで確認済み）。

## PR06 教育・結果・練習導線（ローカル実装済み）

- [x] PRACTICE選択時に、アーカイブ正本から盤面サイズ・対象／VOID数・必要回転数・設計意図を表示する。
- [x] PRACTICEでBEGINNER〜EXTREMEの全難易度を選択できるようにする。
- [x] PRACTICE HUDに現在セルと1マス7 tickの進行を表示し、SAVE／LOAD／REWINDの利用可否を明示する。
- [x] 巻き戻し後の未来側履歴を破棄し、別分岐の操作が過去へ混入しないようにする。
- [x] リザルトをCAPTURE／MISS／ROLL／AREAのカードとスコア内訳へ分解し、次の操作を案内する。
- [x] 旧形式・部分リザルトの欠落数値を安全な既定値へ正規化する。
- [x] PRACTICEカタログ、リザルト正規化、履歴破棄の単体テストを追加する。
- [ ] CI上のChromium／WebKitブラウザ検査で表示・操作を受入確認する。

## PR07 代表問題の品質ゲート（ローカル実装済み）

- [x] 学習曲線を代表する12問を固定し、タグ・盤面サイズ・AREA回数を監査する。
- [x] 代表12問をBEGINNER〜EXTREMEの30Hz解法再生で確認する。
- [x] 1マス7 tickと入力遅延予算を差し引いた操作猶予を、生成レポートへ記録する。
- [x] 軽量なゲーム起動時の構造検査へ品質再生を混ぜず、生成・CI側だけで実行する。
- [ ] CI上のChromium／WebKitブラウザ検査で、代表問題の表示・操作を受入確認する。

## このPRの対象外

- PRのマージ
- `main`への直接反映
- 公開・デプロイ

現行仕様は[CURRENT_STATE.md](./CURRENT_STATE.md)、検査範囲は[TEST_REPORT.md](./TEST_REPORT.md)を参照してください。
