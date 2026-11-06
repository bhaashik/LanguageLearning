/* Deploy in your own Google account. Spreadsheet ID belongs in Script Properties,
 * never in Bhaasa's public configuration. See docs/FEEDBACK.html. */
var FEEDBACK_HEADERS = ['Report ID','Received at (UTC)','Created at (UTC)','App version','Language','Platform','System','Lessons','Constructions','Tracing','TTS','ASR','Offline','Progress','Backups','Ease','Use again','Problems','Optional details'];
var FEEDBACK_FEATURES = ['lessons','constructions','tracing','tts','asr','offline','progress','backups'];

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><title>Bhaasa feedback</title><p>Bhaasa feedback collector. Submit feedback from inside Bhaasa.</p>');
}

function doPost(event) {
  var requestId = '', reportId = '', lock;
  try {
    var raw = event && event.parameter && event.parameter.payload;
    if (typeof raw !== 'string' || raw.length > 16000) throw new Error('invalid_report');
    var envelope;
    try { envelope = JSON.parse(raw); } catch (_) { throw new Error('invalid_report'); }
    if (!envelope || !validFeedbackId(envelope.requestId)) throw new Error('invalid_report');
    requestId = envelope.requestId;
    var report = envelope.report;
    if (report && validFeedbackId(report.id)) reportId = report.id;
    validateFeedbackReport(report);
    var sheetId = PropertiesService.getScriptProperties().getProperty('BHAASA_FEEDBACK_SHEET_ID');
    if (!sheetId) return feedbackReceipt(requestId, reportId, {ok:false,code:'not_configured'});
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return feedbackReceipt(requestId, reportId, {ok:false,code:'busy'});
    var book = SpreadsheetApp.openById(sheetId);
    var sheet = book.getSheetByName('Bhaasa feedback') || book.insertSheet('Bhaasa feedback');
    if (sheet.getLastRow() === 0) { sheet.appendRow(FEEDBACK_HEADERS); sheet.setFrozenRows(1); }
    // IDs are exact matches, not substrings. The lock covers lookup, append and flush.
    var found = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(report.id).matchEntireCell(true).findNext() : null;
    if (found) {
      var previous = sheet.getRange(found.getRow(),2).getValue();
      return feedbackReceipt(requestId,reportId,{ok:true,receivedAt:new Date(previous).toISOString(),duplicate:true});
    }
    var received = new Date().toISOString(), answers = report.answers;
    var row = [report.id,received,new Date(report.createdAt).toISOString(),report.appVersion,report.language,report.platform,report.system];
    FEEDBACK_FEATURES.forEach(function (id) { row.push(answers.features[id]); });
    row.push(answers.ease,answers.again,answers.issues.join(', '),safeFeedbackCell(answers.comment));
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return feedbackReceipt(requestId,reportId,{ok:true,receivedAt:received,duplicate:false});
  } catch (error) {
    var invalid = error && error.message === 'invalid_report';
    // No raw exception, spreadsheet ID, user comment or credentials in the receipt.
    return feedbackReceipt(requestId,reportId,{ok:false,code:invalid?'invalid_report':'write_failed'});
  } finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}

function validFeedbackId(value) { return typeof value === 'string' && /^[a-zA-Z0-9-]{16,80}$/.test(value); }
function validateFeedbackReport(report) {
  function require(value) { if (!value) throw new Error('invalid_report'); }
  function oneOf(value,values) { return values.indexOf(value) !== -1; }
  require(report && validFeedbackId(report.id) && typeof report.createdAt === 'number' && isFinite(report.createdAt) && report.createdAt >= 0 && report.createdAt <= 8640000000000000);
  require(typeof report.appVersion === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(report.appVersion) && report.appVersion.length <= 80);
  require(oneOf(report.language,['ml','fr']) && oneOf(report.platform,['web','android-app','ios-app','desktop']) && oneOf(report.system,['android','ios','linux','windows','macos','other']));
  require(Object.keys(report).every(function(k){return oneOf(k,['id','createdAt','appVersion','language','platform','system','answers']);}));
  var answers = report.answers;
  require(answers && typeof answers === 'object' && answers.features && typeof answers.features === 'object');
  require(Object.keys(answers).every(function(k){return oneOf(k,['features','ease','again','issues','comment']);}));
  require(Object.keys(answers.features).length === FEEDBACK_FEATURES.length && Object.keys(answers.features).every(function(k){return oneOf(k,FEEDBACK_FEATURES);}));
  var tried = false;
  FEEDBACK_FEATURES.forEach(function(id){require(oneOf(answers.features[id],['not_tried','worked','some_problems','did_not_work']));if(answers.features[id] !== 'not_tried')tried=true;});
  require(tried && (report.language !== 'fr' || answers.features.tracing === 'not_tried'));
  require(oneOf(answers.ease,['very_easy','easy','mixed','difficult','very_difficult']) && oneOf(answers.again,['','yes','maybe','no','not_sure']));
  require(Array.isArray(answers.issues) && answers.issues.length <= 11);
  var seen = {};
  answers.issues.forEach(function(id){require(oneOf(id,['crash','slow','audio','microphone','recognition','tracing','saving','content','layout','other','none']) && !seen[id]);seen[id]=true;});
  require(!seen.none || answers.issues.length === 1);
  require(typeof answers.comment === 'string' && answers.comment.length <= 1500);
}
function safeFeedbackCell(value) {
  // Sheets interprets formula-like text. An apostrophe stores the comment as text.
  return /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value;
}
function feedbackReceipt(requestId,reportId,result) {
  var message = {type:'bhaasa-feedback-receipt-v1',requestId:requestId,reportId:reportId,ok:result.ok};
  if (result.ok) { message.receivedAt=result.receivedAt; message.duplicate=result.duplicate===true; }
  else message.code=result.code;
  var json=JSON.stringify(message).replace(/</g,'\\u003c');
  // Apps Script's HtmlService uses a nested frame. Only the nonce-bound receipt
  // travels to the app; the sheet, comment and other responses are never exposed.
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><title>Feedback receipt</title><script>window.top.postMessage('+json+',"*");</script><p>You may return to Bhaasa.</p>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
