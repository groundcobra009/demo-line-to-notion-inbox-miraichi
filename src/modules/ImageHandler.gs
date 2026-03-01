/**
 * 画像処理モジュール
 *
 * LINE画像のダウンロード → Notion File Upload API で直接アップロード
 *
 * Notion File Upload APIフロー:
 * 1. POST /v1/file_uploads (JSON) → fileUploadId取得
 * 2. POST /v1/file_uploads/{id}/send (multipart/form-data) → ファイル送信
 * 3. ページ作成時に file_upload タイプで参照
 */

/**
 * LINE画像をダウンロードしてNotion File Upload APIにアップロード
 * @param {string} messageId - LINE メッセージID
 * @param {number} timestamp - イベントタイムスタンプ
 * @return {Object} { success, fileUploadId, error }
 */
function processLineImage(messageId, timestamp) {
  // 1. LINEから画像をダウンロード
  var download = downloadLineImage(messageId);
  if (!download.success) {
    return { success: false, fileUploadId: '', error: download.error };
  }

  // 2. ファイル名を生成
  var date = timestamp ? new Date(timestamp) : new Date();
  var dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyyMMdd_HHmmss');
  var ext = getImageExtension(download.blob.getContentType());
  var fileName = 'LINE_' + dateStr + '_' + messageId + ext;

  // 3. Notion File Upload APIにアップロード（2ステップ）
  var upload = uploadImageToNotion(download.blob, fileName);
  if (!upload.success) {
    return { success: false, fileUploadId: '', error: upload.error };
  }

  return { success: true, fileUploadId: upload.fileUploadId, error: null };
}

/**
 * Notion File Upload APIに画像をアップロード（2ステップ）
 *
 * Step 1: POST /v1/file_uploads → FileUploadオブジェクト作成
 * Step 2: POST /v1/file_uploads/{id}/send → ファイル送信
 *
 * @param {GoogleAppsScript.Base.Blob} blob - 画像Blob
 * @param {string} fileName - ファイル名
 * @return {Object} { success, fileUploadId, error }
 */
function uploadImageToNotion(blob, fileName) {
  var token = getProperty(PROP_KEYS.NOTION_TOKEN);
  if (!token) {
    return { success: false, fileUploadId: '', error: 'Notion Tokenが未設定です' };
  }

  var headers = {
    'Authorization': 'Bearer ' + token,
    'Notion-Version': CONFIG.notionApiVersion
  };

  try {
    // Step 1: FileUploadオブジェクトを作成
    var createResponse = UrlFetchApp.fetch(CONFIG.notionApiBase + '/file_uploads', {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify({}),
      muteHttpExceptions: true
    });

    var createCode = createResponse.getResponseCode();
    if (createCode !== 200 && createCode !== 201) {
      return { success: false, fileUploadId: '', error: 'File Upload作成エラー: ' + createCode + ' ' + createResponse.getContentText() };
    }

    var fileUpload = JSON.parse(createResponse.getContentText());
    var fileUploadId = fileUpload.id;

    // Step 2: ファイルを送信（multipart/form-data）
    blob.setName(fileName);

    var sendResponse = UrlFetchApp.fetch(CONFIG.notionApiBase + '/file_uploads/' + fileUploadId + '/send', {
      method: 'post',
      headers: headers,
      payload: {
        file: blob
      },
      muteHttpExceptions: true
    });

    var sendCode = sendResponse.getResponseCode();
    if (sendCode !== 200 && sendCode !== 201) {
      return { success: false, fileUploadId: '', error: 'File Upload送信エラー: ' + sendCode + ' ' + sendResponse.getContentText() };
    }

    return { success: true, fileUploadId: fileUploadId, error: null };
  } catch (error) {
    return { success: false, fileUploadId: '', error: 'Notionアップロード失敗: ' + error };
  }
}

/**
 * Content-Typeから拡張子を判定
 * @param {string} contentType
 * @return {string}
 */
function getImageExtension(contentType) {
  if (!contentType) return '.jpg';
  if (contentType.indexOf('png') !== -1) return '.png';
  if (contentType.indexOf('gif') !== -1) return '.gif';
  if (contentType.indexOf('webp') !== -1) return '.webp';
  return '.jpg';
}
