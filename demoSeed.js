/**
 * demoSeed.js — 一键载入完整演示数据
 * ---------------------------------------------------------------
 * 为什么需要它：本项目的业务数据全部存在 **localStorage**（位于 %APPDATA%，
 * 不在项目目录里）。因此把源码压缩包交给评审时**不会带走任何数据**——评审
 * 打开看到的是空白首启。这个模块让"满状态演示"变成一次点击，而交付物仍然只有代码。
 *
 * 设计约束：
 *   1. **只用真实写入口**（Tickets / Appeals / Cases / CampusProfile / MM / Perm / Session），
 *      内部私有结构（学生状态、快照、历史）通过 app.js 暴露的 DemoSeedHooks 调用，
 *      这样本文件不复制、不猜测任何内部数据格式。
 *   2. **确定性**：不使用随机数，每次点击得到同一份演示数据。
 *   3. **可重复执行**：先清空"演示管辖"的存储键再写入，不会越点越多。
 *   4. **不动这些东西**：登录会话、引导完成标记、智能体配置、知识库自定义条目、任务流历史。
 *
 * 覆盖范围（16 个业务键里的 13 个）：
 *   风险状态 / 判定快照 / 预警历史 / 帮扶工单 / 案例库（含结案与升级）/
 *   申诉（待复核·已采纳·已驳回）/ 多源行为信号 + 单独同意 / 错题本 + 回流候选 /
 *   数据访问审计 / 身份变更留痕
 */
(function (global) {
  'use strict';

  var ROOT = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined' ? globalThis : global);

  function M(name) { return ROOT[name] || null; }
  function hooks() { return ROOT.DemoSeedHooks || null; }

  /** 演示管辖的存储键：重新载入时先清空这些，保证可重复执行 */
  var MANAGED_KEYS = [
    'studentWarningStates', 'studentWarningHistory', 'warningSnapshots',
    'warningAppeals', 'supportTickets', 'caseBase',
    'campusSignals', 'campusConsent', 'campusSignalMeta',
    'wrongBook', 'warningCandidates', 'dataAccessLog', 'authLog',
    // 三 Agent 调用留痕：演示前清掉，避免上一轮的录屏/调试输出混进本次演示
    'agentCalls'
  ];

  /** 工单演示内容（desc 需 >= MIN_DESC 才能通过校验，故写得具体） */
  var TICKETS = [
    { type: '经济困难', urgencyHint: 'pending', desc: '家里这学期收入减少，生活费比较紧张，想咨询一下学校有没有临时困难补助可以申请。' },
    { type: '学习困难', urgencyHint: 'processing', desc: '高数和编程两门课跟不上进度，作业经常做不完，希望能安排学长或老师做一次集中辅导。' },
    { type: '心理压力', urgencyHint: 'closed-ok', desc: '最近一个月情绪低落、晚上睡不着，白天上课注意力也很难集中，想找人聊一聊。' },
    { type: '其他', urgencyHint: 'closed-bad', desc: '这学期在外面兼职的时间比较长，担心影响出勤和作业，想请老师帮忙规划一下时间。' }
  ];

  /** 申诉演示内容 */
  var APPEALS = [
    { type: '数据有误', reason: '那几次缺勤是因为我参加了学院组织的学科竞赛集训，已经请过假了，考勤记录可能没有同步，希望老师核实。', review: null },
    { type: '情况说明', reason: '上学期家里有事我确实落下了一些作业，但这学期已经补交了大部分，成绩也在回升，希望重新评估一次。', review: { status: 'accepted', conclusion: '经核实补交记录属实，同意下调风险等级。' } },
    { type: '其他', reason: '我认为评分只看成绩不太合理，我平时参加了很多实践活动。', review: { status: 'rejected', conclusion: '现行规则以学业与过程数据为准，实践活动已在育优名单中单独体现。' } }
  ];

  /**
   * 错题本演示条目。
   * 注意 knowledgePoints 要**刻意重复**：「定积分的换元法」放 3 条，
   * 刚好达到 MM.warning 的阈值（mid=3 条待复习才生成回流预警候选），
   * 否则"错题回流预警"卡片永远是空的。
   */
  var WRONG_ITEMS = [
    { subject: '高数', title: '定积分换元后忘记改上下限', note: '换元后忘记同步换上下限，导致结果差一个符号。', kp: ['定积分的换元法'] },
    { subject: '高数', title: '定积分换元回代错误', note: '换元后没有回代原变量，直接用了新变量的上下限。', kp: ['定积分的换元法'] },
    { subject: '高数', title: '三角换元的范围讨论', note: '三角代换后没有讨论 t 的范围，积分区间取错。', kp: ['定积分的换元法'] },
    { subject: '编程', title: '递归缺少终止条件', note: '递归没有写边界条件导致栈溢出；这类题要先写边界再写递推。', kp: ['递归与边界条件'] },
    { subject: '英语', title: '长难句拆分顺序', note: '定语从句套两层，先找主谓宾再挂修饰成分。', kp: ['长难句拆分'] }
  ];

  /* ------------------------------------------------------------------ */

  function clearManaged() {
    var cleared = 0;
    for (var i = 0; i < MANAGED_KEYS.length; i++) {
      try {
        if (ROOT.localStorage.getItem(MANAGED_KEYS[i]) !== null) {
          ROOT.localStorage.removeItem(MANAGED_KEYS[i]);
          cleared++;
        }
      } catch (e) { /* 单个键失败不影响其余 */ }
    }
    return cleared;
  }

  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  /**
   * 写入完整演示数据。
   * @param {{fresh?:boolean}} opts fresh 默认 true：先清空演示管辖的键再写入
   * @returns {{ok:boolean, stats:object, errors:Array<string>}}
   */
  function seed(opts) {
    opts = opts || {};
    var H = hooks();
    if (!H) return { ok: false, stats: {}, errors: ['DemoSeedHooks 未就绪：demoSeed.js 需要在 index.html 中于 app.js 之前加载'] };

    var errors = [];
    var stats = {
      cleared: 0, students: 0, snapshots: 0, history: 0,
      tickets: 0, cases: 0, appeals: 0,
      signals: 0, consents: 0, wrongBook: 0, candidates: 0, audit: 0
    };

    if (opts.fresh !== false) stats.cleared = clearManaged();

    var roster = safe(function () { return H.roster() || []; }) || [];
    if (!roster.length) return { ok: false, stats: stats, errors: ['花名册为空，无法生成演示数据'] };
    stats.students = roster.length;

    /* ---------- 1. 工单状态：让"已解除预警"这类卡片不再是 0 ---------- */
    // getDashboardData() 里 resolved 与 高/中/低 是互斥的，所以设两个已办结最有信息量
    var statusPlan = {};
    if (roster[1]) statusPlan[roster[1].id] = 'processing';
    if (roster[3]) statusPlan[roster[3].id] = 'resolved';
    if (roster[5]) statusPlan[roster[5].id] = 'resolved';
    for (var sid in statusPlan) {
      if (statusPlan.hasOwnProperty(sid)) safe(function () { return H.setStatus(sid, statusPlan[sid]); });
    }

    /* ---------- 2. 判定快照 + 预警历史（学生端解释卡 / 操作记录台账要用） ---------- */
    for (var i = 0; i < roster.length; i++) {
      if (safe(function () { return H.writeSnapshot(roster[i].id); })) stats.snapshots++;
      if (safe(function () { return H.addHistory(roster[i].id); })) stats.history++;
    }

    /* ---------- 3. 帮扶工单 ---------- */
    var T = M('Tickets');
    var madeTickets = [];
    if (T) {
      for (var t = 0; t < TICKETS.length; t++) {
        var item = TICKETS[t];
        var stu = roster[t % roster.length];
        var r = T.create({
          studentId: stu.id, studentName: stu.name, className: stu.className,
          type: item.type, desc: item.desc, contact: '1380000000' + t
        });
        if (!r || !r.ok) { errors.push('工单 ' + t + ' 创建失败：' + ((r && r.error) || '未知')); continue; }
        stats.tickets++;
        madeTickets.push({ ticket: r.ticket, hint: item.urgencyHint, student: stu });

        if (item.urgencyHint === 'processing') {
          T.update(r.ticket.id, { status: 'accepted', handler: '辅导员 张老师' },
            { at: new Date().toISOString(), actor: '张老师', action: '受理', note: '已联系学生，安排每周一次学业辅导' });
        } else if (item.urgencyHint === 'closed-ok' || item.urgencyHint === 'closed-bad') {
          var plan = (item.urgencyHint === 'closed-ok')
            ? { planName: '心理疏导 + 作息调整', summary: '安排心理咨询两次，并要求每日打卡记录作息', outcome: 'resolved' }
            : { planName: '兼职时间规划', summary: '协助调整兼职时段，恢复出勤与作业提交', outcome: 'escalated' };
          T.update(r.ticket.id, { status: 'closed', handler: '辅导员 张老师', result: plan.summary },
            { at: new Date().toISOString(), actor: '张老师', action: '办结', note: plan.summary });
          // 4. 案例库：结案即沉淀，供「有效干预方式」统计
          var C = M('Cases');
          if (C) {
            var cr = C.add({
              ticketId: r.ticket.id, studentId: stu.id, className: stu.className,
              riskLevel: stu._riskLevel || '中', riskScore: stu._riskScore === undefined ? '' : stu._riskScore,
              factors: [], planName: plan.planName, planSummary: plan.summary,
              checkinRate: plan.outcome === 'resolved' ? 0.85 : 0.42,
              outcome: plan.outcome, durationDays: plan.outcome === 'resolved' ? 18 : 26,
              closedAt: new Date().toISOString()
            });
            if (cr && cr.ok) stats.cases++;
          }
        }
      }
    } else { errors.push('Tickets 模块未加载'); }

    /* ---------- 5. 申诉：待复核 / 已采纳 / 已驳回 各一条 ---------- */
    var A = M('Appeals');
    if (A) {
      for (var a = 0; a < APPEALS.length; a++) {
        var ap = APPEALS[a];
        var s2 = roster[(a + 2) % roster.length];
        var snap = safe(function () { return H.getSnapshot(s2.id); });
        var ra = A.create({
          studentId: s2.id, studentName: s2.name, className: s2.className,
          warningAt: (snap && snap.at) || new Date().toISOString(),
          snapshot: snap || {}, type: ap.type, reason: ap.reason
        });
        if (!ra || !ra.ok) { errors.push('申诉 ' + a + ' 创建失败：' + ((ra && ra.error) || '未知')); continue; }
        stats.appeals++;
        if (ap.review) {
          A.review(ra.appeal.id, { status: ap.review.status, conclusion: ap.review.conclusion, reviewer: '辅导员 张老师' });
        }
      }
    } else { errors.push('Appeals 模块未加载'); }

    /* ---------- 6. 多源行为数据 + 逐人单独同意（重点关注名单要有内容） ---------- */
    var CP = M('CampusProfile');
    if (CP) {
      var sd = CP.seedDemo(roster, { seed: 42, days: 112 });
      if (sd && sd.ok) stats.signals = sd.students; else errors.push('行为数据生成失败：' + ((sd && sd.error) || '未知'));
      var ids = roster.map(function (s) { return String(s.id); });
      var bulk = CP.setConsentBulk(ids, true, { actor: 'demo-seed' });
      stats.consents = (bulk && bulk.count) || 0;
    } else { errors.push('CampusProfile 模块未加载'); }

    /* ---------- 7. 错题本 + 回流候选 ---------- */
    var MM = M('MM');
    if (MM && MM.wrongBook) {
      var owner = roster[0];
      for (var w = 0; w < WRONG_ITEMS.length; w++) {
        var wi = WRONG_ITEMS[w];
        var wr = MM.wrongBook.save({
          studentId: owner.id, studentName: owner.name,
          subject: wi.subject, title: wi.title, note: wi.note,
          knowledgePoints: wi.kp || [],
          status: 'unmastered',
          source: '演示数据', createdAt: new Date().toISOString()
        });
        if (wr && wr.ok !== false) stats.wrongBook++;
      }
      // 注意：必须传 studentId。candidateSync 内部按 wrongBookList({studentId}) 过滤，
      // 不传的话 studentId='' 会把所有条目都滤掉，"错题回流预警"永远是空的。
      if (MM.warning && MM.warning.sync) {
        var cs = safe(function () { return MM.warning.sync({ studentId: owner.id, studentName: owner.name }); });
        if (cs && typeof cs.created === 'object') stats.candidates = cs.created.length;
      }
    }

    /* ---------- 8. 审计与留痕：隐私中心"谁看过我的数据"不能是空的 ---------- */
    var P = M('Perm');
    if (P && P.audit) {
      for (var k = 0; k < Math.min(roster.length, 5); k++) {
        safe(function () {
          return P.audit({
            action: 'view', subjectId: roster[k].id, subjectName: roster[k].name,
            fields: ['grades', 'attendance', 'riskLevel', 'status']
          });
        });
        stats.audit++;
      }
    }
    var S = M('Session');
    if (S && S.log) {
      safe(function () { return S.log({ event: 'demo_seed_loaded', role: 'teacher', detail: '一键载入完整演示数据' }); });
      safe(function () { return S.log({ event: 'campus_consent_granted', role: 'demo-seed', detail: stats.consents + ' 人' }); });
    }

    /* ---------- 9. 落盘 + 刷新界面 ---------- */
    if (H.commit) safe(function () { return H.commit(); });
    if (H.refresh) safe(function () { return H.refresh(); });

    return { ok: errors.length === 0, stats: stats, errors: errors };
  }

  var api = { seed: seed, MANAGED_KEYS: MANAGED_KEYS };
  ROOT.DemoSeed = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
