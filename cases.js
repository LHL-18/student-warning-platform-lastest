/**
 * cases.js — 案例库（给三 Agent 加记忆）
 * ---------------------------------------------------------------
 * 三 Agent 原本完全无状态：每次生成方案都从零开始，历史上哪种方案真的有效
 * 系统并不知道。本模块把**已结案/已升级的工单**沉淀成案例，并在新预警生成
 * 帮扶方案时检索相似案例反哺 Agent2 —— 这是"系统会越用越准"的唯一证据。
 *
 * 设计约束：
 *  1. 不引入向量库 / embedding 服务，用**确定性、可解释**的相似度
 *     （各维度贡献占比的曼哈顿距离 + 风险等级加成），思路对齐 multimodal.js 的轻量检索。
 *  2. 注入模型的上下文必须**脱敏**：不含姓名、学号，只保留班级与风险画像。
 *  3. 单条案例字段缺失（老数据）就跳过该条，绝不让整次检索失败。
 *
 * 存储：localStorage.caseBase，数组，新的在前，最多 300 条
 *   { id:'CASE-<时间戳36进制>', ticketId, studentId, className,
 *     riskLevel, riskScore, factors:[{dim,label,contribution}],
 *     planName, planSummary, checkinRate, outcome:'resolved'|'escalated',
 *     durationDays, closedAt }
 */
(function (global) {
  'use strict';

  var KEY = 'caseBase';
  var MAX = 300;
  var OUTCOME = { resolved: '已解除', escalated: '已升级' };

  /** 方案类型识别（确定性关键词匹配，便于"有效干预方式"按类型统计） */
  var PLAN_RULES = [
    { type: '一对一辅导', re: /一对一|个别辅导|辅导答疑|答疑|导师/ },
    { type: '错题专项', re: /错题|薄弱知识点|专项练习|专项/ },
    { type: '资料推送', re: /MOOC|资料|资源|推送|视频/ },
    { type: '学习计划调整', re: /学习计划|每周安排|计划/ },
    { type: '混合干预', re: /./ }
  ];

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
      try { console.warn('[Cases] 写入失败：' + (e && e.name)); } catch (e2) {}
      return false;
    }
  }

  function classifyPlan(text) {
    var s = String(text || '');
    for (var i = 0; i < PLAN_RULES.length; i++) {
      if (PLAN_RULES[i].re.test(s)) return PLAN_RULES[i].type;
    }
    return '其他';
  }

  function genId(existing) {
    var base = 'CASE-' + Date.now().toString(36);
    var id = base, n = 0;
    while (existing.some(function (c) { return c.id === id; })) { n++; id = base + '-' + n; }
    return id;
  }

  function list() { return read(); }

  /**
   * 案例入库（去重：同一 ticketId 已有案例则更新而不是重复插入）
   * @returns {{ok:boolean, case?:object, error?:string, updated?:boolean}}
   */
  function add(rec) {
    if (!rec || !rec.ticketId) return { ok: false, error: '缺少工单号，无法沉淀案例' };
    var all = read();
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].ticketId) === String(rec.ticketId)) {
        all[i].outcome = rec.outcome || all[i].outcome;
        all[i].closedAt = rec.closedAt || all[i].closedAt;
        all[i].durationDays = (rec.durationDays === undefined) ? all[i].durationDays : rec.durationDays;
        all[i].checkinRate = (rec.checkinRate === undefined) ? all[i].checkinRate : rec.checkinRate;
        var updated = all.splice(i, 1)[0];
        all.unshift(updated);
        if (!write(all)) return { ok: false, error: '本地存储写入失败', updated: false };
        return { ok: true, case: updated, updated: true };
      }
    }
    var item = {
      id: genId(all),
      ticketId: String(rec.ticketId),
      studentId: String(rec.studentId || ''),
      className: rec.className || '未分班',
      riskLevel: rec.riskLevel || '',
      riskScore: (rec.riskScore === undefined || rec.riskScore === null) ? '' : rec.riskScore,
      // 结案时若拿不到 factors 就存空数组——不造数据
      factors: Object.prototype.toString.call(rec.factors) === '[object Array]' ? rec.factors : [],
      planName: rec.planName || '其他',
      planSummary: rec.planSummary || '',
      checkinRate: (typeof rec.checkinRate === 'number') ? rec.checkinRate : 0,
      outcome: rec.outcome === 'escalated' ? 'escalated' : 'resolved',
      durationDays: (typeof rec.durationDays === 'number') ? rec.durationDays : 0,
      closedAt: rec.closedAt || new Date().toISOString()
    };
    all.unshift(item);
    if (!write(all)) return { ok: false, error: '本地存储写入失败' };
    return { ok: true, case: item };
  }

  /* ---------------- 相似度检索（确定性、可解释） ---------------- */

  var DIM_LABEL = { grade: '成绩', attendance: '出勤', homework: '作业', experiment: '实验', wrongbook: '错题回流', base: '基准' };

  /** 把 factors 归一化成 {dim: 占比}（用绝对值，避免正负号影响距离）。
   *  刻意排除 dim==='base'（基准分）：它是打分基准而不是风险因素，
   *  算进来会让所有"严格版"快照互相看起来都很像，也会让"主要因素"写成「基准」。 */
  function vectorize(factors) {
    var v = {}, sum = 0, i;
    if (Object.prototype.toString.call(factors) !== '[object Array]') return v;
    for (i = 0; i < factors.length; i++) {
      var f = factors[i];
      if (!f || !f.dim || f.dim === 'base') continue;
      var w = Math.abs(Number(f.contribution) || 0);
      if (!w) continue;
      v[f.dim] = (v[f.dim] || 0) + w;
      sum += w;
    }
    if (!sum) return {};
    var out = {};
    Object.keys(v).forEach(function (k) { out[k] = v[k] / sum; });
    return out;
  }

  function riskNum(level) { return level === '高' ? 1 : (level === '中' ? 0.5 : 0); }

  function mainDim(vec) {
    var best = null, bestVal = -1;
    Object.keys(vec || {}).forEach(function (k) { if (vec[k] > bestVal) { bestVal = vec[k]; best = k; } });
    return best;
  }

  /**
   * 相似度：各维度贡献占比的曼哈顿距离取反 + 风险等级相同加成。
   * 结果落在 [0,1]，越大越相似；同时给出可读的相似理由。
   */
  function similarity(vecA, levelA, vecB, levelB) {
    var dims = {};
    Object.keys(vecA || {}).forEach(function (k) { dims[k] = true; });
    Object.keys(vecB || {}).forEach(function (k) { dims[k] = true; });
    var keys = Object.keys(dims);
    if (!keys.length) return { score: 0, reason: '两边的判定依据都为空，无法比较' };
    var dist = 0;
    keys.forEach(function (k) { dist += Math.abs((vecA[k] || 0) - (vecB[k] || 0)); });
    var base = Math.max(0, 1 - dist / 2);          // 曼哈顿距离最大为 2
    var lvBonus = (levelA && levelB && levelA === levelB) ? 0.15 : 0;
    var score = Math.min(1, Math.round((base * 0.85 + lvBonus) * 100) / 100);
    var parts = [];
    if (levelA && levelB && levelA === levelB) parts.push('风险等级相同（' + levelA + '风险）');
    var mA = mainDim(vecA), mB = mainDim(vecB);
    if (mA && mA === mB) parts.push('都以「' + (DIM_LABEL[mA] || mA) + '」为主要因素');
    if (!parts.length) parts.push('风险画像相近');
    return { score: score, reason: parts.join('，且') };
  }

  /**
   * 检索相似案例
   * @param {object} snapshot 形如 warningSnapshots[学号]（至少含 riskLevel / factors）
   * @param {number} [k=3]
   * @returns {{ok:boolean, items:Array, total:number, enough:boolean, note:string}}
   */
  function findSimilar(snapshot, k) {
    var topK = (typeof k === 'number' && k > 0) ? k : 3;
    var all = read();
    var snap = snapshot || {};
    var vecA = vectorize(snap.factors);
    var levelA = snap.riskLevel || '';
    var items = [], skipped = 0;

    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      // 老数据 / 字段缺失：跳过该条，不让整次检索失败
      if (!c || !c.ticketId || !c.outcome) { skipped++; continue; }
      var vecB = vectorize(c.factors);
      if (!Object.keys(vecB).length || !Object.keys(vecA).length) { skipped++; continue; }
      var sim = similarity(vecA, levelA, vecB, c.riskLevel);
      items.push({
        id: c.id, ticketId: c.ticketId, className: c.className,
        riskLevel: c.riskLevel, riskScore: c.riskScore, factors: c.factors || [],
        planName: c.planName, planSummary: c.planSummary,
        checkinRate: c.checkinRate, outcome: c.outcome,
        durationDays: c.durationDays, closedAt: c.closedAt,
        score: sim.score, reason: sim.reason
      });
    }
    items.sort(function (x, y) {
      if (y.score !== x.score) return y.score - x.score;
      return String(y.closedAt || '').localeCompare(String(x.closedAt || ''));
    });
    var picked = items.slice(0, topK);
    return {
      ok: true,
      items: picked,
      total: items.length,
      skipped: skipped,
      enough: items.length >= topK,
      note: items.length === 0
        ? '无历史案例可参考'
        : (items.length < topK ? '案例库样本较少（共 ' + items.length + ' 条），仅供参考' : '')
    };
  }

  /**
   * 生成注入 Agent2 的**脱敏**上下文：只有班级与风险画像，绝不含姓名/学号。
   * 措辞克制，不做因果断言之外的发挥。
   */
  function buildAgentContext(items) {
    if (!items || !items.length) return { text: '无历史案例可参考。', count: 0, anonymized: true };
    var resolved = items.filter(function (c) { return c.outcome === 'resolved'; });
    var escalated = items.filter(function (c) { return c.outcome === 'escalated'; });
    var byPlan = {};
    items.forEach(function (c) {
      var key = c.planName || '其他';
      if (!byPlan[key]) byPlan[key] = { resolved: 0, escalated: 0, durations: [] };
      if (c.outcome === 'resolved') { byPlan[key].resolved++; byPlan[key].durations.push(c.durationDays || 0); }
      else byPlan[key].escalated++;
    });
    var lines = [];
    lines.push('参考历史案例（仅画像与结果，已匿名，不含学生身份信息）：');
    lines.push('共 ' + items.length + ' 例相似画像的学生，其中 ' + resolved.length + ' 例解除预警、' + escalated.length + ' 例升级为二级预警。');
    Object.keys(byPlan).forEach(function (name) {
      var s = byPlan[name];
      var avg = s.durations.length ? Math.round(s.durations.reduce(function (a, b) { return a + b; }, 0) / s.durations.length) : null;
      var seg = '采用「' + name + '」的 ' + (s.resolved + s.escalated) + ' 例中，' + s.resolved + ' 例解除';
      if (avg !== null) seg += '（平均 ' + avg + ' 天）';
      if (s.escalated) seg += '，' + s.escalated + ' 例升级为二级预警';
      lines.push('· ' + seg + '。');
    });
    lines.push('以上仅为历史统计，请结合本次学生画像给出建议；最终方案需辅导员审批确认。');
    return { text: lines.join('\n'), count: items.length, anonymized: true };
  }

  /** 「有效干预方式」统计：按方案类型汇总解除率 */
  function effectiveness() {
    var all = read();
    var by = {};
    all.forEach(function (c) {
      if (!c || !c.outcome) return;
      var key = c.planName || '其他';
      if (!by[key]) by[key] = { planName: key, total: 0, resolved: 0, escalated: 0, rates: [] };
      by[key].total++;
      if (c.outcome === 'resolved') { by[key].resolved++; if (typeof c.checkinRate === 'number') by[key].rates.push(c.checkinRate); }
      else by[key].escalated++;
    });
    var out = Object.keys(by).map(function (k) {
      var s = by[k];
      s.resolveRate = s.total ? Math.round((s.resolved / s.total) * 100) : 0;
      s.avgCheckin = s.rates.length ? Math.round((s.rates.reduce(function (a, b) { return a + b; }, 0) / s.rates.length) * 100) / 100 : null;
      s.enough = s.total >= 3;
      return s;
    });
    out.sort(function (x, y) { return y.total - x.total; });
    return out;
  }

  function stats() {
    var all = read();
    var out = { total: all.length, resolved: 0, escalated: 0 };
    all.forEach(function (c) {
      if (c.outcome === 'escalated') out.escalated++;
      else if (c.outcome === 'resolved') out.resolved++;
    });
    return out;
  }

  function clear() { try { global.localStorage.removeItem(KEY); } catch (e) {} }

  global.Cases = {
    KEY: KEY,
    MAX: MAX,
    OUTCOME: OUTCOME,
    DIM_LABEL: DIM_LABEL,
    PLAN_RULES: PLAN_RULES,
    list: list,
    add: add,
    stats: stats,
    clear: clear,
    classifyPlan: classifyPlan,
    vectorize: vectorize,
    similarity: similarity,
    findSimilar: findSimilar,
    buildAgentContext: buildAgentContext,
    effectiveness: effectiveness
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Cases;
})(typeof window !== 'undefined' ? window : this);
