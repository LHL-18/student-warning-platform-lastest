/**
 * agentBridge.js — 平台数据 ↔ 三 Agent 契约层的桥
 * ---------------------------------------------------------------
 * agents.js 是"纯契约层"：它只认文档规定的 JSON 输入，不认识本项目的
 * studentWarningStates / supportTickets / flowRuns。本文件负责单向翻译：
 *
 *   平台数据 ──(确定性映射)──> Agent 输入（含 evidence_id）
 *   Agent 输出 ──(渲染)──> 界面可读卡片
 *
 * 三条硬规则（都是为了"证据可核查"）：
 *   1. **只做映射，不做推断**：没有的数据就写进 missing_fields / data_gaps，
 *      绝不用默认值把缺口填成"看起来正常"；
 *   2. 每条证据都带 source（来自哪个键/哪次记录）与 quality（可信|待核实|过期），
 *      过期判断用观测时间与保留期比较，不靠感觉；
 *   3. 出勤率这类字段库里存的是"缺勤5次"这种描述时，标为待核实，
 *      而不是当成一个数字参与达标判断。
 *
 * 零依赖（只读全局 Agents / localStorage），ES5，无 eval，浏览器与 Node 均可加载。
 */
(function (global) {
  'use strict';

  var ROOT = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined' ? globalThis : global);

  var VERSION = '1.0.0';
  var DAY = 86400000;
  var STALE_DAYS = 180;          // 学业数据超过半年视为过期（一学期的量级）
  var DEFAULT_REVIEW_DAYS = 30;

  function A() { return ROOT.Agents || null; }

  function lsGet(key) {
    try {
      var s = ROOT.localStorage;
      return s ? s.getItem(key) : null;
    } catch (e) { return null; }
  }

  function readJson(key, dflt) {
    var raw = lsGet(key);
    if (!raw) return dflt;
    try {
      var v = JSON.parse(raw);
      return v === null || v === undefined ? dflt : v;
    } catch (e) { return dflt; }
  }

  function isObj(v) { return !!v && Object.prototype.toString.call(v) === '[object Object]'; }
  function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }
  function trim(v) { return v === null || v === undefined ? '' : String(v).replace(/^\s+|\s+$/g, ''); }

  /** 解析各种来源的时间：ISO 串、"2026/9/1 10:00:00" 都尽量认，认不出返回 null。 */
  function parseTime(v) {
    var t = trim(v);
    if (!t) return null;
    var d = new Date(t);
    if (!isNaN(d.getTime())) return d;
    d = new Date(t.replace(/\//g, '-').replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }

  function daysBetween(a, b) {
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / DAY);
  }

  function qualityFor(observedAt, now, opts) {
    opts = opts || {};
    if (opts.unverified) return '待核实';
    var t = parseTime(observedAt);
    if (t && now && daysBetween(t, now) > (opts.staleDays || STALE_DAYS)) return '过期';
    return '可信';
  }

  /* ---------------- 学生与画像 ---------------- */

  /**
   * 取学生全量字段。
   *
   * 不能直接用 RosterUtil.find()：它按设计只返回**种子花名册**（不含教师改过的学业数据），
   * 拿它去分析会把"老师刚录入的成绩"当成没发生 —— 预警就解释错了。
   * 所以以状态表（studentWarningStates，教师端的权威运行期副本）为主，
   * 种子数据只补名字/班级等静态字段，两者都没有才算找不到。
   */
  function findStudent(studentId) {
    if (!studentId) return null;
    var seed = null;
    if (ROOT.RosterUtil && typeof ROOT.RosterUtil.find === 'function') seed = ROOT.RosterUtil.find(studentId);
    var st = warningState(studentId);
    var hasState = isObj(st) && Object.keys(st).length > 0;

    if (!seed && !hasState) {
      var list = isArr(ROOT.mockStudents) ? ROOT.mockStudents : [];
      for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === studentId) return list[i]; }
      return null;
    }

    var out = {
      id: studentId,
      name: trim(st.name) || trim(seed && seed.name),
      className: trim(st.className) || trim(seed && seed.className)
    };
    var FIELDS = ['grades', 'homework', 'attendance', 'lab', 'labReport', 'codeQuality'];
    for (var f = 0; f < FIELDS.length; f++) {
      var k = FIELDS[f];
      // 只有状态表里确实写了值才覆盖种子；空值不能把种子数据抹掉
      out[k] = trim(st[k]) ? st[k] : (seed ? seed[k] : '');
    }
    out._riskLevel = trim(st.riskLevel) || trim(seed && seed._riskLevel);
    out._riskScore = st.riskScore !== undefined && st.riskScore !== '' ? st.riskScore : (seed ? seed._riskScore : undefined);
    out.status = trim(st.status) || trim(seed && seed.status);
    out.ticketId = trim(st.ticketId) || trim(seed && seed.ticketId);
    return out;
  }

  /** 从学生状态表里取预警工单字段（工单号/时间/原因/方案），状态表是教师端权威副本。 */
  function warningState(studentId) {
    var states = readJson('studentWarningStates', {});
    if (isObj(states) && studentId && isObj(states[studentId])) return states[studentId];
    return {};
  }

  /**
   * 取"规则引擎结果"。文档的立场是"规则引擎给出的风险等级和分数是系统计算结果"，
   * 所以这里优先**现场调用** RiskPluginManager（当前生效的那套规则），
   * 拿不到时才退回状态表里已存的等级/分数；两者都没有就置空，让 Agent1 明确报缺失。
   */
  function ruleResultFor(studentId, stu, opts) {
    opts = opts || {};
    var st = warningState(studentId);
    var ruleName = '学业预警规则', ruleVersion = 'v1', triggered = [];
    var level = '', score = null;

    // 1) 现场跑一次当前生效的规则（确定性、可复现，且与教师端看到的口径一致）
    try {
      if (ROOT.RiskPluginManager && typeof ROOT.RiskPluginManager.score === 'function' && (stu || opts.profile)) {
        var activeId = typeof ROOT.RiskPluginManager.getActive === 'function' ? ROOT.RiskPluginManager.getActive() : '';
        var profile = opts.profile || stu || {};
        var scored = ROOT.RiskPluginManager.score({
          grades: profile.grades, homework: profile.homework, attendance: profile.attendance,
          lab: profile.lab, labReport: profile.labReport, codeQuality: profile.codeQuality
        });
        if (scored && isObj(scored)) {
          level = trim(scored.level);
          if (scored.score !== undefined && scored.score !== null && !isNaN(parseFloat(scored.score))) score = parseFloat(scored.score);
          var factors = isArr(scored.factors) ? scored.factors : [];
          for (var f = 0; f < factors.length; f++) {
            var item = factors[f];
            triggered.push(typeof item === 'string' ? item : trim(item && (item.label || item.field)));
          }
          var names = typeof ROOT.RiskPluginManager.getNames === 'function' ? ROOT.RiskPluginManager.getNames() : [];
          for (var n = 0; n < names.length; n++) {
            if (names[n] && names[n].id === activeId) ruleName = trim(names[n].name) || ruleName;
          }
          // 规则版本用插件 id（'strict'|'basic'|'weighted'）：可追溯，且不假装有语义化版本号
          if (activeId) ruleVersion = activeId;
        }
      }
    } catch (e) { /* 规则插件不可用时退回状态表，不阻断流程 */ }

    // 2) 状态表/缓存兜底
    if (!level) level = trim(opts.ruleLevel || (stu && stu._riskLevel) || st.riskLevel);
    if (score === null) {
      var s = opts.ruleScore !== undefined ? opts.ruleScore : (stu && stu._riskScore !== undefined ? stu._riskScore : st.riskScore);
      if (s !== '' && s !== null && s !== undefined && !isNaN(parseFloat(s))) score = parseFloat(s);
    }
    if (!triggered.length) {
      if (isArr(st.factors)) triggered = st.factors.slice(0);
      if (!triggered.length && trim(st.ticketReason)) triggered = [trim(st.ticketReason)];
      if (!triggered.length && level) triggered = ['规则引擎判定风险等级：' + level];
    }
    triggered = triggered.filter(function (t) { return !!trim(t); });

    return {
      rule_name: ruleName,
      rule_version: ruleVersion,
      risk_level: level || '',
      risk_score: score,
      triggered_rules: triggered
    };
  }

  /**
   * 构造 Agent1 输入。
   * @param {{studentId:string, period?:string, at?:string, now?:Date, ruleLevel?:string, ruleScore?:number}} opts
   */
  function buildAnalysisInput(opts) {
    opts = opts || {};
    var agents = A();
    if (!agents) throw new Error('Agent 契约层未加载（agents.js）');
    var studentId = opts.studentId;
    var stu = findStudent(studentId);
    if (!stu) throw new Error('未找到学生：' + studentId);
    var st = warningState(studentId);
    var now = opts.now || new Date();

    // 观测时间：有工单时间用工单时间，否则用录入时间，都没有则用当前时间并标待核实。
    var observedAt = trim(st.ticketTime) || trim(st.updatedAt) || '';
    var unverifiedTime = !parseTime(observedAt);
    if (unverifiedTime) observedAt = now.toISOString();

    var profile = {
      id: studentId,
      name: stu.name,
      className: stu.className,
      grades: stu.grades,
      homework: stu.homework,
      attendance: stu.attendance,
      lab: stu.lab || (stu.attendance && String(stu.attendance).indexOf('实验') >= 0 ? stu.attendance : ''),
      labReport: stu.labReport || '',
      codeQuality: stu.codeQuality || ''
    };

    var missing = [];
    if (!trim(profile.grades)) missing.push('grades');
    if (!trim(profile.homework)) missing.push('homework');
    if (!trim(profile.attendance)) missing.push('attendance');

    var input = agents.buildAgent1Input({
      caseId: opts.caseId || ('CASE-' + String(studentId).slice(-6)),
      // 假名化：Agent1 输入不回传真实学号（文档：只处理必要数据，不输出无关个人信息）
      studentRef: agents.hashId(studentId),
      period: opts.period || '最近一学期',
      ruleResult: ruleResultFor(studentId, stu, opts),
      profile: profile,
      missingFields: missing,
      at: observedAt
    });

    // 非数值型/无法核实的字段降级为"待核实"，避免把文字描述当成可信数字。
    var ev = isArr(input.evidence) ? input.evidence : [];
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (unverifiedTime && e.quality === '可信') e.quality = '待核实';
      if (!trim(e.observed)) { e.observed = '未提供'; e.quality = '待核实'; }
    }
    return input;
  }

  /* ---------------- 案例反哺 ---------------- */

  function caseSummariesFrom(caseToolOutput) {
    var out = [];
    var items = caseToolOutput && caseToolOutput.items;
    if (!isArr(items)) return out;
    for (var i = 0; i < items.length; i++) {
      var c = items[i] || {};
      var ref = trim(c.case_ref) || trim(c.id) || trim(c.ticketId);
      if (!ref) continue;   // 没有可引用编号的案例不进上下文（避免模型引用不到出处）
      out.push({
        case_ref: ref,
        intervention: trim(c.intervention) || trim(c.planName) || trim(c.planSummary) || '（案例未记录干预方式）',
        outcome: trim(c.outcome) || '（未记录结果）',
        // 相似度低或字段不全的案例，证据质量只能算"有限"，不得当成强证据。
        evidence_quality: (typeof c.score === 'number' && c.score < 0.5) ? '有限' : (c.evidence_quality || '有限')
      });
    }
    return out;
  }

  /**
   * 构造 Agent2 输入。findings 来自 Agent1 输出（已被辅导员确认的那部分）。
   * @param {{studentId, findings:Array, cases:object, planPeriodDays:number,
   *          constraints:Array, resources:Array, approvedIndices:Array}} opts
   */
  function buildPlanInput(opts) {
    opts = opts || {};
    var agents = A();
    if (!agents) throw new Error('Agent 契约层未加载（agents.js）');
    var findings = isArr(opts.findings) ? opts.findings : [];
    var keep = isArr(opts.approvedIndices) ? opts.approvedIndices : null;

    var approved = [];
    for (var i = 0; i < findings.length; i++) {
      if (keep && keep.indexOf(i) < 0) continue;   // 辅导员可以勾掉不认可的结论
      var f = findings[i] || {};
      approved.push({
        statement: trim(f.statement),
        evidence_ids: isArr(f.evidence_ids) ? f.evidence_ids.slice(0) : []
      });
    }

    // 可用资源：只列平台确实提供的能力，不虚构"校外机构""家长配合"这类不存在的资源。
    var resources = isArr(opts.resources) ? opts.resources.slice(0) : [
      '错题本与薄弱知识点专项练习',
      '知识库课程资源（课件/讲义）',
      '辅导员一对一辅导排期'
    ];
    var constraints = isArr(opts.constraints) ? opts.constraints : [];
    if (!constraints.length) {
      // 未采集作息/场地约束是真实状态，交给 Agent2 写入 needs_human_input。
      constraints = [];
    }

    return agents.buildAgent2Input({
      caseId: opts.caseId || ('CASE-' + String(opts.studentId || '').slice(-6)),
      studentRef: agents.hashId(opts.studentId || ''),
      approvedFindings: approved,
      constraints: constraints,
      resources: resources,
      caseSummaries: caseSummariesFrom(opts.cases),
      planPeriodDays: opts.planPeriodDays || 30
    });
  }

  /* ---------------- 执行证据（Agent3 的输入） ---------------- */

  /** 从"作业提交率 62%"这类文本里取百分数；取不到返回 null（表示没有该口径的数据）。 */
  function numFromText(text, kind) {
    var t = trim(text);
    if (!t) return null;
    if (kind === 'percent') {
      var m = t.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
      return m ? parseFloat(m[1]) : null;
    }
    var s = t.match(/(\d{1,3}(?:\.\d+)?)\s*分/);
    if (s) return parseFloat(s[1]);
    var p = t.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
    return p ? parseFloat(p[1]) : null;
  }

  /** 规则引擎的原始指标 → Agent3 可直接核对的执行证据（同一口径前后对比）。 */
  function metricEvidence(studentId, reviewDays, now) {
    var agents = A();
    var stu = findStudent(studentId);
    var st = warningState(studentId);
    var out = [];
    if (!stu) return out;

    var startAt = trim(st.ticketTime) || '';
    var startTime = parseTime(startAt);
    var endIso = now.toISOString();
    var seq = 0;

    function push(metric, observed, expected, source, opts) {
      opts = opts || {};
      seq++;
      out.push({
        evidence_id: agents.evidenceId('exec', metric, seq, endIso),
        action_id: opts.actionId || '',
        metric: opts.label || metric,
        observed: observed,
        observed_at: endIso,
        source: source,
        quality: opts.quality || '可信'
      });
    }

    var changed = startTime ? (daysBetween(startTime, now) || 0) : null;
    var stale = changed !== null && changed > STALE_DAYS;

    // 成绩：只在能解析出数字时给出观测值；纯文字（"高数不及格"）标待核实。
    var gNum = numFromText(stu.grades, 'score');
    if (gNum !== null) push('avg_score', gNum + '分', '≥60 分', '学业数据（成绩录入）', { label: '平均成绩', quality: stale ? '过期' : '可信' });
    else if (trim(stu.grades)) push('avg_score', '未提供', '≥60 分', '学业数据（成绩录入，仅有文字描述）', { label: '平均成绩', quality: '待核实' });

    var hNum = numFromText(stu.homework, 'percent');
    if (hNum !== null) push('homework_rate', hNum + '%', '≥80%', '学业数据（作业记录）', { label: '作业提交率', quality: stale ? '过期' : '可信' });
    else if (trim(stu.homework)) push('homework_rate', '未提供', '≥80%', '学业数据（作业记录，无百分比）', { label: '作业提交率', quality: '待核实' });

    var aNum = numFromText(stu.attendance, 'percent');
    if (aNum !== null) push('attendance_rate', aNum + '%', '≥90%', '学业数据（考勤记录）', { label: '出勤率', quality: stale ? '过期' : '可信' });
    else if (trim(stu.attendance)) push('attendance_rate', '未提供', '≥90%', '学业数据（考勤记录，无百分比）', { label: '出勤率', quality: '待核实' });

    // 复核周期本身也是一条证据：周期不足时 Agent3 应说明"需要更长观察期"。
    if (startTime) {
      push('review_window', (changed === null ? '未知' : changed) + ' 天', '≥' + (reviewDays || DEFAULT_REVIEW_DAYS) + ' 天（约定复核周期）',
        '工单时间与本次复核时间之差', { label: '复核周期', quality: '可信' });
    }
    return out;
  }

  /** 工单/操作日志里已经发生的干预动作 → 逐条行动的完成证据。 */
  function actionEvidence(studentId, plan, now) {
    var agents = A();
    var out = [];
    if (!plan) return out;
    var endIso = now.toISOString();
    var st = warningState(studentId);
    var logs = isArr(st.operationLog) ? st.operationLog : [];
    var seq = 100;

    var actions = isArr(plan.actions) ? plan.actions : [];
    for (var i = 0; i < actions.length; i++) {
      var act = actions[i] || {};
      var crit = isArr(act.success_criteria) && act.success_criteria.length ? act.success_criteria[0] : {};
      var metric = trim(crit.metric) || ('行动 ' + trim(act.action_id) + ' 完成情况');

      // 匹配该行动的执行记录：按行动关键词在日志里找（确定性字符串匹配，不做语义猜测）。
      var hits = [];
      var key = trim(act.description).slice(0, 8);
      for (var L = 0; L < logs.length; L++) {
        var note = trim(logs[L] && logs[L].note);
        var action = trim(logs[L] && logs[L].action);
        if (key && note.indexOf(key) >= 0) hits.push(logs[L]);
        else if (/ticket|plan|flow|辅导|打卡|复习/.test(action) && note) hits.push(logs[L]);
      }

      seq++;
      if (!hits.length) {
        // 没有记录就明确"未提供"：Agent3 据此判证据不足，而不是判学生没做。
        out.push({
          evidence_id: agents.evidenceId('exec', metric, seq, endIso),
          action_id: trim(act.action_id),
          metric: metric,
          observed: '未提供',
          observed_at: endIso,
          source: '（该行动在复核周期内没有可核对的执行记录）',
          quality: '待核实'
        });
      } else {
        out.push({
          evidence_id: agents.evidenceId('exec', metric, seq, endIso),
          action_id: trim(act.action_id),
          metric: metric,
          observed: hits.length + ' 条执行记录（最近：' + trim(hits[0].note).slice(0, 40) + '）',
          observed_at: trim(hits[0].time) || endIso,
          source: '工单操作日志',
          quality: '待核实'
        });
      }
    }
    return out;
  }

  /** 已审批方案：优先引用传入的上下文方案，其次工单上的方案字段，最后最近一次 Agent2 留痕输出。 */
  function approvedPlanFor(studentId, ctxPlan) {
    // 1) 同一条流程上下文里的 Agent2 输出（教师刚跑完闭环流就直接复核的场景）
    if (isObj(ctxPlan) && isArr(ctxPlan.actions) && ctxPlan.actions.length) {
      return { plan_id: trim(ctxPlan.plan_id) || ('PLAN-' + String(studentId || '').slice(-6)), actions: ctxPlan.actions };
    }
    var st = warningState(studentId);
    var sp = st.supportPlan;
    if (isObj(sp) && isArr(sp.actions) && sp.actions.length) {
      return { plan_id: trim(sp.plan_id) || ('PLAN-' + String(st.ticketId || studentId)), actions: sp.actions };
    }
    // 2) 退回最近一条 Agent2 调用记录：那是"系统当时确实给出的方案"，有凭据可查。
    var agents = A();
    if (agents && typeof agents.calls === 'function') {
      var list = agents.calls({ agentId: 'agent2' });
      for (var i = 0; i < list.length; i++) {
        var rec = list[i];
        if (!rec || !isObj(rec.output)) continue;
        if (String(rec.caseId || '').indexOf(String(studentId).slice(-6)) < 0) continue;
        if (isArr(rec.output.actions) && rec.output.actions.length) {
          return { plan_id: 'PLAN-' + String(studentId).slice(-6) + '-from-' + (rec.callId || i), actions: rec.output.actions };
        }
      }
    }
    // 工单方案只有一段摘要时：拆不出可核查的行动，返回空并让上游进 data_gaps。
    return { plan_id: 'PLAN-' + String(studentId).slice(-6), actions: [] };
  }

  /**
   * 汇总复核所需的一切（流程里由 agent3.gatherEvidence 工具节点调用）。
   * @param {{studentId:string, reviewDays?:number, now?:Date, ctxPlan?:object}} opts
   */
  function gatherReview(opts) {
    opts = opts || {};
    var now = opts.now || new Date();
    var reviewDays = parseInt(opts.reviewDays, 10);
    if (!isFinite(reviewDays) || reviewDays <= 0) reviewDays = DEFAULT_REVIEW_DAYS;
    var plan = approvedPlanFor(opts.studentId, opts.ctxPlan);
    var evidence = metricEvidence(opts.studentId, reviewDays, now).concat(actionEvidence(opts.studentId, plan, now));
    var start = trim(warningState(opts.studentId).ticketTime) || '';
    var startTime = parseTime(start);
    return {
      plan: plan,
      reviewDays: reviewDays,
      reviewPeriod: {
        start: startTime ? startTime.toISOString().slice(0, 10) : '',
        end: now.toISOString().slice(0, 10)
      },
      evidence: evidence,
      hasPlanActions: isArr(plan.actions) && plan.actions.length > 0
    };
  }

  /** 构造 Agent3 输入。 */
  function buildReviewInput(opts) {
    opts = opts || {};
    var agents = A();
    if (!agents) throw new Error('Agent 契约层未加载（agents.js）');
    var review = opts.review || gatherReview({ studentId: opts.studentId, reviewDays: opts.reviewDays, now: opts.now, ctxPlan: opts.ctxPlan });
    return agents.buildAgent3Input({
      caseId: opts.caseId || ('CASE-' + String(opts.studentId || '').slice(-6)),
      approvedPlan: review.plan,
      reviewPeriod: review.reviewPeriod,
      executionEvidence: review.evidence,
      at: (opts.now || new Date()).toISOString()
    });
  }

  /* ---------------- 降级输出渲染（保证离线演示也能看懂） ---------------- */

  /**
   * Agent2 的结构化输出 → 工单上的 supportPlan（含 actions，供后续 Agent3 逐项核查）。
   * 保留 actions 是为了闭环：没有 actions，Agent3 只能判"证据不足"。
   */
  function planToSupportPlan(output) {
    var out = { summary: '', recommendations: [], resources: [], actions: [], planId: '', needsHumanInput: [] };
    if (!isObj(output)) return out;
    out.summary = trim(output.plan_title) + (trim(output.overall_goal) ? '：' + trim(output.overall_goal) : '');
    out.planId = 'PLAN-' + (trim(output.case_id) || Date.now().toString(36));
    var actions = isArr(output.actions) ? output.actions : [];
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i] || {};
      out.actions.push({
        action_id: trim(a.action_id),
        description: trim(a.description),
        owner: trim(a.owner),
        deadline_day: a.deadline_day,
        success_criteria: isArr(a.success_criteria) ? a.success_criteria.slice(0) : []
      });
      out.recommendations.push(trim(a.action_id) + ' ' + trim(a.description) + '（' + trim(a.owner) + '，第 ' + a.deadline_day + ' 天前）');
      var res = isArr(a.resources) ? a.resources : [];
      for (var r = 0; r < res.length; r++) { if (out.resources.indexOf(res[r]) < 0) out.resources.push(res[r]); }
    }
    out.needsHumanInput = isArr(output.needs_human_input) ? output.needs_human_input.slice(0) : [];
    return out;
  }

  /** 把三份输出渲染成可读摘要（界面卡片与验收脚本共用，避免两处渲染逻辑漂移）。 */
  function summarize(agentId, output) {
    if (!isObj(output)) return { title: '无输出', lines: [] };
    var lines = [], i;
    if (agentId === 'agent1') {
      lines.push('风险等级 ' + trim(output.rule_result_summary.risk_level) + '（' + output.rule_result_summary.risk_score + ' 分，系统原值未改动）');
      var fs = isArr(output.findings) ? output.findings : [];
      for (i = 0; i < fs.length; i++) lines.push('· ' + trim(fs[i].statement) + '［' + (isArr(fs[i].evidence_ids) ? fs[i].evidence_ids.join('、') : '') + '］');
      if (!fs.length) lines.push('· （无证据支撑的结论，未输出 findings）');
      var dq = isArr(output.data_quality_issues) ? output.data_quality_issues : [];
      for (i = 0; i < dq.length; i++) lines.push('证据质量问题：' + dq[i]);
      lines.push('建议：' + trim(output.recommendation) + ' —— ' + trim(output.recommendation_reason));
      return { title: 'Agent1 预警分析', lines: lines };
    }
    if (agentId === 'agent2') {
      lines.push(trim(output.plan_title) + '（' + output.period_days + ' 天）');
      lines.push('总体目标：' + trim(output.overall_goal));
      var as = isArr(output.actions) ? output.actions : [];
      for (i = 0; i < as.length; i++) {
        var a = as[i], crit = isArr(a.success_criteria) ? a.success_criteria : [];
        var c0 = crit[0] || {};
        lines.push('· ' + trim(a.action_id) + ' ' + trim(a.description) + '｜负责人 ' + trim(a.owner) + '｜第 ' + a.deadline_day + ' 天｜完成标准：' + trim(c0.metric) + ' ' + trim(c0.target) + '（来源：' + trim(c0.data_source) + '）');
      }
      var nh = isArr(output.needs_human_input) ? output.needs_human_input : [];
      for (i = 0; i < nh.length; i++) lines.push('需人工补充：' + nh[i]);
      return { title: 'Agent2 帮扶方案', lines: lines };
    }
    if (agentId === 'agent3') {
      lines.push('总体评估：' + trim(output.overall_assessment));
      var cr = isArr(output.criteria_results) ? output.criteria_results : [];
      for (i = 0; i < cr.length; i++) {
        var c = cr[i];
        lines.push('· ' + trim(c.action_id) + ' ' + trim(c.metric) + '｜目标 ' + trim(c.target) + '｜实测 ' + trim(c.observed) + '｜判定 ' + trim(c.assessment));
      }
      var gaps = isArr(output.data_gaps) ? output.data_gaps : [];
      for (i = 0; i < gaps.length; i++) lines.push('数据缺口：' + gaps[i]);
      var cf = isArr(output.conflicts) ? output.conflicts : [];
      for (i = 0; i < cf.length; i++) lines.push('数据冲突：' + cf[i]);
      lines.push('建议：' + trim(output.recommendation) + ' —— ' + trim(output.recommendation_reason));
      return { title: 'Agent3 执行复核', lines: lines };
    }
    return { title: '未知 Agent', lines: [] };
  }

  var API = {
    VERSION: VERSION,
    STALE_DAYS: STALE_DAYS,
    findStudent: findStudent,
    warningState: warningState,
    ruleResultFor: ruleResultFor,
    parseTime: parseTime,
    qualityFor: qualityFor,
    buildAnalysisInput: buildAnalysisInput,
    caseSummariesFrom: caseSummariesFrom,
    buildPlanInput: buildPlanInput,
    metricEvidence: metricEvidence,
    actionEvidence: actionEvidence,
    approvedPlanFor: approvedPlanFor,
    gatherReview: gatherReview,
    buildReviewInput: buildReviewInput,
    planToSupportPlan: planToSupportPlan,
    summarize: summarize
  };

  ROOT.AgentBridge = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
