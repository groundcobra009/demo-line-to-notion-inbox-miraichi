# GitHub Secrets セットアップガイド

## 必須シークレット

### 1. CLASPRC_JSON_BASE64（必須）

clasp の認証情報ファイル（`~/.clasprc.json`）を **Base64 エンコード** した内容

#### 取得方法

```bash
# ローカルで clasp login を実行（初回のみ）
clasp login

# ~/.clasprc.json の内容を Base64 エンコードして確認
cat ~/.clasprc.json | base64
```

#### 元ファイル例（~/.clasprc.json）

```json
{
  "token": {
    "access_token": "ya29.xxx...",
    "refresh_token": "1//xxx...",
    "scope": "https://www.googleapis.com/auth/...",
    "token_type": "Bearer",
    "expiry_date": 1234567890000
  },
  "oauth2ClientSettings": {
    "clientId": "xxx.apps.googleusercontent.com",
    "clientSecret": "xxx",
    "redirectUri": "http://localhost"
  },
  "isLocalCreds": false
}
```

#### GitHub への登録

1. GitHub リポジトリ > **Settings** > **Secrets and variables** > **Actions**
2. **New repository secret** をクリック
3. Name: `CLASPRC_JSON_BASE64`
4. Secret: `cat ~/.clasprc.json | base64` の出力結果をコピー&ペースト
5. **Add secret** をクリック

> **注意**: Base64 エンコードが必要です。生の JSON をそのまま貼り付けないでください。

---

### 2. CLASP_JSON（必須）

プロジェクト設定ファイル（`.clasp.json`）の内容

#### 必要な場合

- リポジトリの `.clasp.json` に `scriptId` が設定されていない場合（必須）
- `.clasp.json` をリポジトリに含めたくない場合
- スクリプトIDを秘匿したい場合

#### 取得方法

```bash
# プロジェクトルートで確認
cat .clasp.json
```

#### ファイル例

```json
{
  "scriptId": "1a2b3c4d5e6f7g8h9i0j...",
  "rootDir": "."
}
```

#### GitHub への登録

1. GitHub リポジトリ > **Settings** > **Secrets and variables** > **Actions**
2. **New repository secret** をクリック
3. Name: `CLASP_JSON`
4. Secret: `.clasp.json` の内容をそのままコピー&ペースト
5. **Add secret** をクリック

---

### 3. DISCORD_WEBHOOK_URL（必須）

Discord 通知用の Webhook URL

#### 取得方法

1. Discord サーバーの設定を開く
2. **連携サービス** > **ウェブフック** を選択
3. **新しいウェブフック** をクリック
4. 通知先のチャンネルを選択し、**ウェブフックURLをコピー** をクリック

#### URL 例

```
https://discord.com/api/webhooks/XXXXXXXXXX/YYYYYYYYYYYY
```

#### GitHub への登録

1. GitHub リポジトリ > **Settings** > **Secrets and variables** > **Actions**
2. **New repository secret** をクリック
3. Name: `DISCORD_WEBHOOK_URL`
4. Secret: コピーした Webhook URL をペースト
5. **Add secret** をクリック

> **注意**: Webhook URL には認証トークンが含まれます。コード内にハードコーディングせず、必ず GitHub Secrets で管理してください。

---

## セキュリティベストプラクティス

### ✅ 推奨事項

1. **認証情報をコミットしない**
   - `.clasprc.json`
   - `.clasp.json`（スクリプトIDを秘匿する場合）

2. **.gitignore に追加**
   ```
   .clasprc.json
   .clasp.json
   ```

3. **最小権限の原則**
   - デプロイ専用のGoogleアカウントを使用
   - 必要最小限のスコープのみ許可

4. **定期的なトークン更新**
   - `refresh_token` は長期間有効
   - 定期的に `clasp login` を再実行して更新

5. **シークレットのローテーション**
   - 漏洩の疑いがある場合は即座に無効化
   - GitHub Secrets を更新

### ⚠️ 注意事項

1. **Public リポジトリでの注意**
   - `.clasp.json` をコミットする場合、スクリプトIDが公開される
   - スクリプト自体のアクセス権限を適切に設定

2. **Fork からの Pull Request**
   - Secrets は fork には渡されない（セキュリティ仕様）
   - 外部コントリビューターは手動デプロイが必要

3. **複数環境の管理**
   - 本番/開発で別の Secrets を使用
   - Environment Secrets の活用を検討

---

## トラブルシューティング

### エラー: "User has not enabled the Apps Script API"

```bash
# Apps Script API を有効化
# https://script.google.com/home/usersettings にアクセスして有効化
```

### エラー: "Invalid credentials"

```bash
# ローカルで再ログイン
clasp logout
clasp login

# 新しい ~/.clasprc.json を Base64 エンコードして GitHub Secrets に登録
cat ~/.clasprc.json | base64
# 出力結果を CLASPRC_JSON_BASE64 シークレットに登録
```

### エラー: "Could not find .clasp.json"

- リポジトリに `.clasp.json` が存在するか確認
- または `CLASP_JSON` シークレットが正しく設定されているか確認

---

## 検証方法

### ローカルでの動作確認

```bash
# 1. 認証
clasp login

# 2. プロジェクト設定確認
cat .clasp.json

# 3. デプロイテスト
clasp push

# 4. 成功したら GitHub Secrets に登録
# CLASPRC_JSON_BASE64 に Base64 エンコードした値を登録
cat ~/.clasprc.json | base64
```

### GitHub Actions での動作確認

```bash
# 1. GitHub リポジトリにプッシュ
git add .
git commit -m "Setup CI/CD"
git push origin main

# 2. Actions タブで実行結果を確認
# https://github.com/[username]/[repo]/actions
```

---

## 参考リンク

- [clasp 公式ドキュメント](https://github.com/google/clasp)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Apps Script API 有効化](https://script.google.com/home/usersettings)
