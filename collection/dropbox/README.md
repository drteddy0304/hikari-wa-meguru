# Dropbox素材保存

大井さんのDropboxのアプリ専用フォルダ `アプリ/Hikari-Materials-Ooi-2026` に保存する。山形さん側の追加操作は不要。Google Apps Scriptは受付とDropbox通信だけに使用し、Google DriveやSheetsへ写真を保存しない。

## 保存内容

`届いた写真と光素材/投稿<連番>/` に以下を保存する。フォルダは非公開。

- 01_送ってもらった月の写真.jpg：最大4096pxに再エンコードした写真。EXIF/GPSを除去。
- 02_抽出した月の光.png：参加者が調整した範囲の透明PNG。最大2048px。
- 03_確認用の小さな写真.jpg：確認用縮小画像。
- 制作・管理データ/光の色と質感.json：調整座標、色、明るさ、100粒子、seedと画像寸法。
- 制作・管理データ/送信時の記録.json：受付時点の記録（利用者のチェック欄は設けていない）。
- 制作・管理データ/保存完了.json：全素材を内容ハッシュで確認した完了記録。

Dropboxで投稿フォルダを開き、フォルダ設定の「ダウンロード」でZIP取得。そのZIPをデザイナーへ渡せる。自動審査はしない。

## 接続・運用

認証情報はApps ScriptのScript Propertiesだけに保存。公開ソースやブラウザにトークンを置かない。App folder / account_info.read / files.metadata.read / files.content.writeのみ。普段のDropboxの他フォルダにはアクセスしない。

`DBX_APP_KEY`, `EXPECTED_DROPBOX_EMAIL`, `DBX_ACCESS_MODE=app_folder`, `DBX_REDIRECT_URI` を運営側で設定。`prepareDropboxConnection` は所有者限定でPKCEリンクを発行する。既存接続は自動置換しない。`startCollection` は保存先を再照合し受付を開始する。停止は `ENABLED=false`。運営名・連絡先はユーザー指定で非表示。ユーザー指定でチェック欄・保存利用の注意書きも表示しない。

新しいコードの公開には `node collection/dropbox/build.mjs <出力先>` で生成したCode.gs、Bridge.html、appsscript.jsonを使い、既存デプロイを新バージョンに更新する。GitHub側はcollection-config.mjsで接続する。

## 検証

2026-10-29：Dropbox OAuth接続、実保存、認証更新、素材ZIPダウンロードと元データとのバイト一致を確認。公開GitHub Pagesの運営者用 `collection/storage-check.html` から調整位置・半径を変えた人工画像を送り、実保存と同一投稿再送を確認。試験用素材は `動作確認用（制作には使いません）/` に隔離し、参加者の同意記録と混同しない。

実ブラウザで見つかったApps Scriptテンプレートのnonce二重エスケープ、RPC時のオブジェクトキー順による重複誤判定を修正。Dropbox backendの20テストで受付停止・未同意・匿名管理操作拒否・部分保存の再試行・容量上限などを検証。

iPhone Safari／LINE内ブラウザ・Android実機は未検証。デスクトップでの確認と区別する。

## 容量

1投稿8MiB、累計予約1GiB、1日100件、Dropbox空き512MiBを確保。無料枠・容量上限で停止し、自動で有料契約にはしない。失敗時も予約を戻さないので上限に早く達する場合がある。大量の不正投稿を完全に防ぐ仕組みではない。

通常の公開画面でもチェック欄なしでMP4生成から保存完了まで確認済み。人工画像テストの受付番号 7ce0d069-1488-49eb-9558-522cfabc68ec は実参加素材として採用しない。

2026-10-30：既存デプロイをバージョン9へ更新。既存5件を日本語名へ移行し、各移動前後のcontent_hashで内容を確認。公開検証ページから新規保存（1567b42e-6420-4b88-9899-700c54a893ee）と再送の重複防止を確認。日本語HTTPヘッダー、移行後の再送、競合時の上書き拒否を含む20テストが成功。既存素材の再整理は所有者が organizeDropboxMaterials を実行する。

2026-10-30：フォルダ名を投稿1、投稿2の連番に変更。内部の受付番号との対応とカウンターはScript Propertiesに保存し、受付ロック内で採番する。再送は同じ番号を再利用する。試験用と通常投稿は別々の連番。失敗した受付は番号が欠番になることがある。
