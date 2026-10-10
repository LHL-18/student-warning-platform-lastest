/**
 * tickets.js — 学生困难申报工单（共享存储层）
 * ---------------------------------------------------------------
 * 为什么单独一个模块：
 *   工单要被学生端写入、教师端读取与流转，两边如果各写一份 localStorage
 *   读写代码，键名/字段迟早会漂移。这里把「键名 + 结构 + 校验 + 紧急分级」
 *   收敛成唯一来源，两端都只调用它。
 *
 * 存储：localStorage.supportTickets，数组，新的在前，最多 200 条
 *   { id:'ST-<时间戳36进制>', studentId, studentName, className,
 *     type, urgency:'normal'|'urgent', desc, contact, createdAt:ISO,
 *     status:'pending'|'accepted'|'closed', handler:'', handleLog:[], result:'' }
 *
 * 约束：ES5 风格、零依赖、不用 eval。
 */
(function (global) {
  'use strict';

  var KEY = 'supportTickets';
  var MAX = 200;
  var MIN_DESC = 10;

  var STATUS = { pending: '待处理', accepted: '处理中', closed: '已结案' };

  /* 保守的本地关键词初筛——只是提示，不是诊断，也不接大模型（保证离线可复现） */
  var URGENT_WORDS = ['自伤', '自杀', '轻生', '不想活', '活不下去', '结束生命', '伤害自己', '没意思了'];

  function nowIso() { return new Date().toISOString(); }

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
      // 配额满等情况：显式返回失败，让调用方提示，而不是假装成功
      try { console.warn('[Tickets] 写入失败：' + (e && e.name)); } catch (e2) {}
      return false;
    }
  }

  function genId(existing) {
    var base = 'ST-' + Date.now().toString(36);
    var id = base, n = 0;
    while (existing.some(function (t) { return t.id === id; })) { n++; id = base + '-' + n; }
    return id;
  }

  function detectUrgency(text) {
    var s = String(text || '');
    for (var i = 0; i < URGENT_WORDS.length; i++) {
      if (s.indexOf(URGENT_WORDS[i]) !== -1) return { urgency: 'urgent', word: URGENT_WORDS[i] };
    }
    return { urgency: 'normal', word: '' };
  }

  /** 按学生/状态过滤；不带 filter 返回全量 */
  function list(filter) {
    var all = read();
    var who = global.Session && global.Session.current ? global.Session.current() : null;
    if (!who) return [];
    if (who.role === 'student') filter = { studentId: who.id, status: filter && filter.status, urgency: filter && filter.urgency };
    else if (who.role !== 'teacher') return [];
    if (!filter) return all;
    return all.filter(function (t) {
      if (filter.studentId !== undefined && filter.studentId !== null && String(t.studentId) !== String(filter.studentId)) return false;
      if (filter.status && t.status !== filter.status) return false;
      if (filter.urgency && (t.urgency || 'normal') !== filter.urgency) return false;
      return true;
    });
  }

  /** 教师端展示顺序：urgent 优先，再按时间倒序 */
  function sorted(filter) {
    var arr = list(filter).slice();
    arr.sort(function (a, b) {
      var au = (a.urgency === 'urgent') ? 0 : 1, bu = (b.urgency === 'urgent') ? 0 : 1;
      if (au !== bu) return au - bu;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return arr;
  }

  /**
   * 新建工单
   * @returns {{ok:boolean, ticket?:object, error?:string, urgent?:boolean, urgentWord?:string}}
   */
  function create(input) {
    input = input || {};
    var desc = String(input.desc || '').trim();
    if (!desc) return { ok: false, error: '请把困难描述得再具体一些' };
    if (desc.length < MIN_DESC) return { ok: false, error: '请把困难描述得再具体一些（至少 ' + MIN_DESC + ' 个字）' };
    if (!input.studentId) return { ok: false, error: '缺少学生身份，无法提交' };
    var who = global.Session && global.Session.current ? global.Session.current() : null;
    if (!who) return { ok: false, error: '未登录，拒绝提交' };
    if (who.role === 'student' && String(who.id) !== String(input.studentId)) return { ok: false, error: '只能为本人提交申报' };
    if (who.role !== 'student' && who.role !== 'teacher') return { ok: false, error: '当前身份无权提交' };

    var all = read();
    var hit = detectUrgency(desc);
    var ticket = {
      id: genId(all),
      studentId: String(input.studentId),
      studentName: input.studentName || '',
      className: input.className || '',
      type: input.type || '其他',
      urgency: hit.urgency,
      desc: desc,
      contact: String(input.contact || '').trim(),
      createdAt: nowIso(),
      status: 'pending',
      handler: '',
      handleLog: [],
      result: ''
    };
    all.unshift(ticket);
    if (!write(all)) return { ok: false, error: '本地存储写入失败（可能已满），请清理后重试' };
    return { ok: true, ticket: ticket, urgent: hit.urgency === 'urgent', urgentWord: hit.word };
  }

  /** 教师端流转：patch 只允许动作相关字段由调用方传入 */
  function update(id, patch, logEntry) {
    var who = global.Session && global.Session.current ? global.Session.current() : null;
    if (!who || who.role !== 'teacher') return { ok: false, error: '仅教师可处理工单' };
    var all = read();
    var allowed = { status: true, handler: true, handleLog: true, result: true };
    for (var i = 0; i < all.length; i++) {
      if (all[i].id !== id) continue;
      if (patch) {
        for (var k in patch) { if (patch.hasOwnProperty(k) && allowed[k]) all[i][k] = patch[k]; }
      }
      if (logEntry) {
        if (Object.prototype.toString.call(all[i].handleLog) !== '[object Array]') all[i].handleLog = [];
        all[i].handleLog.push(logEntry);
      }
      if (!write(all)) return { ok: false, error: '本地存储写入失败' };
      return { ok: true, ticket: all[i] };
    }
    return { ok: false, error: '工单不存在' };
  }

  function get(id) {
    var all = read();
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) return all[i]; }
    return null;
  }

  function stats(filter) {
    var arr = list(filter);
    var out = { total: arr.length, pending: 0, accepted: 0, closed: 0, urgent: 0 };
    arr.forEach(function (t) {
      if (t.status === 'accepted') out.accepted++;
      else if (t.status === 'closed') out.closed++;
      else out.pending++;
      if (t.urgency === 'urgent' && t.status !== 'closed') out.urgent++;
    });
    return out;
  }

  global.Tickets = {
    KEY: KEY,
    MAX: MAX,
    MIN_DESC: MIN_DESC,
    STATUS: STATUS,
    URGENT_WORDS: URGENT_WORDS,
    list: list,
    sorted: sorted,
    get: get,
    create: create,
    update: update,
    stats: stats,
    detectUrgency: detectUrgency
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Tickets;
})(typeof window !== 'undefined' ? window : this);
