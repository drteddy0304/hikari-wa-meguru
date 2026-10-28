# Dropbox素材保存

大井さんのDropboxのアプリ専用フォルダ `アプリ/Hikari-Materials-Ooi-2026` に保存する。山形さん側の追加操作は不要。Google Apps Scriptは受付とDropbox通信だけに使用し、Google DriveやSheetsへ写真を保存しない。

## 保存内容

`submissions/<受付番号>/` に以下を保存する。フォルダは非公開。

- photo.jpg：最大4096pxに再エンコードした写真。EXIF/GPSを除去。
- moon.png：参加者が調整した範囲の透明PNG。最大2048px。
- preview.jpg：確認用縮小画像。
- light.json：調整座標、色、明るさ、100粒子、seedと画像寸法。
- consent.json：同意内容と受付時刻。
- _complete.json：全素材を内容ハッシュで確認した完了記録。

Dropboxで投稿フォルダを開き、フォルダ設定の「ダウンロード」でZIP取得。そのZIPをデザイナーへ渡せる。自動審査はしない。

## 接続・運用

認証情報はApps ScriptのScript Propertiesだけに保存。公開ソースやブラウザにトークンを置かない。App folder / account_info.read / files.metadata.read / files.content.writeのみ。普段のDropboxの他フォルダにはアクセスしない。

`DBX_APP_KEY`, `EXPECTED_DROPBOX_EMAIL`, `DBX_ACCESS_MODE=app_folder`, `DBX_REDIRECT_URI` を運営側で設定。`prepareDropboxConnection` は所有者限定でPKCEリンクを発行する。既存接続は自動置換しない。`startCollection` は保存先を再照合し受付を開始する。停止は `ENABLED=false`。運営名・連絡先はユーザー指定で非表示。同意欄は保持。

新しいコードの公開には `node collection/dropbox/build.mjs <出力先>` で生成したCode.gs、Bridge.html、appsscript.jsonを使い、既存デプロイを新バージョンに更新する。GitHub側はcollection-config.mjsで接続する。

## 検証

2026-10-29：Dropbox OAuth接続、実保存、認証更新、素材ZIPダウンロードと元データとのバイト一致を確認。公開GitHub Pagesの運営者用 `collection/storage-check.html` から調整位置・半径を変えた人工画像を送り、実保存と同一投稿再送を確認。試験用素材は `connection-tests/` に隔離し、参加者の同意記録と混同しない。

実ブラウザで見つかったApps Scriptテンプレートのnonce二重エスケープ、RPC時のオブジェクトキー順による重複誤判定を修正。Dropbox backendの16テストで受付停止・未同意・匿名管理操作拒否・部分保存の再試行・容量上限などを検証。

iPhone Safari／LINE内ブラウザ・Android実機は未検証。デスクトップでの確認と区別する。

## 容量

1投稿8MiB、累計予約1GiB、1日100件、Dropbox空き512MiBを確保。無料枠・容量上限で停止し、自動で有料契約にはしない。失敗時も予約を戻さないので上限に早く達する場合がある。大量の不正投稿を完全に防ぐ仕組みではない。
