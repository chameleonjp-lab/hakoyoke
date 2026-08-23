# 参照作品の公開規則調査

本書は既存作品の名称・素材・問題配置を再利用するためではなく、ユーザーが指定した「進路予測、床印、3種キューブ、足場、回転数」の**抽象的な機能差**を監査するための公開情報メモである。CUBIC ORDEALでは独自名称、独自美術、独自問題、独自評価を維持する。

## 公開情報から確認した機能要素

| 観点 | 確認した抽象的な仕様 | CUBIC ORDEALへの監査観点 |
| --- | --- | --- |
| 床印 | 床を一度印し、対象が到達した時に再入力して処理する。 | MARKの設置、対象到達時のCAPTURE、対象不在時の印解除を明文化する。 |
| 必須キューブ | 標準・優位キューブは処理対象で、取り逃しは足場損失へつながる。 | NORMAL／VEILの取り逃し、損失メーター、足場削除を検証する。 |
| 範囲キューブ | 優位キューブを処理すると範囲アンカーが残り、全アンカーを一括で3×3処理できる。 | AREAの同時発火、VEIL連鎖、範囲表示、MARK上VOID保護を検証する。 |
| 禁止キューブ | 禁止キューブは残して落下させ、処理すると足場を失う。 | VOID捕獲の独立した足場損失と、通常落下時の無損失を検証する。 |
| 押し潰し | 衝突後、残キューブが先へ流れ、損失を受けて同問を再試行する。 | 残キューブ全種類の損失計上、足場不足時のGAME OVER、AGAINを検証する。 |
| PERFECT | 必須対象を全回収、禁止対象は未処理・自然落下で達成し、足場追加と規定回転数別の評価がある。 | 計測開始・終了、足場追加、得点帯、結果表示を検証する。 |
| 操作 | 移動、印／処理、範囲起動、早送り、一時停止が分離される。 | PC、ゲームパッド、モバイルの入力が状態・キューブ規則へ正しく適用されることを検証する。 |

## 出典

1. PlayStation公式ページ: https://www.playstation.com/ja-jp/games/iq-intelligent-qube/
2. Hardcore Gaming 101, *Intelligent Qube*（2024-08-16）: https://www.hardcoregaming101.net/intelligent-qube/
3. PlayStation Datacenter, *Intelligent Qube*: https://www.psxdatacenter.com/games/U/I/SCUS-94181.html
4. GameFAQs, *Intelligent Qube FAQ*（2000-02-02）: https://gamefaqs.gamespot.com/ps/197636-intelligent-qube/faqs/3929

