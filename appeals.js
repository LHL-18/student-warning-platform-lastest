/**
 * appeals.js — 预警申诉（双向闭环的存储层）
 * ---------------------------------------------------------------
 * 与支持工单不同，申诉必须**绑定当时那一份判定依据快照**：
 * 学生在质疑的不是"现在的规则"，而是"当初为什么这么判"。
 * 所以创建申诉时会把 warningSnapshots 里对应的快照摘要复制一份存进申诉记录，
 * 之后老师即便切换了规则，复核依据也不会漂移。
 *
 * 存储：localStorage.warningAppeals，数组，新的在前，最多 200 条
 *   { id:'AP-<时间戳36进制>', studentId, studentName, className,
 *     warningAt, snapshot:{at,pluginId,pluginName,riskLevel,riskScore,mainLabel,mainRaw,factors[]},
 *     type, reason, createdAt, status:'pending'|'accepted'|'rejected',
 *     reviewer:'', reviewedAt:'', conclusion:'', noticeRead:false }
 *
 * 约束：ES5 风格、零依赖、不用 eval。
 */
(function (global) {
  'use strict';

  var KEY = 'warningAppeals';
  var MAX = 200;
  var MIN_REASON = 10;
  var TYPES = ['数据有误', '情况特殊', '已改善请复核', '其他'];
  var STATUS = { pending: '待复核', accepted: '已采纳', rejected: '已驳回' };

  function read() {
    try {
      var raw = global.localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(list) === '[object Array]' ? list : [];
    } catch (e) { return []; }
  }

  function write(list) {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
      return true;
    } catch (e) {
      try { console.warn('[Appeals] 写入失败：' + (e && e.name)); } catch (e2) {}
      return false;
    }
  }

  function genId(existing) {
    var base = 'AP-' + Date.now().toString(36);
    var id = base, n = 0;
    while (existing.some(function (a) { return a.id === id; })) { n++; id = base + '-' + n; }
    return id;
  }

  function list(filter) {
    var all = read();
    if (!filter) return all;
    return all.filter(function (a) {
      if (filter.studentId !== undefined && filter.studentId !== null && String(a.studentId) !== String(filter.studentId)) return false;
      if (filter.status && a.status !== filter.status) return false;
      return true;
    });
  }

  /** 教师端展示顺序：待复核优先，其次按提交时间倒序 */
  function sorted(filter) {
    var arr = list(filter).slice();
    arr.sort(function (a, b) {
      var ap = (a.status === 'pending') ? 0 : 1, bp = (b.status === 'pending') ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return arr;
  }

  function findPending(studentId, warningAt) {
    var all = read();
    for (var i = 0; i < all.length; i++) {
      if (all[i].status === 'pending' &&
        String(all[i].studentId) === String(studentId) &&
        String(all[i].warningAt || '') === String(warningAt || '')) return all[i];
    }
    return null;
  }

  /**
   * 把完整的判定快照压缩成申诉里要展示/留存的摘要。
   * 只保留"复核需要看到的东西"，避免把整份 factors 反复塞进存储。
   */
  function summarizeSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return {};
    var factors = Object.prototype.toString.call(snap.factors) === '[object Array]' ? snap.factors : [];
    var hits = factors.filter(function (f) { return f.hit; });
    hits.sort(function (a, b) { return Math.abs(b.contribution || 0) - Math.abs(a.contribution || 0); });
    var top = hits.slice(0, 4).map(function (f) {
      return { dim: f.dim, label: f.label, rawValue: f.rawValue, contribution: f.contribution };
    });
    return {
      at: snap.at || '',
      pluginId: snap.pluginId || '',
      pluginName: snap.pluginName || '',
      riskLevel: snap.riskLevel || '',
      riskScore: (snap.riskScore === undefined ? '' : snap.riskScore),
      mainLabel: top.length ? top[0].label : '',
      mainRaw: top.length ? top[0].rawValue : '',
      factors: top
    };
  }

  /**
   * 学生提交申诉
   * @returns {{ok:boolean, appeal?:object, error?:string, duplicate?:boolean}}
   */
  function create(input) {
    input = input || {};
    var reason = String(input.reason || '').trim();
    if (!reason) return { ok: false, error: '请填写申诉理由' };
    if (reason.length < MIN_REASON) return { ok: false, error: '申诉理由请写得更具体一些（至少 ' + MIN_REASON + ' 个字）' };
    if (!input.studentId) return { ok: false, error: '缺少学生身份，无法提交' };

    var dup = findPending(input.studentId, input.warningAt);
    if (dup) return { ok: false, duplicate: true, error: '你已提交过申诉，正在处理中', appeal: dup };

    var all = read();
    var rec = {
      id: genId(all),
      studentId: String(input.studentId),
      studentName: input.studentName || '',
      className: input.className || '',
      warningAt: input.warningAt || '',
      snapshot: input.snapshot || {},
      type: input.type || '其他',
      reason: reason,
      createdAt: new Date().toISOString(),
      status: 'pending',
      reviewer: '',
      reviewedAt: '',
      conclusion: '',
      noticeRead: false
    };
    all.unshift(rec);
    if (!write(all)) return { ok: false, error: '本地存储写入失败（可能已满），请清理后重试' };
    return { ok: true, appeal: rec };
  }

  /** 教师端复核（统一写入口，禁止 UI 事件里裸写 localStorage） */
  function review(id, patch) {
    var all = read();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id !== id) continue;
      if (all[i].status !== 'pending') return { ok: false, error: '该申诉已复核过' };
      var conclusion = String((patch && patch.conclusion) || '').trim();
      if (!conclusion) return { ok: false, error: '复核结论不能为空' };
      all[i].status = patch.status === 'accepted' ? 'accepted' : 'rejected';
      all[i].conclusion = conclusion;
      all[i].reviewer = (patch && patch.reviewer) || '';
      all[i].reviewedAt = new Date().toISOString();
      all[i].noticeRead = false;
      if (!write(all)) return { ok: false, error: '写入失败' };
      return { ok: true, appeal: all[i] };
    }
    return { ok: false, error: '申诉不存在' };
  }

  function get(id) {
    var all = read();
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) return all[i]; }
    return null;
  }

  /** 学生读过复核结果后标记，避免新键（状态挂在申诉记录自己身上） */
  function markNoticed(ids) {
    if (Object.prototype.toString.call(ids) !== '[object Array]' || !ids.length) return false;
    var all = read(), changed = false;
    for (var i = 0; i < all.length; i++) {
      if (all[i].status === 'pending' || all[i].noticeRead) continue;
      if (ids.indexOf(all[i].id) !== -1) { all[i].noticeRead = true; changed = true; }
    }
    if (changed) write(all);
    return changed;
  }

  function stats(filter) {
    var arr = list(filter);
    var out = { total: arr.length, pending: 0, accepted: 0, rejected: 0 };
    arr.forEach(function (a) {
      if (a.status === 'accepted') out.accepted++;
      else if (a.status === 'rejected') out.rejected++;
      else out.pending++;
    });
    return out;
  }

  global.Appeals = {
    KEY: KEY,
    MAX: MAX,
    MIN_REASON: MIN_REASON,
    TYPES: TYPES,
    STATUS: STATUS,
    list: list,
    sorted: sorted,
    get: get,
    create: create,
    review: review,
    markNoticed: markNoticed,
    stats: stats,
    summarizeSnapshot: summarizeSnapshot
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Appeals;
})(typeof window !== 'undefined' ? window : this);
