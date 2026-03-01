/**
 * Notion API ラッパーモジュール
 *
 * Notion APIへの低レベルHTTPリクエストを管理する
 */

// ========================================
// 共通リクエスト
// ========================================

/**
 * Notion APIにリクエストを送信
 * @param {string} endpoint - APIエンドポイント（例: '/pages'）
 * @param {string} method - HTTPメソッド
 * @param {Object} [payload] - リクエストボディ
 * @return {Object} レスポンスオブジェクト { success, status, data, error }
 */
function notionRequest(endpoint, method, payload) {
  var token = getProperty(PROP_KEYS.NOTION_TOKEN);
  if (!token) {
    return { success: false, status: 0, data: null, error: 'NOTION_TOKEN が未設定です' };
  }

  var url = CONFIG.notionApiBase + endpoint;
  var options = {
    method: method,
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Notion-Version': CONFIG.notionApiVersion
    },
    muteHttpExceptions: true
  };

  if (payload && (method === 'post' || method === 'patch')) {
    options.payload = JSON.stringify(payload);
  }

  try {
    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var responseData = JSON.parse(response.getContentText());

    if (statusCode >= 200 && statusCode < 300) {
      return { success: true, status: statusCode, data: responseData, error: null };
    } else {
      var errorMsg = responseData.message || ('HTTP ' + statusCode);
      return { success: false, status: statusCode, data: responseData, error: errorMsg };
    }
  } catch (error) {
    return { success: false, status: 0, data: null, error: error.toString() };
  }
}

// ========================================
// ページ操作
// ========================================

/**
 * Notionデータベースにページ（行）を作成
 * @param {string} databaseId - データベースID
 * @param {Object} properties - ページプロパティ
 * @param {Array<Object>} [children] - ページ本文ブロック
 * @return {Object} notionRequest結果
 */
function notionCreatePage(databaseId, properties, children) {
  var payload = {
    parent: { database_id: databaseId },
    properties: properties
  };

  if (children && children.length > 0) {
    payload.children = children;
  }

  return notionRequest('/pages', 'post', payload);
}

// ========================================
// データベース操作
// ========================================

/**
 * Notionデータベースの情報を取得
 * @param {string} databaseId - データベースID
 * @return {Object} notionRequest結果
 */
function notionGetDatabase(databaseId) {
  return notionRequest('/databases/' + databaseId, 'get');
}

/**
 * Notionデータベースを作成
 * @param {string} parentPageId - 親ページID
 * @param {string} title - データベース名
 * @param {Object} properties - プロパティ定義
 * @return {Object} notionRequest結果
 */
function notionCreateDatabase(parentPageId, title, properties) {
  var payload = {
    parent: { page_id: parentPageId },
    title: [
      {
        type: 'text',
        text: { content: title }
      }
    ],
    properties: properties
  };

  return notionRequest('/databases', 'post', payload);
}

/**
 * Notionデータベースをクエリ
 * @param {string} databaseId - データベースID
 * @param {Object} [filter] - フィルター条件
 * @param {number} [pageSize=1] - 取得件数
 * @return {Object} notionRequest結果
 */
function notionQueryDatabase(databaseId, filter, pageSize) {
  var payload = {};
  if (filter) {
    payload.filter = filter;
  }
  payload.page_size = pageSize || 1;

  return notionRequest('/databases/' + databaseId + '/query', 'post', payload);
}
