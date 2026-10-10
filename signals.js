/**
 * signals.js — 校园多源行为信号：存储 + 可控仿真生成器
 * ---------------------------------------------------------------
 * 背景：单靠成绩做画像有先天缺陷——滞后（期末才知道）、稀疏（一学期 3~4 次）、
 * 单一（看不到行为变化）。行为信号（一卡通消费、门禁/外出、考勤、作业）是
 * 日频、连续、但**很弱**的证据。两者融合才可能把预警从"期末算总账"变成"期中就发现"。
 *
 * 本文件负责数据的产生与存放，不含算法（算法在 profileFusion.js）：
 *   1. 存储：localStorage.campusSignals（**新键，已在 README 登记**）
 *   2. 仿真：可控生成器 —— 有 latent 风险真值、各源独立发射模型、个体基线差异、
 *      以及两个关键混杂项（兼职生外出多但不危险 / 困难生消费低但不危险）。
 *
 * 为什么必须用仿真：真实校园数据拿不到，且仿真里**知道真值**才能算提前量、
 * AUC 与消融增益。这是方法验证（method validation），不是真实效果承诺——
 * README 与报告里都如实标注。
 *
 * 约束：ES5 风格、零依赖、无 eval、确定性（同 seed 同结果）。
 */
(function (global) {
  'use strict';

  // Node 下模块里的 `this` 是 module.exports，不是全局对象；统一取真正的根对象
  var ROOT = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined' ? globalThis : global);

  var KEY = 'campusSignals';
  var VERSION = 1;

  /* ---------------- 确定性随机数（纯 ES5 整数 LCG） ---------------- */

  /** 线性同余发生器：s 与乘数相乘仍在 2^53 内，双精度可精确表示，故结果可复现 */
  function makeRng(seed) {
    var s = (seed >>> 0) || 12345;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  /** Box-Muller 正态分布（消耗两个均匀随机数） */
  function makeGauss(rng) {
    return function (mu, sigma) {
      var u1 = rng() || 1e-9, u2 = rng();
      var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mu + (sigma === undefined ? 1 : sigma) * z;
    };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }

  /* ---------------- 常量 ---------------- */

  var SUBJECTS = ['高数', '英语', '编程', '计算机基础'];
  // 各源的时间滞后：观测反映的是若干天前的真实状态（成绩的滞后最明显）
  var LAG = { grades: 10, attendance: 3, homework: 3, access: 0, card: 0, mealCount: 0, nightAccess: 0, unexcused: 3 };
  // 观测节奏（天）
  var CADENCE = { grades: 28, attendance: 7, homework: 7, access: 1, card: 1, mealCount: 1, nightAccess: 1, unexcused: 7 };
  var CRITICAL = 1.0;   // latent 风险达到该值即视为"需要干预"（评估用的真值）

  /**
   * MVP-2a 新增观测的"风险响应强度"（featureScale）默认值。
   * 取值依据（刻意保守，避免把仿真调成有利于自己的样子）：
   *   · 就餐次数：风险升高 1 个单位 → 日均少吃约 1.1 顿（个体噪声 σ=0.55），信噪比约 2
   *   · 夜间门禁：风险升高 1 个单位 → 每晚多约 1.2 次晚归（个体噪声 σ=0.7），信噪比约 1.7
   *   · 未请假缺勤：风险升高 1 个单位 → 周缺勤率多约 45 个百分点（噪声 σ=4）
   * 这个强度**在建模时固定、不按结果回调**；test-fusion.js 另外做敏感性扫描
   * （0.5×/1.0×/1.5×），回答"信号要多强才值得采集"，而不是只报一个好看的数字。
   */
  var FEATURE_SCALE = 1.0;

  /**
   * 个体间异质性倍数（heteroScale）默认值。
   * 它放大"学生的习惯水平差异"（如有人习惯性 99% 出勤、有人习惯性 88%）。
   *
   * 为什么需要这个旋钮：个体基线的价值取决于『个体间差异 / 风险造成的真实变化』这个比值。
   * 该比值小的时候，绝对阈值（群体线）本身就够准，个体基线白付了"估基线"的成本；
   * 比值大的时候，绝对阈值会把高基线学生的下滑漏掉、把低基线学生误报。默认 1.0×
   * 表示沿用工程直觉的保守取值，真正要回答"什么时候该用个体基线"必须扫这个旋钮。
   */
  var HETERO_SCALE = 1.0;

  var SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '林', '何', '高', '罗'];
  var GIVEN = ['伟', '芳', '娜', '敏', '静', '强', '磊', '洋', '艳', '勇', '军', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '桂英', '鑫', '宇', '晨', '雨', '浩然', '子轩', '欣怡'];

  /* ---------------- latent 风险轨迹 ---------------- */

  /**
   * r(t) = 个体倾向 + 恶化斜率 × (t − onset)
   * 只有部分学生（atRisk）会真正恶化；其余保持平稳倾向。
   */
  function latentRisk(stu, t) {
    if (!stu.atRisk || t < stu.onset) return stu.propensity;
    return stu.propensity + stu.slope * (t - stu.onset);
  }

  function criticalDay(stu, days) {
    for (var t = 1; t <= days; t++) {
      if (latentRisk(stu, t) >= CRITICAL) return t;
    }
    return -1;   // 观测窗口内未发生临界事件
  }

  /* ---------------- 仿真主函数 ---------------- */

  /**
   * 生成一批学生的一学期多源数据。
   * @param {{seed?:number, students?:number, days?:number, atRiskRate?:number}} opts
   * @returns {{seed:number, days:number, students:Array}}
   */
  function simulate(opts) {
    opts = opts || {};
    var seed = opts.seed || 1;
    var n = opts.students || 200;
    var days = opts.days || 112;              // 16 周
    var atRiskRate = opts.atRiskRate === undefined ? 0.42 : opts.atRiskRate;
    var fscale = opts.featureScale === undefined ? FEATURE_SCALE : opts.featureScale;
    var vscale = opts.heteroScale === undefined ? HETERO_SCALE : opts.heteroScale;

    var rng = makeRng(seed);
    var gauss = makeGauss(rng);
    var students = [];
    var roster = opts.roster && opts.roster.length ? opts.roster : null;
    if (roster) n = roster.length;

    for (var i = 0; i < n; i++) {
      var stu = {
        id: roster ? String(roster[i].id) : ('S' + (1000 + i)),
        name: roster ? (roster[i].name || ('学生' + roster[i].id)) : (SURNAMES[Math.floor(rng() * SURNAMES.length)] + GIVEN[Math.floor(rng() * GIVEN.length)]),
        className: roster ? (roster[i].className || '未分班') : ('软件工程21' + (1 + (i % 3))),
        // ---- latent 真值（仅供评估，不进存储） ----
        propensity: round1(gauss(0, 0.55)),
        atRisk: rng() < atRiskRate,
        onset: 0,
        slope: 0,
        // ---- 个体基线（这正是"群体阈值"会失手的地方）----
        baseGrade: round1(gauss(78, 7)),        // 学霸/学困的自身水平不同
        subjectOffset: [round1(gauss(0, 2.5)), round1(gauss(0, 2.5)), round1(gauss(0, 2.5)), round1(gauss(0, 2.5))],
        baseAtt: round1(gauss(96, 1.6 * vscale)),        // 有人习惯性 98，有人习惯性 93
        baseHw: round1(gauss(96, 2.0 * vscale)),         // 作业提交率同样存在个体习惯差异
        baseOut: round1(Math.max(0.2, gauss(2.0, 1.0))),   // 宅 vs 爱出门
        baseSpend: round1(Math.max(8, gauss(38, 11))),     // 消费水平本身差异很大
        baseMeals: Math.round(Math.max(1, Math.min(3, gauss(2.4, 0.4)))),  // 有人习惯两顿、有人三顿
        baseNight: round1(Math.max(0, gauss(0.3, 0.3))),   // 有人本来就常晚归（混杂项）
        // ---- 两个关键混杂项 ----
        partTime: false,   // 兼职：外出多，但与学业风险无关
        poor: false        // 家庭困难：消费低，但与学业风险无关
      };
      if (stu.atRisk) {
        stu.onset = 15 + Math.floor(rng() * 65);
        stu.slope = 0.010 + rng() * 0.012;
      }
      if (rng() < 0.18) { stu.partTime = true; stu.baseOut += 3.0; }
      if (rng() < 0.20) { stu.poor = true; stu.baseSpend = round1(stu.baseSpend * 0.6); }

      stu.criticalDay = criticalDay(stu, days);
      stu.event = stu.criticalDay > 0;

      // ---- 各源观测 ----
      var series = { grades: [], attendance: [], homework: [], access: [], card: [] };
      var t;

      // 成绩：每 28 天一次，反映 10 天前的状态（滞后），按科目分别产出
      for (t = CADENCE.grades; t <= days; t += CADENCE.grades) {
        var rG = latentRisk(stu, t - LAG.grades);
        var row = { day: t };
        for (var s = 0; s < SUBJECTS.length; s++) {
          row[SUBJECTS[s]] = Math.round(clamp(stu.baseGrade - 22 * rG + stu.subjectOffset[s] + gauss(0, 4), 0, 100));
        }
        series.grades.push(row);
      }

      // 考勤 / 作业：每周一次
      for (t = CADENCE.attendance; t <= days; t += CADENCE.attendance) {
        var rA = latentRisk(stu, t - LAG.attendance);
        series.attendance.push({ day: t, value: Math.round(clamp(stu.baseAtt - 26 * rA + gauss(0, 2.5), 40, 100)) });
        series.homework.push({ day: t, value: Math.round(clamp(stu.baseHw - 28 * rA + gauss(0, 3), 0, 100)) });
      }

      // 一卡通消费 / 门禁外出：每天都有（日频，是"早发现"的关键）
      for (t = 1; t <= days; t++) {
        var rD = latentRisk(stu, t);
        series.access.push({ day: t, value: Math.max(0, round1(stu.baseOut - 2.2 * rD + gauss(0, 0.9))) });
        series.card.push({ day: t, amount: Math.max(1, round1(stu.baseSpend * (1 - 0.30 * rD) + gauss(0, 4))) });
      }

      // ---- MVP-2a 新增：节律型观测（比"原始次数"更贴近真实风险，且与个体习惯水平弱相关）----
      series.mealCount = [];
      series.nightAccess = [];
      for (t = 1; t <= days; t++) {
        var rD2 = latentRisk(stu, t);
        // 就餐次数：风险升高 → 漏餐（0~3 顿）
        series.mealCount.push({
          day: t,
          value: Math.round(Math.max(0, Math.min(3, stu.baseMeals - 1.1 * fscale * rD2 + gauss(0, 0.55))))
        });
        // 夜间门禁（23:00 后）：风险升高 → 晚归增多
        series.nightAccess.push({
          day: t,
          value: Math.max(0, Math.round(stu.baseNight + 1.2 * fscale * rD2 + gauss(0, 0.7)))
        });
      }
      // 未请假缺勤（周频，%）：把"请假"从缺勤里区分出来——这是教务系统本来就有、但现行规则没用的信息
      series.unexcused = [];
      for (t = CADENCE.unexcused; t <= days; t += CADENCE.unexcused) {
        var rW = latentRisk(stu, t - LAG.unexcused);
        series.unexcused.push({
          day: t,
          value: Math.round(Math.max(0, Math.min(100, 2 + 45 * fscale * rW + gauss(0, 4))))
        });
      }

      stu.series = series;
      students.push(stu);
    }

    return { seed: seed, days: days, students: students, critical: CRITICAL, subjects: SUBJECTS.slice() };
  }

  /* ---------------- 存储（只存信号，不存真值） ---------------- */

  /** 剥掉 latent 真值，只保留可被系统看到的数据 */
  function toStore(cohort) {
    return {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      seed: cohort.seed,
      days: cohort.days,
      students: (cohort.students || []).map(function (s) {
        return { id: s.id, name: s.name, className: s.className, series: s.series };
      })
    };
  }

  function save(cohort) {
    try {
      ROOT.localStorage.setItem(KEY, JSON.stringify(toStore(cohort)));
      return true;
    } catch (e) {
      try { console.warn('[Signals] 写入失败：' + (e && e.name)); } catch (e2) {}
      return false;
    }
  }

  function load() {
    try {
      var raw = ROOT.localStorage.getItem(KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return (obj && obj.students) ? obj : null;
    } catch (e) { return null; }
  }

  function clear() {
    try { ROOT.localStorage.removeItem(KEY); } catch (e) {}
  }

  var api = {
    KEY: KEY,
    VERSION: VERSION,
    SUBJECTS: SUBJECTS,
    LAG: LAG,
    CADENCE: CADENCE,
    CRITICAL: CRITICAL,
    FEATURE_SCALE: FEATURE_SCALE,
    HETERO_SCALE: HETERO_SCALE,
    makeRng: makeRng,
    makeGauss: makeGauss,
    latentRisk: latentRisk,
    simulate: simulate,
    toStore: toStore,
    save: save,
    load: load,
    clear: clear
  };
  global.Signals = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
