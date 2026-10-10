/**
 * campusProfile.js — 校园多源画像的产品侧适配层
 * ---------------------------------------------------------------
 * 把算法（profileFusion.js）与仿真/存储（signals.js）接到业务上，
 * 并且**把合规做进流程**，而不是写在文案里：
 *
 *   1. 单独同意：`campusConsent`（**新键，已在 README 登记**）记录每个学生是否授权
 *      "校园行为数据参与画像"。**默认未授权**——不授权就不进名单、不参与打分。
 *   2. 可撤回：撤回后立即从名单中移除、不再参与打分，并留痕（`authLog`）。
 *   3. 目的限定：名单只给辅导员看，标注"仅供参考、不自动决策"，不产生任何自动处分。
 *   4. 审计：查看名单写 `Perm.audit({action:'view', fields:['campusSignals','fusionScore']})`。
 *   5. 解释：学生可以看"我自己的行为画像里，哪些源贡献最大"（与教师端同一套算法）。
 *
 * 约束：ES5、零依赖、纯 localStorage。
 */
(function (global) {
  'use strict';

  // Node 下模块里的 `this` 是 module.exports；统一取真正的根对象
  var ROOT = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined' ? globalThis : global);

  // 依赖解析：浏览器下用全局对象；Node 下各自模块作用域不同，退化为 require
  var SignalsRef = ROOT.Signals || null;
  var FusionRef = ROOT.ProfileFusion || null;
  if (typeof require === 'function') {
    try { if (!SignalsRef) SignalsRef = require('./signals.js'); } catch (e) {}
    try { if (!FusionRef) FusionRef = require('./profileFusion.js'); } catch (e) {}
  }

  var CONSENT_KEY = 'campusConsent';
  var COUNT_KEY = 'campusSignalMeta';

  function readJson(key, dflt) {
    try {
      var raw = ROOT.localStorage.getItem(key);
      if (!raw) return dflt;
      var v = JSON.parse(raw);
      return (v === null || v === undefined) ? dflt : v;
    } catch (e) { return dflt; }
  }

  function writeJson(key, val) {
    try { ROOT.localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) {
      try { console.warn('[Campus] 写入失败：' + (e && e.name)); } catch (e2) {}
      return false;
    }
  }

  /* ---------------- 同意管理 ---------------- */

  /** @returns {boolean} 是否已授权（默认 false：不授权不使用） */
  function hasConsent(studentId) {
    var map = readJson(CONSENT_KEY, {});
    return !!(map[String(studentId)] && map[String(studentId)].granted);
  }

  function consentInfo(studentId) {
    var map = readJson(CONSENT_KEY, {});
    return map[String(studentId)] || null;
  }

  /**
   * 授权 / 撤回。authorized 记录在案，撤回保留历史（改 granted=false 而不是删除）。
   * @returns {{ok:boolean, granted:boolean, error?:string}}
   */
  function setConsent(studentId, granted, opts) {
    opts = opts || {};
    if (!studentId) return { ok: false, granted: false, error: '缺少学号' };
    var map = readJson(CONSENT_KEY, {});
    var id = String(studentId);
    var rec = map[id] || {};
    rec.granted = !!granted;
    rec.updatedAt = new Date().toISOString();
    rec.scope = '校园行为数据（考勤/作业/一卡通消费/门禁外出）参与学业画像';
    rec.purpose = '仅用于学业帮扶提醒，不用于任何奖惩、不进入排名、不产生自动处分';
    rec.actor = opts.actor || 'student';
    if (granted) { rec.grantedAt = rec.updatedAt; }
    else { rec.revokedAt = rec.updatedAt; }
    map[id] = rec;
    if (!writeJson(CONSENT_KEY, map)) return { ok: false, granted: !!granted, error: '本地存储写入失败' };
    return { ok: true, granted: !!granted, record: rec };
  }

  /**
   * 批量授权/撤回：**仅供演示与管理员批量导入已取得的同意**（actor 会记录在案）。
   * 生产环境必须是逐个学生自己点同意——UI 上对此有明确标注。
   */
  function setConsentBulk(ids, granted, opts) {
    var n = 0;
    (ids || []).forEach(function (id) {
      var r = setConsent(id, granted, opts);
      if (r.ok) n++;
    });
    return { ok: true, count: n };
  }

  function consentedIds() {
    var map = readJson(CONSENT_KEY, {});
    var out = [];
    Object.keys(map).forEach(function (k) { if (map[k] && map[k].granted) out.push(k); });
    return out;
  }

  function consentStats(allIds) {
    var ids = consentedIds();
    var total = (allIds && allIds.length) ? allIds.length : 0;
    return { granted: ids.length, total: total, pending: Math.max(0, total - ids.length) };
  }

  /* ---------------- 信号读取（撤回后即不参与） ---------------- */

  function loadSignals() {
    if (!SignalsRef || typeof SignalsRef.load !== 'function') return null;
    return SignalsRef.load();
  }

  function hasSignals() {
    var s = loadSignals();
    return !!(s && s.students && s.students.length);
  }

  /** 生成一批与花名册对齐的演示行为数据（真实场景应由校方数据接口写入） */
  function seedDemo(roster, opts) {
    if (!SignalsRef) return { ok: false, error: 'signals.js 未加载' };
    opts = opts || {};
    var cohort = SignalsRef.simulate({
      seed: opts.seed || 42,
      days: opts.days || 112,
      roster: roster || null,
      atRiskRate: opts.atRiskRate
    });
    if (!SignalsRef.save(cohort)) return { ok: false, error: '写入失败' };
    writeJson(COUNT_KEY, { seededAt: new Date().toISOString(), students: cohort.students.length, days: cohort.days, seed: cohort.seed });
    // 存储里不保留 latent 真值（系统不该看到"答案"）
    return { ok: true, students: cohort.students.length, days: cohort.days };
  }

  function clearSignals() {
    if (SignalsRef && SignalsRef.clear) SignalsRef.clear();
    try { ROOT.localStorage.removeItem(COUNT_KEY); } catch (e) {}
  }

  /* ---------------- 教师端：重点关注名单 ---------------- */

  /**
   * 生成重点关注名单（**只纳入已授权学生**；未授权者被排除并计数）。
   * @param {{limit?:number, weights?:object, audit?:boolean}} [opts]
   */
  function focusList(opts) {
    opts = opts || {};
    var sig = loadSignals();
    var all = (sig && sig.students) ? sig.students.map(function (s) { return s.id; }) : [];
    var allowed = consentedIds().filter(function (id) { return all.indexOf(id) !== -1; });
    var excluded = all.length - allowed.length;

    if (!sig || !all.length) {
      return { ok: false, empty: true, reason: 'no-signals', rows: [], granted: 0, excluded: 0 };
    }
    if (!allowed.length) {
      return { ok: true, empty: true, reason: 'no-consent', rows: [], granted: 0, excluded: excluded };
    }
    if (!FusionRef || typeof FusionRef.scoreStudents !== 'function') {
      return { ok: false, empty: true, reason: 'no-algorithm', rows: [], granted: allowed.length, excluded: excluded };
    }
    var scored = FusionRef.scoreStudents(sig, { allowedIds: allowed, weights: opts.weights });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.id).localeCompare(String(b.id));
    });
    var rows = scored.slice(0, opts.limit || 20);
    return {
      ok: true, empty: false, rows: rows,
      granted: allowed.length, excluded: excluded,
      asOf: sig.generatedAt || '', days: sig.days || 0,
      totalScored: scored.length
    };
  }

  /* ---------------- 学生端：我自己的行为画像 ---------------- */

  /**
   * 学生查看自己的行为画像（未授权时不给任何数据）。
   *
   * 口径一致性：**必须与教师端用同一个池子**（都只含已授权学生），否则同一名学生
   * 在教师名单里是 68 分、在自己页面里是 0 分——因为横向标准化依赖"池子里有谁"。
   * 代价是关注度天然是**相对值**（只对同一批授权学生可比），这一点如实标注。
   */
  function myProfile(studentId) {
    if (!studentId) return { ok: false, reason: 'no-id' };
    if (!hasConsent(studentId)) return { ok: false, reason: 'not-granted' };
    var sig = loadSignals();
    if (!sig || !sig.students) return { ok: false, reason: 'no-signals' };
    if (!FusionRef) return { ok: false, reason: 'no-algorithm' };
    var allowed = consentedIds();
    var full = FusionRef.scoreStudents(sig, { allowedIds: allowed });
    var row = null;
    for (var j = 0; j < full.length; j++) {
      if (String(full[j].id) === String(studentId)) { row = full[j]; break; }
    }
    return {
      ok: !!row, row: row, reason: row ? '' : 'not-found',
      poolSize: allowed.length,
      unstable: allowed.length < 5      // 池子太小则横向标准化不稳，UI 要如实提示
    };
  }

  /** 撤回后需要清除的派生结果：本实现不缓存派生结果，故只需返回状态（留作扩展点） */
  function onRevoke(studentId) {
    if (global.Session && global.Session.log) {
      global.Session.log({ event: 'campus_consent_revoked', role: 'student', id: studentId });
    }
    if (global.Perm && global.Perm.audit) {
      global.Perm.audit({ action: 'write', subjectId: studentId, fields: ['campusConsent'] });
    }
    return { ok: true };
  }

  function onGrant(studentId) {
    if (global.Session && global.Session.log) {
      global.Session.log({ event: 'campus_consent_granted', role: 'student', id: studentId });
    }
    if (global.Perm && global.Perm.audit) {
      global.Perm.audit({ action: 'write', subjectId: studentId, fields: ['campusConsent'] });
    }
    return { ok: true };
  }

  var api = {
    CONSENT_KEY: CONSENT_KEY,
    hasConsent: hasConsent,
    consentInfo: consentInfo,
    setConsent: setConsent,
    setConsentBulk: setConsentBulk,
    consentedIds: consentedIds,
    consentStats: consentStats,
    loadSignals: loadSignals,
    hasSignals: hasSignals,
    seedDemo: seedDemo,
    clearSignals: clearSignals,
    focusList: focusList,
    myProfile: myProfile,
    onGrant: onGrant,
    onRevoke: onRevoke
  };
  global.CampusProfile = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
