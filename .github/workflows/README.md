# GitHub Actions for Google Apps Script

このワークフローを他のリポジトリで使用する方法

## 🚀 クイックスタート

### 1. ワークフローファイルをコピー

このファイルを他のリポジトリの `.github/workflows/deploy-gas.yml` にコピー

### 2. GitHub Secrets を設定

https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions

#### 必須シークレット

| Name | 説明 | 取得方法 |
|------|------|----------|
| `CLASPRC_JSON_BASE64` | clasp認証情報（base64） | 下記参照 |
| `CLASP_JSON` | プロジェクト設定（scriptIdが空の場合は必須） | 下記参照 |

### 3. CLASPRC_JSON_BASE64 の取得

```bash
# ローカルで実行
cat ~/.clasprc.json | base64 | tr -d '\n'
```

出力された文字列を `CLASPRC_JSON_BASE64` に設定

### 4. CLASP_JSON の取得（オプション）

リポジトリに `.clasp.json` を含めない場合のみ必要

```bash
cat .clasp.json
```

出力されたJSONを `CLASP_JSON` に設定

---

## 📋 詳細セットアップ

### clasp の初期設定

```bash
# 1. clasp をインストール
npm install -g @google/clasp

# 2. Google アカウントでログイン
clasp login

# 3. 既存プロジェクトをクローン
clasp clone YOUR_SCRIPT_ID

# または新規作成
clasp create --type standalone --title "My GAS Project"
```

### プロジェクト構成

```
your-gas-project/
├── .github/
│   └── workflows/
│       └── deploy-gas.yml    # このファイルをコピー
├── Code.gs                   # メインコード
├── appsscript.json          # GAS設定
└── .clasp.json              # clasp設定（任意）
```

---

## 🔧 カスタマイズ

### ブランチ指定を変更

```yaml
on:
  push:
    branches:
      - main        # ← 任意のブランチに変更
      - production
```

### 手動実行を無効化

```yaml
on:
  push:
    branches:
      - main
  # workflow_dispatch を削除
```

---

## 🐛 トラブルシューティング

### エラー: "User has not enabled the Apps Script API"

https://script.google.com/home/usersettings にアクセスして Apps Script API を有効化

### エラー: "Could not find .clasp.json"

以下のいずれかを実施：
1. リポジトリに `.clasp.json` を追加
2. GitHub Secrets に `CLASP_JSON` を設定

### エラー: "base64: invalid input"

`CLASPRC_JSON_BASE64` に改行が含まれています。以下で再取得：

```bash
cat ~/.clasprc.json | base64 | tr -d '\n'
```

---

## 📚 参考リンク

- [clasp 公式ドキュメント](https://github.com/google/clasp)
- [GitHub Actions ドキュメント](https://docs.github.com/en/actions)
- [Apps Script API](https://script.google.com/home/usersettings)
