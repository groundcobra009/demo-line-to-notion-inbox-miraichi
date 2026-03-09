/**
 * LINE to Notion Inbox - メインコード
 *
 * エントリポイント: doPost（Webhook）、onOpen（メニュー）、UI関数
 */

// ========================================
// Webhook エントリポイント
// ========================================

/**
 * LINE Webhookからのリクエストを受信
 * GASウェブアプリとしてデプロイ時のPOSTエンドポイント
 *
 * 注意: GAS ウェブアプリは初回リクエスト時に 302 リダイレクトを返します。
 * LINE Developers の「検証」ボタンではエラーが表示されますが、
 * 実際のメッセージ配信は正常に動作します。
 *
 * @param {Object} e - イベントオブジェクト
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  // GAS の doPost(e) では HTTP リクエストヘッダーにアクセスできないため、
  // X-Line-Signature による署名検証は行えません。
  // Webhook URL の秘匿性でセキュリティを担保します。

  var bodyString = '';
  try {
    bodyString = e.postData.contents;

    // 受信ログ（トレース用）
    logInfo('doPost', 'Webhook受信', { payload: bodyString });

    // テキスト・画像メッセージイベントを抽出
    var parsed = parseLineEvents(bodyString);

    if (parsed.textEvents.length === 0 && parsed.imageEvents.length === 0) {
      logInfo('doPost', '対応イベントなし（検証pingまたは非対応タイプ）');
      return ContentService.createTextOutput('OK');
    }

    // テキストイベントを処理
    for (var i = 0; i < parsed.textEvents.length; i++) {
      var event = parsed.textEvents[i];
      var result = processInboxItem(event);

      if (result.success) {
        logInfo('doPost', '処理成功: ' + event.text.substring(0, 50), {
          lineMessageId: event.messageId,
          userId: event.userId
        });
      } else {
        logError('doPost', 'Inbox処理失敗: ' + result.error, {
          lineMessageId: event.messageId,
          userId: event.userId,
          payload: { text: event.text.substring(0, 200) }
        });
      }
    }

    // 画像イベントを処理
    for (var j = 0; j < parsed.imageEvents.length; j++) {
      var imgEvent = parsed.imageEvents[j];
      var imgResult = processInboxItem(imgEvent);

      if (imgResult.success) {
        logInfo('doPost', '画像処理成功', {
          lineMessageId: imgEvent.messageId,
          userId: imgEvent.userId
        });
      } else {
        logError('doPost', '画像Inbox処理失敗: ' + imgResult.error, {
          lineMessageId: imgEvent.messageId,
          userId: imgEvent.userId
        });
      }
    }

  } catch (error) {
    logError('doPost', '予期しないエラー: ' + error, { payload: bodyString });
  }

  // LINE Webhookには常に200を返す
  return ContentService.createTextOutput('OK');
}

/**
 * GETリクエストハンドラ（ヘルスチェック用）
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doGet() {
  return ContentService.createTextOutput('LINE to Notion Inbox is running.');
}

// ========================================
// メニュー・UI
// ========================================

/**
 * スプレッドシート起動時にカスタムメニューを追加
 * 初期設定が未完了の場合はセットアップウィザードを自動表示
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();

  ui.createMenu('LINE to Notion')
    .addItem('サイドバーを表示', 'showSidebar')
    .addSeparator()
    .addItem('初期設定ウィザード', 'showSetupWizard')
    .addItem('設定変更', 'showSettingsDialog')
    .addSeparator()
    .addItem('ヘルプ', 'showHelpDialog')
    .addToUi();

  // 初期設定が未完了の場合、ウィザードを自動表示
  if (!isSetupComplete()) {
    showSetupWizard();
  }
}

/**
 * 初期設定が完了しているかチェック
 * @return {boolean}
 */
function isSetupComplete() {
  return getProperty(PROP_KEYS.SETUP_COMPLETE) === 'true';
}

/**
 * サイドバーを表示
 */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('ui/Sidebar')
    .setTitle('LINE to Notion Inbox');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 初期設定ウィザードをモーダルダイアログで表示
 */
function showSetupWizard() {
  var html = HtmlService.createHtmlOutputFromFile('ui/dialogs/SetupWizard')
    .setWidth(520)
    .setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, '初期設定ウィザード');
}

/**
 * 設定ダイアログを表示
 */
function showSettingsDialog() {
  var html = HtmlService.createHtmlOutputFromFile('ui/dialogs/SettingsDialog')
    .setWidth(500)
    .setHeight(550);
  SpreadsheetApp.getUi().showModalDialog(html, '設定変更');
}

/**
 * ヘルプダイアログを表示
 */
function showHelpDialog() {
  var html = HtmlService.createHtmlOutputFromFile('ui/dialogs/HelpDialog')
    .setWidth(480)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'ヘルプ');
}

// ========================================
// セットアップウィザード サーバー側関数
// ========================================

/**
 * 初期設定を保存する（ウィザードから呼び出される）
 * @param {Object} settings - 設定オブジェクト
 * @return {Object} { success, error }
 */
function saveInitialSetup(settings) {
  try {
    var props = PropertiesService.getScriptProperties();

    // 必須設定
    if (settings.notionToken) {
      props.setProperty(PROP_KEYS.NOTION_TOKEN, settings.notionToken);
    }
    if (settings.lineChannelSecret) {
      props.setProperty(PROP_KEYS.LINE_CHANNEL_SECRET, settings.lineChannelSecret);
    }

    // Notion DB設定（IDをUUID形式に正規化して保存）
    if (settings.notionDatabaseId) {
      props.setProperty(PROP_KEYS.NOTION_DATABASE_ID, normalizeNotionId(settings.notionDatabaseId));
    }
    if (settings.notionParentPageId) {
      props.setProperty(PROP_KEYS.NOTION_PARENT_PAGE_ID, normalizeNotionId(settings.notionParentPageId));
    }

    // LINE Access Token（任意）
    if (settings.lineAccessToken) {
      props.setProperty(PROP_KEYS.LINE_ACCESS_TOKEN, settings.lineAccessToken);
    }

    // タイトルプロパティ名
    if (settings.titlePropName) {
      props.setProperty(PROP_KEYS.PROP_TITLE_NAME, settings.titlePropName);
    }

    // オプションプロパティ名マッピング
    if (settings.statusPropName) {
      props.setProperty(PROP_KEYS.PROP_STATUS_NAME, settings.statusPropName);
    }
    if (settings.sourcePropName) {
      props.setProperty(PROP_KEYS.PROP_SOURCE_NAME, settings.sourcePropName);
    }
    if (settings.capturedAtPropName) {
      props.setProperty(PROP_KEYS.PROP_CAPTURED_AT_NAME, settings.capturedAtPropName);
    }
    if (settings.lineUserIdPropName) {
      props.setProperty(PROP_KEYS.PROP_LINE_USER_ID_NAME, settings.lineUserIdPropName);
    }
    if (settings.lineMessageIdPropName) {
      props.setProperty(PROP_KEYS.PROP_LINE_MESSAGE_ID_NAME, settings.lineMessageIdPropName);
    }
    if (settings.rawTextPropName) {
      props.setProperty(PROP_KEYS.PROP_RAW_TEXT_NAME, settings.rawTextPropName);
    }

    // ログシート初期化
    initializeLogSheet();

    props.setProperty(PROP_KEYS.SETUP_COMPLETE, 'true');

    logInfo('saveInitialSetup', '初期設定完了');
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * 個別の設定を更新する（設定ダイアログから呼び出される）
 * @param {string} key - PROP_KEYSのキー名
 * @param {string} value - 新しい値
 * @return {Object} { success, error }
 */
function updateSetting(key, value) {
  try {
    if (!PROP_KEYS[key]) {
      return { success: false, error: '無効な設定キー: ' + key };
    }
    setProperty(PROP_KEYS[key], value);
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Notion接続テスト（ウィザードから呼び出される）
 * @param {string} token - Notionトークン
 * @param {string} databaseId - データベースID（空可）
 * @return {Object} { success, message, dbTitle }
 */
function testNotionConnection(token, databaseId) {
  try {
    // 一時的にトークンを使ってテスト
    var originalToken = getProperty(PROP_KEYS.NOTION_TOKEN);
    setProperty(PROP_KEYS.NOTION_TOKEN, token);

    if (databaseId) {
      var result = notionGetDatabase(normalizeNotionId(databaseId));
      // トークンを元に戻す
      if (originalToken) {
        setProperty(PROP_KEYS.NOTION_TOKEN, originalToken);
      }

      if (result.success) {
        var dbTitle = '';
        if (result.data.title && result.data.title.length > 0) {
          dbTitle = result.data.title[0].plain_text || '';
        }
        return { success: true, message: 'DB接続成功', dbTitle: dbTitle };
      } else {
        return { success: false, message: 'DB接続失敗: ' + result.error, dbTitle: '' };
      }
    } else {
      // DBなしの場合、ユーザー情報取得で接続テスト
      var userResult = notionRequest('/users/me', 'get');
      if (originalToken) {
        setProperty(PROP_KEYS.NOTION_TOKEN, originalToken);
      }

      if (userResult.success) {
        return { success: true, message: 'API接続成功', dbTitle: '' };
      } else {
        return { success: false, message: 'API接続失敗: ' + userResult.error, dbTitle: '' };
      }
    }
  } catch (error) {
    return { success: false, message: 'テスト失敗: ' + error, dbTitle: '' };
  }
}

/**
 * 設定リセット（全プロパティをクリア）
 * @return {Object} { success, error }
 */
function resetAllSettings() {
  try {
    PropertiesService.getScriptProperties().deleteAllProperties();
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// ========================================
// データベース接続テスト・作成
// ========================================

/**
 * データベース接続テスト（ウィザードから呼び出される）
 * 既存DBへの接続を検証する
 * @param {string} token - Notionトークン（空なら保存済みを使用）
 * @param {string} databaseId - データベースID
 * @return {Object} { success, message, dbTitle }
 */
function testDatabaseConnection(token, databaseId) {
  try {
    var originalToken = getProperty(PROP_KEYS.NOTION_TOKEN);
    if (token) {
      setProperty(PROP_KEYS.NOTION_TOKEN, token);
    }

    var normalizedId = normalizeNotionId(databaseId);
    var result = notionGetDatabase(normalizedId);

    // トークンを元に戻す
    if (token && originalToken) {
      setProperty(PROP_KEYS.NOTION_TOKEN, originalToken);
    }

    if (result.success) {
      var dbTitle = '';
      if (result.data.title && result.data.title.length > 0) {
        dbTitle = result.data.title[0].plain_text || '';
      }
      return { success: true, message: 'データベース接続成功: 「' + dbTitle + '」', dbTitle: dbTitle };
    } else {
      return { success: false, message: 'データベース接続失敗: ' + result.error, dbTitle: '' };
    }
  } catch (error) {
    return { success: false, message: 'テスト失敗: ' + error, dbTitle: '' };
  }
}

/**
 * 親ページへの接続テスト（ウィザードから呼び出される）
 * 親ページにアクセスできるか検証する
 * @param {string} token - Notionトークン
 * @param {string} parentPageId - 親ページID
 * @return {Object} { success, message }
 */
function testParentPageConnection(token, parentPageId) {
  try {
    var originalToken = getProperty(PROP_KEYS.NOTION_TOKEN);
    if (token) {
      setProperty(PROP_KEYS.NOTION_TOKEN, token);
    }

    var normalizedId = normalizeNotionId(parentPageId);
    var result = notionRequest('/pages/' + normalizedId, 'get');

    if (token && originalToken) {
      setProperty(PROP_KEYS.NOTION_TOKEN, originalToken);
    }

    if (result.success) {
      var pageTitle = '';
      var props = result.data.properties || {};
      for (var key in props) {
        if (props[key].type === 'title' && props[key].title && props[key].title.length > 0) {
          pageTitle = props[key].title[0].plain_text || '';
          break;
        }
      }
      return { success: true, message: '親ページ接続成功' + (pageTitle ? ': 「' + pageTitle + '」' : '') };
    } else {
      return { success: false, message: '親ページ接続失敗: ' + result.error };
    }
  } catch (error) {
    return { success: false, message: 'テスト失敗: ' + error };
  }
}

/**
 * ウィザードからDB自動作成を実行（結果をUIに返す）
 * @param {string} token - Notionトークン
 * @param {string} parentPageId - 親ページID
 * @return {Object} { success, message, databaseId }
 */
function createDatabaseFromWizard(token, parentPageId) {
  try {
    // トークンと親ページIDを一時的にセット
    var originalToken = getProperty(PROP_KEYS.NOTION_TOKEN);
    if (token) {
      setProperty(PROP_KEYS.NOTION_TOKEN, token);
    }
    setProperty(PROP_KEYS.NOTION_PARENT_PAGE_ID, normalizeNotionId(parentPageId));

    var result = createInboxDatabase();

    // トークンを元に戻す（まだ最終保存前）
    if (token && originalToken) {
      setProperty(PROP_KEYS.NOTION_TOKEN, originalToken);
    }

    if (result.success) {
      return {
        success: true,
        message: 'データベースを作成しました！ ID: ' + result.databaseId,
        databaseId: result.databaseId
      };
    } else {
      return { success: false, message: 'データベース作成失敗: ' + result.error, databaseId: '' };
    }
  } catch (error) {
    return { success: false, message: 'エラー: ' + error, databaseId: '' };
  }
}

// ========================================
// テスト用関数
// ========================================

/**
 * doPostのテスト用関数
 * LINEからのWebhookをシミュレート
 */
function testDoPost() {
  var testBody = JSON.stringify({
    events: [
      {
        type: 'message',
        message: {
          id: 'test-' + new Date().getTime(),
          type: 'text',
          text: 'テスト投稿 from GAS'
        },
        source: {
          userId: 'test-user-001'
        },
        timestamp: new Date().getTime(),
        replyToken: ''
      }
    ]
  });

  var e = {
    postData: {
      contents: testBody,
      headers: {}
    },
    parameter: {}
  };

  var result = doPost(e);
  Logger.log('テスト結果: ' + result.getContent());
}
