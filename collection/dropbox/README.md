# Dropbox保存（接続準備中・受付OFF）

写真とユーザー調整済みの切り抜き・光データを、そのまま受信する。再検出しない。
Google Apps Scriptは受付とOAuth中継にだけ使用し、DriveやSheetsへ素材を保存しない。
新規の有料API・DBは追加しない。Apps ScriptとDropboxの容量・実行上限内で停止する設計。

## 所有と閲覧

- DropboxアカウントとDropbox連携アプリは山形さん所有。
- 通常の `/submissions` フォルダを山形さんが大井さんに「閲覧のみ」で招待共有する。メールアドレスを確認してから招待する。公開リンクにはしない。
- App folderは通常の招待共有に非対応のため、2026-10-29にユーザーが **企画専用アカウントへのFull Dropbox** を承認した。普段のアカウントでは作成・接続しない。
- Full Dropboxはフォルダ単位の認可制限ではない。コードは `/submissions` 以外に書き込まないが、鍵が漏れれば許可スコープ内の操作は専用アカウント全体へ及ぶ。一般ファイルをこのアカウントに混在させない。
- サーバーを編集できる管理者は連携鍵を扱える。Dropboxアプリの所有だけでサーバー管理権限も本人限定になるわけではない。

## 山形さんに依頼する最初の作業

Dropbox公式 https://www.dropbox.com/developers/apps へ企画専用アカウントでログイン。
連携アプリを新規作成（Scoped access / Full Dropbox）。名称例 `Hikari wa Meguru Materials`（名前の利用可否は未確認）。利用規約は本人が確認する。
作成後の **App key** は接続先を識別する公開識別子。パスワード、App secret、Generated access token、認証コードをチャットへ送らない。
Permissionsは `account_info.read`、`files.metadata.read`、`files.content.write` の3つだけ。
この段階ではOAuth承認リンクは未発行。アプリ作成と受信サーバー公開後に正しいリンクを発行する。

## 運営側設定

1. `node collection/dropbox/build.mjs <ローカル出力先>` で Code.gs / Bridge.html / appsscript.json を生成。Google版の検証関数と許諾案を共有する。
2. 受付用Apps Scriptに3ファイルを設定。既存Google版のコードと同時にロードしない（同名関数あり）。Drive／Sheetsスコープは外す。必要スコープは外部通信と運営者のメール照合。
3. Script Propertiesに `DBX_APP_KEY`, `EXPECTED_DROPBOX_EMAIL`, `DEDICATED_FULL_DROPBOX_CONFIRMED=true` を設定。値は公開ソースに入れない。
4. Webアプリを所有者として実行する形で公開し、実URLを `DBX_REDIRECT_URI` とDropboxアプリのRedirect URI両方へ設定。無料実行枠を超える場合は停止し、有料契約へ自動移行しない。
5. エディタで `prepareDropboxConnection` を実行。1時間・1回限りの連携URLを本人へ渡す（チャットやログを公開しない）。生成前に既存接続があると拒否する。
6. 本人が専用Dropboxで許可すると、state/PKCEと登録メールを照合して接続鍵をScript Propertiesに保存する。誤アカウントは鍵を保存せず、その認可を取り消す。連携成功後もENABLED=false。
7. 運営者名、取下げ連絡先、保管・削除方針、許諾文を確定。`OPERATOR`, `CONTACT`, `TERMS_APPROVED` を設定。
8. 人工画像で保存・再送・容量停止・本人アカウント・大井さんの閲覧・フォルダのZIPダウンロードを確認後に受付を有効化する。`collection-config.mjs` のendpointとenabledも必要。

## 保存内容とデザイナーへの受け渡し

`/submissions/<投稿番号>/` に photo.jpg, moon.png, preview.jpg, light.json, consent.json。
全ファイルを内容ハッシュで確認した後、最後に `_complete.json` を置く。これがない投稿は保存途中であり、採用しない。
山形さんが完成した投稿を確認し、採用素材を別の通常フォルダにコピーしてデザイナーへ渡す。投稿フォルダを動かすと再送照合ができなくなるのでコピーする。
Dropbox公式UIでフォルダをダウンロード／共有する。自動採用、自動審査、自動送信はしない。

## 制限・確認状況

素材8MiB/投稿、初期累計予約1GiB、1日100回、空き容量512MiBを確保。失敗時も容量予約を減らさないため、再試行で早めに上限に達することがある。悪意ある大量投稿の完全な防止ではない。
自動テスト10項目：全素材保存後の完了、再送、部分失敗回復、異なる内容拒否、停止・未同意拒否、容量、運営者制限、OAuth state、Dropboxブロックハッシュをモックで確認。
**未検証**：実Dropbox API、本人OAuth、Apps Script公開、スマホ送信、閲覧招待、ZIP受け渡し。ソース準備は接続完了ではない。

公式資料：
- https://www.dropbox.com/developers/reference/developer-guide
- https://community.dropbox.com/en/discussion/comment/679746
- https://dropbox.tech/developers/pkce--what-and-why-
- https://docs.dropboxapi.com/dropbox-api/docs/technical-reference/content-hash
