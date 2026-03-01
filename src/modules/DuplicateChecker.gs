/**
 * 重複排除モジュール
 *
 * LineMessageIdを使ってNotion DB内の重複を検出する
 */

// ========================================
// 重複チェック
// ========================================

/**
 * 指定したメッセージIDが既にNotion DBに存在するか確認
 * @param {string} databaseId - データベースID
 * @param {string} messageId - LINE messageId
 * @param {Object} optionalProps - checkOptionalProperties()の結果
 * @return {boolean} 存在する場合true
 */
function isDuplicate(databaseId, messageId, optionalProps) {
  // LineMessageIdプロパティが無い場合は重複チェック不可
  if (!optionalProps || !optionalProps.lineMessageId) {
    Logger.log('LineMessageIdプロパティが無いため重複チェックをスキップ');
    return false;
  }

  var mapping = getPropertyMapping();
  var filter = {
    property: mapping.lineMessageId,
    rich_text: {
      equals: messageId
    }
  };

  try {
    var result = notionQueryDatabase(databaseId, filter, 1);
    if (!result.success) {
      Logger.log('重複チェッククエリ失敗: ' + result.error);
      return false;
    }

    var results = result.data.results || [];
    return results.length > 0;
  } catch (error) {
    Logger.log('重複チェック例外: ' + error);
    return false;
  }
}
