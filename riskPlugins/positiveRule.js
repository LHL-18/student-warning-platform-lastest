/**
 * positiveRule.js — 正向评分（育优预警）
 * ---------------------------------------------------------------
 * 与三套风险插件**并列但独立**：
 *   · 故意不注册进 RiskPluginManager.plugins（那会污染风险评分）；
 *   · 不读也不写风险评分状态，纯函数式实时计算，不新增 localStorage 键；
 *   · 全部规则化，不调用任何模型 —— 可解释、可复现、断网可用。
 *
 * 输出：{ score, level:'A'|'B'|'C', strengths:[{dim,label,score,reason}], dims, suggestions }
 * 打分维度（各 0-100，加权求和；某维度数据缺失时按剩余权重归一化，不猜数据）：
 *   academic   学业表现 0.40 —— 课程加权均分（高数/编程 1.2，英语/计算机基础 1.0）
 *   discipline 行为自律 0.25 —— 出勤率、作业提交率
 *   resilience 学习韧性 0.20 —— 错题本复习次数与掌握比例
 *   progress   进步幅度 0.15 —— 与 studentWarningHistory 历史分数的提升
 *
 * 文案红线：正向评分不得成为任何奖励的自动依据，UI 必须标注「仅供辅导员参考」；
 * 涉及奖学金/保研的表述一律加「以学校政策为准」。
 */
var PositiveRuleManager = (function () {
  'use strict';

  var WEIGHTS = { academic: 0.40, discipline: 0.25, resilience: 0.20, progress: 0.15 };
  var DIM_LABEL = { academic: '学业表现', discipline: '行为自律', resilience: '学习韧性', progress: '进步幅度' };
  var SUBJECT_WEIGHTS = [
    { name: '高数', w: 1.2 }, { name: '英语', w: 1.0 },
    { name: '编程', w: 1.2 }, { name: '计算机基础', w: 1.0 }
  ];
  var LEVEL_LINE = { A: 85, B: 70 };
  var STRENGTH_LINE = 70;   // 达到该分数才作为"优势"展示

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function firstNum(text) {
    var m = String(text === undefined || text === null ? '' : text).match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  /** 学生端把 grades 存成对象、教师端存成文本，这里统一成文本 */
  function gradesText(grades) {
    if (typeof grades === 'string') return grades;
    if (grades && typeof grades === 'object') {
      var parts = [];
      Object.keys(grades).forEach(function (k) {
        var v = grades[k];
        if (v === undefined || v === null || v === '') return;
        parts.push(k + ' ' + v + ' 分');
      });
      return parts.join('，');
    }
    return '';
  }

  /** 百分比字段可能是数字（学生端）或文本（花名册），统一取数 */
  function percent(v) {
    if (typeof v === 'number' && isFinite(v)) return clamp(Math.round(v), 0, 100);
    var n = firstNum(v);
    return n === null ? null : clamp(n, 0, 100);
  }

  function dimLevel(score) {
    return score >= LEVEL_LINE.A ? 'A' : (score >= LEVEL_LINE.B ? 'B' : 'C');
  }

  /* ---------------- 四个维度 ---------------- */

  function academicDim(grades) {
    var g = gradesText(grades), wSum = 0, wTotal = 0, found = [];
    for (var i = 0; i < SUBJECT_WEIGHTS.length; i++) {
      var m = g.match(new RegExp(SUBJECT_WEIGHTS[i].name + '[^0-9]*(\\d+)'));
      if (!m) continue;
      var sc = parseInt(m[1], 10);
      wSum += sc * SUBJECT_WEIGHTS[i].w;
      wTotal += SUBJECT_WEIGHTS[i].w;
      found.push(SUBJECT_WEIGHTS[i].name + ' ' + sc + ' 分');
    }
    if (!wTotal) return null;                       // 没有任何成绩数据 → 不参与加权
    var avg = Math.round(wSum / wTotal);
    return {
      score: clamp(avg, 0, 100),
      reason: '课程加权均分 ' + avg + ' 分（' + found.join('、') + '；高数/编程按 1.2 倍权重）'
    };
  }

  function disciplineDim(attendance, homework) {
    var att = percent(attendance), hw = percent(homework);
    if (att === null && hw === null) return null;
    var vals = [], parts = [];
    if (att !== null) { vals.push(att); parts.push('出勤率 ' + att + '%'); }
    if (hw !== null) { vals.push(hw); parts.push('作业提交率 ' + hw + '%'); }
    var score = Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);
    var reason = parts.join('、');
    if (att === 100 && hw === 100) reason += '，全勤且作业零缺交，自律性突出';
    else if (score >= 90) reason += '，行为习惯稳定';
    return { score: clamp(score, 0, 100), reason: reason };
  }

  function resilienceDim(wrongBook) {
    var list = Object.prototype.toString.call(wrongBook) === '[object Array]' ? wrongBook : [];
    if (!list.length) return null;                  // 没有错题记录 → 不臆测韧性
    var totalReviews = 0, mastered = 0;
    list.forEach(function (w) {
      if (!w) return;
      totalReviews += Number(w.reviewCount) || 0;
      if (w.status === 'mastered') mastered++;
    });
    var avgReviews = totalReviews / list.length;
    // 平均复习 4 次记满分；掌握比例占另一半权重
    var reviewScore = clamp(avgReviews * 25, 0, 100);
    var masteryScore = clamp((mastered / list.length) * 100, 0, 100);
    var score = Math.round(reviewScore * 0.5 + masteryScore * 0.5);
    return {
      score: clamp(score, 0, 100),
      reason: '错题共 ' + list.length + ' 条、累计复习 ' + totalReviews + ' 次（平均 ' +
        (Math.round(avgReviews * 10) / 10) + ' 次/条），已掌握 ' + mastered + '/' + list.length
    };
  }

  function progressDim(history) {
    var list = Object.prototype.toString.call(history) === '[object Array]' ? history : [];
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var v = h && h.result && h.result.riskAnalysis ? h.result.riskAnalysis.score : null;
      var n = (typeof v === 'number') ? v : firstNum(v);
      if (n !== null && !isNaN(n)) scored.push({ at: String(h.timestamp || ''), score: n });
    }
    if (scored.length < 2) return null;             // 只有一次记录谈不上"进步幅度"
    scored.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    var delta = scored[scored.length - 1].score - scored[0].score;
    // 持平记 60 分基线，每提升 1 分加 1.5 分，最多 100
    return {
      score: clamp(Math.round(60 + delta * 1.5), 0, 100),
      reason: '较历史记录提升 ' + (delta >= 0 ? delta : delta) + ' 分（' + scored[0].score + ' → ' + scored[scored.length - 1].score + '）'
    };
  }

  /* ---------------- 取数 ---------------- */

  /** 从现有存储收集上下文（只读；不新增键） */
  function collect(studentId) {
    var ctx = { wrongBook: [], history: [] };
    try {
      if (typeof window !== 'undefined' && window.MM && window.MM.wrongBook && window.MM.wrongBook.list) {
        ctx.wrongBook = window.MM.wrongBook.list({ studentId: studentId }) || [];
      }
    } catch (e) {}
    try {
      var raw = window.localStorage.getItem('studentWarningHistory');
      var all = raw ? JSON.parse(raw) : [];
      if (Object.prototype.toString.call(all) !== '[object Array]') all = [];
      ctx.history = all.filter(function (h) { return String(h.studentId) === String(studentId); });
    } catch (e) {}
    return ctx;
  }

  /* ---------------- 主入口 ---------------- */

  /**
   * @param {object} student 形如 { id, name, className, grades, attendance, homework/homeworkRate }
   * @param {object} [ctx] { wrongBook:[], history:[] }
   * @returns {{score:number, level:string, strengths:Array, dims:object, suggestions:Array}}
   */
  function evaluate(student, ctx) {
    ctx = ctx || {};
    student = student || {};
    var dims = {
      academic: academicDim(student.grades),
      discipline: disciplineDim(
        student.attendance !== undefined ? student.attendance : null,
        student.homework !== undefined ? student.homework : student.homeworkRate
      ),
      resilience: resilienceDim(ctx.wrongBook),
      progress: progressDim(ctx.history)
    };

    var wSum = 0, usedWeight = 0, usedDims = [];
    Object.keys(WEIGHTS).forEach(function (k) {
      if (!dims[k]) return;
      usedWeight += WEIGHTS[k];
      wSum += dims[k].score * WEIGHTS[k];
      usedDims.push(k);
    });
    var score = usedWeight > 0 ? Math.round(wSum / usedWeight) : 0;
    var level = dimLevel(score);

    var strengths = Object.keys(dims)
      .filter(function (k) { return dims[k] && dims[k].score >= STRENGTH_LINE; })
      .map(function (k) {
        return { dim: k, label: DIM_LABEL[k], score: dims[k].score, level: dimLevel(dims[k].score), reason: dims[k].reason };
      })
      .sort(function (a, b) { return b.score - a.score; });

    return {
      score: score,
      level: level,
      strengths: strengths,
      dims: dims,
      usedDims: usedDims,
      dataEnough: usedDims.length > 0,
      suggestions: suggestions({ strengths: strengths })
    };
  }

  function evaluateStudent(student) {
    if (!student || !student.id) return null;
    return evaluate(student, collect(student.id));
  }

  /**
   * 建议：纯规则映射，不调大模型；每条都带「以学校政策为准」，不给绝对承诺。
   * 只在对应维度达到 A（≥85）时给出，避免变成"人人都有奖"的空话。
   */
  function suggestions(res) {
    var out = [];
    var byDim = {};
    ((res && res.strengths) || []).forEach(function (s) { byDim[s.dim] = s; });
    if (byDim.academic && byDim.academic.score >= LEVEL_LINE.A) {
      out.push({ dim: 'academic', dimLabel: DIM_LABEL.academic, text: '学业表现突出，可尝试学科竞赛 / 参与科研项目（具体以学校政策为准）' });
    }
    if (byDim.resilience && byDim.resilience.score >= LEVEL_LINE.A) {
      out.push({ dim: 'resilience', dimLabel: DIM_LABEL.resilience, text: '你的错题复习习惯很好，可以带同学一起复习（具体以学校政策为准）' });
    }
    if (byDim.progress && byDim.progress.score >= LEVEL_LINE.A) {
      out.push({ dim: 'progress', dimLabel: DIM_LABEL.progress, text: '本学期进步明显，可申请进步奖学金（具体以学校政策为准）' });
    }
    if (byDim.discipline && byDim.discipline.score >= LEVEL_LINE.A && !out.length) {
      out.push({ dim: 'discipline', dimLabel: DIM_LABEL.discipline, text: '出勤与作业完成度稳定，可担任课程小组的学习负责人（具体以学校政策为准）' });
    }
    return out;
  }

  var api = {
    WEIGHTS: WEIGHTS,
    DIM_LABEL: DIM_LABEL,
    SUBJECT_WEIGHTS: SUBJECT_WEIGHTS,
    LEVEL_LINE: LEVEL_LINE,
    STRENGTH_LINE: STRENGTH_LINE,
    dimLevel: dimLevel,
    gradesText: gradesText,
    collect: collect,
    evaluate: evaluate,
    evaluateStudent: evaluateStudent,
    suggestions: suggestions
  };
  if (typeof window !== 'undefined') window.PositiveRuleManager = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
