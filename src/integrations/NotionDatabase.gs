/**
 * Notion データベース管理モジュール
 *
 * データベースの存在確認、構造検証、自動作成を管理する
 */

// ========================================
// データベース検証
// ========================================

/**
 * 設定済みのNotion DBが有効かどうか確認する
 * @return {Object} { valid, databaseId, error, properties }
 */
function validateNotionDatabase() {
  var databaseId = getProperty(PROP_KEYS.NOTION_DATABASE_ID);

  // DB ID未設定
  if (!databaseId) {
    return { valid: false, databaseId: '', error: 'NOTION_DATABASE_ID が未設定です', properties: null };
  }

  // DB取得を試行
  var result = notionGetDatabase(databaseId);
  if (!result.success) {
    return { valid: false, databaseId: databaseId, error: 'DB取得失敗: ' + result.error, properties: null };
  }

  // タイトルプロパティの存在確認
  var titlePropName = getTitlePropertyName();
  var dbProperties = result.data.properties || {};
  var titleProp = dbProperties[titlePropName];

  if (!titleProp || titleProp.type !== 'title') {
    return {
      valid: false,
      databaseId: databaseId,
      error: 'タイトルプロパティ "' + titlePropName + '" が見つからないか、type=title ではありません',
      properties: dbProperties
    };
  }

  return { valid: true, databaseId: databaseId, error: null, properties: dbProperties };
}

/**
 * DBのプロパティ名一覧からオプションプロパティの存在を確認
 * @param {Object} dbProperties - Notion DBのプロパティオブジェクト
 * @return {Object} 各プロパティの存在マップ { status: bool, source: bool, ... }
 */
function checkOptionalProperties(dbProperties) {
  var mapping = getPropertyMapping();
  return {
    status: !!(dbProperties[mapping.status] && dbProperties[mapping.status].type === 'select'),
    source: !!(dbProperties[mapping.source] && dbProperties[mapping.source].type === 'select'),
    capturedAt: !!(dbProperties[mapping.capturedAt] && dbProperties[mapping.capturedAt].type === 'date'),
    lineUserId: !!(dbProperties[mapping.lineUserId] && dbProperties[mapping.lineUserId].type === 'rich_text'),
    lineMessageId: !!(dbProperties[mapping.lineMessageId] && dbProperties[mapping.lineMessageId].type === 'rich_text'),
    rawText: !!(dbProperties[mapping.rawText] && dbProperties[mapping.rawText].type === 'rich_text')
  };
}

// ========================================
// データベース自動作成
// ========================================

/**
 * parent_id配下にInbox用データベースを新規作成
 * @return {Object} { success, databaseId, error }
 */
function createInboxDatabase() {
  var parentPageId = normalizeNotionId(getProperty(PROP_KEYS.NOTION_PARENT_PAGE_ID));
  if (!parentPageId) {
    return { success: false, databaseId: '', error: 'NOTION_PARENT_PAGE_ID が未設定です' };
  }

  var mapping = getPropertyMapping();

  // プロパティ定義
  var properties = {};

  // タイトルプロパティ（必須）
  properties[mapping.title] = { title: {} };

  // Statusプロパティ（select）
  properties[mapping.status] = {
    select: {
      options: CONFIG.statusOptions.map(function(name) {
        return { name: name };
      })
    }
  };

  // Sourceプロパティ（select）
  properties[mapping.source] = {
    select: {
      options: [{ name: CONFIG.defaultSource }]
    }
  };

  // CapturedAtプロパティ（date）
  properties[mapping.capturedAt] = { date: {} };

  // LineUserIdプロパティ（rich_text）
  properties[mapping.lineUserId] = { rich_text: {} };

  // LineMessageIdプロパティ（rich_text）
  properties[mapping.lineMessageId] = { rich_text: {} };

  // RawTextプロパティ（rich_text）
  properties[mapping.rawText] = { rich_text: {} };

  var result = notionCreateDatabase(parentPageId, CONFIG.defaultDatabaseName, properties);
  if (!result.success) {
    return { success: false, databaseId: '', error: 'DB作成失敗: ' + result.error };
  }

  // 作成したDB IDを保存
  var newDbId = result.data.id;
  setProperty(PROP_KEYS.NOTION_DATABASE_ID, newDbId);
  Logger.log('Notion DB を自動作成しました: ' + newDbId);

  return { success: true, databaseId: newDbId, error: null };
}

// ========================================
// データベース解決（検証 → 必要なら作成）
// ========================================

/**
 * 有効なデータベースIDを取得する（無ければ作成）
 * @return {Object} { success, databaseId, properties, error }
 */
function resolveDatabase() {
  // 既存DBの検証
  var validation = validateNotionDatabase();
  if (validation.valid) {
    return {
      success: true,
      databaseId: validation.databaseId,
      properties: validation.properties,
      error: null
    };
  }

  Logger.log('既存DB検証失敗: ' + validation.error + ' → DB自動作成を試行');

  // DB作成
  var creation = createInboxDatabase();
  if (!creation.success) {
    return { success: false, databaseId: '', properties: null, error: creation.error };
  }

  // 作成したDBを再取得してプロパティを返す
  var recheck = notionGetDatabase(creation.databaseId);
  if (!recheck.success) {
    return {
      success: true,
      databaseId: creation.databaseId,
      properties: null,
      error: null
    };
  }

  return {
    success: true,
    databaseId: creation.databaseId,
    properties: recheck.data.properties || null,
    error: null
  };
}
