/**
 * エラーログモジュール
 *
 * エラー情報を同一スプレッドシート内のシートに記録する
 */

// ========================================
// ログシート管理
// ========================================

/**
 * コンテナバインドのスプレッドシートを取得
 * UIコンテキスト（onOpen等）では getActiveSpreadsheet() が使える。
 * Webhookコンテキスト（doPost）では使えないので、保存済みIDで openById する。
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet|null}
 */
function getContainerSpreadsheet() {
  // 1. コンテナバインド（UI操作時）
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      // IDを保存しておく（Webhook時用）
      var currentId = getProperty(PROP_KEYS.LOG_SHEET_ID);
      if (currentId !== active.getId()) {
        setProperty(PROP_KEYS.LOG_SHEET_ID, active.getId());
      }
      return active;
    }
  } catch (e) {
    // doPost等のコンテキストでは例外が出る場合がある
  }

  // 2. 保存済みIDから開く（Webhook時）
  var savedId = getProperty(PROP_KEYS.LOG_SHEET_ID);
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {
      Logger.log('保存済みスプレッドシートID無効: ' + e);
    }
  }

  return null;
}

/**
 * ログ用シートを取得または作成（同一スプレッドシート内）
 * @return {GoogleAppsScript.Spreadsheet.Sheet|null}
 */
function getOrCreateLogSheet() {
  try {
    var spreadsheet = getContainerSpreadsheet();
    if (!spreadsheet) {
      Logger.log('スプレッドシートが取得できません。ログシートはUI操作時に初期化してください。');
      return null;
    }

    var sheetName = CONFIG.sheetNames.logs;
    var sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      // ヘッダー行を設定
      sheet.getRange(1, 1, 1, 7).setValues([[
        'タイムスタンプ',
        'レベル',
        '関数名',
        'メッセージID',
        'ユーザーID',
        'エラー内容',
        'ペイロード'
      ]]);
      sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
      sheet.setFrozenRows(1);
      // 列幅を調整
      sheet.setColumnWidth(1, 150);  // タイムスタンプ
      sheet.setColumnWidth(2, 60);   // レベル
      sheet.setColumnWidth(3, 140);  // 関数名
      sheet.setColumnWidth(6, 300);  // エラー内容
      sheet.setColumnWidth(7, 400);  // ペイロード
    }

    return sheet;
  } catch (error) {
    Logger.log('ログシート取得/作成失敗: ' + error);
    return null;
  }
}

// ========================================
// ログ書き込み
// ========================================

/**
 * エラーログをスプレッドシートに記録
 * @param {string} level - ログレベル ('INFO', 'WARN', 'ERROR')
 * @param {string} functionName - 関数名
 * @param {string} errorMessage - エラーメッセージ
 * @param {Object} [context] - 追加コンテキスト { lineMessageId, userId, payload }
 */
function logToSheet(level, functionName, errorMessage, context) {
  try {
    var sheet = getOrCreateLogSheet();
    if (!sheet) {
      Logger.log('[' + level + '] ' + functionName + ': ' + errorMessage);
      return;
    }

    var ctx = context || {};
    var now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    var payloadStr = '';
    if (ctx.payload) {
      try {
        payloadStr = typeof ctx.payload === 'string' ? ctx.payload : JSON.stringify(ctx.payload);
        if (payloadStr.length > 1000) {
          payloadStr = payloadStr.substring(0, 1000) + '...(truncated)';
        }
      } catch (e) {
        payloadStr = '(serialize error)';
      }
    }

    sheet.appendRow([
      now,
      level,
      functionName,
      ctx.lineMessageId || '',
      ctx.userId || '',
      errorMessage,
      payloadStr
    ]);
  } catch (error) {
    Logger.log('ログ書き込み失敗: ' + error);
    Logger.log('[' + level + '] ' + functionName + ': ' + errorMessage);
  }
}

/**
 * INFOレベルのログを記録
 */
function logInfo(functionName, message, context) {
  logToSheet('INFO', functionName, message, context);
}

/**
 * WARNレベルのログを記録
 */
function logWarn(functionName, message, context) {
  logToSheet('WARN', functionName, message, context);
}

/**
 * ERRORレベルのログを記録
 */
function logError(functionName, message, context) {
  logToSheet('ERROR', functionName, message, context);
}

// ========================================
// ログシート初期化（UI用）
// ========================================

/**
 * ログシートを初期化してURLを返す（サイドバー・ウィザード用）
 * @return {Object} { success, sheetId, sheetUrl, error }
 */
function initializeLogSheet() {
  try {
    var sheet = getOrCreateLogSheet();
    if (!sheet) {
      return { success: false, sheetId: '', sheetUrl: '', error: 'ログシート作成失敗' };
    }

    var spreadsheet = sheet.getParent();
    return {
      success: true,
      sheetId: spreadsheet.getId(),
      sheetUrl: spreadsheet.getUrl() + '#gid=' + sheet.getSheetId(),
      error: null
    };
  } catch (error) {
    return { success: false, sheetId: '', sheetUrl: '', error: error.toString() };
  }
}
