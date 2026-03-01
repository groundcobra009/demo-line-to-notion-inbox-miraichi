/**
 * LINE Webhook処理モジュール
 *
 * LINE Messaging APIからのWebhookイベントを解析・検証する
 */

// ========================================
// 署名検証
// ========================================

/**
 * LINE Webhookの署名を検証
 *
 * 注意: GAS の doPost(e) では HTTP リクエストヘッダーにアクセスできないため、
 * X-Line-Signature を取得できません。そのため GAS 環境では署名検証をスキップし、
 * Webhook URL の秘匿性でセキュリティを担保します。
 *
 * @param {string} body - リクエストボディ（JSON文字列）
 * @param {string} signature - X-Line-Signatureヘッダー値（GASでは常に空）
 * @return {boolean} 検証結果
 */
function verifyLineSignature(body, signature) {
  // GAS の doPost では HTTP ヘッダーを取得できないため、
  // signature が空の場合は検証をスキップして通す
  if (!signature) {
    return true;
  }

  var channelSecret = getProperty(PROP_KEYS.LINE_CHANNEL_SECRET);
  if (!channelSecret) {
    return true;
  }

  var hash = Utilities.computeHmacSha256Signature(body, channelSecret);
  var expectedSignature = Utilities.base64Encode(hash);
  return expectedSignature === signature;
}

// ========================================
// イベント解析
// ========================================

/**
 * LINE Webhookのリクエストボディからテキストメッセージイベントを抽出
 * @param {string} bodyString - リクエストボディ（JSON文字列）
 * @return {Array<Object>} テキストメッセージイベントの配列
 */
function parseLineTextEvents(bodyString) {
  var parsed = parseLineEvents(bodyString);
  return parsed.textEvents;
}

/**
 * LINE Webhookのリクエストボディからテキスト・画像メッセージイベントを抽出
 * @param {string} bodyString - リクエストボディ（JSON文字列）
 * @return {Object} { textEvents: Array, imageEvents: Array }
 */
function parseLineEvents(bodyString) {
  var body = JSON.parse(bodyString);
  var events = body.events || [];
  var textEvents = [];
  var imageEvents = [];

  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    if (event.type === 'message' && event.message) {
      if (event.message.type === 'text') {
        textEvents.push({
          type: 'text',
          messageId: event.message.id,
          text: event.message.text,
          userId: event.source ? event.source.userId : '',
          timestamp: event.timestamp,
          replyToken: event.replyToken || ''
        });
      } else if (event.message.type === 'image') {
        imageEvents.push({
          type: 'image',
          messageId: event.message.id,
          userId: event.source ? event.source.userId : '',
          timestamp: event.timestamp,
          replyToken: event.replyToken || '',
          contentProvider: event.message.contentProvider || { type: 'line' }
        });
      } else {
        Logger.log('非対応メッセージタイプ: ' + event.message.type);
      }
    } else {
      Logger.log('非対応イベント: type=' + event.type);
    }
  }

  return { textEvents: textEvents, imageEvents: imageEvents };
}

/**
 * LINE Content APIから画像データをダウンロード
 * @param {string} messageId - メッセージID
 * @return {Object} { success, blob, error }
 */
function downloadLineImage(messageId) {
  var accessToken = getProperty(PROP_KEYS.LINE_ACCESS_TOKEN);
  if (!accessToken) {
    return { success: false, blob: null, error: 'Channel Access Tokenが未設定です。画像取得にはAccess Tokenが必要です。' };
  }

  try {
    var url = 'https://api-data.line.me/v2/bot/message/' + messageId + '/content';
    var response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + accessToken },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      var blob = response.getBlob();
      return { success: true, blob: blob, error: null };
    } else {
      return { success: false, blob: null, error: 'LINE Content API エラー: ' + response.getResponseCode() + ' ' + response.getContentText() };
    }
  } catch (error) {
    return { success: false, blob: null, error: 'LINE画像ダウンロード失敗: ' + error };
  }
}

// ========================================
// LINE返信（任意・将来拡張用）
// ========================================

/**
 * LINEユーザーに返信メッセージを送信
 * @param {string} replyToken - リプライトークン
 * @param {string} text - 返信テキスト
 */
function replyToLine(replyToken, text) {
  var accessToken = getProperty(PROP_KEYS.LINE_ACCESS_TOKEN);
  if (!accessToken || !replyToken) {
    return;
  }

  var payload = {
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: text
      }
    ]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', options);
    if (response.getResponseCode() !== 200) {
      Logger.log('LINE返信エラー: ' + response.getResponseCode() + ' ' + response.getContentText());
    }
  } catch (error) {
    Logger.log('LINE返信例外: ' + error);
  }
}
