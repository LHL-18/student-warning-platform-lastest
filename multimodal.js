/**
 * multimodal.js — 多模态能力层
 * ---------------------------------------------------------------
 * 统一封装 OCR（文字识别）、ASR（语音转文字）、拍照答疑、文档解析。
 *
 * 设计原则：真实能力优先，失败自动降级到 Mock，保证课堂/答辩演示永不中断。
 *
 *  · OCR 级联：本地 Tesseract（免费离线）→ 多模态大模型 VLM → Mock
 *  · ASR     ：浏览器实时听写 / 音频文件走大模型 ASR → Mock
 *  · 答疑    ：OCR → 知识库 RAG → 多模态大模型解题 → Mock
 *  · 文档    ：txt/md/csv/json/xlsx 真实解析 + 文本分块
 *
 * 依赖（均可用 window 全局访问，缺失时自动降级）：
 *   CONFIG（config.js）           —— 读取 CONFIG.multimodal / CONFIG.real
 *   knowledgeBase（knowledge.js） —— 错题答疑的知识库检索
 *   XLSX（xlsx.full.min.js）      —— Excel 解析
 *   electronAPI（preload.js）     —— 本地 Tesseract OCR
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  /* ================================================================
   *  配置
   * ================================================================ */

  var DEFAULTS = {
    ocrEngine: 'auto',        // auto | tesseract | vlm | mock
    asrEngine: 'auto',        // auto | webspeech | vlm | mock
    vlmEngine: 'auto',        // auto | real | mock
    vlmModel: 'qwen-vl-plus',
    asrModel: 'qwen3-asr-flash',
    chatUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKey: '',
    tesseractLang: 'chi_sim+eng',
    minOcrConfidence: 55,     // 本地 OCR 置信度低于该值时升级到 VLM
    minOcrChars: 4,           // 本地 OCR 结果过短时升级到 VLM
    enableMockFallback: true, // 真实能力全部失败时是否回落到 Mock
    maxImageSide: 1280        // 上传图片压缩后的最长边
  };

  var runtime = {};

  function cfg() {
    var base = {};
    var k;
    for (k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) base[k] = DEFAULTS[k]; }
    var ext = global.CONFIG || {};
    if (ext.real) {
      // 兼容旧配置：chatUrl / apiKey 原先放在 CONFIG.real 下
      if (!base.chatUrl && ext.real.chatUrl) base.chatUrl = ext.real.chatUrl;
      if (!base.apiKey && ext.real.apiKey) base.apiKey = ext.real.apiKey;
    }
    if (ext.multimodal) {
      for (k in ext.multimodal) {
        if (ext.multimodal.hasOwnProperty(k) && ext.multimodal[k] !== undefined && ext.multimodal[k] !== null) {
          base[k] = ext.multimodal[k];
        }
      }
    }
    // 仍为空时按传统字段兜底
    if (!base.chatUrl && ext.real && ext.real.chatUrl) base.chatUrl = ext.real.chatUrl;
    if (!base.apiKey && ext.real && ext.real.apiKey) base.apiKey = ext.real.apiKey;
    for (k in runtime) { if (runtime.hasOwnProperty(k)) base[k] = runtime[k]; }
    return base;
  }

  function setConfig(patch) {
    if (!patch) return cfg();
    for (var k in patch) { if (patch.hasOwnProperty(k)) runtime[k] = patch[k]; }
    return cfg();
  }

  function hasElectronOCR() {
    return !!(global.electronAPI && typeof global.electronAPI.ocrImage === 'function');
  }

  function vlmEnabled() {
    var c = cfg();
    return c.vlmEngine !== 'mock' && !!c.apiKey && !!c.chatUrl;
  }

  function noop() {}

  /* ================================================================
   *  通用工具
   * ================================================================ */

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsDataURL(file);
    });
  }

  /** 压缩图片，避免 localStorage 和接口体积过大 */
  function downscaleImage(dataUrl, maxSide, quality) {
    return new Promise(function (resolve) {
      try {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          var scale = Math.min(1, maxSide / Math.max(w, h));
          if (scale >= 1) { resolve(dataUrl); return; }
          var canvas = document.createElement('canvas');
          canvas.width = Math.round(w * scale);
          canvas.height = Math.round(h * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          try { resolve(canvas.toDataURL('image/jpeg', quality || 0.82)); }
          catch (e) { resolve(dataUrl); }
        };
        img.onerror = function () { resolve(dataUrl); };
        img.src = dataUrl;
      } catch (e) { resolve(dataUrl); }
    });
  }

  function esc(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function textToHtml(text) {
    return esc(text).replace(/\n/g, '<br>');
  }

  /** 中文友好：按字符取 n-gram 重叠度 0~1 */
  function bigramOverlap(a, b) {
    if (!a || !b) return 0;
    var grams = {}, i, g, hit = 0, total = 0;
    for (i = 0; i < a.length - 1; i++) grams[a.substr(i, 2)] = true;
    for (i = 0; i < b.length - 1; i++) {
      g = b.substr(i, 2);
      total++;
      if (grams[g]) hit++;
    }
    return total ? hit / total : 0;
  }

  /* ================================================================
   *  大模型调用（DashScope OpenAI 兼容模式）
   * ================================================================ */

  function chatCompletion(messages, opts) {
    opts = opts || {};
    var c = cfg();
    if (!c.apiKey || !c.chatUrl) return Promise.resolve(null);
    if (c.vlmEngine === 'mock') return Promise.resolve(null);
    if (opts.model !== c.asrModel && !vlmEnabled()) return Promise.resolve(null);
    var body = {
      model: opts.model || c.vlmModel,
      messages: messages,
      temperature: opts.temperature === undefined ? 0.3 : opts.temperature
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { try { controller.abort(); } catch (e) {} }, 60000) : null;
    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    return fetch(c.chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.apiKey },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    }).then(function (r) {
      clearTimer();
      if (!r.ok) {
        return r.text().then(function (t) { throw new Error('接口返回 HTTP ' + r.status + '：' + String(t).slice(0, 200)); });
      }
      return r.json();
    }).then(function (d) {
      if (!d) return null;
      if (d.error) { console.warn('[MM] 接口返回错误：', d.error.message || d.error); return null; }
      var content = d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : null;
      if (Array.isArray(content)) content = content.map(function (p) { return p && p.text ? p.text : ''; }).join('');
      if (typeof content === 'string' && content.trim()) return content.trim();
      if (d.output && d.output.text) return d.output.text;
      if (typeof d.text === 'string' && d.text.trim()) return d.text.trim();
      return null;
    }).catch(function (err) {
      clearTimer();
      console.warn('[MM] 请求失败：', err && err.message);
      return null;
    });
  }

  function vlmMessages(imageDataUrl, prompt) {
    return [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: imageDataUrl } },
      { type: 'text', text: prompt }
    ] }];
  }

  /* ================================================================
   *  Mock 兜底数据
   * ================================================================ */

  var MOCK = {
    ocrText: '高数第三章习题第 5 题：求函数 f(x)=x³-3x²+2 的极值点与极值。\n' +
      '第 6 题：计算定积分 ∫(0,π) sin²x dx。\n' +
      '（当前为模拟识别结果：未检测到可用的 OCR 引擎或网络）',
    asrText: '老师您好，我在做高数作业时遇到几个问题。第一个是关于极限的证明题，不太会用 ε-δ 语言去证明；' +
      '第二个是复合函数求导时，总是搞混链式法则的顺序。希望老师能帮我讲解一下。',
    solve: {
      title: '高数 · 导数与极值',
      answer: '1. 求导：f′(x)=3x²-6x=3x(x-2)，令 f′(x)=0 得驻点 x=0、x=2。\n' +
        '2. 二阶导判定：f″(x)=6x-6。f″(0)=-6<0，故 x=0 为极大值点；f″(2)=6>0，故 x=2 为极小值点。\n' +
        '3. 极值：f(0)=2（极大值），f(2)=2-12+8=-2（极小值）。\n' +
        '4. 易错点：不要只靠 f′(x)=0 判断极值，必须用二阶导或单调性符号变化确认。'
    }
  };

  /* ================================================================
   *  OCR —— 本地 Tesseract → VLM 级联
   * ================================================================ */

  var ocrProgressHandler = null;

  function bindElectronProgress() {
    if (ocrProgressHandler || !global.electronAPI || typeof global.electronAPI.onOcrProgress !== 'function') return;
    ocrProgressHandler = function (data) { emitOcr({ phase: 'tesseract', progress: data.progress || 0, status: '本地识别中…' }); };
    global.electronAPI.onOcrProgress(ocrProgressHandler);
  }

  var currentOcrEmit = noop;

  function emitOcr(info) { try { currentOcrEmit(info); } catch (e) {} }

  function localOcr(dataUrl, onProgress) {
    if (!hasElectronOCR()) return Promise.resolve(null);
    bindElectronProgress();
    // 渲染侧也要有超时：本地 OCR 首次初始化可能很慢甚至卡住主进程，
    // 不能让「识别中…」无限挂住；超时就当作本地不可用，级联到大模型 / Mock。
    var call = Promise.resolve().then(function () { return global.electronAPI.ocrImage(dataUrl); });
    var guarded = new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { console.warn('[MM] 本地 OCR 超时，降级到其它引擎'); } catch (e) {}
        resolve(null);
      }, 15000);
      call.then(function (r) {
        if (settled) return;
        settled = true; clearTimeout(timer); resolve(r);
      }, function () {
        if (settled) return;
        settled = true; clearTimeout(timer); resolve(null);
      });
    });
    return guarded
      .then(function (r) {
        if (!r || !r.success || !r.text) return null;
        return { text: String(r.text).trim(), confidence: r.confidence, engine: 'tesseract' };
      })
      .catch(function () { return null; });
  }

  function vlmOcr(dataUrl) {
    if (!vlmEnabled()) return Promise.resolve(null);
    return chatCompletion(vlmMessages(dataUrl,
      '你是一个 OCR 引擎。请逐字识别这张图片中的全部文字，保持原有换行与公式符号，不要翻译、不要解释、不要补充。' +
      '如果是题目图片，只需输出题目原文。'
    ), { temperature: 0 }).then(function (text) {
      return text ? { text: text, confidence: 95, engine: 'vlm' } : null;
    });
  }

  function ocrAcceptable(res, c) {
    if (!res || !res.text) return false;
    if (res.text.trim().length < c.minOcrChars) return false;
    if (res.engine === 'tesseract') {
      if (res.confidence === undefined || res.confidence === null || !isFinite(res.confidence)) return false;
      return res.confidence >= c.minOcrConfidence;
    }
    return true;
  }

  /**
   * 识别图片文字
   * @param {string} dataUrl 图片 base64
   * @param {{engine?:string,onProgress?:function}} [opts]
   * @returns {Promise<{success:boolean,text:string,engine:string,confidence?:number,mock:boolean}>}
   */
  function ocr(dataUrl, opts) {
    opts = opts || {};
    var c = cfg();
    var engine = opts.engine || c.ocrEngine;
    currentOcrEmit = opts.onProgress || noop;

    function done(res, mock, extra) {
      currentOcrEmit = noop;
      var output = {
        success: true,
        text: res.text,
        engine: res.engine,
        confidence: res.confidence,
        mock: !!mock
      };
      if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) output[k] = extra[k]; } }
      return output;
    }

    function fallback() {
      var res = { text: MOCK.ocrText, engine: 'mock' };
      return c.enableMockFallback ? done(res, true, { mockReason: 'OCR 引擎不可用或结果不达标' }) : Promise.reject(new Error('OCR 引擎不可用'));
    }

    if (engine === 'mock') return fallback();
    if (engine === 'tesseract') return localOcr(dataUrl, opts.onProgress).then(function (r) { return r ? done(r, false) : fallback(); });
    if (engine === 'vlm') return vlmOcr(dataUrl).then(function (r) { return r ? done(r, false) : fallback(); });

    // auto：本地优先，置信度不足再上大模型
    return localOcr(dataUrl, opts.onProgress).then(function (local) {
      if (ocrAcceptable(local, c)) return done(local, false);
      if (local && local.text) emitOcr({ phase: 'escalate', progress: 60, status: '本地识别置信度偏低，升级多模态大模型…' });
      return vlmOcr(dataUrl).then(function (vlm) {
        if (vlm && ocrAcceptable(vlm, c)) return done(vlm, false);
        if (local && local.text && local.text.trim()) return done(local, false, { lowConfidence: true });
        return fallback();
      });
    }).catch(function () { return fallback(); });
  }

  function ocrFile(file, opts) {
    opts = opts || {};
    var c = cfg();
    if (!file || file.size > 10 * 1024 * 1024) return Promise.reject(new Error('图片不能超过 10MB'));
    return fileToDataUrl(file).then(function (dataUrl) {
      return downscaleImage(dataUrl, c.maxImageSide, 0.9);
    }).then(function (dataUrl) {
      return ocr(dataUrl, opts).then(function (res) { res.image = dataUrl; return res; });
    });
  }

  /* ================================================================
   *  ASR —— 实时听写 / 音频文件
   * ================================================================ */

  function asrSupported() {
    return !!(global.SpeechRecognition || global.webkitSpeechRecognition);
  }

  /**
   * 实时麦克风听写
   * @param {{onInterim?:function,onFinal?:function,onError?:function,onEnd?:function}} handlers
   * @returns {{stop:function,abort:function}|null}
   */
  function asrLive(handlers) {
    handlers = handlers || {};
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!SR) {
      if (handlers.onError) handlers.onError(new Error('当前运行环境不支持实时语音识别，请改用「音频文件」方式'));
      return null;
    }
    var rec = new SR();
    rec.lang = 'zh-CN';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = function (event) {
      var interim = '', finalText = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim && handlers.onInterim) handlers.onInterim(interim);
      if (finalText && handlers.onFinal) handlers.onFinal(finalText);
    };
    rec.onerror = function (e) {
      var msg = e && e.error === 'not-allowed' ? '麦克风权限被拒绝，请在系统/应用设置中允许麦克风' : ('语音识别出错：' + (e && e.error ? e.error : '未知错误'));
      if (handlers.onError) handlers.onError(new Error(msg));
    };
    rec.onend = function () { if (handlers.onEnd) handlers.onEnd(); };
    try { rec.start(); } catch (e) {
      if (handlers.onError) handlers.onError(e);
      return null;
    }
    return {
      stop: function () { try { rec.stop(); } catch (e) {} },
      abort: function () { try { rec.abort(); } catch (e) {} }
    };
  }

  /** 音频文件 → 文本（走大模型 ASR，失败回落 Mock） */
  function asrFile(file, opts) {
    opts = opts || {};
    var c = cfg();
    if (!file || file.size > 10 * 1024 * 1024) return Promise.reject(new Error('音频不能超过 10MB'));
    var ext = (file.name || 'audio.wav').split('.').pop().toLowerCase();
    var format = ext === 'm4a' ? 'mp4' : ext;
    return fileToDataUrl(file).then(function (dataUrl) {
      if (c.asrEngine === 'mock' || c.vlmEngine === 'mock' || !c.apiKey) return null;
      return chatCompletion([{
        role: 'user',
        content: [{
          type: 'input_audio',
          input_audio: { data: dataUrl, format: format }
        }]
      }], { model: c.asrModel, temperature: 0, maxTokens: 2048 });
    }).then(function (text) {
      if (text) return { success: true, text: text, engine: 'vlm-asr', mock: false };
      if (!c.enableMockFallback) throw new Error('语音识别不可用');
      return { success: true, text: MOCK.asrText, engine: 'mock', mock: true, mockReason: '语音识别不可用' };
    }).catch(function () {
      if (!cfg().enableMockFallback) throw new Error('语音识别不可用');
      return { success: true, text: MOCK.asrText, engine: 'mock', mock: true, mockReason: '语音识别请求失败' };
    });
  }

  /* ================================================================
   *  知识库检索 + 拍照答疑
   * ================================================================ */

  function matchKnowledge(text, limit) {
    var kb = global.knowledgeBase || [];
    if (!kb.length || !text) return [];
    var scored = [];
    for (var i = 0; i < kb.length; i++) {
      var k = kb[i];
      var score = 0;
      var tags = k.tags || [];
      for (var t = 0; t < tags.length; t++) {
        if (tags[t] && text.indexOf(tags[t]) !== -1) score += 3;
      }
      if (k.title && text.indexOf(k.title) !== -1) score += 3;
      if (k.course && text.indexOf(k.course) !== -1) score += 1;
      score += bigramOverlap(k.title || '', text) * 4;
      score += bigramOverlap((k.summary || '').slice(0, 40), text) * 2;
      if (score > 0) scored.push({ item: k, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, limit || 3).map(function (x) { return x.item; });
  }

  function buildSolvePrompt(questionText, matched) {
    var ctx = '';
    if (matched && matched.length) {
      ctx = '\n\n【知识库关联素材】\n' + matched.map(function (k, i) {
        return (i + 1) + '. 《' + k.title + '》（' + k.course + '）：' + (k.summary || '') +
          (k.examples && k.examples.length ? '；典型例题：' + k.examples.join('；') : '');
      }).join('\n');
    }
    return '你是一位耐心的大学学业辅导老师。请根据图片中的错题，输出结构化的答疑内容：\n' +
      '1. 【题目识别】用一句话概括题目考查的知识点；\n' +
      '2. 【解题思路】分步骤讲解，关键公式写清楚；\n' +
      '3. 【完整解答】给出最终答案；\n' +
      '4. 【易错点】指出这类题最常见的错误；\n' +
      '5. 【同类练习】出 1 道同类型练习题（只出题，不给答案）。\n' +
      '语言面向大学生，简洁清晰，不要客套。\n\n' +
      (questionText ? '【OCR 识别到的题目文字】\n' + questionText : '') + ctx;
  }

  /**
   * 拍照答疑：OCR → 知识库 RAG → 多模态大模型解题
   */
  function solve(imageDataUrl, opts) {
    opts = opts || {};
    var onProgress = opts.onProgress || noop;
    var c = cfg();
    onProgress({ phase: 'ocr', progress: 10, status: '识别题目文字…' });
    var textPromise = opts.ocrText ? Promise.resolve(opts.ocrText)
      : ocr(imageDataUrl, { onProgress: onProgress }).then(function (r) { return r.text || ''; });
    return textPromise.then(function (text) {
      var matched = matchKnowledge(text, 3);
      onProgress({ phase: 'solve', progress: 60, status: '多模态大模型解题中…' });
      return chatCompletion(vlmMessages(imageDataUrl, buildSolvePrompt(text, matched)), { maxTokens: 3000 })
        .then(function (answer) {
          if (answer && vlmEnabled()) {
            return { success: true, text: answer, ocrText: text, matched: matched, engine: 'vlm', mock: false };
          }
          if (!c.enableMockFallback) throw new Error('答疑服务不可用');
          return {
            success: true,
            text: MOCK.solve.answer,
            title: MOCK.solve.title,
            ocrText: text || MOCK.ocrText,
            matched: matched,
            engine: 'mock',
            mock: true
          };
        });
    });
  }

  function solveFile(file, opts) {
    return fileToDataUrl(file).then(function (dataUrl) {
      return downscaleImage(dataUrl, cfg().maxImageSide, 0.9);
    }).then(function (dataUrl) {
      return solve(dataUrl, opts).then(function (res) { res.image = dataUrl; return res; });
    });
  }

  /* ================================================================
   *  文档解析 + 文本分块（知识库上传）
   * ================================================================ */

  function readDocument(file) {
    var name = (file.name || '').toLowerCase();
    var ext = name.split('.').pop();
    if (ext === 'xlsx' || ext === 'xls') {
      return file.arrayBuffer().then(function (buf) {
        if (!global.XLSX) throw new Error('Excel 解析库未加载');
        var wb = global.XLSX.read(buf, { type: 'array' });
        var parts = wb.SheetNames.map(function (n) {
          return '## ' + n + '\n' + global.XLSX.utils.sheet_to_csv(wb.Sheets[n]);
        });
        return { name: file.name, ext: ext, text: parts.join('\n\n') };
      });
    }
    if (ext === 'pdf' || ext === 'doc' || ext === 'docx' || ext === 'ppt' || ext === 'pptx') {
      return Promise.reject(new Error('暂不支持直接解析 .' + ext + '，请转为 txt/md/csv/xlsx 后再上传'));
    }
    return file.text().then(function (t) {
      return { name: file.name, ext: ext, text: t };
    });
  }

  function chunkText(text, size, overlap) {
    size = size || 600;
    overlap = overlap === undefined ? 80 : overlap;
    var clean = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!clean) return [];
    var chunks = [];
    var step = Math.max(1, size - overlap);
    for (var i = 0; i < clean.length; i += step) {
      chunks.push(clean.substr(i, size));
      if (i + size >= clean.length) break;
    }
    return chunks;
  }

  function extractTitle(text, filename) {
    var first = String(text || '').split('\n').map(function (s) { return s.trim(); })
      .filter(function (s) { return s; })[0] || '';
    if (first && first.length <= 30) return first.replace(/^#+\s*/, '');
    return (filename || '未命名文档').replace(/\.[^.]+$/, '');
  }

  /** 解析文档 → 生成可直接入库的知识点对象数组 */
  function parseToKnowledge(file, opts) {
    opts = opts || {};
    return readDocument(file).then(function (doc) {
      var chunks = chunkText(doc.text, opts.chunkSize || 600, opts.overlap || 80);
      var title = extractTitle(doc.text, doc.name);
      if (!chunks.length) throw new Error('文件内容为空');
      return chunks.map(function (chunk, i) {
        return {
          id: 'kb-' + Date.now().toString(36) + '-' + i,
          course: opts.course || '通识',
          title: chunks.length > 1 ? title + '（第 ' + (i + 1) + ' 部分）' : title,
          summary: chunk.slice(0, 120),
          content: chunk,
          examples: [],
          exercises: [],
          resources: [doc.name],
          resourceLinks: [],
          difficulty: opts.difficulty || '基础',
          tags: opts.tags || [],
          visible: opts.visible || 'all',
          source: doc.name,
          chunkStatus: '已分块(' + chunks.length + '块)',
          indexStatus: '已索引'
        };
      });
    });
  }

  /* ================================================================
   *  错题本（学生端沉淀 / 教师端复用）
   * ================================================================ */

  var WRONG_BOOK_KEY = 'wrongBook';

  function wrongBookList(filter) {
    var list = [];
    try { list = JSON.parse(global.localStorage.getItem(WRONG_BOOK_KEY) || '[]'); } catch (e) { list = []; }
    if (!filter) return list;
    return list.filter(function (it) {
      if (filter.status && it.status !== filter.status) return false;
      if (filter.subject && it.subject !== filter.subject) return false;
      if (filter.studentId !== undefined && filter.studentId !== null && it.studentId !== filter.studentId) return false;
      return true;
    });
  }

  function wrongBookSave(item) {
    var list = wrongBookList();
    var record = {
      id: item.id || ('wb-' + Date.now().toString(36) + Math.floor(Math.random() * 1000)),
      studentId: item.studentId || '',
      subject: item.subject || '未分类',
      title: item.title || '',
      ocrText: item.ocrText || '',
      solution: item.solution || '',
      image: (item.image && item.image.length <= 200000) ? item.image : '',
      knowledgePoints: item.knowledgePoints || [],
      status: item.status || 'unmastered',
      reviewCount: item.reviewCount || 0,
      createdAt: item.createdAt || new Date().toISOString()
    };
    list.unshift(record);
    var trimmed = list.slice(0, 200);
    while (trimmed.length) {
      try { global.localStorage.setItem(WRONG_BOOK_KEY, JSON.stringify(trimmed)); return record; }
      catch (e) { trimmed.pop(); }
    }
    return null;
  }

  function wrongBookUpdate(id, patch) {
    var list = wrongBookList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        for (var k in patch) { if (patch.hasOwnProperty(k)) list[i][k] = patch[k]; }
        try { global.localStorage.setItem(WRONG_BOOK_KEY, JSON.stringify(list)); } catch (e) {}
        return list[i];
      }
    }
    return null;
  }

  function wrongBookRemove(id) {
    var list = wrongBookList().filter(function (it) { return it.id !== id; });
    try { global.localStorage.setItem(WRONG_BOOK_KEY, JSON.stringify(list)); } catch (e) {}
    return list;
  }

  /* ================================================================
   *  错题 → 薄弱知识点聚合 → 回流预警候选
   * ---------------------------------------------------------------
   *  规则：同一知识点「未掌握 + 复习中」的错题数 ≥ 3 即生成预警候选，
   *        由教师端确认后转为正式预警工单。
   * ================================================================ */

  var WARNING_CANDIDATE_KEY = 'warningCandidates';
  var THRESHOLDS = { mid: 3, high: 5 };

  function wrongBookStats(filter) {
    var list = wrongBookList(filter);
    var map = {};
    list.forEach(function (it) {
      var kps = (it.knowledgePoints && it.knowledgePoints.length) ? it.knowledgePoints : ['未分类'];
      kps.forEach(function (kp) {
        var key = kp + '|' + (it.subject || '');
        if (!map[key]) {
          map[key] = { knowledgePoint: kp, subject: it.subject || '未分类',
            total: 0, unmastered: 0, reviewing: 0, mastered: 0, pending: 0, lastAt: it.createdAt };
        }
        var s = map[key];
        s.total++;
        if (it.status === 'mastered') s.mastered++;
        else if (it.status === 'reviewing') s.reviewing++;
        else s.unmastered++;
        s.pending = s.unmastered + s.reviewing;
        if (it.createdAt > s.lastAt) s.lastAt = it.createdAt;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.pending - a.pending; });
  }

  function candidateList(filter) {
    var list = [];
    try { list = JSON.parse(global.localStorage.getItem(WARNING_CANDIDATE_KEY) || '[]'); } catch (e) { list = []; }
    if (!filter) return list;
    return list.filter(function (c) {
      if (filter.status && c.status !== filter.status) return false;
      if (filter.studentId && c.studentId !== filter.studentId) return false;
      return true;
    });
  }

  function candidateSave(list) {
    try { global.localStorage.setItem(WARNING_CANDIDATE_KEY, JSON.stringify(list.slice(0, 200))); } catch (e) {}
  }

  function candidateSync(opts) {
    opts = opts || {};
    var mid = opts.threshold || THRESHOLDS.mid;
    var high = opts.highThreshold || THRESHOLDS.high;
    var studentId = opts.studentId || '';
    var studentName = opts.studentName || '';
    var stats = wrongBookStats({ studentId: studentId });
    var list = candidateList();
    var created = [], updated = [];

    stats.forEach(function (s) {
      if (s.pending < mid) return;
      var level = s.pending >= high ? '高' : '中';
      var existing = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].studentId === studentId && list[i].knowledgePoint === s.knowledgePoint && list[i].status === 'pending') {
          existing = list[i]; break;
        }
      }
      var now = new Date().toISOString();
      if (existing) {
        existing.count = s.pending;
        existing.level = level;
        existing.reason = '错题本中「' + s.knowledgePoint + '」累计 ' + s.pending + ' 题未掌握';
        existing.updatedAt = now;
        updated.push(existing);
      } else {
        var rec = {
          id: 'wc-' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
          studentId: studentId,
          studentName: studentName,
          knowledgePoint: s.knowledgePoint,
          course: s.subject,
          count: s.pending,
          level: level,
          reason: '错题本中「' + s.knowledgePoint + '」累计 ' + s.pending + ' 题未掌握',
          source: opts.source || '错题本回流',
          status: 'pending',
          createdAt: now,
          updatedAt: now
        };
        list.unshift(rec);
        created.push(rec);
      }
    });

    candidateSave(list);
    return { created: created, updated: updated, candidates: list };
  }

  function candidateUpdate(id, patch) {
    var list = candidateList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        for (var k in patch) { if (patch.hasOwnProperty(k)) list[i][k] = patch[k]; }
        candidateSave(list);
        return list[i];
      }
    }
    return null;
  }

  function candidateRemove(id) {
    var list = candidateList().filter(function (c) { return c.id !== id; });
    candidateSave(list);
    return list;
  }

  /* ================================================================
   *  对外接口
   * ================================================================ */

  global.MM = {
    version: VERSION,
    cfg: cfg,
    setConfig: setConfig,
    // OCR
    ocr: ocr,
    ocrFile: ocrFile,
    mockOcrText: MOCK.ocrText,
    // ASR
    asrLive: asrLive,
    asrFile: asrFile,
    asrSupported: asrSupported,
    mockAsrText: MOCK.asrText,
    // 答疑
    solve: solve,
    solveFile: solveFile,
    matchKnowledge: matchKnowledge,
    mockSolveText: MOCK.solve.answer,
    // 文档 / 知识库
    readDocument: readDocument,
    chunkText: chunkText,
    parseToKnowledge: parseToKnowledge,
    // 错题本
    wrongBook: {
      list: wrongBookList,
      save: wrongBookSave,
      update: wrongBookUpdate,
      remove: wrongBookRemove,
      stats: wrongBookStats
    },
    // 错题回流预警候选
    warning: {
      list: candidateList,
      sync: candidateSync,
      update: candidateUpdate,
      remove: candidateRemove,
      thresholds: THRESHOLDS
    },
    // 工具
    fileToDataUrl: fileToDataUrl,
    downscaleImage: downscaleImage,
    textToHtml: textToHtml,
    hasElectronOCR: hasElectronOCR
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = global.MM;
})(typeof window !== 'undefined' ? window : this);
