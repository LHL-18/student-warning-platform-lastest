/**
 * profileFusion.js — 个性化多源证据融合（MVP-1 算法骨架）
 * ---------------------------------------------------------------
 * 核心主张：**外出频率本身不是坏信号**。一个平时天天出门的学生突然不出门，
 * 和一个本来就宅的学生天天不出门，含义完全不同。所以第一层不是群体阈值，
 * 而是每个学生自己的基线。算法分五步：
 *
 *   1. 个体基线偏离度：用该生**学期初固定参考窗**的中位数/MAD 做鲁棒标准化；
 *      样本少时向群体基线收缩（λ = n/(n+n₀)），冷启动不硬猜。
 *   2. 时间衰减：成绩是月频、行为是日频，用 exp(−Δt/τ) 让"新鲜证据"更重，
 *      同时自然解决异步、不等间隔采样。
 *   3. 对数几率融合：d(t) = Σ wₛ · zₛ(t) · decayₛ(t)；权重先给专家先验
 *      （MVP-2 用申诉/结案标签学习，并带 L2 收缩）。
 *   4. 自中心化：减去该生参考窗内自身的平均偏离，去掉恒定偏置
 *      （见 selfCenter 注释：不做这一步，CUSUM 会把常量一路积分）。
 *   5. 单边 CUSUM：S(t) = max(0, S(t−1) + d(t) − k)。持续恶化会不断累积，
 *      不会像单点阈值那样"闪一下又消失"。
 *
 * 冲突度：K(t) = 1 − |Σ w·z| / Σ w·|z|。各源打架时（成绩好但行为异常）K 升高，
 * 这类样本应**转人工核实**，而不是自动升级等级。
 *
 * 评估口径（与 test-fusion.js 配合）：与"仅成绩"和"现行系统"在**同等误报预算**下
 * 比较检出率与平均提前天数（matched-FAR），避免"调松阈值换召回"的假优势；
 * 再用消融实验量化每个源的信息增益。
 *
 * 约束：ES5 风格、零依赖、无 eval；纯函数式，不写任何存储。
 */
(function (global) {
  'use strict';

  var SOURCES = ['grades', 'attendance', 'homework', 'access', 'card',
    'mealRhythm', 'nightRhythm', 'excusedAttend'];

  var SRC_LABEL = {
    grades: '成绩', attendance: '考勤', homework: '作业',
    access: '门禁外出(原始)', card: '一卡通消费(原始)',
    mealRhythm: '就餐节律', nightRhythm: '夜间作息', excusedAttend: '未请假缺勤'
  };

  /** 专家先验权重（合计 1.0，便于解释；MVP-2 由标签学习并收缩到此先验） */
  var PRIOR_WEIGHTS = { grades: 0.38, attendance: 0.20, homework: 0.12, access: 0.18, card: 0.12 };

  /**
   * 两组权重画像，用于 MVP-2a 的对照实验：
   *   raw      —— MVP-1：行为侧用"原始次数"（门禁次数、消费额）
   *   features —— MVP-2a：行为侧换成**节律型特征**（就餐节律、夜间作息、未请假缺勤）
   * 两组都保留 成绩/考勤/作业，差别只在行为源，这样才能干净地比较"原始次数 vs 节律特征"。
   */
  var WEIGHT_PROFILES = {
    raw: { grades: 0.38, attendance: 0.20, homework: 0.12, access: 0.18, card: 0.12 },
    features: { grades: 0.34, attendance: 0.14, homework: 0.10, mealRhythm: 0.14, nightRhythm: 0.14, excusedAttend: 0.14 }
  };

  /** 各源的语义方向（统一成"数值越低越危险"） */
  var WEIGHT_NAMES = {
    grades: '成绩低于自身水平', attendance: '考勤低于自身水平', homework: '作业低于自身水平',
    access: '外出频次低于自身水平', card: '消费低于自身水平',
    mealRhythm: '近 7 天日均就餐次数偏少', nightRhythm: '近 7 天晚归天数偏多',
    excusedAttend: '未请假缺勤率偏高'
  };

  /** 鲁棒尺度下限，避免 MAD=0 时 z 爆炸 */
  var MIN_SCALE = {
    grades: 4, attendance: 3, homework: 4, access: 0.8, card: 5,
    mealRhythm: 0.3, nightRhythm: 0.8, excusedAttend: 5
  };

  /**
   * 计数型信号：做 log(1+x) 变换后再算偏离度（MVP-2c 步骤 B）。
   *
   * 为什么必须做：外出次数/消费额是**非负量**，低基线学生的"向下偏离"被 0 截断
   * （下限效应）——一个平时每天出门 1 次的学生不可能"少出门 3 次"，而平时 6 次的学生可以。
   * 于是对称的 z 检验天然更爱报警高基线学生，群体阈值则相反（系统性误报"宅"的学生）。
   * 取对数后偏离度变成**相对变化**：无论基线是 1 还是 6，掉 50% 给同样的 z，
   * 下限效应被消除，两组学生的误报率也随之拉平。
   *
   * 百分比类信号（考勤率、作业率、合规出勤率）不做变换：它们本来就有意义的 0~100 基准。
   */
  var COUNT_SOURCES = { access: true, card: true, mealRhythm: true, nightRhythm: true };

  /** 计数型源的 log 尺度下限（与未变换时的量纲不同，故单独给值） */
  var MIN_SCALE_LOG = { access: 0.25, card: 0.12, mealRhythm: 0.10, nightRhythm: 0.40 };

  function transformValue(kind, v, useLog) {
    if (!COUNT_SOURCES[kind] || useLog === false) return v;
    var n = Number(v);
    if (!isFinite(n)) return null;
    return Math.log(1 + Math.max(0, n));
  }

  function scaleFloor(kind, useLog) {
    if (!COUNT_SOURCES[kind]) return MIN_SCALE[kind];
    // 注意：下限必须与**当前尺度**匹配。曾经漏传 useLog，线性模式下误用 log 下限（更小），
    // z 被整体放大、检出率从 85% 崩到 32%——这是"配置开关泄漏进尺度估计"的典型 bug。
    return (useLog === false) ? MIN_SCALE[kind] : MIN_SCALE_LOG[kind];
  }

  /**
   * 计数型信号的**泊松方差归一化尺度**（MVP-2e）。
   *
   * 动机：上一版用 log(1+x) + 固定下限，拿到了提前量但公平性偏差从 3.6% 升到 7.0%。
   * 根因是"固定下限"对所有人都一样大，而计数型噪声本身随水平变化：泊松下
   *   Var(X) = λ  ⇒  sd(log(1+X)) ≈ √λ/(1+λ)     （delta 方法）
   * 于是 λ 小的学生（宅）噪声本来就大、λ 大的（爱出门）噪声小。用与 λ 匹配的尺度做残差，
   * 就能同时保住"相对变化可比"（log 的好处）和"按各自噪声定显著性"（公平性）。
   *
   * φ 为过散系数（真实计数普遍过散，取 2 更保守），下限 0.25 避免零计数处除零。
   */
  var POISSON_PHI = 2.0;

  function poissonLogScale(level) {
    var lam = Math.max(0.25, Number(level) || 0);
    return Math.sqrt(POISSON_PHI * lam) / (1 + lam);
  }

  /** 时间衰减常数（天）：行为信号必须新鲜，成绩证据可以留存久一些 */
  var DECAY_TAU = {
    grades: 45, attendance: 12, homework: 12, access: 4, card: 4,
    mealRhythm: 5, nightRhythm: 5, excusedAttend: 10
  };

  /** 个人基线窗口（兼容保留：新实现改用固定参考窗）与收缩强度 */
  var PERSONAL_WINDOW = { grades: 3, attendance: 4, homework: 4, access: 21, card: 21 };
  var SHRINK_N0 = 6;

  /**
   * 参考窗（学期初）——**固定**基线，不滚动。
   * 第一版用滚动窗口时踩了坑：学生连续下降 3 周后，滚动窗口把下降本身吸收进基线，
   * z 回归正常，检测器又"看不见"了（消融实验里表现为"去掉考勤反而更准"）。
   * 取 21 天（3 周）是在"基线估计稳定"与"不吸收早期恶化"之间折中；
   * 学生恶化最早自第 15 天起，而中位数对少量后段样本是稳健的。
   */
  var REFERENCE_DAYS = 21;

  /**
   * 滑动双窗变化检测（MVP-2b）：把"固定 21 天参考窗"升级为两个滑动窗。
   *   · 参考窗（长窗 42 天，且**排除最近 7 天**）：刻画该生"平时的水平"
   *   · 检测窗（短窗 7 天）：刻画"最近的状态"
   *   偏离度 z = (参考窗水平 − 检测窗水平) / 尺度
   *
   * 为什么这样更好：
   *   1. 固定窗口会被**自身早期恶化污染**——学生第 15 天开始下滑时，21 天参考窗里
   *      已经有 6 天下滑样本，基线被抬高、z 被低估，预警被迫变晚。
   *   2. 两个窗口**不重叠**是关键：若短窗落在长窗内部，"最近状态"会被自己的参考值稀释，
   *      偏离度恒小，等于检测器失明。
   *   3. 滑动参考窗还让"长期合法变化"（如整体学业水平提升）自然被吸收，
   *      只对"相对自己近期习惯的突变"敏感。
   */
  var SHORT_WIN = 7;
  var LONG_WIN = 42;

  /**
   * 中窗（MVP-2f）：与长窗**并行**的第二个滑动尺度。
   * 为什么需要它：长窗 42 天滞后太大——学生第 30 天开始下滑、到第 55 天时，
   * 长窗里还有一半是下滑前的干净样本，中位数被拖住、偏离度被低估。
   * 21 天中窗对"两三周前开始的持续变化"响应更快，而 42 天长窗更抗噪。
   * 两个尺度失效模式不同，故并行取最大（与"锚定 vs 滑动"同一个思路）。
   */
  var MID_WIN = 21;

  /** CUSUM 参考值兜底（正常由 estimateK 按统计量自身尺度估计） */
  var CUSUM_K = 0.35;

  /** 现行系统的群体阈值（与 riskPlugins/strict.js 保持一致） */
  var GROUP_THRESHOLDS = { grade: 60, attendance: 80, homework: 70 };

  /** 课程权重沿用 weighted 插件的思路（高数/编程 1.2） */
  var SUBJECT_W = { '高数': 1.2, '英语': 1.0, '编程': 1.2, '计算机基础': 1.0 };

  var DEFAULT_FAR = 0.10;      // 误报预算：10% 的非事件学生可被误报
  var EVAL_DAY = 56;           // AUC 的期中检查点（第 8 周）

  /* ---------------- 基础统计 ---------------- */

  function median(arr) {
    if (!arr || !arr.length) return null;
    var a = arr.filter(function (v) { return typeof v === 'number' && isFinite(v); }).sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /** 1.4826×MAD 是正态下与标准差一致的一致估计 */
  function robustScale(arr, floor) {
    var clean = (arr || []).filter(function (v) { return typeof v === 'number' && isFinite(v); });
    if (clean.length < 2) return floor;
    var med = median(clean);
    var dev = clean.map(function (v) { return Math.abs(v - med); });
    var s = 1.4826 * median(dev);
    return Math.max(s, floor);
  }

  function gradeValue(row) {
    var wSum = 0, wTotal = 0;
    for (var k in SUBJECT_W) {
      if (!SUBJECT_W.hasOwnProperty(k)) continue;
      if (row[k] === undefined || row[k] === null) continue;
      wSum += row[k] * SUBJECT_W[k];
      wTotal += SUBJECT_W[k];
    }
    return wTotal > 0 ? wSum / wTotal : 0;
  }

  function minSubject(row) {
    var mn = null;
    for (var k in SUBJECT_W) {
      if (!SUBJECT_W.hasOwnProperty(k)) continue;
      if (row[k] === undefined || row[k] === null) continue;
      if (mn === null || row[k] < mn) mn = row[k];
    }
    return mn === null ? 100 : mn;
  }

  /* ---------------- 预处理 ---------------- */

  /** 滚动窗口均值（用于就餐节律：近 7 天日均就餐次数） */
  function rollingMean(list, win) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var d = list[i].day, sum = 0, n = 0;
      for (var j = i; j >= 0 && list[j].day > d - win; j--) { sum += list[j].value; n++; }
      out.push({ day: d, value: n ? sum / n : 0, minSubject: 0 });
    }
    return out;
  }

  /** 滚动窗口内"取值为 0 的天数"（用于夜间作息：近 7 天无晚归的天数） */
  function rollingZeroDays(list, win) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var d = list[i].day, zeros = 0;
      for (var j = i; j >= 0 && list[j].day > d - win; j--) { if (list[j].value <= 0) zeros++; }
      out.push({ day: d, value: zeros, minSubject: 0 });
    }
    return out;
  }

  function prepare(cohort, opts) {
    var useLog = !(opts && opts.logCounts === false);   // 默认开启 log 变换；可关闭做对照
    return (cohort.students || []).map(function (s) {
      var ser = s.series || {};
      var src = {};
      src.grades = (ser.grades || []).map(function (row) {
        return { day: row.day, value: gradeValue(row), minSubject: minSubject(row) };
      });
      src.attendance = (ser.attendance || []).map(function (o) { return { day: o.day, value: o.value, minSubject: o.value }; });
      src.homework = (ser.homework || []).map(function (o) { return { day: o.day, value: o.value, minSubject: o.value }; });
      src.access = (ser.access || []).map(function (o) {
        return { day: o.day, value: transformValue('access', o.value, useLog), minSubject: o.value };
      });
      src.card = (ser.card || []).map(function (o) {
        var raw = (o.amount !== undefined ? o.amount : o.value);
        return { day: o.day, value: transformValue('card', raw, useLog), minSubject: raw };
      });

      // ---- MVP-2a 派生特征：把"原始次数"换成**节律型**特征（统一定义为"越低越危险"）----
      // 为什么要换：原始外出次数/消费额被"个体习惯水平"主导（爱出门、消费高的人天然值大），
      // 而节律型特征刻画的是"作息是否规律"，与习惯水平弱相关。
      src.mealRhythm = rollingMean(ser.mealCount || [], 7).map(function (o) {        // 近 7 天日均就餐次数
        return { day: o.day, value: transformValue('mealRhythm', o.value, useLog), minSubject: o.value };
      });
      src.nightRhythm = rollingZeroDays(ser.nightAccess || [], 7).map(function (o) { // 近 7 天无晚归天数
        return { day: o.day, value: transformValue('nightRhythm', o.value, useLog), minSubject: o.value };
      });
      src.excusedAttend = (ser.unexcused || []).map(function (o) {                   // 合规出勤率 = 100 − 未请假缺勤率
        var raw = Number(o.value);
        return { day: o.day, value: isFinite(raw) ? Math.max(0, 100 - raw) : null, minSubject: 0 };
      });

      SOURCES.forEach(function (kind) {
        src[kind] = (src[kind] || []).filter(function (o) {
          return o && isFinite(Number(o.day)) && typeof o.value === 'number' && isFinite(o.value);
        });
      });

      return {
        id: s.id, name: s.name, className: s.className,
        src: src,
        criticalDay: s.criticalDay === undefined ? -1 : s.criticalDay,
        event: !!s.event,
        partTime: !!s.partTime,
        poor: !!s.poor,
        baseOut: s.baseOut === undefined ? null : s.baseOut
      };
    });
  }

  /** 取某源在 day 当天（含之前）最新一条观测 */
  function latestAt(list, day) {
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].day <= day) return list[i];
    }
    return null;
  }

  /* ---------------- 群体（横截面）基线 ---------------- */

  /** 逐日逐源计算横截面中位数与鲁棒尺度，作为冷启动与收缩的锚 */
  function populationStats(prepared, days, useLog) {
    var stats = {};
    SOURCES.forEach(function (kind) {
      stats[kind] = [];
      for (var t = 1; t <= days; t++) {
        var vals = [];
        for (var i = 0; i < prepared.length; i++) {
          var ob = latestAt(prepared[i].src[kind], t);
          if (ob) vals.push(ob.value);
        }
        stats[kind][t] = { median: median(vals), scale: robustScale(vals, scaleFloor(kind, useLog)) };
      }
    });
    return stats;
  }

  /**
   * 学期初参考基线（固定，不滚动）：成绩要等到第一次月考，故参考窗放宽一个月。
   * 观测不足 3 条时只借用自己的中位数、尺度仍用群体值（冷启动阶梯）。
   */
  function referenceStats(student, kind, refDays, useLog) {
    var list = student.src[kind], vals = [], raw = [];
    var limit = (kind === 'grades') ? (refDays + 28) : refDays;
    for (var i = 0; i < list.length; i++) {
      if (list[i].day <= limit) { vals.push(list[i].value); raw.push(list[i].minSubject); }
    }
    if (!vals.length) return null;
    return {
      median: median(vals),
      scale: vals.length >= 3 ? robustScale(vals, scaleFloor(kind, useLog)) : null,
      // 原始尺度（未取对数）的基线水平，用于按泊松推导该生的噪声尺度
      rawLevel: median(raw),
      n: vals.length
    };
  }

  /* ---------------- 逐日偏离序列 ---------------- */

  /**
   * 取"最近 fromDay 天以内、但早于 toDay 天"的观测值（toDay=0 表示含当天）。
   * list 按 day 升序，因此越过上界即可提前结束。
   */
  function windowValues(list, t, fromDay, toDay, raw) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var d = list[i].day;
      if (d > t - toDay) break;
      if (d > t - fromDay) out.push(raw ? list[i].minSubject : list[i].value);
    }
    return out;
  }

  function meanOf(arr) {
    var clean = (arr || []).filter(function (v) { return typeof v === 'number' && isFinite(v); });
    if (!clean.length) return 0;
    var s = 0;
    for (var i = 0; i < clean.length; i++) s += clean[i];
    return s / clean.length;
  }

  /**
   * d(t) = Σ wₛ · zₛ(t) · decayₛ(t)。
   *
   * @param {string} refMode 参考假设：
   *   'anchor' —— 锚定参考：用学期初固定窗口（不滚动）。不会"适应恶化"，但对早期恶化污染敏感。
   *   'slide'  —— 滑动参考：长窗[42d,7d) 中位数 vs 短窗[7d] 均值。抗污染、能吸收长期合法变化，
   *               但会**逐步适应**持续恶化（第一版滚动窗口就栽在这上面）。
   *   两个假设各有失效模式，故 evaluate() 会**并行算两套**再取证据最大者，而不是二选一。
   */
  function deviationSeries(student, popStats, weights, days, refDays, refMode, useLog, poissonScale, winFrom) {
    weights = weights || PRIOR_WEIGHTS;
    refDays = refDays === undefined ? REFERENCE_DAYS : refDays;
    refMode = refMode || 'anchor';
    winFrom = winFrom || LONG_WIN;          // 滑动参考的"参考窗长度"（多尺度时传 MID_WIN）
    var usePoisson = (poissonScale !== false) && (useLog !== false);

    var ref = {};
    SOURCES.forEach(function (kind) { ref[kind] = referenceStats(student, kind, refDays, useLog); });

    var D = [], conflict = [], contrib = [];
    var ptr = {};
    SOURCES.forEach(function (kind) { ptr[kind] = -1; });

    for (var t = 1; t <= days; t++) {
      var d = 0, absSum = 0;
      var dayContrib = [];

      for (var si = 0; si < SOURCES.length; si++) {
        var kind = SOURCES[si];
        var list = student.src[kind];
        while (ptr[kind] + 1 < list.length && list[ptr[kind] + 1].day <= t) ptr[kind]++;
        if (ptr[kind] < 0) continue;

        var cur = list[ptr[kind]];
        var pop = popStats[kind][t];
        var popZ = (pop.median - cur.value) / pop.scale;
        var r = ref[kind];
        var z;

        if (refMode === 'slide') {
          var shortVals = windowValues(list, t, SHORT_WIN, 0);
          var refVals = windowValues(list, t, winFrom, SHORT_WIN);
          if (refVals.length >= 2 && shortVals.length >= 1) {
            var refLevel = median(refVals);
            var shortLevel = meanOf(shortVals);
            var pS;
            if (usePoisson && COUNT_SOURCES[kind]) {
              pS = poissonLogScale(median(windowValues(list, t, winFrom, SHORT_WIN, true)));
            } else {
              pS = Math.max((r && r.scale) || 0, pop.scale * 0.75);
            }
            z = (refLevel - shortLevel) / pS;
          } else if (r) {
            var pS2 = (usePoisson && COUNT_SOURCES[kind])
              ? poissonLogScale(r.rawLevel)
              : Math.max(r.scale || 0, pop.scale * 0.75);
            var lam2 = r.n / (r.n + SHRINK_N0);
            z = lam2 * ((r.median - cur.value) / pS2) + (1 - lam2) * popZ;
          } else {
            z = popZ;
          }
        } else {
          if (r) {
            // 计数源：尺度由该生自身基线水平按泊松推导（λ 小→噪声大），而非固定下限
            var pScale = (usePoisson && COUNT_SOURCES[kind])
              ? poissonLogScale(r.rawLevel)
              : Math.max(r.scale || 0, pop.scale * 0.75);
            var lambda = r.n / (r.n + SHRINK_N0);                    // 分层收缩
            z = lambda * ((r.median - cur.value) / pScale) + (1 - lambda) * popZ;
          } else {
            z = popZ;                                   // 第 28 天前无成绩等冷启动情形
          }
        }

        var age = t - cur.day;
        var decay = Math.exp(-age / DECAY_TAU[kind]);
        var w = weights[kind] || 0;
        var c = w * z * decay;
        dayContrib.push({ kind: kind, z: z, decay: decay, weight: w, contribution: c, age: age });
        d += c;
        absSum += Math.abs(c);
      }

      D.push(d);
      conflict.push(absSum > 1e-9 ? 1 - Math.abs(d) / absSum : 0);
      contrib.push(dayContrib);
    }
    return { D: D, conflict: conflict, contrib: contrib };
  }

  /**
   * 单边 CUSUM：S(t) = max(0, S(t−1) + d(t) − k)。
   * 持续恶化会不断累积，不会像单点阈值那样"闪一下又消失"。
   */
  function cusum(D, k) {
    var L = [], s = 0;
    for (var t = 0; t < D.length; t++) {
      s = Math.max(0, s + D[t] - k);
      L.push(s);
    }
    return L;
  }

  /**
   * 自中心化：减去该生参考窗内自身的平均偏离。
   *
   * 为什么必须做：成绩源在参考窗内没有观测，只能用群体基线 → 天生低于全校中位数的那
   * 一半学生会有一个**恒定正偏置**；CUSUM 会把这个常量一路积分，结果所有人都在缓慢
   * 漂移、阈值被迫抬高、真正的恶化反而被更晚发现。减去自身参考均值后，CUSUM 只累积
   * "相对自己基线期的变化"——这是控制图的标准用法。
   */
  function selfCenter(D, refDays) {
    if (!D || !D.length) return { Dc: D || [], mu0: 0 };
    var sum = 0, count = 0, Dc = [];
    for (var j = 0; j < D.length; j++) {
      var baseline = count ? sum / count : 0;
      var value = isFinite(D[j]) ? D[j] : 0;
      Dc.push(value - baseline);
      if (j < refDays && isFinite(D[j])) { sum += D[j]; count++; }
    }
    return { Dc: Dc, mu0: count ? sum / count : 0, baselineSource: count ? 'prefix' : 'cohort' };
  }

  /**
   * 估计 CUSUM 参考值 k：取"参考窗内自中心化偏离度"的稳健标准差的一半。
   * k 必须与统计量自身量纲匹配——第一版写死 0.35，而加权融合后的 d 尺度只有 0.2~1.0，
   * 减去 0.35 会把信号吃掉，导致预警比单点规则还晚。
   */
  function estimateK(centeredList, refDays) {
    var scales = [];
    for (var i = 0; i < centeredList.length; i++) {
      var win = (centeredList[i].Dc || []).slice(0, refDays);
      if (win.length < 5) continue;
      var s = robustScale(win, 0);
      if (s > 0) scales.push(s);
    }
    if (!scales.length) return CUSUM_K;
    return Math.max(0.02, median(scales) * 0.5);
  }

  /**
   * 估计"急性通道"的标准化尺度：取参考窗内自中心化偏离度的稳健标准差（跨学生取中位数）。
   * 用全局常数而非每个学生各自的尺度，避免参考窗内方差近乎为 0 时把信号放大成噪声。
   */
  function estimateSigma(centeredList, refDays, floor) {
    var scales = [];
    for (var i = 0; i < centeredList.length; i++) {
      var win = (centeredList[i].Dc || []).slice(0, refDays);
      if (win.length < 5) continue;
      var s = robustScale(win, 0);
      if (s > 0) scales.push(s);
    }
    if (!scales.length) return floor || 0.05;
    return Math.max(floor || 0.05, median(scales));
  }

  /**
   * 多参考·多通道检测（MVP-2b/2c）。
   *   三条**互补**的急性证据，各自在"噪声单位"下标准化：
   *     aR(t) = Dc_anchor(t)/σR   —— 相对**学期初**的偏离（不会被恶化追平，但怕早期污染）
   *     aS(t) = Dc_slide(t)/σS    —— 相对**近期习惯**的变化（抗污染，但会被持续恶化追平）
   *     aT(t) = Dc_rule(t)/σT     —— **绝对阈值**规则的边距（现行风险规则那条线）
   *   急性通道 a(t) = max(aR, aS, aT)：哪个假设认为异常就采信哪个
   *   累积通道 b(t) = max(0, b(t−1) + a(t) − 0.5)：持续漂移才累积，抗噪
   *   最终分 score(t) = max(a(t), b(t))
   *
   * 为什么要并入 aT：实测"个体基线"在**高检出率**下不如绝对阈值经济（95% 检出时误报
   * 22% vs 4%）——因为 70/80 这些线是对全人群"预校准"过的，不需要估基线。既然两者
   * 失效模式相反，就在**同一误报预算**下取并集：既拿到个体基线的"早"，也拿到绝对阈值的"全"。
   *
   * 注：b 刻意**不除以 √t**（显著性口径会随时间惩罚持续异常，实测把检出率从 85% 打到 66%）。
   */
  function channels(arrays) {
    var acute = [], B = [], dual = [], s = 0, n = 0;
    for (var i = 0; i < arrays.length; i++) if (arrays[i]) n = arrays[i].length;
    for (var t = 0; t < n; t++) {
      var a = -Infinity;
      for (var j = 0; j < arrays.length; j++) {
        if (!arrays[j]) continue;
        if (arrays[j][t] > a) a = arrays[j][t];
      }
      acute.push(a);
      s = Math.max(0, s + a - 0.5);
      B.push(s);
      dual.push(Math.max(a, s));
    }
    return { A: acute, B: B, dual: dual };
  }

  /** 兼容入口：偏离 + 自中心化 + CUSUM */
  function riskSeries(student, popStats, weights, days, refDays, k) {
    var rd = (refDays === undefined) ? REFERENCE_DAYS : refDays;
    var dev = deviationSeries(student, popStats, weights, days, rd);
    var sc = selfCenter(dev.D, rd);
    var kk = (k === undefined) ? CUSUM_K : k;
    return { L: cusum(sc.Dc, kk), D: dev.D, Dc: sc.Dc, conflict: dev.conflict, contrib: dev.contrib };
  }

  /* ---------------- 两个对照检测器 ---------------- */

  /**
   * 仅成绩的"单源现状"对照（用户抱怨的"单纯从成绩画像"）：
   * 只用最近一次月考的最差科目，按群体及格线（60）算边距；节奏受月考限制（28 天一次）。
   */
  function gradesOnlySeries(student, days) {
    var R = [];
    for (var t = 1; t <= days; t++) {
      var g = latestAt(student.src.grades, t);
      R.push(g ? -(g.minSubject - GROUP_THRESHOLDS.grade) / 40 : -1);
    }
    return R;
  }

  /**
   * 现行系统（成绩+考勤+作业 的群体阈值快照）对照：与 riskPlugins/strict.js 同源，
   * 各维度取最差边距（任一维异常即升高）。返回逐日风险（越大越危险）。
   */
  function baselineSeries(student, days) {
    var R = [];
    for (var t = 1; t <= days; t++) {
      var g = latestAt(student.src.grades, t);
      var a = latestAt(student.src.attendance, t);
      var h = latestAt(student.src.homework, t);
      var margins = [];
      if (g) margins.push((g.minSubject - GROUP_THRESHOLDS.grade) / 40);
      if (a) margins.push((a.value - GROUP_THRESHOLDS.attendance) / 20);
      if (h) margins.push((h.value - GROUP_THRESHOLDS.homework) / 30);
      var worst = margins.length ? Math.min.apply(null, margins) : 1;
      R.push(-worst);
    }
    return R;
  }

  /* ---------------- 阈值标定与指标 ---------------- */

  function firstAlarm(series, tau) {
    for (var t = 0; t < series.length; t++) {
      if (series[t] > tau) return t + 1;
    }
    return -1;
  }

  /** 在误报预算内取最敏感的阈值（matched-FAR 的公平比较方式） */
  function calibrate(items, targetFar) {
    var lo = Infinity, hi = -Infinity, i, j;
    for (i = 0; i < items.length; i++) {
      for (j = 0; j < items[i].series.length; j++) {
        var v = items[i].series[j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return { tau: hi, far: 0 };
    var best = null, fallback = null;
    var GRID = 120;
    for (var k = 0; k <= GRID; k++) {
      var tau = lo + (hi - lo) * (k / GRID);
      var fp = 0, neg = 0;
      for (i = 0; i < items.length; i++) {
        if (items[i].event) continue;
        neg++;
        if (firstAlarm(items[i].series, tau) > 0) fp++;
      }
      var far = neg ? fp / neg : 0;
      var cand = { tau: tau, far: far };
      if (fallback === null || far < fallback.far) fallback = cand;
      if (far <= targetFar) { if (best === null || far > best.far) best = cand; }
    }
    return best || fallback;
  }

  /** 固定阈值下的指标（从 evaluateDetector 抽出，供"并集"复用） */
  function metricsAt(items, tau) {
    var ev = items.filter(function (x) { return x.event; });
    var nonEv = items.filter(function (x) { return !x.event; });
    var detected = 0, early = 0, leadSum = 0, leadN = 0, fp = 0;
    ev.forEach(function (x) {
      var a = firstAlarm(x.series, tau);
      if (a > 0) {
        detected++;
        leadSum += (x.criticalDay - a);
        leadN++;
        if (a < x.criticalDay) early++;
      }
    });
    nonEv.forEach(function (x) { if (firstAlarm(x.series, tau) > 0) fp++; });
    return {
      tau: tau,
      far: nonEv.length ? fp / nonEv.length : 0,
      detectRate: ev.length ? detected / ev.length : 0,
      earlyRate: ev.length ? early / ev.length : 0,
      meanLead: leadN ? leadSum / leadN : 0,
      events: ev.length, nonEvents: nonEv.length
    };
  }

  function evaluateDetector(items, targetFar) {
    if (!items || items.length < 4) {
      var smallCal = calibrate(items || [], targetFar);
      return metricsAt(items || [], smallCal.tau);
    }
    var folds = [[], []];
    for (var i = 0; i < items.length; i++) folds[i % 2].push(items[i]);
    var results = [];
    for (var f = 0; f < 2; f++) {
      var train = folds[f];
      var test = folds[1 - f];
      var cal = calibrate(train, targetFar);
      results.push(metricsAt(test, cal.tau));
    }
    function weighted(field, countField) {
      var total = 0, count = 0;
      for (var ri = 0; ri < results.length; ri++) {
        var n = results[ri][countField] || 0;
        total += results[ri][field] * n;
        count += n;
      }
      return count ? total / count : 0;
    }
    return {
      tau: (results[0].tau + results[1].tau) / 2,
      far: weighted('far', 'nonEvents'),
      detectRate: weighted('detectRate', 'events'),
      earlyRate: weighted('earlyRate', 'events'),
      meanLead: weighted('meanLead', 'events'),
      events: (results[0].events || 0) + (results[1].events || 0),
      nonEvents: (results[0].nonEvents || 0) + (results[1].nonEvents || 0),
      protocol: 'two-way-cross-fit',
      foldFar: [results[0].far, results[1].far]
    };
  }

  /**
   * 按"必须抓住 targetDetect 比例的事件学生"来定阈值：取刚好达成该检出率的最保守阈值
   * （于是误报最少）。只比"同等误报"会掩盖权衡，加上这个操作点才能回答
   * "要抓 95% 的恶化学生，各方要付多少误报、能提前多久"。
   */
  function evaluateDetectorAtDetection(items, targetDetect) {
    var ev = items.filter(function (x) { return x.event; });
    var nonEv = items.filter(function (x) { return !x.event; });
    if (!ev.length) return { tau: Infinity, far: 0, detectRate: 0, earlyRate: 0, meanLead: 0 };
    var maxes = ev.map(function (x) {
      var m = -Infinity;
      for (var i = 0; i < x.series.length; i++) { if (x.series[i] > m) m = x.series[i]; }
      return m;
    }).sort(function (a, b) { return b - a; });
    var idx = Math.max(0, Math.ceil(targetDetect * maxes.length) - 1);
    var tau = maxes[idx] - 1e-9;
    var detected = 0, early = 0, leadSum = 0, leadN = 0, fp = 0;
    ev.forEach(function (x) {
      var a = firstAlarm(x.series, tau);
      if (a > 0) {
        detected++;
        leadSum += (x.criticalDay - a); leadN++;
        if (a < x.criticalDay) early++;
      }
    });
    nonEv.forEach(function (x) { if (firstAlarm(x.series, tau) > 0) fp++; });
    return {
      tau: tau,
      far: nonEv.length ? fp / nonEv.length : 0,
      detectRate: ev.length ? detected / ev.length : 0,
      earlyRate: ev.length ? early / ev.length : 0,
      meanLead: leadN ? leadSum / leadN : 0
    };
  }

  /* ---------------- AUC（排名法，并列计 0.5） ---------------- */

  function auc(pairs) {
    var pos = [], neg = [];
    pairs.forEach(function (p) { (p.label ? pos : neg).push(p.score); });
    if (!pos.length || !neg.length) return 0.5;
    var conc = 0;
    for (var i = 0; i < pos.length; i++) {
      for (var j = 0; j < neg.length; j++) {
        if (pos[i] > neg[j]) conc += 1;
        else if (pos[i] === neg[j]) conc += 0.5;
      }
    }
    return conc / (pos.length * neg.length);
  }

  /* ---------------- 顶层评估 ---------------- */

  function evaluate(cohort, opts) {
    opts = opts || {};
    var weights = opts.weights || PRIOR_WEIGHTS;
    var targetFar = opts.far === undefined ? DEFAULT_FAR : opts.far;
    var days = opts.days || cohort.days;
    var refDays = opts.refDays === undefined ? REFERENCE_DAYS : opts.refDays;
    var prepared = prepare(cohort, opts);
    var useLog = !(opts.logCounts === false);
    var pops = populationStats(prepared, days, useLog);

    // 四条互补的急性证据：锚定参考 + 长/中两个滑动尺度 + 绝对阈值规则
    var devAnchor = prepared.map(function (p) { return deviationSeries(p, pops, weights, days, refDays, 'anchor', useLog, opts.poissonScale); });
    var devSlideL = prepared.map(function (p) { return deviationSeries(p, pops, weights, days, refDays, 'slide', useLog, opts.poissonScale, LONG_WIN); });
    var devSlideM = (opts.midWindow === true)     // 默认关闭：实测对指标零影响（见 README 说明）
      ? prepared.map(function (p) { return deviationSeries(p, pops, weights, days, refDays, 'slide', useLog, opts.poissonScale, MID_WIN); })
      : null;
    var centAnchor = devAnchor.map(function (d) { return selfCenter(d.D, refDays); });
    var centSlideL = devSlideL.map(function (d) { return selfCenter(d.D, refDays); });
    var centSlideM = devSlideM ? devSlideM.map(function (d) { return selfCenter(d.D, refDays); }) : null;
    var ruleSeries = prepared.map(function (p) { return baselineSeries(p, days); });
    var centRule = ruleSeries.map(function (s) { return selfCenter(s, refDays); });
    var sigmaR = (opts.sigmaA === undefined) ? estimateSigma(centAnchor, refDays, 0.05) : opts.sigmaA;
    var sigmaSL = (opts.sigmaS === undefined) ? estimateSigma(centSlideL, refDays, 0.05) : opts.sigmaS;
    var sigmaSM = centSlideM ? ((opts.sigmaM === undefined) ? estimateSigma(centSlideM, refDays, 0.05) : opts.sigmaM) : 1;
    var sigmaT = (opts.sigmaT === undefined) ? estimateSigma(centRule, refDays, 0.05) : opts.sigmaT;
    var mode = opts.detector || 'acute';   // 实测：急性通道（多参考取最大）在提前量与 AUC 上都最优

    var items = prepared.map(function (p, i) {
      var dev = devAnchor[i], scA = centAnchor[i], scL = centSlideL[i], scM = centSlideM ? centSlideM[i] : null, scT = centRule[i];
      var aR = scA.Dc.map(function (v) { return v / sigmaR; });
      var aSL = scL.Dc.map(function (v) { return v / sigmaSL; });
      var aSM = scM ? scM.Dc.map(function (v) { return v / sigmaSM; }) : null;
      var aT = scT.Dc.map(function (v) { return v / sigmaT; });
      var ch = channels(aSM ? [aR, aSL, aSM] : [aR, aSL]);   // ④ 只由"个体基线"的多个尺度构成
      return {
        id: p.id, name: p.name, event: p.event, criticalDay: p.criticalDay,
        partTime: p.partTime, poor: p.poor,
        fusionAcute: ch.A, fusionCusum: ch.B, fusionDual: ch.dual,
        fusionChAnchor: aR, fusionChSlide: aSL, fusionChMid: aSM, fusionChRule: aT,
        fusion: (mode === 'acute' ? ch.A : (mode === 'cusum' ? ch.B : ch.dual)),
        conflict: dev.conflict,
        baseline: ruleSeries[i],
        gradesOnly: gradesOnlySeries(p, days)
      };
    });

    var pick = function (field) {
      return items.map(function (x) { return { event: x.event, criticalDay: x.criticalDay, series: x[field] }; });
    };
    var baseEval = evaluateDetector(pick('baseline'), targetFar);
    var fuseEval = evaluateDetector(pick('fusion'), targetFar);
    var gradeEval = evaluateDetector(pick('gradesOnly'), targetFar);

    // 第二个操作点：把检出率对齐到 targetDetect（默认 95%），再看各方要付多少误报、能提前多久
    var td = opts.targetDetect === undefined ? 0.95 : opts.targetDetect;
    var atDetect = {
      baseline: evaluateDetectorAtDetection(pick('baseline'), td),
      fusion: evaluateDetectorAtDetection(pick('fusion'), td),
      gradesOnly: evaluateDetectorAtDetection(pick('gradesOnly'), td)
    };

    /*
     * 并集检测（阈值 OR 融合）：把误报预算**一分为二**，融合与绝对阈值各按 FAR/2 标定，
     * 任一报警即报警 —— 等价于在分数空间比较 max(融合/τf, 阈值/τr) > 1。
     *
     * 为什么不用"两通道分数直接取 max"：那样会把排序能力拉回**尾部最重的那个通道**
     * （实测 AUC 从 0.906 掉到 0.821）。预算拆分则完整保留各自的操作特性：
     * 融合负责"早"，绝对阈值负责"全"，合并后的误报不超过预算。
     */
    var halfFar = targetFar / 2;
    var calFusion = calibrate(pick('fusion'), halfFar);
    var calRule = calibrate(pick('baseline'), halfFar);
    var tf = (calFusion.tau > 0 ? calFusion.tau : 1e-9);
    var tr = (calRule.tau > 0 ? calRule.tau : 1e-9);
    var orItems = items.map(function (x) {
      var s = [];
      for (var t = 0; t < x.fusion.length; t++) {
        s.push(Math.max(x.fusion[t] / tf, x.baseline[t] / tr));
      }
      return { event: x.event, criticalDay: x.criticalDay, series: s };
    });
    var orEval = metricsAt(orItems, 1);
    orEval.tauFusion = calFusion.tau;
    orEval.tauRule = calRule.tau;
    var orPairs = orItems.map(function (x, i) {
      return { score: x.series[EVAL_DAY - 1] || 0, label: items[i].event };
    });

    // 期中检查点 AUC：能否在第 8 周就把"将来会出问题"的人分出来
    var pairsOf = function (field) {
      return items.map(function (x) { return { score: x[field][EVAL_DAY - 1] || 0, label: x.event }; });
    };

    // 冲突度：事件学生 vs 非事件学生在期中前后的平均冲突
    var evConf = 0, evN = 0, neConf = 0, neN = 0;
    items.forEach(function (x) {
      var kk = x.conflict[EVAL_DAY - 1] || 0;
      if (x.event) { evConf += kk; evN++; } else { neConf += kk; neN++; }
    });

    return {
      items: items,
      baseline: baseEval,
      fusion: fuseEval,
      gradesOnly: gradeEval,
      union: orEval,
      aucUnion: auc(orPairs),
      atDetect: atDetect,
      targetDetect: td,
      detectorMode: mode,
      sigmaAnchor: sigmaR,
      sigmaSlide: sigmaSL,
      sigmaMid: sigmaSM,
      sigmaRule: sigmaT,
      refDays: refDays,
      weights: weights,
      aucBaseline: auc(pairsOf('baseline')),
      aucFusion: auc(pairsOf('fusion')),
      aucGradesOnly: auc(pairsOf('gradesOnly')),
      conflictEvent: evN ? evConf / evN : 0,
      conflictNonEvent: neN ? neConf / neN : 0,
      targetFar: targetFar,
      events: items.filter(function (x) { return x.event; }).length,
      total: items.length
    };
  }

  /** 消融：逐个去掉一个源，看检出率与提前量的变化（"权重该给多少"的依据） */
  function ablate(cohort, opts) {
    opts = opts || {};
    var baseW = opts.weights || PRIOR_WEIGHTS;
    var full = opts.full || evaluate(cohort, opts);
    var out = [];
    SOURCES.forEach(function (kind) {
      if (!(baseW[kind] > 0)) return;                 // 只消融当前画像里真正启用的源
      var w = {};
      SOURCES.forEach(function (kk) { w[kk] = (kk === kind) ? 0 : (baseW[kk] || 0); });
      var childOpts = {};
      for (var optionKey in opts) { if (opts.hasOwnProperty(optionKey) && optionKey !== 'full') childOpts[optionKey] = opts[optionKey]; }
      childOpts.weights = w;
      var r = evaluate(cohort, childOpts);
      out.push({
        removed: kind,
        label: SRC_LABEL[kind],
        deltaDetect: r.fusion.detectRate - full.fusion.detectRate,
        deltaLead: r.fusion.meanLead - full.fusion.meanLead,
        auc: r.aucFusion
      });
    });
    out.sort(function (a, b) { return a.deltaDetect - b.deltaDetect; });
    return out;
  }

  /**
   * 混杂/公平性对照：同一个"外出次数"信号，用**群体阈值** vs **个体基线**，
   * 在**相同总体误报预算**下比较两组学生的误报率差异（disparity）。
   *
   * 为什么这样设计：第一版对照让两组规则各取固定倍数阈值，结果个体基线因为日频信号
   * 做了 112 次单点检验、alpha 被放大到 95%+，数字完全不可比。现在两边都先标定到
   * 同一 FAR，再看偏差。
   */
  function confounderCheck(cohort, opts) {
    opts = opts || {};
    var targetFar = opts.far === undefined ? DEFAULT_FAR : opts.far;
    var days = opts.days || cohort.days;
    var allPrepared = prepare(cohort, opts);
    var prepared = allPrepared;
    var useLog = !(opts.logCounts === false);
    var pops = populationStats(allPrepared, days, useLog);
    var nonEvent = prepared.filter(function (p) { return !p.event; });
    var outs = nonEvent.map(function (p) { return p.baseOut === null ? 0 : p.baseOut; });
    var cut = median(outs);

    var scored = nonEvent.map(function (p) {
      var ref = referenceStats(p, 'access', REFERENCE_DAYS, useLog);
      var popMax = -Infinity, perMax = -Infinity;
      var usePoisson = (opts.poissonScale !== false) && (useLog !== false);
      for (var t = 1; t <= days; t++) {
        var ob = latestAt(p.src.access, t);
        if (!ob) continue;
        var pop = pops.access[t];
        var pv = (pop.median - ob.value) / pop.scale;
        if (pv > popMax) popMax = pv;
        if (ref) {
          // 计数源用泊松方差归一化（λ 小→噪声大），否则维持"群体尺度兜底"
          var s = usePoisson
            ? poissonLogScale(ref.rawLevel)
            : Math.max(ref.scale || 0, pop.scale * 0.75);
          var qv = (ref.median - ob.value) / s;
          if (qv > perMax) perMax = qv;
        }
      }
      return { pop: popMax, per: perMax, low: (p.baseOut === null ? 0 : p.baseOut) < cut };
    });

    // 取分位数使两边 FAR 都 ≈ targetFar（比网格更稳）
    function pickTau(field) {
      var vals = scored.map(function (x) { return x[field]; }).filter(function (v) { return isFinite(v); });
      vals.sort(function (a, b) { return a - b; });
      if (!vals.length) return Infinity;
      var idx = Math.min(vals.length - 1, Math.max(0, Math.ceil((1 - targetFar) * vals.length) - 1));
      return vals[idx];
    }

    function rates(field, tau) {
      var low = { fp: 0, n: 0 }, high = { fp: 0, n: 0 };
      scored.forEach(function (x) {
        var v = x[field];
        var alarm = isFinite(v) && v > tau;
        if (x.low) { low.n++; if (alarm) low.fp++; } else { high.n++; if (alarm) high.fp++; }
      });
      var rl = low.n ? low.fp / low.n : 0, rh = high.n ? high.fp / high.n : 0;
      return {
        lowBaseline: rl, highBaseline: rh,
        overall: (low.fp + high.fp) / Math.max(1, low.n + high.n),
        disparity: Math.abs(rl - rh)
      };
    }

    var pop = rates('pop', pickTau('pop'));
    var per = rates('per', pickTau('per'));
    return { pop: pop, personal: per, cut: cut, targetFar: targetFar, samples: scored.length };
  }

  /* ---------------- 权重学习（MVP-2d：用申诉/结案标签定权重） ----------------
   * 现状：权重还是专家先验（我拍的）。这里用**标签**把它学出来，并带 L2 收缩回先验，
   * 使得"样本少时不动、样本多了才敢改"——这是小样本场景唯一诚实的做法。
   *
   * 标签从哪来（产品侧）：
   *   · warningAppeals 被**采纳** → 当初那次判定是错的 → 负样本（0，实际不危险）
   *   · warningAppeals 被**驳回** → 判定成立 → 正样本（1）
   *   · caseBase outcome='escalated' → 确实恶化过 → 正样本（1）
   * 仿真验证时直接用 latent 真值 event 作标签，以便量化"标签要多少才值得学"。
   */

  /**
   * 取每个学生在某个检查日的**逐源**标准化偏离（≈各源独立的"异常程度"）。
   * 复用 deviationSeries 的 contrib（权重置 1 时 contribution = z × decay）。
   */
  function perSourceFeatures(prepared, pops, days, refDays, useLog, atDay, poissonScale) {
    var rows = [], labels = [];
    for (var i = 0; i < prepared.length; i++) {
      var uniform = {};
      SOURCES.forEach(function (k) { uniform[k] = 1; });
      var dev = deviationSeries(prepared[i], pops, uniform, days, refDays, 'anchor', useLog, poissonScale);
      var day = dev.contrib[Math.max(0, Math.min(dev.contrib.length - 1, atDay - 1))] || [];
      var feats = [];
      for (var s = 0; s < SOURCES.length; s++) {
        var kind = SOURCES[s], v = 0;
        for (var j = 0; j < day.length; j++) {
          if (day[j].kind === kind) { v = day[j].z * day[j].decay; break; }
        }
        feats.push(v);
      }
      rows.push(feats);
      labels.push(prepared[i].event ? 1 : 0);
    }
    return { X: rows, y: labels, sources: SOURCES.slice() };
  }

  /** 逐列标准化（帮助梯度下降收敛），返回均值/标准差以便把权重换回原尺度 */
  function standardizeColumns(X) {
    var n = X.length, K = n ? X[0].length : 0;
    var mean = [], sd = [], i, k;
    for (k = 0; k < K; k++) { mean.push(0); sd.push(0); }
    if (!n) return { Z: [], mean: mean, sd: sd };
    for (k = 0; k < K; k++) {
      var s = 0;
      for (i = 0; i < n; i++) s += X[i][k];
      mean[k] = s / n;
    }
    for (k = 0; k < K; k++) {
      var s2 = 0;
      for (i = 0; i < n; i++) { var d = X[i][k] - mean[k]; s2 += d * d; }
      sd[k] = Math.sqrt(s2 / n) || 1;
    }
    var Z = [];
    for (i = 0; i < n; i++) {
      var row = [];
      for (k = 0; k < K; k++) row.push((X[i][k] - mean[k]) / sd[k]);
      Z.push(row);
    }
    return { Z: Z, mean: mean, sd: sd };
  }

  /**
   * L2 正则（向专家先验收缩）的逻辑回归，梯度下降，纯 ES5。
   * 目标：min Σ logloss + λ‖w − w_prior‖²
   * @param {{X:Array, y:Array}} ds
   * @param {Array} priorVec 先验权重（与列同序，标准化空间下会被重新标定）
   */
  function learnWeights(ds, priorVec, opts) {
    opts = opts || {};
    var Z = ds.Z || ds.X, y = ds.y;
    var n = Z.length, K = n ? Z[0].length : 0;
    if (!n) return null;
    var lr = opts.lr === undefined ? 0.3 : opts.lr;
    var iters = opts.iters === undefined ? 600 : opts.iters;
    var lambda = opts.lambda === undefined ? 0.5 : opts.lambda;
    // 先验在标准化空间下重新标定：保持各源的相对强弱，幅度按列标准差折算
    var prior = [];
    for (var k = 0; k < K; k++) prior.push((priorVec && priorVec[k] !== undefined) ? priorVec[k] : 0);
    var w = prior.slice(), b = 0, i, j, it;
    for (it = 0; it < iters; it++) {
      var gw = [], gb = 0;
      for (j = 0; j < K; j++) gw.push(0);
      for (i = 0; i < n; i++) {
        var s = b;
        for (j = 0; j < K; j++) s += w[j] * Z[i][j];
        var p = 1 / (1 + Math.exp(-s));
        var e = p - y[i];
        for (j = 0; j < K; j++) gw[j] += e * Z[i][j];
        gb += e;
      }
      for (j = 0; j < K; j++) {
        gw[j] = gw[j] / n + 2 * lambda * (w[j] - prior[j]);
        w[j] -= lr * gw[j];
      }
      b -= lr * (gb / n);
    }
    // 训练集上的对数损失（诊断用）
    var loss = 0;
    for (i = 0; i < n; i++) {
      var s2 = b;
      for (j = 0; j < K; j++) s2 += w[j] * Z[i][j];
      var p2 = Math.max(1e-9, Math.min(1 - 1e-9, 1 / (1 + Math.exp(-s2))));
      loss += -(y[i] * Math.log(p2) + (1 - y[i]) * Math.log(1 - p2));
    }
    return { w: w, b: b, loss: loss / n, n: n, lambda: lambda };
  }

  /**
   * 端到端：从若干 cohort 抽标签 → 学权重 → 归一化回"权重"语义（Σ|w|=1）
   * @returns {{weights:object, raw:object, prior:object, n:number, loss:number, intercept:number}}
   */
  function learnFromCohorts(cohorts, opts) {
    opts = opts || {};
    var days = opts.days || 112, refDays = opts.refDays === undefined ? REFERENCE_DAYS : opts.refDays;
    var atDay = opts.atDay || EVAL_DAY;
    var X = [], y = [];
    for (var c = 0; c < cohorts.length; c++) {
      var prepared = prepare(cohorts[c], opts);
      var useLog = !(opts.logCounts === false);
      var pops = populationStats(prepared, days, useLog);
      var ds = perSourceFeatures(prepared, pops, days, refDays, useLog, atDay, opts.poissonScale);
      for (var i = 0; i < ds.X.length; i++) { X.push(ds.X[i]); y.push(ds.y[i]); }
    }
    var st = standardizeColumns(X);
    var priorProfile = opts.prior || WEIGHT_PROFILES.features;
    var priorVec = SOURCES.map(function (k) { return priorProfile[k] || 0; });
    var objective = opts.objective || 'ranking';
    var fit = (objective === 'logistic')
      ? learnWeights({ Z: st.Z, y: y }, priorVec, opts)
      : learnWeightsRanking({ Z: st.Z, y: y }, priorVec, opts);
    if (!fit) return null;
    // 换回原尺度：w_raw = w_std / sd
    var raw = {};
    var absSum = 0, k2;
    var rawArr = [];
    for (k2 = 0; k2 < SOURCES.length; k2++) {
      var v = fit.w[k2] / (st.sd[k2] || 1);
      rawArr.push(v);
      absSum += Math.abs(v);
    }
    for (k2 = 0; k2 < SOURCES.length; k2++) {
      raw[SOURCES[k2]] = absSum > 0 ? rawArr[k2] / absSum : 0;
    }
    return {
      weights: raw, rawArr: rawArr, prior: priorProfile,
      n: fit.n,
      loss: (fit.loss !== undefined ? fit.loss : (1 - fit.pairAcc)),
      pairAcc: fit.pairAcc,
      objective: fit.objective || 'logistic',
      intercept: fit.b, lambda: fit.lambda,
      positiveRate: y.length ? y.reduce(function (a, b) { return a + b; }, 0) / y.length : 0
    };
  }

  /**
   * 权重上线闸门（champion / challenger）。
   *
   * 为什么要这道闸门：本项目的实测结论是"**用标签学出来的权重并没有赢过专家先验**"
   * （见 test-fusion.js 的权重学习实验：9 种配置全部略差）。既然学习可能变差，产品就
   * **不能悄悄换权重**——只有当 challenger 在**留出集**上明确更好时才建议启用，否则继续用现役。
   *
   * 判据（都比现役好才算赢）：提前量 +0.5 天以上，且 AUC 不倒退超过 0.005，且误报不显著变差。
   * @param {{meanLead:number, auc:number, far:number}} champ 现役画像指标
   * @param {{meanLead:number, auc:number, far:number}} chal  挑战者指标
   */
  function shouldAdopt(champ, chal, opts) {
    opts = opts || {};
    var leadGain = (opts.leadGain === undefined) ? 0.5 : opts.leadGain;
    var aucTol = (opts.aucTol === undefined) ? 0.005 : opts.aucTol;
    var farTol = (opts.farTol === undefined) ? 0.01 : opts.farTol;
    if (!champ || !chal) return { adopt: false, reason: '缺少对照指标' };
    var reasons = [];
    var leadOk = chal.meanLead >= champ.meanLead + leadGain;
    var aucOk = chal.auc >= champ.auc - aucTol;
    var farOk = chal.far <= champ.far + farTol;
    if (!leadOk) reasons.push('提前量未提升 ' + leadGain + ' 天（' + chal.meanLead.toFixed(1) + ' vs ' + champ.meanLead.toFixed(1) + '）');
    if (!aucOk) reasons.push('AUC 倒退超过 ' + aucTol + '（' + chal.auc.toFixed(3) + ' vs ' + champ.auc.toFixed(3) + '）');
    if (!farOk) reasons.push('误报变差超过 ' + farTol + '（' + pctOf(chal.far) + ' vs ' + pctOf(champ.far) + '）');
    return {
      adopt: leadOk && aucOk && farOk,
      reason: reasons.length ? reasons.join('；') : '留出集上明确优于现役画像'
    };
  }

  function pctOf(v) { return (v * 100).toFixed(1) + '%'; }

  /**
   * 产品侧轻量入口：只给每个学生算"当前关注度 + 贡献分解"，不跑检测器标定。
   * @param {object} cohort 形如 Signals.load() 的结果（无 latent 真值也可）
   * @param {{allowedIds?:Array<string>, weights?:object, days?:number}} [opts]
   * @returns {Array<{id,name,className,score,day,conflict,contributions}>}
   */
  function scoreStudents(cohort, opts) {
    opts = opts || {};
    var days = opts.days || cohort.days || 112;
    var refDays = opts.refDays === undefined ? REFERENCE_DAYS : opts.refDays;
    var weights = opts.weights || WEIGHT_PROFILES.features;
    var useLog = !(opts.logCounts === false);
    var prepared = prepare(cohort, opts);
    if (opts.allowedIds) {
      var allowed = opts.allowedIds;
      prepared = prepared.filter(function (p) { return allowed.indexOf(p.id) !== -1; });
    }
    if (!prepared.length) return [];
    var pops = populationStats(prepared, days, useLog);
    var dAs = prepared.map(function (p) { return deviationSeries(p, pops, weights, days, refDays, 'anchor', useLog, opts.poissonScale); });
    var dSs = prepared.map(function (p) { return deviationSeries(p, pops, weights, days, refDays, 'slide', useLog, opts.poissonScale); });
    var cAs = dAs.map(function (d) { return selfCenter(d.D, refDays); });
    var cSs = dSs.map(function (d) { return selfCenter(d.D, refDays); });
    var sigA = estimateSigma(cAs, refDays, 0.05);
    var sigS = estimateSigma(cSs, refDays, 0.05);

    return prepared.map(function (p, i) {
      var aR = cAs[i].Dc.map(function (v) { return v / sigA; });
      var aS = cSs[i].Dc.map(function (v) { return v / sigS; });
      var ch = channels([aR, aS]);
      var t = ch.A.length - 1;
      var day = dAs[i].contrib[t] || [];
      var contribs = day.filter(function (c) { return Math.abs(c.contribution) > 1e-9; })
        .sort(function (a, b) { return Math.abs(b.contribution) - Math.abs(a.contribution); })
        .map(function (c) {
          return { kind: c.kind, label: SRC_LABEL[c.kind] || c.kind, z: Math.round(c.z * 100) / 100, contribution: Math.round(c.contribution * 1000) / 1000 };
        });
      return {
        id: p.id, name: p.name, className: p.className,
        score: channelScore(ch.A[t]), day: t + 1,
        conflict: Math.round((dAs[i].conflict[t] || 0) * 100) / 100,
        contributions: contribs
      };
    });
  }

  /** 关注度归一到 0~100（便于教师端展示，纯展示用，不参与判定） */
  function channelScore(v) {
    if (!isFinite(v)) return null;
    var s = Math.round(v * 20);
    if (s < 0) s = 0;
    if (s > 100) s = 100;
    return s;
  }

  /**
   * 成对排序目标（MVP-2g）——解决 MVP-2d 的"目标错配"。
   *
   * MVP-2d 用逻辑回归拟合"第 56 天是不是事件学生"这个**二分类标签**，但检测器的评价口径是
   * "固定误报预算下多早报警 + AUC 排序"——两者不是同一个目标函数，实测学出来的权重
   * 反而比专家先验差 2~4 天。
   *
   * 这里改成 **RankNet 风格的成对损失**：只关心"事件学生是否排在非事件学生前面"
   *
   *   L = Σ_(i∈正, j∈负) log(1 + exp(−(s_i − s_j))) + λ‖w − w_prior‖²
   *
   * 这正是 AUC 的可微替代（pairwise surrogate），与检测口径一致。
   * 正负对数量为 O(n²)，故每轮**随机抽样** pairsPerIter 对（确定性 PRNG，可复现）。
   */
  function learnWeightsRanking(ds, priorVec, opts) {
    opts = opts || {};
    var Z = ds.Z || ds.X, y = ds.y;
    var n = Z.length, K = n ? Z[0].length : 0;
    if (!n) return null;
    var lr = opts.lr === undefined ? 0.05 : opts.lr;
    var iters = opts.iters === undefined ? 600 : opts.iters;
    var lambda = opts.lambda === undefined ? 0.5 : opts.lambda;
    var pairsPerIter = opts.pairsPerIter === undefined ? 4000 : opts.pairsPerIter;
    var pos = [], neg = [];
    for (var q = 0; q < n; q++) { (y[q] ? pos : neg).push(q); }
    if (!pos.length || !neg.length) return null;
    var prng = makeLocalRng(opts.seed === undefined ? 20261007 : opts.seed);

    var prior = [];
    for (var k = 0; k < K; k++) prior.push(priorVec && priorVec[k] !== undefined ? priorVec[k] : 0);
    var w = prior.slice(), b = 0, i, j;

    for (var it = 0; it < iters; it++) {
      var gw = [], gb = 0;
      for (j = 0; j < K; j++) gw.push(0);
      for (var p = 0; p < pairsPerIter; p++) {
        var a = pos[Math.floor(prng() * pos.length)];
        var c = neg[Math.floor(prng() * neg.length)];
        var sa = b, sc = b;
        for (j = 0; j < K; j++) { sa += w[j] * Z[a][j]; sc += w[j] * Z[c][j]; }
        var diff = sa - sc;
        var g = -1 / (1 + Math.exp(diff));       // dL/d(diff)，L = log(1+exp(-diff))
        for (j = 0; j < K; j++) gw[j] += g * (Z[a][j] - Z[c][j]);
        gb += g;
      }
      var scale = 1 / pairsPerIter;
      for (j = 0; j < K; j++) {
        gw[j] = gw[j] * scale + 2 * lambda * (w[j] - prior[j]);
        w[j] -= lr * gw[j];
      }
      b -= lr * (gb * scale);
    }
    // 训练集上的成对准确率（正样本分数高于负样本的比例，即训练 AUC 的代理）
    var correct = 0, totalPairs = 0;
    for (i = 0; i < pos.length; i++) {
      for (var m = 0; m < neg.length; m++) {
        var s1 = b, s2 = b;
        for (j = 0; j < K; j++) { s1 += w[j] * Z[pos[i]][j]; s2 += w[j] * Z[neg[m]][j]; }
        totalPairs++;
        if (s1 > s2) correct++;
      }
    }
    return { w: w, b: b, pairAcc: totalPairs ? correct / totalPairs : 0.5, n: n, lambda: lambda, objective: 'ranking' };
  }

  /** 轻量确定性 PRNG（成对抽样用，避免每次学习结果抖动） */
  function makeLocalRng(seed) {
    var s = (seed >>> 0) || 12345;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  /* ---------------- 多 seed 汇总 ---------------- */

  /** 取仿真器：浏览器下用全局 Signals；Node 下模块作用域不同，退化为 require */
  var SignalsRef = global.Signals;
  if (!SignalsRef && typeof require === 'function') {
    try { SignalsRef = require('./signals.js'); } catch (e) { SignalsRef = null; }
  }
  function simulateWith(seed, students, days) {
    if (!SignalsRef) throw new Error('未找到 signals.js（仿真器）');
    return SignalsRef.simulate({ seed: seed, students: students, days: days });
  }

  /** 多 seed 汇总，避免单次抽样结论 */
  function evaluateSeeds(seeds, opts) {
    var rows = [];
    seeds.forEach(function (seed) {
      var cohort = (opts && opts.simulate)
        ? opts.simulate(seed, (opts && opts.students) || 200, (opts && opts.days) || 112)
        : simulateWith(seed, (opts && opts.students) || 200, (opts && opts.days) || 112);
      var r = evaluate(cohort, opts);
      rows.push({
        seed: seed, baseline: r.baseline, fusion: r.fusion, gradesOnly: r.gradesOnly,
        union: r.union, atDetect: r.atDetect,
        aucBaseline: r.aucBaseline, aucFusion: r.aucFusion, aucGradesOnly: r.aucGradesOnly,
        aucUnion: r.aucUnion,
        events: r.events, total: r.total
      });
    });
    function avg(fn) {
      var s = 0;
      rows.forEach(function (r) { s += fn(r); });
      return rows.length ? s / rows.length : 0;
    }
    function avgDet(key) {
      return {
        detectRate: avg(function (r) { return r[key].detectRate; }),
        earlyRate: avg(function (r) { return r[key].earlyRate; }),
        meanLead: avg(function (r) { return r[key].meanLead; }),
        far: avg(function (r) { return r[key].far; })
      };
    }
    function avgDetAt(key, sub) {
      return {
        detectRate: avg(function (r) { return r[sub][key].detectRate; }),
        earlyRate: avg(function (r) { return r[sub][key].earlyRate; }),
        meanLead: avg(function (r) { return r[sub][key].meanLead; }),
        far: avg(function (r) { return r[sub][key].far; })
      };
    }
    return {
      rows: rows,
      gradesOnly: avgDet('gradesOnly'),
      baseline: avgDet('baseline'),
      fusion: avgDet('fusion'),
      union: avgDet('union'),
      atDetectGradesOnly: avgDetAt('gradesOnly', 'atDetect'),
      atDetectBaseline: avgDetAt('baseline', 'atDetect'),
      atDetectFusion: avgDetAt('fusion', 'atDetect'),
      aucGradesOnly: avg(function (r) { return r.aucGradesOnly; }),
      aucBaseline: avg(function (r) { return r.aucBaseline; }),
      aucFusion: avg(function (r) { return r.aucFusion; }),
      aucUnion: avg(function (r) { return r.aucUnion; }),
      avgEvents: avg(function (r) { return r.events; }),
      avgTotal: avg(function (r) { return r.total; })
    };
  }

  var api = {
    SOURCES: SOURCES,
    SRC_LABEL: SRC_LABEL,
    WEIGHT_NAMES: WEIGHT_NAMES,
    PRIOR_WEIGHTS: PRIOR_WEIGHTS,
    WEIGHT_PROFILES: WEIGHT_PROFILES,
    rollingMean: rollingMean,
    rollingZeroDays: rollingZeroDays,
    DECAY_TAU: DECAY_TAU,
    MIN_SCALE: MIN_SCALE,
    PERSONAL_WINDOW: PERSONAL_WINDOW,
    SHRINK_N0: SHRINK_N0,
    REFERENCE_DAYS: REFERENCE_DAYS,
    SHORT_WIN: SHORT_WIN,
    LONG_WIN: LONG_WIN,
    MID_WIN: MID_WIN,
    CUSUM_K: CUSUM_K,
    windowValues: windowValues,
    meanOf: meanOf,
    estimateSigma: estimateSigma,
    channels: channels,
    GROUP_THRESHOLDS: GROUP_THRESHOLDS,
    SUBJECT_W: SUBJECT_W,
    DEFAULT_FAR: DEFAULT_FAR,
    EVAL_DAY: EVAL_DAY,
    median: median,
    robustScale: robustScale,
    gradeValue: gradeValue,
    prepare: prepare,
    latestAt: latestAt,
    populationStats: populationStats,
    referenceStats: referenceStats,
    perSourceFeatures: perSourceFeatures,
    standardizeColumns: standardizeColumns,
    learnWeights: learnWeights,
    learnWeightsRanking: learnWeightsRanking,
    learnFromCohorts: learnFromCohorts,
    shouldAdopt: shouldAdopt,
    scoreStudents: scoreStudents,
    channelScore: channelScore,
    deviationSeries: deviationSeries,
    cusum: cusum,
    selfCenter: selfCenter,
    estimateK: estimateK,
    riskSeries: riskSeries,
    gradesOnlySeries: gradesOnlySeries,
    baselineSeries: baselineSeries,
    firstAlarm: firstAlarm,
    calibrate: calibrate,
    evaluateDetector: evaluateDetector,
    auc: auc,
    evaluate: evaluate,
    ablate: ablate,
    confounderCheck: confounderCheck,
    evaluateSeeds: evaluateSeeds
  };
  global.ProfileFusion = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
