/** Electron + CDP UI 回归夹具。只使用项目已有的 Electron。 */
'use strict';
var electron = require('electron');
var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var path = require('path');
var os = require('os');
var fs = require('fs');

var APP_DIR = path.resolve(__dirname, '..', '..');
var requested = process.argv[2] || 'all';
var names = requested === 'all' ? ['teacher', 'sandbox', 'dirty', 'student'] : [requested];
var results = [];
var win = null;
var activeReport = null;

delete process.env.ELECTRON_RUN_AS_NODE;
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'student-warning-ui-')));

function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function evaluate(source) { return win.webContents.executeJavaScript(source, true); }
function load(file) {
  console.log('[ui] load ' + file);
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () { reject(new Error('页面加载超时：' + file)); }, 15000);
    win.webContents.once('did-finish-load', function () { clearTimeout(timer); resolve(); });
    win.loadFile(path.join(APP_DIR, file));
  });
}

function attach(report) {
  var dbg = win.webContents.debugger;
  try { dbg.attach('1.3'); } catch (e) { report.exceptions.push('CDP: ' + e.message); return; }
  dbg.sendCommand('Runtime.enable').catch(function () {});
  dbg.sendCommand('Log.enable').catch(function () {});
  dbg.sendCommand('Page.enable').catch(function () {});
  dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source:
    "window.__UI_ERRORS=[];window.confirm=function(){return true;};window.prompt=function(m,d){return d||'自动填写';};window.alert=function(){};" +
    "window.addEventListener('error',function(e){window.__UI_ERRORS.push(String(e.message||e.error||''));},true);" +
    "window.addEventListener('unhandledrejection',function(e){window.__UI_ERRORS.push(String(e.reason&&e.reason.message||e.reason||''));});"
  }).catch(function () {});
  dbg.on('message', function (event, method, params) {
    var target = activeReport || report;
    if (method === 'Runtime.exceptionThrown') {
      var exceptionText = String((params.exceptionDetails.exception || {}).description || params.exceptionDetails.text || '');
      if (exceptionText) target.exceptions.push(exceptionText);
    }
    if (method === 'Log.entryAdded' && params.entry && params.entry.level === 'error') target.consoleErrors.push(params.entry.text);
  });
}

function check(report, name, ok, actual, expected) {
  report.assertions.push({ name: name, ok: !!ok, actual: actual, expected: expected });
}
function session(role) {
  var value = { role: role, id: role === 'teacher' ? 'T-测试老师' : '2024100101', name: role === 'teacher' ? '测试老师' : '张三', provider: 'demo', expiresAt: Date.now() + 3600000 };
  return evaluate("localStorage.setItem('appSession.v1'," + JSON.stringify(JSON.stringify(value)) + ")");
}
function visible() {
  return evaluate("JSON.stringify(Array.prototype.slice.call(document.querySelectorAll('.tab-panel')).filter(function(p){return getComputedStyle(p).display!=='none';}).map(function(p){return p.id;}).concat(['contentDashboard','contentEmpty'].filter(function(id){var p=document.getElementById(id);return p&&getComputedStyle(p).display!=='none';})))");
}
function clickTab(name) {
  return evaluate("(function(){var b=document.querySelector('.tab-item[data-tab=\"" + name + "\"]');if(!b)return false;b.click();return true;})()");
}
function collectErrors(report) {
  return evaluate("JSON.stringify(window.__UI_ERRORS||[])").then(function (raw) {
    var errors = JSON.parse(raw || '[]');
    for (var i = 0; i < errors.length; i++) { if (String(errors[i] || '').trim()) report.exceptions.push(errors[i]); }
  });
}

function reset(role, file) {
  return load('login.html').then(function () { return evaluate('localStorage.clear()'); }).then(function () { return session(role); }).then(function () { return load(file); }).then(function () { return wait(1200); });
}

function teacher(report) {
  var tabs = ['detail', 'history', 'dashboard', 'knowledge', 'plan', 'checkin', 'kbadmin', 'tickets'];
  return reset('teacher', 'index.html').then(function () {
    var chain = Promise.resolve();
    tabs.forEach(function (tab) {
      chain = chain.then(function () { return clickTab(tab); }).then(function () { return wait(150); }).then(function () { return visible(); }).then(function (raw) {
        var shown = JSON.parse(raw); check(report, '单一视图：' + tab, shown.length === 1, shown, 1);
      });
    });
    return chain.then(function () {
      return evaluate("(function(){var s=document.querySelector('.topbar-nav .nav-item[data-nav=\"settings\"]');var f=document.querySelector('.topbar-nav .nav-item[data-nav=\"flow\"]');if(!s||!f)return 'missing';s.click();f.click();var p=document.getElementById('settingsPanel');return p?getComputedStyle(p).display:'none';})()").then(function (display) {
        check(report, '离开设置后面板关闭', display === 'none', display, 'none');
      });
    });
  }).then(function () { return clickTab('plan'); }).then(function () { return evaluate("(document.getElementById('planContent')||{}).innerText||''"); }).then(function (text) {
    check(report, '未选学生显示帮扶空状态', text.indexOf('请先') !== -1, text, '包含“请先”');
    return collectErrors(report);
  });
}

function sandbox(report) {
  return reset('teacher', 'index.html').then(function () {
    return evaluate("(function(){var keys=['studentWarningStates','studentWarningHistory','warningSnapshots'];window.__BEFORE=keys.map(function(k){return localStorage.getItem(k);});return true;})()");
  }).then(function () { return clickTab('dashboard'); }).then(function () {
    return evaluate("(function(){var keys=['studentWarningStates','studentWarningHistory','warningSnapshots'];return JSON.stringify(keys.map(function(k){return localStorage.getItem(k);})===window.__BEFORE);})()");
  }).then(function () {
    return evaluate("JSON.stringify(['studentWarningStates','studentWarningHistory','warningSnapshots'].map(function(k){return localStorage.getItem(k);}))");
  }).then(function (after) {
    return evaluate('JSON.stringify(window.__BEFORE)').then(function (before) { check(report, '只读渲染不修改预警存储', after === before, after, before); });
  }).then(function () { return collectErrors(report); });
}

function dirty(report) {
  var tabs = ['detail', 'history', 'dashboard', 'knowledge', 'plan', 'checkin', 'kbadmin', 'tickets'];
  return load('login.html').then(function () { return evaluate("(function(){localStorage.clear();var ks=['onboarding.v1.teacher','studentWarningStates','studentWarningHistory','warningSnapshots','wrongBook','flowRuns','kbExtraEntries','agentConfigs','dataAccessLog','supportTickets','warningAppeals','caseBase','campusSignals','campusConsent','campusSignalMeta'];ks.forEach(function(k,i){localStorage.setItem(k,i%2?'abc':'[]');});localStorage.setItem('riskPluginActive','constructor');return true;})()"); }).then(function () { return session('teacher'); }).then(function () { return load('index.html'); }).then(function () { return wait(1200); }).then(function () {
    var chain = Promise.resolve();
    tabs.forEach(function (tab) { chain = chain.then(function () { return clickTab(tab); }).then(function () { return wait(100); }); });
    return chain;
  }).then(function () { return collectErrors(report); });
}

function student(report) {
  return reset('student', 'student.html').then(function () {
    return evaluate("Array.prototype.slice.call(document.querySelectorAll('[data-page],[data-nav]')).length");
  }).then(function (count) { check(report, '学生端已渲染导航', count > 0, count, '> 0'); return collectErrors(report); });
}

var scenarios = { teacher: teacher, sandbox: sandbox, dirty: dirty, student: student };
function runOne(name) {
  var report = { scenario: name, exceptions: [], consoleErrors: [], steps: [], assertions: [] };
  results.push(report);
  activeReport = report;
  console.log('[ui] scenario ' + name);
  if (!scenarios[name]) return Promise.reject(new Error('未知场景：' + name));
  return scenarios[name](report);
}

app.whenReady().then(function () {
  win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(APP_DIR, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false } });
  var report = { exceptions: [], consoleErrors: [] };
  attach(report);
  var chain = Promise.resolve();
  names.forEach(function (name) { chain = chain.then(function () { return runOne(name); }); });
  return chain;
}).then(function () {
  var failures = 0;
  results.forEach(function (r) {
    failures += r.exceptions.length + r.assertions.filter(function (a) { return !a.ok; }).length;
    var assertionFailures = r.assertions.filter(function (a) { return !a.ok; }).length;
    console.log((r.exceptions.length || assertionFailures ? 'FAIL' : 'PASS') + ' ' + r.scenario + ' | assertions=' + r.assertions.length + ' exceptions=' + r.exceptions.length);
    r.assertions.filter(function (a) { return !a.ok; }).forEach(function (a) { console.log('  FAIL ' + a.name + ' actual=' + JSON.stringify(a.actual) + ' expected=' + JSON.stringify(a.expected)); });
    r.exceptions.forEach(function (e) { console.log('  ERROR ' + e); });
  });
  process.exitCode = failures ? 1 : 0;
  app.quit();
}).catch(function (error) { console.error(error && error.stack || error); process.exitCode = 1; app.quit(); });

setTimeout(function () { console.error('UI 回归总超时'); process.exitCode = 1; app.quit(); }, 60000);
