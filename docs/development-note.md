# 開発ノート: LINE to Notion Inbox をAIと一緒に作った話

> LINEに送るだけでNotionのInboxに自動登録されるツールを、Claude Codeと対話しながら作った記録。

---

## やりたかったこと

「思いついたことを、LINEにポンと送るだけでNotionに入る」

- iPhoneのロック画面からLINE開いて、テキスト送るだけ
- 写真も送れる
- あとはNotionのInboxに勝手に入ってる

シンプルだけど、これがあるとないとで「思考のキャプチャ率」がまるで違う。

---

## 技術スタック（結果的にこうなった）

```
LINE (Messaging API)
  ↓ Webhook
Google Apps Script (Webアプリ)
  ↓ Notion API
Notion Database (Inbox)
```

- **サーバー**: Google Apps Script（無料、デプロイが楽、スプレッドシートと一体化）
- **クライアント**: LINE（毎日使ってるアプリ = 起動コストゼロ）
- **データ保存先**: Notion（タスク管理・ナレッジベースとして既に使ってる）

---

## 開発の流れ（試行錯誤の記録）

### Phase 1: まず動くものを作る

**コミット**: `feat: LINE to Notion Inbox - full implementation`

最初の一発で、以下を一気に実装した:

- `doPost` でLINE Webhookを受け取る
- テキストメッセージを取り出してNotion DBにページ作成
- 重複チェック（LineMessageIdで判定）
- エラーログをスプレッドシートに記録
- サイドバーUI、初期設定ウィザード、設定変更ダイアログ

**ポイント**: AIと作ると「まず全部入り」で出てくる。最初からエラーハンドリングもUIも揃っているのは、手作業だと後回しにしがちな部分。

### Phase 2: デバッグ地獄

**コミット**: `fix: signature verification, log sheet location, Japanese UI`
**コミット**: `fix: add trace logging in doPost for webhook debugging`

ここが一番ハマった。LINE Webhookが動かない。

**問題1: 署名検証が通らない**

GASの`doPost(e)`ではHTTPヘッダーにアクセスできない。LINEの署名検証には`x-line-signature`ヘッダーが必要だが、取得する手段がない。

→ **解決**: 署名検証をスキップし、デプロイURLの秘匿性に頼る方式に変更。GASの制約として割り切った。

**問題2: ログが見えない**

Webhookからの実行では`SpreadsheetApp.getActiveSpreadsheet()`が使えない（UIコンテキストがないため）。

→ **解決**: スプレッドシートIDをスクリプトプロパティに保存し、`SpreadsheetApp.openById()`で開く方式に。UI操作時にIDを自動保存する仕組みを追加。

**問題3: そもそもdoPostに到達してるか分からない**

→ **解決**: トレースログを入れて一つずつ確認。地味だけど確実。

### Phase 3: 見た目と体裁を整える

**コミット**: `style: LINE brand color (#06C755) + README rewrite`

機能が動いたので、READMEをちゃんと書き直した。LINEブランドカラー（#06C755）でUIの統一感も出した。

### Phase 4: 画像対応 — ここが最大の試行錯誤

**コミット**: `feat: LINE画像メッセージをNotionに埋め込み対応`

テキストだけじゃなくて、写真もLINEから送りたい。スクショとか、ホワイトボードの写真とか。

**最初のアプローチ: Google Drive経由**

1. LINE Content APIで画像バイナリを取得
2. Google Driveに保存
3. 共有URLを取得
4. Notionページにexternal画像として埋め込み

→ **問題**: Driveの共有URL管理が煩雑。権限設定を間違えると画像が表示されない。

**コミット**: `fix: Drive廃止→Notion File Upload APIで画像を直接ページに埋め込み`

**方針転換: Notion File Upload API（2ステップ方式）**

1. `POST /file_uploads` でアップロードセッションを作成
2. `POST /file_uploads/{id}/send` で実際のファイルを送信
3. 返ってきたfile_upload IDを使ってページにimage blockを作成

**コミット**: `fix: Notion File Upload APIのエンドポイント修正(file_uploads)`

→ **問題**: エンドポイントのパスが間違っていた。APIドキュメントをよく読むと`/v1/file_uploads`ではなく正しいパスがあった。

**学び**: 新しいAPI（Notion File Upload APIは比較的新しい）は、AIの学習データに含まれていないことがある。公式ドキュメントの確認は必須。

---

## ハマりポイントまとめ

| 問題 | 原因 | 解決 |
|------|------|------|
| LINE署名検証が通らない | GASではHTTPヘッダーを取得できない | 検証スキップ、URL秘匿で代替 |
| Webhookからログが書けない | UIコンテキストがない | SSIDをプロパティ保存→openById |
| 画像のDrive経由が面倒 | 権限管理・URL管理が煩雑 | Notion File Upload APIに切り替え |
| File Upload APIが404 | エンドポイントパスの誤り | 公式ドキュメント再確認 |
| テキストが2000文字で切れる | Notion APIの文字数制限 | 2000文字ごとにチャンク分割 |

---

## 設計で意識したこと

### 1. 「あったら使う、なければスキップ」の柔軟設計

Notion DBのプロパティは`Name`（Title）だけ必須。`Status`、`Source`、`CapturedAt`などはあれば自動セットするが、なくてもエラーにならない。

これにより:
- 最小構成で始められる
- 後からプロパティを追加しても自動で使ってくれる
- 既存のDBを流用できる

### 2. UIは3層構造

| UI | 用途 | タイミング |
|----|------|-----------|
| SetupWizard（ダイアログ） | 初期設定 | 初回のみ |
| SettingsDialog（ダイアログ） | 設定変更 | たまに |
| Sidebar | 状態確認・テスト | 普段使い |

GASのUIはサイドバーとダイアログの2種類しかないが、使い分けることで「初回」「設定変更」「日常」の3つの体験を作れる。

### 3. エラーは握りつぶさない

Webhookは非同期なので、エラーが起きてもユーザーには見えない。だからスプレッドシートの「ErrorLog」シートにすべて記録する。タイムスタンプ、レベル、関数名、メッセージID、ペイロードまで残す。

---

## AIと一緒に開発して気づいたこと

### 良かった点

- **初期実装のスピード**: 13ファイル、UI含めた全機能が数回の対話で完成
- **エラーハンドリングが最初から入る**: 手作業だと後回しにしがちな部分
- **ドキュメントが自然に生まれる**: コードと同時にREADMEも書いてくれる
- **方針転換が楽**: 「Drive経由やめてNotion直接アップロードにして」で一発

### 注意が必要な点

- **新しいAPIの知識がない場合がある**: Notion File Upload APIのように最近追加されたAPIは、正確な仕様を別途確認する必要があった
- **GAS固有の制約**: `doPost`でヘッダーが取れない等、プラットフォーム固有の制約はAIが知らない場合がある
- **動作確認は人間の仕事**: コードは書けても「実際にLINEから送って動くか」は自分で試すしかない

### 開発フロー

```
1. やりたいことを日本語で伝える
2. AIがコード全体を生成
3. GASにデプロイして手動テスト
4. エラーが出たらログを貼って相談
5. 修正版をもらってデプロイ
6. 繰り返し
```

このループを1日で3-4回転。従来なら1週間かかるものが、半日で動くところまで持っていけた。

---

## 最終的なファイル構成

```
src/
├── appsscript.json              # GAS設定
├── core/
│   ├── Code.gs                  # エントリポイント（doPost, onOpen, UI）
│   └── Config.gs                # 設定・定数の一元管理
├── integrations/
│   ├── LineWebhook.gs           # LINEイベント解析・画像取得
│   ├── NotionApi.gs             # Notion API HTTPラッパー
│   └── NotionDatabase.gs        # DB検証・自動作成
├── modules/
│   ├── DuplicateChecker.gs      # 重複排除（MessageId照合）
│   ├── ErrorLogger.gs           # スプレッドシートログ
│   ├── ImageHandler.gs          # 画像アップロードパイプライン
│   └── InboxProcessor.gs        # メイン処理オーケストレーション
└── ui/
    ├── Sidebar.html             # サイドバー
    └── dialogs/
        ├── SetupWizard.html     # 初期設定ウィザード
        ├── SettingsDialog.html  # 設定変更
        └── HelpDialog.html      # ヘルプ
```

---

## まとめ

「LINEに送るだけでNotionに入る」という小さなツールだが、実際に作ると:

- **LINE Messaging API** のWebhookの仕組み
- **GAS** のWebアプリとしての制約
- **Notion API** のページ作成とFile Upload
- **非同期処理** のデバッグ手法

これだけの技術要素が絡む。AIと一緒に作ることで、一つ一つの技術を「深く理解してから使う」のではなく「動くものを作りながら理解する」アプローチが取れた。

動くものが手元にあると、「次はこうしたい」が自然に湧いてくる。それがAI共同開発の最大の価値だと思う。
