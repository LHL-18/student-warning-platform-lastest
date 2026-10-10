/**
 * evidence.js — 证据链（只引用已有数据，不新建存储、不双写）
 * ---------------------------------------------------------------
 * 预警解释卡回答"凭什么是我"，证据链回答"依据在哪"：
 * 每条预警都尽量挂上可下钻的原始证据引用，评委追问"依据呢"时能当场点开。
 *
 * 设计约束（来自提示词集）：
 *   1. 证据一律**引用**已有模块的数据（错题本 / 任务流运行记录 / 申报工单），
 *      不新建证据存储，避免双写不一致；
 *   2. 找不到对应证据就留空，不造数据；
 *   3. 引用可能已过保留期（错题本留 200 条、flowRuns 留 50 条），
 *      失效时返回 { expired:true }，由 UI 提示"该证据已过保留期"而不是报错。
 *
 * 引用结构：{ type, ref, label, at }
 *   type: 'wrongbook' | 'ocr' | 'asr' | 'flowrun' | 'ticket'
 */
(function (global) {
  'use strict';

  var TYPE_LABEL = {
    wrongbook: '错题本',
    ocr: 'OCR 识别原文',
    asr: '语音转写',
    flowrun: '任务流运行记录',
    ticket: '困难申报工单'
  };

  function ls(key) {
    try { return global.localStorage.getItem(key); } catch (e) { return null; }
  }
  function readJson(key, dflt) {
    try {
      var raw = ls(key);
      var v = raw ? JSON.parse(raw) : dflt;
      return v === null || v === undefined ? dflt : v;
    } catch (e) { return dflt; }
  }

  function statusText(s) {
    return s === 'mastered' ? '已掌握' : (s === 'reviewing' ? '复习中' : '未掌握');
  }

  /* ---------------- 收集（写入快照时调用） ---------------- */

  /**
   * 为某学生收集证据引用。
   * @param {string} studentId
   * @param {{limitWrong?:number, limitTicket?:number, limitRun?:number}} [opts]
   * @returns {Array<{type,ref,label,at}>}
   */
  function collect(studentId, opts) {
    opts = opts || {};
    var out = [];
    if (!studentId) return out;

    // 1) 错题本：学生本人未掌握/复习中的错题
    try {
      if (global.MM && global.MM.wrongBook && typeof global.MM.wrongBook.list === 'function') {
        var wrongs = global.MM.wrongBook.list({ studentId: studentId }) || [];
        wrongs.slice(0, opts.limitWrong || 5).forEach(function (w) {
          out.push({
            type: 'wrongbook',
            ref: String(w.id || ''),
            label: '错题：' + (w.title || w.subject || '未命名') + '（' + statusText(w.status) + '）',
            at: w.createdAt || ''
          });
        });
      }
    } catch (e) {}

    // 2) 任务流运行记录（该生的预警帮扶流）+ 其中的 OCR 步骤原文
    try {
      var runs = readJson('flowRuns', []);
      if (Object.prototype.toString.call(runs) !== '[object Array]') runs = [];
      var mine = runs.filter(function (r) {
        return r && r.input && String(r.input.studentId || '') === String(studentId);
      }).slice(0, opts.limitRun || 3);
      mine.forEach(function (r) {
        out.push({
          type: 'flowrun',
          ref: String(r.runId || ''),
          label: (r.flowName || '任务流') + '（' + (r.status || '') + ' · ' + ((r.steps || []).length) + ' 个节点）',
          at: r.startedAt || ''
        });
        // 该次运行里若含 OCR 节点，把识别原文也作为独立证据挂上（文本是真实产物，不造数据）
        (r.steps || []).forEach(function (s) {
          var isOcr = s && (s.id === 'ocr' || s.id === 'vlm' || s.tool === 'ocr' || s.tool === 'ocr.vlm');
          if (!isOcr || !s.output) return;
          var text = (typeof s.output === 'string') ? s.output : (s.output.text || '');
          if (!text) return;
          out.push({
            type: 'ocr',
            ref: String(r.runId || '') + '#' + String(s.id || 'ocr'),
            label: 'OCR 识别原文（' + ((s.output && s.output.engine) || '未知引擎') + '）',
            at: s.startedAt || r.startedAt || ''
          });
        });
      });
    } catch (e) {}

    // 3) 困难申报工单
    try {
      if (global.Tickets && typeof global.Tickets.list === 'function') {
        var tks = global.Tickets.list({ studentId: studentId }) || [];
        tks.slice(0, opts.limitTicket || 3).forEach(function (t) {
          out.push({
            type: 'ticket',
            ref: String(t.id || ''),
            label: '困难申报：' + (t.type || '其他') + '（' + ((global.Tickets.STATUS || {})[t.status] || t.status || '') + '）',
            at: t.createdAt || ''
          });
        });
      }
    } catch (e) {}

    return out;
  }

  /* ---------------- 解析（下钻详情时调用） ---------------- */

  /**
   * 把一条引用解析成可展示的详情。
   * @returns {{ok:boolean, expired?:boolean, type:string, title?:string, rows?:Array, text?:string, run?:object, error?:string}}
   */
  function resolve(ref) {
    ref = ref || {};
    var type = ref.type;
    try {
      if (type === 'wrongbook') {
        var list = (global.MM && global.MM.wrongBook) ? global.MM.wrongBook.list() : [];
        var w = null;
        for (var i = 0; i < list.length; i++) { if (String(list[i].id) === String(ref.ref)) { w = list[i]; break; } }
        if (!w) return { ok: false, expired: true, type: type };
        if (global.Perm && !global.Perm.guardData(w.studentId).ok) return { ok: false, type: type, error: '无权查看该证据' };
        return {
          ok: true, type: type, title: w.title || '未命名错题',
          rows: [
            { k: '科目', v: w.subject || '未分类' },
            { k: '知识点', v: (w.knowledgePoints || []).join('、') || '未标注' },
            { k: '掌握状态', v: statusText(w.status) },
            { k: '已复习次数', v: String(w.reviewCount || 0) },
            { k: '录入时间', v: String(w.createdAt || '').slice(0, 19).replace('T', ' ') }
          ],
          text: w.ocrText || '',
          solution: w.solution || ''
        };
      }
      if (type === 'ticket') {
        var tks = (global.Tickets) ? global.Tickets.list() : [];
        var t = null;
        for (var j = 0; j < tks.length; j++) { if (String(tks[j].id) === String(ref.ref)) { t = tks[j]; break; } }
        if (!t) return { ok: false, expired: true, type: type };
        if (global.Perm && !global.Perm.guardData(t.studentId).ok) return { ok: false, type: type, error: '无权查看该工单' };
        return {
          ok: true, type: type, title: (t.type || '困难申报') + ' · ' + t.id,
          rows: [
            { k: '提交时间', v: String(t.createdAt || '').slice(0, 19).replace('T', ' ') },
            { k: '状态', v: (global.Tickets.STATUS || {})[t.status] || t.status },
            { k: '紧急程度', v: t.urgency === 'urgent' ? '紧急' : '一般' },
            { k: '处理人', v: t.handler || '—' }
          ],
          text: t.desc || '',
          solution: t.result || ''
        };
      }
      if (type === 'flowrun') {
        var runs = readJson('flowRuns', []);
        var r = null;
        for (var k = 0; k < runs.length; k++) { if (String(runs[k].runId) === String(ref.ref)) { r = runs[k]; break; } }
        if (!r) return { ok: false, expired: true, type: type };
        return { ok: true, type: type, title: r.flowName || '任务流', run: r };
      }
      if (type === 'ocr' || type === 'asr') {
        var parts = String(ref.ref || '').split('#');
        var runs2 = readJson('flowRuns', []);
        var rr = null;
        for (var m = 0; m < runs2.length; m++) { if (String(runs2[m].runId) === String(parts[0])) { rr = runs2[m]; break; } }
        if (!rr) return { ok: false, expired: true, type: type };
        var step = null;
        (rr.steps || []).forEach(function (s) { if (String(s.id) === String(parts[1])) step = s; });
        if (!step) return { ok: false, expired: true, type: type };
        var o = step.output || {};
        var text = (typeof o === 'string') ? o : (o.text || '');
        return {
          ok: true, type: type, title: (step.label || 'OCR'),
          rows: [
            { k: '识别引擎', v: (o && o.engine) || '未知' },
            { k: '置信度', v: (o && o.confidence !== undefined && o.confidence !== null) ? String(o.confidence) : '—' },
            { k: '是否降级', v: (o && o.mock) ? '是（Mock 兜底）' : '否' },
            { k: '来源运行', v: (rr.flowName || '') + ' · ' + String(rr.startedAt || '').slice(0, 19).replace('T', ' ') }
          ],
          text: text
        };
      }
      return { ok: false, type: type, error: '未知的证据类型' };
    } catch (e) {
      return { ok: false, type: type, error: (e && e.message) || '解析失败' };
    }
  }

  /** 按类型分组，便于 UI 分块展示 */
  function group(refs) {
    var out = { wrongbook: [], ocr: [], asr: [], flowrun: [], ticket: [] };
    (refs || []).forEach(function (r) {
      if (!r || !r.type) return;
      if (!out[r.type]) out[r.type] = [];
      out[r.type].push(r);
    });
    return out;
  }

  /** 学生侧粒度：只展示本人的原始材料，不暴露教师端的内部研判过程 */
  var STUDENT_TYPES = ['wrongbook', 'ocr', 'asr', 'ticket'];
  function forStudent(refs) {
    return (refs || []).filter(function (r) { return STUDENT_TYPES.indexOf(r.type) !== -1; });
  }

  global.Evidence = {
    TYPE_LABEL: TYPE_LABEL,
    STUDENT_TYPES: STUDENT_TYPES,
    collect: collect,
    resolve: resolve,
    group: group,
    forStudent: forStudent,
    statusText: statusText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Evidence;
})(typeof window !== 'undefined' ? window : this);
