/**
 * ocrProcess.js — 本地 OCR 的独立执行进程（Electron utilityProcess）
 * ---------------------------------------------------------------
 * 为什么要单独起一个进程：
 *   tesseract.js 的 worker 初始化会**同步阻塞所在进程的事件循环**（实测 20~30 秒以上），
 *   而它原来跑在主进程里，结果就是窗口无响应、IPC 与 DevTools 端点全部超时，
 *   连 setTimeout 都不会触发（时间片都被占满）——加超时/熔断都救不了。
 *   把它隔离到 utilityProcess 后，卡住的只是这个子进程，主进程与窗口始终可用。
 *
 * 协议（与 main.js 通过 process.parentPort 通信）：
 *   主 → 子：{ type:'init', cachePath }            预热/告知语言包缓存目录
 *            { type:'recognize', id, dataUrl, lang } 识别一张图
 *   子 → 主：{ type:'progress', progress }          识别进度
 *            { type:'result', id, ok, text, confidence, error }
 */
var path = require('path');
var fs = require('fs');
var os = require('os');

var createWorker = null;
try { createWorker = require('tesseract.js').createWorker; } catch (e) { createWorker = null; }

var worker = null;
var workerLang = null;
var workerPromise = null;
var cachePath = null;

function post(msg) {
  try { process.parentPort.postMessage(msg); } catch (e) {}
}

function getWorker(lang) {
  if (worker && workerLang === lang) return Promise.resolve(worker);
  if (workerPromise) return workerPromise;
  if (!createWorker) return Promise.reject(new Error('未安装 tesseract.js'));
  workerPromise = createWorker(lang || 'chi_sim+eng', 1, {
    cachePath: cachePath,
    logger: function (m) {
      if (m && m.status === 'recognizing text') {
        post({ type: 'progress', progress: Math.round((m.progress || 0) * 100) });
      }
    }
  }).then(function (w) {
    worker = w;
    workerLang = lang;
    workerPromise = null;
    return w;
  }).catch(function (err) {
    workerPromise = null;
    throw err;
  });
  return workerPromise;
}

function recognize(msg) {
  var tmpPath = null;
  getWorker(msg.lang || 'chi_sim+eng').then(function (w) {
    var base64 = String(msg.dataUrl || '').replace(/^data:image\/\w+;base64,/, '');
    tmpPath = path.join(os.tmpdir(), 'ocr_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.png');
    fs.writeFileSync(tmpPath, base64, 'base64');
    return w.recognize(tmpPath);
  }).then(function (result) {
    var data = (result && result.data) || {};
    post({
      type: 'result', id: msg.id, ok: true,
      text: data.text || '',
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
      confidenceAvailable: typeof data.confidence === 'number'
    });
  }).catch(function (err) {
    post({ type: 'result', id: msg.id, ok: false, error: (err && err.message) || '识别失败' });
  }).then(function () {
    if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch (e) {} }
  });
}

process.parentPort.on('message', function (e) {
  var msg = e && e.data;
  if (!msg) return;
  if (msg.type === 'init') { cachePath = msg.cachePath; return; }
  if (msg.type === 'recognize') { recognize(msg); return; }
});
