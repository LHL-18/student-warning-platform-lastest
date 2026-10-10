/**
 * main.js — Electron 主进程
 * 负责窗口创建、安全策略、单实例锁、窗口状态管理
 */

var app = require('electron').app;
var BrowserWindow = require('electron').BrowserWindow;
var ipcMain = require('electron').ipcMain;
var session = require('electron').session;
var utilityProcess = require('electron').utilityProcess;
var path = require('path');
var fs = require('fs');
var os = require('os');
var fileURLToPath = require('url').fileURLToPath;

function isTrustedLocalUrl(rawUrl) {
  try {
    var targetPath = path.resolve(fileURLToPath(String(rawUrl || '')));
    var appPath = path.resolve(__dirname);
    return targetPath === appPath || targetPath.indexOf(appPath + path.sep) === 0;
  } catch (e) {
    return false;
  }
}

var createWorker = null;
var ocrLoadError = '';
try { createWorker = require('tesseract.js').createWorker; } catch (e) { createWorker = null; ocrLoadError = e.message; console.warn('[main] 本地 OCR 加载失败：' + e.message); }

// 本地 OCR 的自我保护（真正的执行体在 ocrProcess.js 子进程里）：
//   tesseract 初始化会同步阻塞它所在进程的事件循环，所以绝不能在主进程做。
//   这里只保留"熔断"状态：连续失败达到阈值就停用本地 OCR，让前端直接降级。
var OCR_FAIL_LIMIT = 2;
var ocrFailStreak = 0;
var ocrDisabled = false;

function noteOcrFailure(severe) {
  ocrFailStreak++;
  // 初始化阶段就失败（severe）说明这条链路当前不可用，直接熔断
  if (severe || ocrFailStreak >= OCR_FAIL_LIMIT) {
    ocrDisabled = true;
    console.warn('[main] 本地 OCR 本次会话已停用（' + (severe ? '初始化超时' : '连续失败') + '），前端会自动降级到大模型 / Mock');
  }
}

// 单实例锁 — 防止重复启动
var gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

var mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    title: '学业预警帮扶平台',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      // ===== 安全配置 =====
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,     // sandbox:true 与 preload 兼容性因平台而异，暂用 false
      webviewTag: false,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
      // ===== 性能 =====
      spellcheck: false
    }
  });

  // 移除默认菜单（生产环境）
  // 开发时可注释下面这行以保留 DevTools 入口
  mainWindow.setMenuBarVisibility(false);

  // 加载首页：身份选择页（登录后按角色进入教师端 / 学生端）
  mainWindow.loadFile(path.join(__dirname, 'login.html'));
  mainWindow.webContents.on('will-navigate', function (event, url) {
    if (!isTrustedLocalUrl(url)) { event.preventDefault(); console.warn('[main] 已阻止外部导航：' + url); }
  });
  mainWindow.webContents.setWindowOpenHandler(function () { return { action: 'deny' }; });

  // 开发环境：打开 DevTools
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 第二个实例启动时，聚焦已有窗口
app.on('second-instance', function () {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/* ================================================================
 *  权限：允许麦克风（实时语音识别 / ASR 需要）
 * ================================================================ */
function setupPermissions() {
  try {
    function trusted(webContents) {
      var url = webContents && webContents.getURL ? webContents.getURL() : '';
      return isTrustedLocalUrl(url);
    }
    session.defaultSession.setPermissionRequestHandler(function (webContents, permission, callback) {
      if (trusted(webContents) && (permission === 'media' || permission === 'audioCapture')) return callback(true);
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler(function (webContents, permission) {
      if (trusted(webContents) && (permission === 'media' || permission === 'audioCapture')) return true;
      return false;
    });
  } catch (e) {
    console.warn('[main] 权限设置失败：', e.message);
  }
}

/* ================================================================
 *  OCR 图片识别 IPC
 *  渲染进程传入 base64 图片，主进程调用本地 Tesseract.js 识别中文+英文。
 *  首次运行会自动下载 chi_sim / eng 语言包并缓存到用户数据目录。
 * ================================================================ */
/* ================================================================
 *  OCR 图片识别 IPC —— 跑在独立 utilityProcess 里
 *  背景：tesseract.js 的 worker 初始化会同步阻塞所在进程的事件循环（实测 20~30 秒以上），
 *  放在主进程里会导致窗口无响应、IPC 与 DevTools 端点全部超时，而且连 setTimeout 都不触发
 *  （时间片被占满），加超时/熔断也没用。所以把真正干活的代码隔离到 ocrProcess.js。
 *  主进程只负责转发与超时保护，窗口始终可用。
 * ================================================================ */
var ocrProc = null;
var ocrSeq = 0;
var ocrPending = {};
var OCR_CALL_TIMEOUT_MS = 45000;

function sendOcrProgress(progress) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ocr-progress', { progress: progress, status: 'recognizing' });
  }
}

function killOcrProcess() {
  try { if (ocrProc) ocrProc.kill(); } catch (e) {}
  ocrProc = null;
  var ids = Object.keys(ocrPending);
  for (var i = 0; i < ids.length; i++) {
    var p = ocrPending[ids[i]];
    clearTimeout(p.timer);
    p.resolve({ success: false, error: '本地 OCR 进程已退出' });
    delete ocrPending[ids[i]];
  }
}

function startOcrProcess() {
  if (ocrDisabled) return Promise.reject(new Error('本地 OCR 本次会话已停用，已自动降级'));
  if (ocrProc) return Promise.resolve(ocrProc);
  if (!utilityProcess || !createWorker) return Promise.reject(new Error('本地 OCR 不可用'));
  var cachePath = path.join(app.getPath('userData'), 'tessdata');
  try { fs.mkdirSync(cachePath, { recursive: true }); } catch (e) {}
  try {
    ocrProc = utilityProcess.fork(path.join(__dirname, 'ocrProcess.js'), [], { serviceName: 'kindee-ocr' });
  } catch (e) {
    ocrDisabled = true;
    return Promise.reject(new Error('无法启动 OCR 子进程：' + e.message));
  }
  ocrProc.on('message', function (msg) {
    if (!msg) return;
    if (msg.type === 'progress') { sendOcrProgress(msg.progress || 0); return; }
    if (msg.type !== 'result') return;
    var p = ocrPending[msg.id];
    if (!p) return;
    delete ocrPending[msg.id];
    clearTimeout(p.timer);
    if (msg.ok) {
      ocrFailStreak = 0;
      p.resolve({ success: true, text: msg.text || '', confidence: msg.confidence });
    } else {
      noteOcrFailure(false);
      p.resolve({ success: false, error: msg.error || '识别失败' });
    }
  });
  ocrProc.on('exit', function () { killOcrProcess(); });
  try { ocrProc.postMessage({ type: 'init', cachePath: cachePath }); } catch (e) {}
  return Promise.resolve(ocrProc);
}

function ocrRecognize(imageDataUrl, lang) {
  var allowedLang = { chi_sim: true, eng: true, 'chi_sim+eng': true };
  if (!allowedLang[lang]) { console.warn('[main] 非法 OCR 语言参数，已回落默认值'); lang = 'chi_sim+eng'; }
  return startOcrProcess().then(function (proc) {
    return new Promise(function (resolve) {
      var id = ++ocrSeq;
      var timer = setTimeout(function () {
        delete ocrPending[id];
        // 子进程卡死：杀掉重建，本次按失败返回（主进程不受影响）
        killOcrProcess();
        noteOcrFailure(false);
        resolve({ success: false, error: '本地 OCR 超时' });
      }, OCR_CALL_TIMEOUT_MS);
      ocrPending[id] = { resolve: resolve, timer: timer };
      try {
        proc.postMessage({ type: 'recognize', id: id, dataUrl: imageDataUrl, lang: lang || 'chi_sim+eng' });
      } catch (e) {
        clearTimeout(timer);
        delete ocrPending[id];
        resolve({ success: false, error: '本地 OCR 通信失败' });
      }
    });
  }, function (err) {
    return { success: false, error: (err && err.message) || '本地 OCR 不可用' };
  });
}

ipcMain.handle('ocr-image', async function (event, imageDataUrl, options) {
  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return { success: false, error: '缺少图片数据' };
  }
  if (ocrDisabled) {
    return { success: false, error: '本地 OCR 本次会话已停用，已自动降级' };
  }
  var opts = options || {};
  return await ocrRecognize(imageDataUrl, opts.lang);
});

// 查询本地 OCR 是否就绪（未安装 tesseract.js / 已熔断时前端直接走大模型）
ipcMain.handle('ocr-available', function () {
  return { available: !!createWorker && !!utilityProcess && !ocrDisabled, disabled: ocrDisabled, reason: ocrLoadError || (ocrDisabled ? '本次会话已熔断' : '') };
});

ipcMain.handle('app-version', function () { return app.getVersion(); });

app.on('will-quit', function () {
  killOcrProcess();
});

app.whenReady().then(function () {
  setupPermissions();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
