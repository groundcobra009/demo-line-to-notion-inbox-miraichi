/**
 * プロジェクト設定ファイル
 *
 * LINE to Notion Inbox の全設定を一元管理
 */

// ========================================
// 基本設定
// ========================================

const CONFIG = {
  appName: 'LINE to Notion Inbox',
  version: '1.0.0',

  // ログシート名
  sheetNames: {
    logs: 'ErrorLog'
  },

  // Notion DB自動作成時のデフォルト名
  defaultDatabaseName: 'LINE Inbox',

  // Notion DBプロパティ名のデフォルトマッピング
  defaultPropertyMapping: {
    title: 'Name',
    status: 'Status',
    source: 'Source',
    capturedAt: 'CapturedAt',
    lineUserId: 'LineUserId',
    lineMessageId: 'LineMessageId',
    rawText: 'RawText'
  },

  // Statusプロパティのデフォルト選択肢
  statusOptions: ['Inbox', 'Processing', 'Done'],

  // Sourceプロパティのデフォルト値
  defaultSource: 'LINE',

  // Notion APIエンドポイント
  notionApiBase: 'https://api.notion.com/v1',
  notionApiVersion: '2022-06-28',

  // Nameプロパティの最大文字数（Notionタイトル制限）
  titleMaxLength: 2000
};

// ========================================
// スクリプトプロパティ キー定数
// ========================================

const PROP_KEYS = {
  SETUP_COMPLETE: 'SETUP_COMPLETE',
  NOTION_TOKEN: 'NOTION_TOKEN',
  NOTION_DATABASE_ID: 'NOTION_DATABASE_ID',
  NOTION_PARENT_PAGE_ID: 'NOTION_PARENT_PAGE_ID',
  LINE_CHANNEL_SECRET: 'LINE_CHANNEL_SECRET',
  LINE_ACCESS_TOKEN: 'LINE_ACCESS_TOKEN',
  PROP_TITLE_NAME: 'PROP_TITLE_NAME',
  PROP_STATUS_NAME: 'PROP_STATUS_NAME',
  PROP_SOURCE_NAME: 'PROP_SOURCE_NAME',
  PROP_CAPTURED_AT_NAME: 'PROP_CAPTURED_AT_NAME',
  PROP_LINE_USER_ID_NAME: 'PROP_LINE_USER_ID_NAME',
  PROP_LINE_MESSAGE_ID_NAME: 'PROP_LINE_MESSAGE_ID_NAME',
  PROP_RAW_TEXT_NAME: 'PROP_RAW_TEXT_NAME',
  LOG_SHEET_ID: 'LOG_SHEET_ID'
};

// ========================================
// Notion ID 正規化
// ========================================

/**
 * Notion ID をUUID形式（8-4-4-4-12）に正規化する
 * ハイフンなし32文字、ハイフン付き36文字、どちらも受け付ける
 * @param {string} id - Notion ID（32文字 or UUID形式）
 * @return {string} UUID形式のID。不正な場合はそのまま返す
 */
function normalizeNotionId(id) {
  if (!id) return '';
  // 前後の空白を除去
  id = id.trim();
  // 既にハイフン付きUUID形式の場合はそのまま返す
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  // ハイフンなし32文字の場合、UUID形式に変換
  var hex = id.replace(/-/g, '');
  if (/^[0-9a-f]{32}$/i.test(hex)) {
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }
  // それ以外はそのまま返す（APIがエラーを返す）
  return id;
}

// ========================================
// プロパティ取得ヘルパー
// ========================================

/**
 * スクリプトプロパティを取得
 * @param {string} key - プロパティキー
 * @param {string} [defaultValue=''] - デフォルト値
 * @return {string}
 */
function getProperty(key, defaultValue) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value !== null ? value : (defaultValue !== undefined ? defaultValue : '');
}

/**
 * スクリプトプロパティを設定
 * @param {string} key - プロパティキー
 * @param {string} value - 値
 */
function setProperty(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

/**
 * タイトルプロパティ名を取得（設定済みならそれを、未設定ならデフォルトを返す）
 * @return {string}
 */
function getTitlePropertyName() {
  return getProperty(PROP_KEYS.PROP_TITLE_NAME, CONFIG.defaultPropertyMapping.title);
}

/**
 * プロパティ名マッピングを取得
 * 設定されていればその値、されていなければデフォルト値を返す
 * @return {Object}
 */
function getPropertyMapping() {
  return {
    title: getProperty(PROP_KEYS.PROP_TITLE_NAME, CONFIG.defaultPropertyMapping.title),
    status: getProperty(PROP_KEYS.PROP_STATUS_NAME, CONFIG.defaultPropertyMapping.status),
    source: getProperty(PROP_KEYS.PROP_SOURCE_NAME, CONFIG.defaultPropertyMapping.source),
    capturedAt: getProperty(PROP_KEYS.PROP_CAPTURED_AT_NAME, CONFIG.defaultPropertyMapping.capturedAt),
    lineUserId: getProperty(PROP_KEYS.PROP_LINE_USER_ID_NAME, CONFIG.defaultPropertyMapping.lineUserId),
    lineMessageId: getProperty(PROP_KEYS.PROP_LINE_MESSAGE_ID_NAME, CONFIG.defaultPropertyMapping.lineMessageId),
    rawText: getProperty(PROP_KEYS.PROP_RAW_TEXT_NAME, CONFIG.defaultPropertyMapping.rawText)
  };
}

/**
 * 全設定を取得（UI表示用）
 * @return {Object}
 */
function getAllSettings() {
  var props = PropertiesService.getScriptProperties().getProperties();
  return {
    notionToken: props[PROP_KEYS.NOTION_TOKEN] ? '****' + props[PROP_KEYS.NOTION_TOKEN].slice(-4) : '',
    notionDatabaseId: props[PROP_KEYS.NOTION_DATABASE_ID] || '',
    notionParentPageId: props[PROP_KEYS.NOTION_PARENT_PAGE_ID] || '',
    lineChannelSecret: props[PROP_KEYS.LINE_CHANNEL_SECRET] ? '****' + props[PROP_KEYS.LINE_CHANNEL_SECRET].slice(-4) : '',
    lineAccessToken: props[PROP_KEYS.LINE_ACCESS_TOKEN] ? '****' + props[PROP_KEYS.LINE_ACCESS_TOKEN].slice(-4) : '',
    titlePropName: props[PROP_KEYS.PROP_TITLE_NAME] || CONFIG.defaultPropertyMapping.title,
    statusPropName: props[PROP_KEYS.PROP_STATUS_NAME] || CONFIG.defaultPropertyMapping.status,
    sourcePropName: props[PROP_KEYS.PROP_SOURCE_NAME] || CONFIG.defaultPropertyMapping.source,
    capturedAtPropName: props[PROP_KEYS.PROP_CAPTURED_AT_NAME] || CONFIG.defaultPropertyMapping.capturedAt,
    lineUserIdPropName: props[PROP_KEYS.PROP_LINE_USER_ID_NAME] || CONFIG.defaultPropertyMapping.lineUserId,
    lineMessageIdPropName: props[PROP_KEYS.PROP_LINE_MESSAGE_ID_NAME] || CONFIG.defaultPropertyMapping.lineMessageId,
    rawTextPropName: props[PROP_KEYS.PROP_RAW_TEXT_NAME] || CONFIG.defaultPropertyMapping.rawText,
    setupComplete: props[PROP_KEYS.SETUP_COMPLETE] === 'true',
    logSheetId: props[PROP_KEYS.LOG_SHEET_ID] || ''
  };
}
