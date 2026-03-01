# GAS UIデザインガイドライン

## 1. はじめに

このガイドラインは、Google Apps Script(GAS)でカスタムUIを設計・実装する際の、**サイドバー(Sidebar)**と**ダイアログ(Dialog)**の使い分け基準を定めるものです。一貫性のあるユーザー体験を提供し、開発効率を向上させることを目的とします。

## 2. 基本方針

UIの選択は、**「ユーザーの作業フローを中断させる必要があるか」**を基準に判断します。

- **継続的な操作や参照が中心の場合** → **サイドバー**
- **一時的な入力や通知、ユーザーの注意を喚起する必要がある場合** → **ダイアログ**

---

## 3. UI別ガイドライン

### 3.1. サイドバー (Sidebar)

**特徴**: スプレッドシートやドキュメントの横に常駐し、メインコンテンツと並行して操作できます。

**適した用途**:
- **定型的なデータ入力**: 繰り返し使用する入力フォーム。
- **設定・操作パネル**: ツールの各種設定やフィルター操作など、頻繁にアクセスする機能。
- **ナビゲーションメニュー**: 複数の機能を提供するスクリプトの目次。
- **リアルタイム情報の表示**: 処理状況のログやダッシュボード。

**実装のポイント**:
- ユーザーがメインコンテンツ(シートやドキュメント)を参照しながら作業を進められる場合に最適です。
- 常に表示されているため、ユーザーは自分のタイミングで操作できます。

### 3.2. ダイアログ (Dialog / Modal)

**特徴**: 画面中央にポップアップ表示され、ユーザーがダイアログを閉じるまで他の操作をブロック(モーダル)します。

**適した用途**:
- **重要な確認**: 削除や上書きなど、取り消せない操作の最終確認。
- **一時的な入力**: 処理に必要なパラメータやファイル選択など、一度きりの入力。
- **通知・警告**: エラーメッセージや処理の完了通知。
- **初期設定ウィザード**: 初回利用時に必要な設定をステップバイステップで案内する。

**実装のポイント**:
- ユーザーの注意を強制的に引き、特定の操作に集中させたい場合に使用します。
- 処理のフローを明確に区切り、必要な情報を確実に受け取るために有効です。

---

## 4. 特別なルール:初期設定ウィザード

一度設定すれば頻繁には変更しない項目については、**ダイアログUIによる「初期設定ウィザード」**として実装することを推奨します。

**ルール**:
> スクリプトの初回実行時に、APIキー、Webhook URL(Discordなど)、各種設定IDといった、一度きりの設定項目を要求する場合は、ダイアログUIを用いたウィザード形式で実装する。

**理由**:
- **確実な設定**: モーダルなUIでユーザーをガイドし、必要な設定が完了するまで他の操作をさせないことで、設定漏れを防ぎます。
- **シンプルなUX**: 初回ユーザーに複雑なサイドバーUIを見せることなく、必要な設定だけをステップ・バイ・ステップで完了させることができます。
- **再設定の簡素化**: 設定変更時も同じウィザードを呼び出すことで、一貫した操作性を提供できます。

## 5. 使い分け早見表

| シナリオ | 推奨UI | 理由 |
|:---|:---:|:---|
| 繰り返し使うデータ入力フォーム | **サイドバー** | シートを見ながら継続的に作業するため。 |
| 初回のみのAPIキー設定 | **ダイアログ** | 確実に設定を完了させ、ユーザーを迷わせないため。(初期設定ウィザード) |
| 処理完了の通知 | **ダイアログ** | ユーザーの注意を引き、結果を明確に伝えるため。 |
| ツールの機能一覧メニュー | **サイドバー** | 複数の機能へアクセスするためのナビゲーションとして常駐させるため。 |
| 危険な操作(データ削除など)の確認 | **ダイアログ** | ユーザーの意図を再確認し、誤操作を防ぐため。 |

---

# GASプロジェクト開発規約

## プロジェクト構成

### 技術スタック
- **実行環境**: Google Apps Script (V8ランタイム)
- **言語**: JavaScript (ES6+)
- **UI**: HTML/CSS (Material Design推奨)
- **データストア**: Googleスプレッドシート、スクリプトプロパティ

### ファイル構成
```
プロジェクト/
├── Code.gs                    # メインロジック・トリガー処理
├── Config.gs                  # 設定定数の一元管理
├── Utils.gs                   # 汎用ユーティリティ関数
├── [機能別].gs                # 機能ごとのモジュール
├── SettingsDialog.html        # 設定ダイアログUI
├── HelpDialog.html           # ヘルプUI
└── Sidebar.html              # サイドバーUI
```

## コーディング規約

### 命名規則
- **関数名**: camelCase(例: `createDataObject`, `sendNotification`)
- **定数**: UPPER_SNAKE_CASE(例: `FORM_CONFIG`, `API_VERSION`)
- **変数**: camelCase(例: `rowData`, `itemName`)
- **HTMLファイル**: PascalCase(例: `SettingsDialog.html`)

### 関数設計
- **単一責任の原則**: 1関数1機能を厳守
- **JSDoc必須**: すべての関数に型情報・説明を記載
```javascript
/**
 * データオブジェクトを生成
 * @param {string} key - データキー
 * @param {*} value - 設定値
 * @return {Object} データオブジェクト
 */
function createDataObject(key, value) {
  return { key: key, value: value };
}
```

### エラーハンドリング
- **try-catch必須**: 外部API呼び出しや重要処理は例外処理を実装
- **ログ出力**: 処理の成功・失敗を `Logger.log()` で記録
- **ユーザー通知**: エラー発生時は管理者への通知機構を実装
```javascript
try {
  UrlFetchApp.fetch(url, options);
  Logger.log('✅ API呼び出し成功');
} catch (error) {
  Logger.log('❌ APIエラー: ' + error);
  sendErrorNotification('functionName', error);
}
```

## 設定管理

### スクリプトプロパティ
機密情報・環境依存値は `PropertiesService.getScriptProperties()` に保存:
- APIキー・トークン
- Webhook URL
- 管理者メールアドレス
- 外部サービスID

### Config.gsでの定数管理
プロジェクト設定を一元管理:
```javascript
const CONFIG = {
  appName: 'マイアプリケーション',
  version: '1.0.0',
  sheetNames: {
    main: 'メインデータ',
    settings: '設定',
    logs: 'ログ'
  },
  fields: [
    { id: 'name', title: 'お名前', type: 'text', required: true },
    { id: 'email', title: 'メール', type: 'email', required: true }
  ]
};
```

## スプレッドシート設計

### データシート構造
| 列 | 項目 | 説明 | データ型 |
|----|------|------|----------|
| A | タイムスタンプ | 記録日時 | Date |
| B-Z | データ項目 | 業務データ | 各種 |
| AA+ | システム列 | 処理フラグ・ステータス | Boolean/String |

### システム列の命名
- `送信済み`: 外部通知完了フラグ
- `処理日時`: 最終処理タイムスタンプ
- `エラーログ`: エラー内容記録

### 数式シートの活用
- **UNIQUE関数**: マスタデータの自動抽出
- **FILTER関数**: 条件付きデータ取得
- **IMPORTRANGE**: シート間データ連携

## UI設計

### Material Design準拠
- **カラーパレット**: プライマリ・アクセントカラーを定義
- **レスポンシブ**: モバイル対応(max-width: 600px)
- **カード形式**: 機能をセクションで区切り視認性向上
- **フィードバック**: ボタン無効化・ローディング表示

### ダイアログ構成
```html
<div class="container">
  <div class="tabs">タブナビゲーション</div>
  <div class="tab-content">
    <div class="card">
      <h3>セクションタイトル</h3>
      <form>
        <input type="text" id="field1" placeholder="入力欄" />
        <button onclick="handleSubmit()">実行</button>
      </form>
    </div>
  </div>
</div>
```

### google.script.run
- **非同期処理**: `withSuccessHandler()` / `withFailureHandler()` 必須
- **UI更新**: 処理中はボタン無効化・完了後に再有効化
```javascript
google.script.run
  .withSuccessHandler(onSuccess)
  .withFailureHandler(onFailure)
  .serverFunction(param);
```

## トリガー設計

### 命名規則
- `onFormSubmit`: フォーム送信トリガー
- `onEdit`: 編集トリガー
- `dailyBatch`: 時間主導型トリガー

### イベントオブジェクト活用
```javascript
function onFormSubmit(e) {
  const range = e.range;
  const values = range.getValues()[0];
  // 処理実装
}
```

### テスト実行用関数
```javascript
function testOnFormSubmit() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn());

  const e = {
    source: SpreadsheetApp.getActiveSpreadsheet(),
    range: range
  };

  onFormSubmit(e);
}
```

## セキュリティ・アクセス制御

### 認証スコープ
必要最小限の権限を要求:
```javascript
/**
 * @OnlyCurrentDoc
 */
```

### データアクセス制御
- **スプレッドシート**: オーナーのみ編集可能に設定
- **中間シート**: 管理者のみアクセス(共有リンク非表示)
- **公開シート**: 閲覧専用で外部共有

### 機密情報の取り扱い
- スクリプトプロパティで管理
- コード内にハードコーディング禁止
- ログ出力時はマスキング処理

## パフォーマンス最適化

### レート制限対策
- **API呼び出し**: 1秒間隔で `Utilities.sleep(1000)`
- **バッチ処理**: 大量データは100件ごとに分割
- **Gmail送信**: 1日100通の上限を意識

### 効率化テクニック
- **一括読み込み**: `getValues()` で配列取得(ループ内の `getValue()` 禁止)
- **一括書き込み**: `setValues()` で配列書き込み
- **ヘッダー検索**: 列名で動的検索(列番号ハードコーディング禁止)
```javascript
// ❌ 非効率
for (let i = 1; i <= lastRow; i++) {
  const value = sheet.getRange(i, 1).getValue();
}

// ✅ 効率的
const values = sheet.getRange(1, 1, lastRow, 1).getValues();
values.forEach(row => {
  const value = row[0];
});
```

## デバッグ・ログ管理

### ログレベル
- `Logger.log('✅ 成功メッセージ')`: 正常完了
- `Logger.log('⚠️ 警告メッセージ')`: 注意喚起
- `Logger.log('❌ エラーメッセージ')`: 異常終了

### 確認方法
1. Apps Scriptエディタ → 「表示」→「ログ」
2. 「実行数」でトリガー履歴を確認
3. スタックトレースでエラー箇所を特定

## 外部連携

### API呼び出しパターン
```javascript
function callExternalAPI(url, payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      throw new Error('API Error: ' + statusCode);
    }

    return JSON.parse(response.getContentText());
  } catch (error) {
    Logger.log('❌ API呼び出しエラー: ' + error);
    throw error;
  }
}
```

### 主要連携先
- **Discord**: Webhook経由で通知
- **Notion**: REST API経由でデータベース書き込み
- **Gmail**: GmailApp経由でメール送信
- **Slack**: Incoming Webhook経由で通知

## 更新・メンテナンス

### 設定変更時の注意
1. `Config.gs` を優先的に更新
2. 既存データとの互換性を確認
3. テスト実行関数で動作検証
4. 本番環境への反映前にバックアップ

### バージョン管理
- `CONFIG.version` でバージョン番号を管理
- 重要な変更はコメントに記録
- 過去バージョンはコピーして保存

## 外部リソース

- [Google Apps Script公式ドキュメント](https://developers.google.com/apps-script)
- [Material Design](https://material.io/design)
- [スプレッドシート関数リファレンス](https://support.google.com/docs/table/25273)
