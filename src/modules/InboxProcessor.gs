/**
 * Inbox処理オーケストレーターモジュール
 *
 * LINEメッセージからNotionページ作成までの一連の処理を管理する
 */

// ========================================
// メイン処理
// ========================================

/**
 * LINEイベント（テキスト or 画像）をNotionに登録する
 * @param {Object} event - parseLineEventsで抽出したイベントオブジェクト
 * @return {Object} { success, pageId, error }
 */
function processInboxItem(event) {
  var context = {
    lineMessageId: event.messageId,
    userId: event.userId
  };

  try {
    // 1. データベース解決（存在確認 → 必要なら作成）
    var db = resolveDatabase();
    if (!db.success) {
      logError('processInboxItem', 'DB解決失敗: ' + db.error, context);
      return { success: false, pageId: '', error: db.error };
    }

    var databaseId = db.databaseId;
    var dbProperties = db.properties;

    // 2. オプションプロパティの存在確認
    var optionalProps = dbProperties ? checkOptionalProperties(dbProperties) : {
      status: false, source: false, capturedAt: false,
      lineUserId: false, lineMessageId: false, rawText: false
    };

    // 3. 重複チェック
    if (isDuplicate(databaseId, event.messageId, optionalProps)) {
      logInfo('processInboxItem', '重複スキップ: messageId=' + event.messageId, context);
      return { success: true, pageId: '', error: null };
    }

    // 4. 画像イベントの場合、画像をダウンロード→Notionアップロード
    var fileUploadId = '';
    if (event.type === 'image') {
      var imgResult = processLineImage(event.messageId, event.timestamp);
      if (!imgResult.success) {
        logError('processInboxItem', '画像処理失敗: ' + imgResult.error, context);
        return { success: false, pageId: '', error: imgResult.error };
      }
      fileUploadId = imgResult.fileUploadId;
    }

    // 5. Notionページ作成
    var mapping = getPropertyMapping();
    var properties = buildPageProperties(event, mapping, optionalProps);
    var children = event.type === 'image'
      ? buildImagePageChildren(event, fileUploadId)
      : buildPageChildren(event);

    var result = notionCreatePage(databaseId, properties, children);
    if (!result.success) {
      logError('processInboxItem', 'ページ作成失敗: ' + result.error, context);
      return { success: false, pageId: '', error: result.error };
    }

    var pageId = result.data.id;
    logInfo('processInboxItem', 'Inboxアイテム登録成功: pageId=' + pageId, context);

    return { success: true, pageId: pageId, error: null };

  } catch (error) {
    logError('processInboxItem', '予期しないエラー: ' + error, context);
    return { success: false, pageId: '', error: error.toString() };
  }
}

// ========================================
// プロパティ構築
// ========================================

/**
 * Notionページのプロパティオブジェクトを構築
 * @param {Object} event - LINEイベント
 * @param {Object} mapping - プロパティ名マッピング
 * @param {Object} optionalProps - オプションプロパティ存在マップ
 * @return {Object} Notion propertiesオブジェクト
 */
function buildPageProperties(event, mapping, optionalProps) {
  var titleText;
  if (event.type === 'image') {
    var imgDate = event.timestamp ? new Date(event.timestamp) : new Date();
    titleText = 'LINE画像 ' + Utilities.formatDate(imgDate, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  } else {
    titleText = event.text;
  }
  if (titleText.length > CONFIG.titleMaxLength) {
    titleText = titleText.substring(0, CONFIG.titleMaxLength);
  }

  var properties = {};

  // タイトル（必須）
  properties[mapping.title] = {
    title: [
      {
        text: { content: titleText }
      }
    ]
  };

  // Status（select）: "Inbox"
  if (optionalProps.status) {
    properties[mapping.status] = {
      select: { name: 'Inbox' }
    };
  }

  // Source（select）: "LINE"
  if (optionalProps.source) {
    properties[mapping.source] = {
      select: { name: CONFIG.defaultSource }
    };
  }

  // CapturedAt（date）: 受信日時（JST）
  if (optionalProps.capturedAt) {
    var capturedDate = event.timestamp ? new Date(event.timestamp) : new Date();
    properties[mapping.capturedAt] = {
      date: {
        start: Utilities.formatDate(capturedDate, 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX")
      }
    };
  }

  // LineUserId（rich_text）
  if (optionalProps.lineUserId && event.userId) {
    properties[mapping.lineUserId] = {
      rich_text: [
        {
          text: { content: event.userId }
        }
      ]
    };
  }

  // LineMessageId（rich_text）
  if (optionalProps.lineMessageId && event.messageId) {
    properties[mapping.lineMessageId] = {
      rich_text: [
        {
          text: { content: event.messageId }
        }
      ]
    };
  }

  // RawText（rich_text）
  if (optionalProps.rawText) {
    var rawText = event.type === 'image' ? '[画像]' : event.text;
    if (rawText.length > 2000) {
      rawText = rawText.substring(0, 2000);
    }
    properties[mapping.rawText] = {
      rich_text: [
        {
          text: { content: rawText }
        }
      ]
    };
  }

  return properties;
}

// ========================================
// 本文ブロック構築
// ========================================

/**
 * Notionページの本文ブロック（children）を構築
 * @param {Object} event - LINEイベント
 * @return {Array<Object>} Notionブロック配列
 */
function buildPageChildren(event) {
  var children = [];

  // メッセージ全文
  var textChunks = splitTextToChunks(event.text, 2000);
  for (var i = 0; i < textChunks.length; i++) {
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: textChunks[i] }
          }
        ]
      }
    });
  }

  // 区切り線
  children.push({
    object: 'block',
    type: 'divider',
    divider: {}
  });

  // メタ情報
  var capturedDate = event.timestamp ? new Date(event.timestamp) : new Date();
  var metaText = 'Source: LINE\n' +
    'MessageId: ' + event.messageId + '\n' +
    'UserId: ' + event.userId + '\n' +
    'CapturedAt: ' + Utilities.formatDate(capturedDate, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') + ' (JST)';

  children.push({
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [
        {
          type: 'text',
          text: { content: metaText }
        }
      ],
      icon: {
        type: 'emoji',
        emoji: '\uD83D\uDCDD'
      }
    }
  });

  return children;
}

/**
 * 画像用のNotionページ本文ブロックを構築
 * @param {Object} event - LINEイベント（image type）
 * @param {string} fileUploadId - Notion File Upload ID
 * @return {Array<Object>} Notionブロック配列
 */
function buildImagePageChildren(event, fileUploadId) {
  var children = [];

  // 画像ブロック（Notion File Upload）
  children.push({
    object: 'block',
    type: 'image',
    image: {
      type: 'file_upload',
      file_upload: {
        id: fileUploadId
      }
    }
  });

  // 区切り線
  children.push({
    object: 'block',
    type: 'divider',
    divider: {}
  });

  // メタ情報
  var capturedDate = event.timestamp ? new Date(event.timestamp) : new Date();
  var metaText = 'Source: LINE\n' +
    'Type: Image\n' +
    'MessageId: ' + event.messageId + '\n' +
    'UserId: ' + event.userId + '\n' +
    'CapturedAt: ' + Utilities.formatDate(capturedDate, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss') + ' (JST)';

  children.push({
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [
        {
          type: 'text',
          text: { content: metaText }
        }
      ],
      icon: {
        type: 'emoji',
        emoji: '\uD83D\uDDBC\uFE0F'
      }
    }
  });

  return children;
}

/**
 * テキストを指定サイズごとに分割
 * @param {string} text - 元テキスト
 * @param {number} maxLength - 1チャンクの最大文字数
 * @return {Array<string>}
 */
function splitTextToChunks(text, maxLength) {
  if (text.length <= maxLength) {
    return [text];
  }

  var chunks = [];
  var start = 0;
  while (start < text.length) {
    chunks.push(text.substring(start, start + maxLength));
    start += maxLength;
  }
  return chunks;
}
