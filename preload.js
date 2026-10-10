/**
 * preload.js — 安全桥接层
 * 通过 contextBridge 暴露有限的 Node.js 能力给渲染进程，
 * 避免开启 nodeIntegration 带来的安全风险。
 */

var contextBridge = require('electron').contextBridge;
var ipcRenderer = require('electron').ipcRenderer;
var fs = require('fs');
var path = require('path');
var os = require('os');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * OCR 图片识别（本地 Tesseract.js）
   * @param {string} imageDataUrl — base64 图片数据
   * @param {{lang?:string}} [options] — 识别语言，默认 chi_sim+eng
   * @returns {Promise<{success: boolean, text?: string, confidence?: number, error?: string}>}
   */
  ocrImage: function (imageDataUrl, options) {
    return ipcRenderer.invoke('ocr-image', imageDataUrl, options || {});
  },

  /**
   * 查询本地 OCR 引擎是否可用
   * @returns {Promise<{available: boolean, lang: string|null}>}
   */
  ocrAvailable: function () {
    return ipcRenderer.invoke('ocr-available');
  },

  /**
   * 监听 OCR 进度
   * @param {function} callback — ({progress: number, status: string}) => void
   */
  onOcrProgress: function (callback) {
    var listener = function (event, data) {
      callback(data);
    };
    ipcRenderer.on('ocr-progress', listener);
    return function () { ipcRenderer.removeListener('ocr-progress', listener); };
  },

  /**
   * 导出结果为文本文件到桌面
   * @param {string} content — 要保存的文本内容
   * @returns {Promise<{success: boolean, filePath: string, error: string}>}
   */
  exportToFile: function (content) {
    return new Promise(function (resolve) {
      try {
        content = String(content || '');
        if (content.length > 500000) return resolve({ success: false, error: '导出内容超过 500KB' });
        var now = new Date();
        var timestamp = '' + now.getFullYear() +
          pad(now.getMonth() + 1) +
          pad(now.getDate()) + '_' +
          pad(now.getHours()) +
          pad(now.getMinutes()) +
          pad(now.getSeconds());
        var filename = '学业帮扶报告_' + timestamp + '.txt';
        var desktopPath = path.join(os.homedir(), 'Desktop', filename);
        var targetPath = desktopPath;
        try { fs.mkdirSync(path.dirname(targetPath), { recursive: true }); } catch (ignore) {}
        try { fs.writeFileSync(targetPath, content, 'utf-8'); }
        catch (writeError) {
          targetPath = path.join(os.homedir(), 'Documents', filename);
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, content, 'utf-8');
        }
        resolve({ success: true, filePath: targetPath });
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  },

  /**
   * 获取应用版本号
   */
  getAppVersion: function () {
    return ipcRenderer.invoke('app-version');
  }
});

// 辅助：补零
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}
