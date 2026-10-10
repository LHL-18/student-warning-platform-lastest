// 学生端逻辑
(function() {
  'use strict';

  // 路由守卫：非学生身份（未登录 / 身份不符 / 会话过期）直接回登录页
  if (window.Session && !window.Session.guard('student')) return;
  /* ---------------- 当前登录学生 ----------------
   * 身份来自 session.js（登录页选择），基础信息来自 students.js（花名册），
   * 风险等级 / 评分 / 工单状态优先取教师端保存的 studentWarningStates，
   * 保证"教师端改了，学生端立刻看得到"。
   */
  var session = (window.Session && window.Session.current()) || null;
  var studentId = (session && session.id) || '2024100103';
  var rosterStudent = (window.RosterUtil && window.RosterUtil.find(studentId)) || null;

  var RISK_LABEL = { '高': '高风险', '中': '中风险', '低': '低风险' };
  var RISK_COLOR = { '高': '#d93025', '中': '#e37400', '低': '#0d904f' };
  var STATUS_LABEL = { pending: '待干预', supporting: '帮扶中', reviewing: '核查中', resolved: '已解除' };
  var STATUS_COLOR = { pending: '#b45309', supporting: '#1a73e8', reviewing: '#9334e6', resolved: '#0d904f' };

  function parseGrades(text) {
    var keys = ['高数', '英语', '编程', '计算机基础'], out = {};
    for (var i = 0; i < keys.length; i++) {
      var m = String(text || '').match(new RegExp(keys[i] + '[^0-9]*(\\d+)'));
      out[keys[i]] = m ? parseInt(m[1], 10) : 0;
    }
    return out;
  }
  function rateFromText(text, dflt) {
    var t = String(text || '');
    if (t.indexOf('全勤') !== -1) return 100;
    var m = t.match(/(\d+)\s*%/);
    if (m) return Math.min(100, parseInt(m[1], 10));
    if (/旷课|缺交/.test(t)) return 70;
    if (/迟到|请假|偶尔/.test(t)) return 90;
    return dflt;
  }

  var savedState = {};
  try {
    var allStates = {};
    try {
      var parsedStates = JSON.parse(localStorage.getItem('studentWarningStates') || '{}');
      if (parsedStates && Object.prototype.toString.call(parsedStates) === '[object Object]') allStates = parsedStates;
    } catch (e) { allStates = {}; }
    savedState = allStates[studentId] || {};
  } catch (e) { savedState = {}; }

  var riskLevel = savedState.riskLevel || '';
  var riskScore = (savedState.riskScore !== undefined && savedState.riskScore !== '') ? savedState.riskScore : null;
  if ((!riskLevel || riskScore === null) && window.RiskPluginManager && rosterStudent) {
    try {
      var scored = window.RiskPluginManager.score({
        name: rosterStudent.name, studentId: rosterStudent.id,
        grades: rosterStudent.grades || '', homework: rosterStudent.homework || '',
        attendance: rosterStudent.attendance || '', lab: rosterStudent.lab || '',
        codeQuality: rosterStudent.codeQuality || '', labReport: rosterStudent.labReport || ''
      });
      riskLevel = riskLevel || scored.level;
      if (riskScore === null) riskScore = scored.score;
    } catch (e) {}
  }

  var user = {
    id: studentId,
    name: (rosterStudent && rosterStudent.name) || (session && session.name) || '同学',
    className: (rosterStudent && rosterStudent.className) || (session && session.className) || '未分班',
    riskLevel: riskLevel || '低',
    riskScore: (riskScore === null ? '--' : riskScore),
    grades: parseGrades(rosterStudent ? rosterStudent.grades : ''),
    attendance: rateFromText(rosterStudent && rosterStudent.attendance, 100),
    homeworkRate: rateFromText(rosterStudent && rosterStudent.homework, 95),
    labRate: 100,
    status: savedState.status || 'pending',
    syncedFromTeacher: !!savedState.riskLevel
  };
  var learningPlan = [
    { week:1, title:'第 1 周', items:[
      {day:1,task:'学习《函数极限与连续》',resource:'核心讲义',done:true},
      {day:2,task:'完成极限练习题 20 道',resource:'典型例题20道',done:true},
      {day:3,task:'学习《C语言基础语法与数据类型》',resource:'语法速查表',done:false},
      {day:4,task:'完成编程入门题 10 道',resource:'入门编程题10道',done:false}
    ]},
    { week:2, title:'第 2 周', items:[
      {day:1,task:'学习《一元函数微分学》',resource:'公式手册',done:false},
      {day:2,task:'求导专项练习 15 题',resource:'求导专项练习',done:false},
      {day:3,task:'学习《循环结构与数组》',resource:'循环专项习题',done:false}
    ]}
  ];
  var notifications = [
    {id:1,type:'warning',title:'学业预警提醒',content:'您的学业状态良好，保持当前学习节奏。',time:'2026-07-17 10:30',read:false},
    {id:2,type:'task',title:'本周学习任务发布',content:'第 2 周学习计划已更新',time:'2026-07-16 09:00',read:false},
    {id:3,type:'review',title:'辅导员回访通知',content:'辅导员将于本周五进行线上回访',time:'2026-07-15 14:00',read:true},
    {id:4,type:'task',title:'上周任务完成提醒',content:'你还有 2 项学习任务未完成',time:'2026-07-14 08:00',read:true}
  ];
  var sidebar = document.getElementById('studentSidebar');
  var tabs = { profile:document.getElementById('tabProfile'), plan:document.getElementById('tabPlan'),
    notice:document.getElementById('tabNotice'), appeal:document.getElementById('tabAppeal'),
    privacy:document.getElementById('tabPrivacy'), wrongbook:document.getElementById('tabWrongBook') };
  function showToast(msg) { var t=document.getElementById('toast');t.textContent=msg;t.style.display='';setTimeout(function(){t.style.display='none';},2500); }
  function esc(s) { if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function renderSidebar() {
    var lvl = user.riskLevel==='高'?'risk-high':user.riskLevel==='中'?'risk-medium':'risk-low';
    sidebar.innerHTML = '<div style="text-align:center;padding:16px 0;"><div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#1a73e8,#4a90d9);color:#fff;font-size:24px;font-weight:600;display:flex;align-items:center;justify-content:center;margin:0 auto;">'+user.name.charAt(0)+'</div><div style="font-size:15px;font-weight:600;margin-top:8px;">'+user.name+'</div><div style="font-size:11px;color:var(--color-text-muted);">'+user.className+'</div><span class="risk-badge '+lvl+'">'+(user.riskLevel==='高'?'高风险':user.riskLevel==='中'?'中风险':'低风险')+'</span></div><div style="padding:8px 12px;font-size:12px;color:var(--color-text-muted);border-top:1px solid var(--color-border-light);"><div>出勤率: <strong style="color:#0d904f;">'+user.attendance+'%</strong></div><div>作业提交率: <strong style="color:#1a73e8;">'+user.homeworkRate+'%</strong></div><div>实验完成率: <strong style="color:#9334e6;">'+user.labRate+'%</strong></div></div>';
  }
  /* ---------------- 预警解释卡 ----------------
   * 回答"凭什么是我"：展示生成预警那一刻固化的判定依据快照。
   * 快照来自教师端写下的 warningSnapshots（含当时的规则名/分数/分维度贡献），
   * 所以即使之后老师切换了评分规则，学生看到的仍是当初的判定依据。
   * 文案全部由规则拼装，不调用大模型，保证离线可复现。
   */
  var DIM_LABEL = { grade: '成绩', attendance: '出勤', homework: '作业', experiment: '实验', wrongbook: '错题回流', base: '基准' };

  /* 我的证据：引用解析（同一个 evidence.js，教师端与学生端共用） */
  var _myEvidenceRefs = [];

  function myEvidenceDetailHtml(res) {
    if (!res || !res.ok) {
      return '<div style="font-size:11px;color:var(--color-text-muted);">' +
        (res && res.expired ? '该证据已过保留期' : ('读取失败：' + esc((res && res.error) || '未知原因'))) + '</div>';
    }
    var h = '';
    (res.rows || []).forEach(function (r) {
      h += '<div style="font-size:11px;"><span style="color:var(--color-text-muted);">' + esc(r.k) + '：</span>' + esc(r.v) + '</div>';
    });
    if (res.text) {
      h += '<div style="margin-top:6px;padding:6px;background:var(--color-bg);border-radius:4px;font-size:11px;white-space:pre-wrap;max-height:160px;overflow:auto;">' + esc(String(res.text).slice(0, 500)) + '</div>';
    }
    if (res.solution) {
      h += '<div style="margin-top:4px;font-size:11px;"><span style="color:var(--color-text-muted);">结论：</span>' + esc(String(res.solution).slice(0, 300)) + '</div>';
    }
    return h;
  }

  function bindMyEvidence() {
    var list = _myEvidenceRefs || [];
    Array.prototype.forEach.call(document.querySelectorAll('[data-myev]'), function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(this.getAttribute('data-myev'), 10);
        var box = document.getElementById('myEvidenceDetail' + i);
        if (!box) return;
        if (box.style.display !== 'none') { box.style.display = 'none'; this.textContent = '查看'; return; }
        var res;
        try { res = window.Evidence.resolve(list[i]); } catch (e) { res = { ok: false, error: e.message }; }
        box.innerHTML = myEvidenceDetailHtml(res);
        box.style.display = '';
        this.textContent = '收起';
      });
    });
  }

  function loadMySnapshot() {
    if (!window.Perm || !window.Perm.filterSnapshot) return null;
    var gate = window.Perm.guardData('student', user.id);
    if (!gate.ok) return null;
    var all = {};
    try { all = JSON.parse(localStorage.getItem('warningSnapshots') || '{}') || {}; } catch (e) { all = {}; }
    var raw = all[user.id];
    if (!raw) return null;
    window.Perm.audit({ action: 'view', subjectId: user.id, subjectName: user.name, fields: ['riskLevel', 'riskScore', 'factors'] });
    return window.Perm.filterSnapshot('student', raw, true);
  }

  function renderExplainCard() {
    var snap = loadMySnapshot();
    if (!snap || !snap.riskLevel) return '';

    var lv = snap.riskLevel;
    // 同一份快照已有待复核申诉时，按钮置为「已申诉（处理中）」并禁用
    var myAppeals = window.Appeals ? window.Appeals.list({ studentId: user.id }) : [];
    var pendingForThis = myAppeals.filter(function (a) {
      return a.status === 'pending' && String(a.warningAt) === String(snap.at);
    });
    var score = (snap.riskScore === undefined || snap.riskScore === null) ? '--' : snap.riskScore;
    var factors = (Object.prototype.toString.call(snap.factors) === '[object Array]') ? snap.factors.slice() : [];

    // 命中的排前面，其次按贡献绝对值排序
    factors.sort(function (a, b) {
      var ha = a.hit ? 1 : 0, hb = b.hit ? 1 : 0;
      if (ha !== hb) return hb - ha;
      return Math.abs(b.contribution || 0) - Math.abs(a.contribution || 0);
    });

    var maxAbs = 1;
    factors.forEach(function (f) { maxAbs = Math.max(maxAbs, Math.abs(f.contribution || 0)); });

    var bars = factors.map(function (f) {
      var pct = Math.round(Math.abs(f.contribution || 0) / maxAbs * 100);
      var color = f.hit ? 'var(--color-danger)' : 'var(--color-text-muted)';
      var dim = DIM_LABEL[f.dim] || f.dim || '';
      return '<div style="margin-top:8px;">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;">' +
        '<span>' + esc(dim) + ' · ' + esc(f.label || '') + (f.rawValue ? '（' + esc(f.rawValue) + '）' : '') + '</span>' +
        '<span style="color:' + color + ';font-weight:600;">' + (f.contribution > 0 ? '+' : '') + f.contribution + ' 分</span></div>' +
        '<div style="height:6px;background:#e8eaed;border-radius:3px;margin-top:4px;">' +
        '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px;"></div></div>' +
        '</div>';
    }).join('');

    // 一句话解释：命中项里贡献最大的作为"主要原因"
    var hits = factors.filter(function (f) { return f.hit; });
    var sentence;
    if (hits.length) {
      var main = hits[0];
      var dimName = DIM_LABEL[main.dim] || main.dim;
      // 文案要具体到"哪一科/哪一项"，例如「成绩」维度未达阈值（编程 55 分）
      var detailTxt = (main.label && main.label !== dimName)
        ? (main.label + (main.rawValue ? ' ' + main.rawValue : ''))
        : (main.rawValue || '');
      sentence = '你在「' + dimName + '」维度未达阈值' +
        (detailTxt ? '（' + esc(detailTxt) + '）' : '') +
        '，该项贡献 ' + main.contribution + ' 分，是本次预警的<b>主要原因</b>。';
      if (hits.length > 1) {
        var others = hits.slice(1).map(function (f) { return f.label || DIM_LABEL[f.dim] || f.dim; }).join('、');
        sentence += '次要因素：' + esc(others) + '。';
      }
    } else {
      sentence = '本次判定没有命中单项异常，风险等级由各维度加权综合得出。';
    }

    var ruleLine = '本次判定使用规则：' + esc(snap.pluginName || snap.pluginId || '—') +
      '（' + esc(snap.pluginId || '—') + '） · 快照时间 ' + esc(String(snap.at || '').slice(0, 16).replace('T', ' '));

    // 我的证据：与教师端同一份引用，但只展示本人的原始数据
    // （不暴露教师端的研判过程，例如帮扶方案草稿、与他人对比等）
    var myEvidence = (window.Evidence && Object.prototype.toString.call(snap.evidenceRefs) === '[object Array]')
      ? window.Evidence.forStudent(snap.evidenceRefs) : [];
    _myEvidenceRefs = myEvidence;
    var evHtml = '';
    if (myEvidence.length) {
      evHtml = '<div style="margin-top:10px;border-top:1px dashed var(--color-border-light);padding-top:8px;">' +
        '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">我的证据 <span style="font-weight:400;color:var(--color-text-muted);">' +
        myEvidence.length + ' 条 · 均为你本人的原始数据</span></div>';
      myEvidence.forEach(function (r, i) {
        evHtml += '<div style="font-size:12px;padding:4px 0;border-bottom:1px dashed var(--color-border-light);">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">' +
          '<span>' + esc(r.label || '') + '</span>' +
          '<span style="color:var(--color-text-muted);font-size:11px;white-space:nowrap;">' + esc(fmtTime(r.at)) +
          ' <button type="button" class="ledger-btn" data-myev="' + i + '">查看</button></span></div>' +
          '<div id="myEvidenceDetail' + i + '" style="display:none;margin-top:6px;"></div></div>';
      });
      evHtml += '</div>';
    }

    var noDetail = !factors.length
      ? '<div style="font-size:12px;color:var(--color-text-muted);margin-top:8px;">该规则不提供分维度明细，以下仅展示总分。</div>'
      : '';

    return '<div class="card" style="padding:14px;margin-bottom:14px;border-left:4px solid ' + RISK_COLOR[lv] + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
      '<div style="font-size:13px;font-weight:600;">预警解释卡 <span style="font-size:11px;font-weight:400;color:var(--color-text-muted);">判定依据快照</span></div>' +
      '<div><span class="risk-badge ' + (lv === '高' ? 'risk-high' : lv === '中' ? 'risk-medium' : 'risk-low') + '">' + RISK_LABEL[lv] + '</span>' +
      ' <span style="font-size:12px;color:var(--color-text-secondary);">安全分 <strong style="color:' + RISK_COLOR[lv] + ';font-size:15px;">' + score + '</strong></span></div>' +
      '</div>' +
      '<div style="font-size:12px;line-height:1.8;color:var(--color-text-secondary);margin-top:8px;">' + sentence + '</div>' +
      noDetail + bars + evHtml +
      '<div style="font-size:11px;color:var(--color-text-muted);margin-top:10px;">' + ruleLine + '</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;">' +
      '<button type="button" class="btn btn-sm btn-outline" id="appealWarningBtn"' + (pendingForThis.length ? ' disabled' : '') + '>' +
      (pendingForThis.length ? '已申诉（处理中）' : '我要申诉') + '</button>' +
      '<span style="font-size:11px;color:var(--color-text-muted);">对判定结果有异议可提交申诉，由辅导员复核。</span>' +
      '</div><div id="appealFormWrap" style="display:none;"></div></div>';
  }

  /* ---------------- 预警申诉（双向闭环的学生侧） ----------------
   * 申诉绑定"当时那份判定快照"：学生质疑的是当初为什么这么判，
   * 而不是改规则之后的重新计算，所以快照摘要会随申诉一起留存。
   */
  function renderAppealForm(snap) {
    var wrap = document.getElementById('appealFormWrap');
    if (!wrap) return;
    var summary = window.Appeals ? window.Appeals.summarizeSnapshot(snap) : {};
    var types = window.Appeals ? window.Appeals.TYPES : ['其他'];
    var typeOpts = types.map(function (t) { return '<option>' + t + '</option>'; }).join('');
    wrap.innerHTML =
      '<div style="margin-top:10px;padding:10px;border:1px solid var(--color-border-light);border-radius:4px;">' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">提交申诉</div>' +
      '<div style="font-size:11px;color:var(--color-text-muted);background:var(--color-bg);padding:8px;border-radius:4px;line-height:1.8;">' +
      '你正在质疑这份判定：<br>' +
      '判定规则：' + esc(summary.pluginName || '—') + '（' + esc(summary.pluginId || '—') + '）<br>' +
      '判定结论：' + esc(RISK_LABEL[summary.riskLevel] || summary.riskLevel || '—') + ' · 安全分 ' + esc(String(summary.riskScore)) + '<br>' +
      '主要因素：' + esc(summary.mainLabel ? (summary.mainLabel + (summary.mainRaw ? '（' + summary.mainRaw + '）' : '')) : '无单项异常') + '<br>' +
      '快照时间：' + esc(String(summary.at || '').slice(0, 16).replace('T', ' ')) +
      '</div>' +
      '<div class="form-group" style="margin-top:8px;"><label>申诉类型</label>' +
      '<select id="appealWType" style="padding:6px 8px;border:1px solid var(--color-border);border-radius:4px;">' + typeOpts + '</select></div>' +
      '<div class="form-group" style="margin-top:8px;"><label>申诉理由（必填，至少 10 个字）</label>' +
      '<textarea id="appealWReason" rows="3" style="padding:8px;border:1px solid var(--color-border);border-radius:4px;width:100%;" placeholder="请说明你认为判定有误的具体原因，例如：成绩数据录入有误，我上学期高数实际 78 分"></textarea></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;">' +
      '<button type="button" class="btn btn-sm btn-primary" id="appealWSubmit">提交申诉</button>' +
      '<button type="button" class="btn btn-sm btn-outline" id="appealWCancel">取消</button></div>' +
      '<div id="appealWResult" style="font-size:12px;margin-top:8px;"></div>' +
      '</div>';

    document.getElementById('appealWCancel').addEventListener('click', function () { wrap.style.display = 'none'; });
    document.getElementById('appealWSubmit').addEventListener('click', function () {
      var box = document.getElementById('appealWResult');
      if (!window.Perm || !window.Perm.can('student', 'appeal:submit', true)) {
        box.innerHTML = '<span style="color:var(--color-danger)">当前身份无权提交申诉</span>';
        return;
      }
      var res = window.Appeals.create({
        studentId: user.id, studentName: user.name, className: user.className,
        warningAt: snap.at, snapshot: summary,
        type: document.getElementById('appealWType').value,
        reason: document.getElementById('appealWReason').value
      });
      if (!res.ok) {
        box.innerHTML = '<span style="color:' + (res.duplicate ? 'var(--color-warning)' : 'var(--color-danger)') + '">' + esc(res.error) + '</span>';
        return;
      }
      window.Perm.audit({ action: 'write', subjectId: user.id, subjectName: user.name, fields: ['appealType', 'appealReason', 'appealSnapshot'] });
      showToast('申诉已提交');
      renderProfile();   // 重新渲染，按钮变为「已申诉（处理中）」
      var after = document.getElementById('appealFormWrap');
      if (after) after.style.display = 'none';
    });
  }

  function renderProfile() {
    // 数据访问留痕：学生查看自己的画像（PROMPT-00 底座验收项；PROMPT-05 会扩展到更多入口）
    if (window.Perm) window.Perm.audit({ action: 'view', subjectId: user.id, subjectName: user.name, fields: ['grades', 'attendance', 'riskLevel', 'status'] });
    // 综合评分未评估时是 0，直接显示 "0" 会和"高风险"自相矛盾；改为"—"并说明
    var hasScore = !(user.riskScore === 0 || user.riskScore === '' || user.riskScore === null || user.riskScore === undefined);
    var scoreText = hasScore ? user.riskScore : '—';
    var scoreSub = hasScore ? '满分 100' : '尚未评估';
    tabs.profile.innerHTML = '<h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">学业健康画像</h3>' + renderExplainCard() + renderStrengthCard() + '<div class="stat-cards" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px;"><div class="stat-card"><div class="stat-card-label">风险等级</div><div class="stat-card-value" style="color:'+RISK_COLOR[user.riskLevel]+';">'+RISK_LABEL[user.riskLevel]+'</div></div><div class="stat-card"><div class="stat-card-label">综合评分</div><div class="stat-card-value" style="color:#1a73e8;">'+scoreText+'</div><div class="stat-card-sub">'+scoreSub+'</div></div><div class="stat-card"><div class="stat-card-label">工单状态</div><div class="stat-card-value" style="font-size:18px;color:'+STATUS_COLOR[user.status]+';">'+STATUS_LABEL[user.status]+'</div></div>'+ (user.syncedFromTeacher ? '<div class="stat-card" style="grid-column:1/-1;padding:10px 14px;"><div class="stat-card-label" style="margin:0;">数据来源</div><div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;">风险等级与工单状态来自辅导员的最新评估，与教师端保持一致。</div></div>' : '') +'</div><div class="chart-row" style="margin-bottom:14px;"><div class="chart-box"><h4 class="chart-title">出勤率</h4><div style="height:8px;background:#e8eaed;border-radius:4px;margin-top:8px;"><div style="height:100%;width:'+user.attendance+'%;background:#0d904f;border-radius:4px;"></div></div><div style="text-align:center;margin-top:4px;font-size:13px;font-weight:600;">'+user.attendance+'%</div></div><div class="chart-box"><h4 class="chart-title">作业提交率</h4><div style="height:8px;background:#e8eaed;border-radius:4px;margin-top:8px;"><div style="height:100%;width:'+user.homeworkRate+'%;background:#1a73e8;border-radius:4px;"></div></div><div style="text-align:center;margin-top:4px;font-size:13px;font-weight:600;">'+user.homeworkRate+'%</div></div></div><div class="chart-box chart-wide"><h4 class="chart-title">各科成绩分布</h4><div class="radar-row"><div class="radar-canvas" id="radarChart"></div><div class="radar-scores">' + renderRadarScores() + '</div></div></div>';
    // 申诉入口：本阶段先给明确提示，PROMPT-03 会接成真实的双向申诉闭环
    var appealBtn = document.getElementById('appealWarningBtn');
    bindMyEvidence();
    if (appealBtn) appealBtn.addEventListener('click', function () {
      var snap = loadMySnapshot();
      if (!snap) { showToast('暂无可申诉的预警判定'); return; }
      if (window.Appeals) {
        var dup = window.Appeals.list({ studentId: user.id, status: 'pending' }).filter(function (a) {
          return String(a.warningAt) === String(snap.at);
        });
        if (dup.length) { showToast('你已提交过申诉，正在处理中'); return; }
      }
      var wrap = document.getElementById('appealFormWrap');
      if (!wrap) return;
      if (wrap.style.display === 'none' || !wrap.style.display) {
        wrap.style.display = '';
        renderAppealForm(snap);
      } else {
        wrap.style.display = 'none';
      }
    });
    setTimeout(function(){
      var rd = document.getElementById('radarChart'); if(!rd) return;
      var ch = echarts.init(rd);
      // 卡片较宽，雷达图不必占满：容器固定 260px 高，图例交给右侧分数条
      ch.setOption({ radar:{ indicator:[{name:'高数',max:100},{name:'英语',max:100},{name:'编程',max:100},{name:'计算机基础',max:100}], shape:'circle',center:['50%','52%'],radius:'72%', axisName:{fontSize:11,color:'#5f6368'}, splitArea:{areaStyle:{color:['#fff','#fafbfc']}} }, series:[{ type:'radar', symbolSize:5, data:[{ value:[user.grades['高数'],user.grades['英语'],user.grades['编程'],user.grades['计算机基础']], name:user.name, areaStyle:{color:'rgba(26,115,232,0.15)'}, lineStyle:{color:'#1a73e8',width:2}, itemStyle:{color:'#1a73e8'} }] }] });
    },300);
  }
  /** 雷达图右侧的分数明细：4 个数值直接给数字，比只画一张图更好读 */
  function renderRadarScores() {
    var subjects = ['高数', '英语', '编程', '计算机基础'];
    return subjects.map(function (name) {
      var v = Number(user.grades[name]) || 0;
      var cls = v < 60 ? ' is-weak' : (v < 75 ? ' is-warn' : '');
      return '<div class="radar-score-item' + cls + '">'
        + '<span class="radar-score-name">' + name + '</span>'
        + '<span class="radar-score-bar"><span class="radar-score-fill" style="width:' + Math.max(0, Math.min(100, v)) + '%;"></span></span>'
        + '<span class="radar-score-val">' + v + '</span>'
        + '</div>';
    }).join('');
  }

  function renderPlan() {
    var h = '<h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">我的学习计划</h3>';
    learningPlan.forEach(function(wk){
      var done = wk.items.filter(function(i){return i.done;}).length;
      h += '<div class="learning-path-week"><div class="learning-path-week-header">'+wk.title+' <span style="font-size:11px;font-weight:400;color:var(--color-text-muted);">('+done+'/'+wk.items.length+' 已完成)</span></div>';
      wk.items.forEach(function(it,idx){
        h += '<div class="learning-path-item" style="'+(it.done?'opacity:0.6;':'')+'"><span class="learning-path-day">Day '+it.day+'</span><span>'+(it.done?'<s>'+it.task+'</s>':it.task)+'</span><span style="font-size:10px;color:var(--color-text-muted);margin-left:auto;">'+it.resource+'</span><button class="ledger-btn mark-done" data-week="'+wk.week+'" data-idx="'+idx+'" style="margin-left:8px;">'+(it.done?'已完成':'标记完成')+'</button></div>';
      });
      h += '</div>';
    });
    tabs.plan.innerHTML = h;
    tabs.plan.querySelectorAll('.mark-done').forEach(function(b){
      b.addEventListener('click',function(){
        var w = parseInt(this.dataset.week)-1, i = parseInt(this.dataset.idx);
        if(learningPlan[w]&&learningPlan[w].items[i]){ learningPlan[w].items[i].done=!learningPlan[w].items[i].done; renderPlan(); }
      });
    });
  }
  /* 「预警复核结果」通知：由申诉记录派生，不写死演示数据 */
  function appealNotices() {
    if (!window.Appeals) return [];
    return window.Appeals.list({ studentId: user.id })
      .filter(function (a) { return a.status !== 'pending'; })
      .map(function (a) {
        return {
          id: 'appeal-' + a.id,
          type: 'review',
          title: '预警复核结果：' + (a.status === 'accepted' ? '已采纳' : '已驳回'),
          content: (a.reviewer ? ('复核人 ' + a.reviewer + '：') : '') + (a.conclusion || ''),
          time: String(a.reviewedAt || '').slice(0, 16).replace('T', ' '),
          read: !!a.noticeRead,
          appealId: a.id
        };
      });
  }

  function renderNotice() {
    var all = appealNotices().concat(notifications);
    var unread = all.filter(function (n) { return !n.read; });
    var h = '<h3 style="font-size:16px;font-weight:600;margin-bottom:4px;">消息通知 <span class="risk-badge ' + (unread.length ? 'risk-high' : 'risk-low') + '" style="font-size:10px;">' + unread.length + ' 条未读</span></h3>';
    all.forEach(function (n) {
      h += '<div class="learning-path-week" style="' + (n.read ? 'opacity:0.7;' : 'border-left:3px solid #1a73e8;') + '"><div class="learning-path-item"><span style="font-size:16px;">' + (n.type === 'warning' ? '\u26a0' : n.type === 'task' ? '\u{1f4cb}' : '📞') + '</span><div style="flex:1;"><strong>' + esc(n.title) + '</strong><div style="font-size:11px;color:var(--color-text-muted);">' + esc(n.content) + '</div></div><span style="font-size:10px;color:var(--color-text-muted);">' + esc(n.time) + '</span></div></div>';
    });
    tabs.notice.innerHTML = h;
    // 打开通知页即视为已读（状态挂在申诉记录自身，不新增存储键）
    var ids = all.filter(function (n) { return n.appealId && !n.read; }).map(function (n) { return n.appealId; });
    if (ids.length && window.Appeals) window.Appeals.markNoticed(ids);
  }
  /* ---------------- 困难申报（真实工单） ----------------
   * 之前的实现是"假表单"：点提交只弹 toast、工单号是当场现编的，一个字都没落库，
   * 辅导员那边永远收不到。这里改成真实写入 localStorage.supportTickets，
   * 并在下方渲染「我的申报记录」，让提交结果可被验证。
   */
  var APPEAL_TYPES = ['学业辅导需求', '心理辅导需求', '生活困难求助', '其他'];

  function renderAppealList() {
    var box = document.getElementById('appealList');
    if (!box) return;
    var list = (window.Tickets ? Tickets.list({ studentId: user.id }) : []);
    var h = '<div class="card" style="padding:12px;margin-top:14px;"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">我的申报记录 <span class="risk-badge risk-low" style="font-size:10px;">' + list.length + ' 条</span></div>';
    if (!list.length) {
      box.innerHTML = h + '<div style="font-size:12px;color:var(--color-text-muted);">还没有提交过申报。提交后辅导员会在这里回复处理结论。</div></div>';
      return;
    }
    list.forEach(function (t) {
      var st = (window.Tickets.STATUS[t.status] || '待处理');
      var cls = t.status === 'closed' ? 'risk-low' : (t.status === 'accepted' ? 'risk-medium' : 'risk-high');
      h += '<div style="border-top:1px dashed var(--color-border-light);padding:8px 0;font-size:12px;">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">' +
        '<span><span class="risk-badge ' + cls + '" style="font-size:10px;">' + esc(st) + '</span> ' +
        '<strong>' + esc(t.type) + '</strong>' + (t.urgency === 'urgent' ? ' <span class="risk-badge risk-high" style="font-size:10px;">紧急</span>' : '') + '</span>' +
        '<span style="color:var(--color-text-muted);font-size:11px;">' + esc((t.createdAt || '').slice(0, 16).replace('T', ' ')) + '</span></div>' +
        '<div style="color:var(--color-text-secondary);margin-top:4px;">' + esc(t.desc) + '</div>' +
        '<div style="color:var(--color-text-muted);font-size:11px;margin-top:4px;">工单号 ' + esc(t.id) + (t.handler ? ' · 处理人 ' + esc(t.handler) : '') + '</div>' +
        (t.result ? '<div style="margin-top:6px;padding:8px;background:var(--color-success-light);border-radius:4px;color:#166534;">处理结论：' + esc(t.result) + '</div>' : '') +
        '</div>';
    });
    box.innerHTML = h + '</div>';
  }

  function renderAppeal() {
    var typeOpts = APPEAL_TYPES.map(function (t) { return '<option>' + t + '</option>'; }).join('');
    tabs.appeal.innerHTML =
      '<h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">学业困难申报</h3>' +
      '<div class="card" style="padding:16px;">' +
      '<div class="form-group"><label>申报类型</label>' +
      '<select id="appealType" style="padding:6px 8px;border:1px solid var(--color-border);border-radius:4px;">' + typeOpts + '</select></div>' +
      '<div class="form-group" style="margin-top:10px;"><label>详细描述</label>' +
      '<textarea id="appealDesc" rows="4" style="padding:8px;border:1px solid var(--color-border);border-radius:4px;width:100%;" placeholder="请描述您遇到的困难和需要的帮助（至少 10 个字）..."></textarea></div>' +
      '<div class="form-group" style="margin-top:10px;"><label>联系方式</label>' +
      '<input id="appealContact" style="padding:6px 8px;border:1px solid var(--color-border);border-radius:4px;width:100%;" placeholder="手机号或QQ号..."></div>' +
      '<button class="btn btn-primary" style="margin-top:12px;" id="submitAppealBtn">提交申报</button>' +
      '<div id="appealResult" style="margin-top:10px;display:none;"></div>' +
      '</div><div id="appealList"></div>';

    var resultBox = document.getElementById('appealResult');
    document.getElementById('submitAppealBtn').addEventListener('click', function () {
      var type = document.getElementById('appealType').value;
      var desc = document.getElementById('appealDesc').value;
      var contact = document.getElementById('appealContact').value;

      // 权限闸门：必须是学生身份、且只能以自己的名义提交
      if (!window.Perm) { showToast('权限模块未加载'); return; }
      if (!Perm.can('student', 'ticket:submit', true)) { showToast('当前身份无权提交申报'); return; }

      var res = window.Tickets.create({
        studentId: user.id, studentName: user.name, className: user.className,
        type: type, desc: desc, contact: contact
      });
      if (!res.ok) {
        resultBox.style.display = '';
        resultBox.innerHTML = '<div style="padding:10px;background:var(--color-danger-light);border-radius:4px;color:#a50e0e;">' + esc(res.error) + '</div>';
        return;
      }

      Perm.audit({ action: 'write', subjectId: user.id, subjectName: user.name, fields: ['ticketType', 'ticketDesc', 'ticketContact'] });

      var html = '<div style="padding:10px;background:var(--color-success-light);border-radius:4px;color:#166534;">' +
        '申报已提交！工单编号：<strong>' + esc(res.ticket.id) + '</strong><br>辅导员会在 48 小时内响应，可在下方「我的申报记录」查看进度。</div>';
      // 自伤/轻生等词命中时给一条更醒目的求助提示（只是初筛提醒，不是诊断）
      if (res.urgent) {
        html += '<div style="margin-top:8px;padding:12px;background:var(--color-danger-light);border:1px solid #f2b8b5;border-radius:4px;color:#a50e0e;">' +
          '<strong>我们注意到你的描述里可能有需要立即关注的信号。</strong><br>' +
          '请立即联系你的辅导员，或拨打校内心理援助热线（占位：0000-00000000）／全国心理援助热线 12356。<br>' +
          '你并不孤单，我们会尽快与你联系。</div>';
      }
      resultBox.style.display = '';
      resultBox.innerHTML = html;

      document.getElementById('appealDesc').value = '';
      document.getElementById('appealContact').value = '';
      renderAppealList();
      showToast('申报已提交');
    });

    renderAppealList();
  }
  /* ---------------- 我的优势（正向预警 / 育优） ----------------
   * 顺序是刻意的：若学生同时有风险预警，**先显示预警解释卡，再显示优势卡片**。
   * 风险信息是学生必须知情的（可解释、可申诉）；优势信息是激励性的，
   * 放在后面并用正向措辞，避免学生产生"被系统盯上"的挫败感——
   * 同一批字段，叙事从"盯差生"变成"学生发展平台"。
   * 正向评分仅供辅导员参考，不作为任何奖励的自动依据；只展示个人优势，不展示任何排名。
   */
  function renderStrengthCard() {
    if (!window.PositiveRuleManager) return '';
    var res;
    try { res = PositiveRuleManager.evaluateStudent(user); } catch (e) { return ''; }
    if (!res || !res.dataEnough) return '';

    var top = (res.strengths || []).slice(0, 2);
    var lvColor = res.level === 'A' ? 'var(--color-success, #0d904f)' : '#1a73e8';
    var h = '<div class="card" style="padding:12px;margin-bottom:14px;border-left:3px solid var(--color-success, #0d904f);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
      '<div style="font-size:13px;font-weight:600;">我的优势 <span class="risk-badge risk-low" style="font-size:10px;">优势等级 ' + esc(res.level) + ' · ' + res.score + ' 分</span></div>' +
      '<span style="font-size:11px;color:var(--color-text-muted);">仅供辅导员参考</span></div>';

    if (!top.length) {
      h += '<div style="font-size:12px;color:var(--color-text-muted);margin-top:8px;">暂时还没有达到"优势"标准的维度，继续积累，下次分析再看。</div>';
    } else {
      h += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">';
      top.forEach(function (s) {
        h += '<span style="font-size:12px;padding:3px 10px;border-radius:12px;background:rgba(13,144,79,0.1);color:' + lvColor + ';font-weight:600;">' +
          esc(s.label) + ' ' + s.score + '</span>';
      });
      h += '</div>';
      top.forEach(function (s) {
        h += '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:6px;line-height:1.7;">· ' +
          '<strong>' + esc(s.label) + '</strong>：' + esc(s.reason) + '</div>';
      });
    }

    var sug = res.suggestions || [];
    if (sug.length) {
      h += '<div style="margin-top:10px;padding:8px;background:var(--color-bg);border-radius:4px;">' +
        '<div style="font-size:12px;font-weight:600;margin-bottom:4px;">可以试试</div>';
      sug.forEach(function (x) {
        h += '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.8;">· ' + esc(x.text) + '</div>';
      });
      h += '<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">以上为系统按规则给出的建议，仅供参考，不作为任何奖励的自动依据。</div></div>';
    }
    h += '</div>';
    return h;
  }

  /* ---------------- 校园行为数据：单独同意 / 撤回 ----------------
   * 消费、门禁（行踪轨迹）在 PIPL 下属敏感个人信息，必须**单独同意**且可随时撤回。
   * 因此这里与"总体同意"分离：不授权就不进教师端名单、不参与任何打分。
   * 撤回是即时生效的（派生结果不缓存），并在 authLog 留痕。
   */
  function renderCampusConsentBlock() {
    if (!window.CampusProfile) return '';
    var granted = CampusProfile.hasConsent(user.id);
    var info = CampusProfile.consentInfo(user.id);
    var h = '<div class="card" style="padding:12px;margin-bottom:12px;border-left:3px solid ' + (granted ? 'var(--color-success, #0d904f)' : '#b45309') + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
      '<div style="font-size:13px;font-weight:600;">校园行为数据 <span class="risk-badge ' + (granted ? 'risk-low' : 'risk-medium') + '" style="font-size:10px;">' +
      (granted ? '已授权' : '未授权') + '</span></div>' +
      '<button type="button" class="btn btn-sm ' + (granted ? 'btn-outline' : 'btn-primary') + '" id="campusConsentBtn">' +
      (granted ? '撤回授权' : '同意使用') + '</button></div>' +
      '<div style="font-size:12px;color:var(--color-text-secondary);line-height:1.9;margin-top:8px;">' +
      '· 涉及的数据：考勤、作业提交、一卡通消费、门禁外出（属于敏感个人信息，因此**单独征求你的同意**）。<br>' +
      '· 用来做什么：帮助辅导员**更早发现**你的学业状态变化，从而安排帮扶；<br>' +
      '· <strong>不</strong>用来做什么：不进入任何奖惩、不做排名、不产生自动处分，也不会向任何人展示原始明细；<br>' +
      '· 你可以随时撤回：撤回后数据立即不再参与画像，也不会出现在教师端名单里，撤回记录会留痕。<br>' +
      '· 不授权不影响你使用本系统，也不影响你获得帮扶。</div>';
    if (info && info.updatedAt) {
      h += '<div style="font-size:11px;color:var(--color-text-muted);margin-top:6px;">最近变更：' +
        esc(fmtTime(info.updatedAt)) + '（' + esc(info.actor || '') + '）</div>';
    }
    if (granted) {
      h += '<div id="campusMyProfile" style="margin-top:10px;"></div>';
    }
    h += '</div>';
    return h;
  }

  /** 授权后展示"我自己的行为画像"（与教师端口径一致） */
  function renderCampusMyProfile() {
    var box = document.getElementById('campusMyProfile');
    if (!box || !window.CampusProfile) return;
    var res = CampusProfile.myProfile(user.id);
    if (!res.ok) {
      box.innerHTML = '<div style="font-size:12px;color:var(--color-text-muted);">' +
        (res.reason === 'no-signals' ? '当前还没有你的行为数据。' : '暂时无法生成画像。') + '</div>';
      return;
    }
    var row = res.row;
    var h = '<div style="padding:8px;background:var(--color-bg);border-radius:4px;">' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:4px;">我的行为画像（关注度 ' + row.score + '）</div>';
    (row.contributions || []).slice(0, 4).forEach(function (c) {
      h += '<div style="font-size:11px;color:var(--color-text-secondary);">· ' + esc(c.label) +
        '：偏离自身基线 ' + c.z + ' 倍，贡献 ' + c.contribution + '</div>';
    });
    h += '<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">' +
      '关注度是**相对值**（只在已授权的同学之间可比），不是风险等级，也不会展示给其他同学。';
    if (res.unstable) {
      h += '当前授权样本较少（' + res.poolSize + ' 人），结果仅供参考。';
    }
    h += '</div></div>';
    box.innerHTML = h;
  }

  /* ---------------- 隐私中心 ----------------
   * 面向"被访问者"的记录页：谁在什么时候查看/导出/修改过我的数据。
   * 措辞刻意避开"监控/审计"，用"访问记录/数据说明"，并明确本页仅本人可见。
   * 数据来自 permissions.js 的 dataAccessLog（Perm.myLog() 只返回 subjectId=本人 的记录）。
   */
  var ACTION_TXT = { view: '查看', export: '导出', write: '修改' };
  var ROLE_TXT = { teacher: '辅导员/教师', student: '本人' };

  function fmtTime(iso) {
    return String(iso || '').slice(0, 16).replace('T', ' ');
  }

  function renderPrivacy() {
    if (!window.Perm) { tabs.privacy.innerHTML = '<div class="card" style="padding:16px;">权限模块未加载</div>'; return; }
    // 越权硬闸门：学生只能访问自己的数据
    var gate = window.Perm.guardData('student', user.id);
    if (!gate.ok) {
      tabs.privacy.innerHTML = '<div class="card" style="padding:16px;color:var(--color-danger);">' + esc(gate.error) + '</div>';
      return;
    }
    var myLog = window.Perm.myLog();

    var h = '<h3 style="font-size:16px;font-weight:600;margin-bottom:12px;">隐私中心</h3>';
    h += '<div class="card" style="padding:12px;margin-bottom:12px;font-size:12px;line-height:1.8;color:var(--color-text-secondary);">' +
      '本页记录<strong>仅本人可见</strong>。这里告诉你：谁在什么时候访问过你的数据，以及你的哪些信息会被用于预警评分。</div>';

    /* (a) 谁看过我的数据 */
    h += '<div class="card" style="padding:12px;margin-bottom:12px;"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">谁看过我的数据</div>';
    if (!myLog.length) {
      h += '<div style="font-size:12px;color:var(--color-text-muted);">暂无访问记录</div>';
    } else {
      var byActor = {};
      myLog.forEach(function (r) {
        var k = r.actorRole + '|' + (r.actorName || r.actorId || '');
        if (!byActor[k]) byActor[k] = { name: r.actorName || r.actorId || '—', role: r.actorRole, count: 0, last: r.at };
        byActor[k].count++;
        if (String(r.at) > String(byActor[k].last)) byActor[k].last = r.at;
      });
      Object.keys(byActor).forEach(function (k) {
        var a = byActor[k];
        h += '<div style="font-size:12px;padding:3px 0;">' + esc(ROLE_TXT[a.role] || a.role) + ' <strong>' + esc(a.name) + '</strong> 访问过 ' +
          a.count + ' 次，最近 ' + esc(fmtTime(a.last)) + '</div>';
      });
      h += '<div style="border-top:1px dashed var(--color-border-light);margin-top:8px;padding-top:6px;">';
      myLog.slice(0, 30).forEach(function (r) {
        h += '<div style="font-size:11px;padding:5px 0;border-bottom:1px dashed var(--color-border-light);line-height:1.7;">' +
          '<span style="color:var(--color-text-muted);">' + esc(fmtTime(r.at)) + '</span> · ' +
          esc(ROLE_TXT[r.actorRole] || r.actorRole) + ' ' + esc(r.actorName || '') + ' · ' +
          '<strong>' + esc(ACTION_TXT[r.action] || r.action) + '</strong>' +
          (r.fields && r.fields.length ? '<br>涉及字段：' + esc(r.fields.join('、')) : '') +
          (r.page ? '<br>来源页面：' + esc(r.page) : '') + '</div>';
      });
      h += '</div>';
    }
    h += '</div>';

    /* (b) 我的数据 + 导出 */
    var wrongCount = (window.MM && MM.wrongBook) ? MM.wrongBook.list({ studentId: user.id }).length : 0;
    var ticketCount = window.Tickets ? Tickets.list({ studentId: user.id }).length : 0;
    var appealCount = window.Appeals ? Appeals.list({ studentId: user.id }).length : 0;
    h += '<div class="card" style="padding:12px;margin-bottom:12px;"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">我的数据</div>' +
      '<div style="font-size:12px;line-height:2;">成绩与出勤：1 份（' + esc(user.name) + ' · ' + esc(user.className) + '）<br>' +
      '错题本：' + wrongCount + ' 条<br>困难申报：' + ticketCount + ' 条<br>预警申诉：' + appealCount + ' 条</div>' +
      '<button type="button" class="btn btn-sm btn-outline" style="margin-top:10px;" id="privacyExportBtn">导出我的数据（JSON）</button>' +
      '<div id="privacyExportResult" style="font-size:12px;margin-top:8px;color:var(--color-text-secondary);"></div></div>';

    /* (c) 校园行为数据：单独同意 + 可撤回（PIPL 第 28/29 条：行踪轨迹属敏感个人信息，需单独同意） */
    h += renderCampusConsentBlock();

    /* (d) 数据说明 + 申请更正 */
    h += '<div class="card" style="padding:12px;margin-bottom:12px;"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">数据说明</div>' +
      '<div style="font-size:12px;line-height:1.9;color:var(--color-text-secondary);">' +
      '· 会进入预警评分的：各科成绩、出勤率、作业提交率、实验完成率、错题本里未掌握的知识点。<br>' +
      '· <strong>不会</strong>进入预警评分的：「困难申报」中的心理辅导类内容——它只用于辅导员分流与提醒，不参与任何自动打分。<br>' +
      '· 你的数据默认只保存在本机，不会自动上传；教师端导出报表时会留下访问记录，你在本页就能看到。<br>' +
      '· 本页记录仅本人可见；辅导员看不到"你打开过本页"这类信息。</div>' +
      '<button type="button" class="btn btn-sm btn-outline" style="margin-top:10px;" id="privacyCorrectBtn">申请更正数据</button></div>';

    tabs.privacy.innerHTML = h;

    /* 校园行为数据的同意 / 撤回 */
    var consentBtn = document.getElementById('campusConsentBtn');
    if (consentBtn) consentBtn.addEventListener('click', function () {
      var granted = CampusProfile.hasConsent(user.id);
      if (granted) {
        if (!confirm('确认撤回「校园行为数据」授权？\n\n撤回后：\n· 行为数据立即不再参与画像\n· 你不会再出现在教师端的重点关注名单里\n· 撤回记录会留痕')) return;
        CampusProfile.setConsent(user.id, false, { actor: 'student' });
        CampusProfile.onRevoke(user.id);
        showToast('已撤回授权，行为数据不再参与画像');
      } else {
        if (!confirm('确认同意「校园行为数据」用于学业帮扶画像？\n\n· 仅用于帮扶提醒，不进入奖惩、不做排名、不自动处分\n· 可随时撤回')) return;
        CampusProfile.setConsent(user.id, true, { actor: 'student' });
        CampusProfile.onGrant(user.id);
        showToast('已授权，感谢你的信任');
      }
      renderPrivacy();
    });
    renderCampusMyProfile();

    /* 导出我的数据：优先复用 preload 既有能力，不新增 IPC 通道 */
    var exportBtn = document.getElementById('privacyExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      var snap = null;
      try { snap = (JSON.parse(localStorage.getItem('warningSnapshots') || '{}') || {})[user.id] || null; } catch (e) { snap = null; }
      var payload = {
        exportedAt: new Date().toISOString(),
        student: { id: user.id, name: user.name, className: user.className, riskLevel: user.riskLevel, riskScore: user.riskScore, status: user.status },
        warningSnapshot: snap,
        wrongBook: (window.MM && MM.wrongBook) ? MM.wrongBook.list({ studentId: user.id }) : [],
        tickets: window.Tickets ? Tickets.list({ studentId: user.id }) : [],
        appeals: window.Appeals ? Appeals.list({ studentId: user.id }) : [],
        accessLog: window.Perm.myLog()
      };
      var text = JSON.stringify(payload, null, 2);
      window.Perm.audit({ action: 'export', subjectId: user.id, subjectName: user.name, fields: ['selfData'] });
      var box = document.getElementById('privacyExportResult');
      if (window.electronAPI && window.electronAPI.exportToFile) {
        window.electronAPI.exportToFile(text).then(function (res) {
          box.innerHTML = res && res.success ? ('已导出到：' + esc(res.filePath || '桌面')) : ('导出失败：' + esc((res && res.error) || '未知原因'));
        }, function (err) { box.textContent = '导出失败：' + ((err && err.message) || ''); });
      } else {
        try {
          var blob = new Blob([text], { type: 'application/json;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = '我的学业数据_' + user.id + '.json'; a.click();
          URL.revokeObjectURL(url);
          box.textContent = '已下载 JSON 文件';
        } catch (e) { box.textContent = '导出失败：' + e.message; }
      }
    });

    /* 申请更正：只是留痕，不做真实流程（避免误导学生以为会自动改数） */
    var correctBtn = document.getElementById('privacyCorrectBtn');
    if (correctBtn) correctBtn.addEventListener('click', function () {
      var note = prompt('请说明需要更正的数据项与正确内容，提交后辅导员会与你联系：');
      if (!note || !String(note).trim()) { showToast('已取消'); return; }
      if (window.Session && Session.log) {
        Session.log({ event: 'data_correction_request', role: 'student', id: user.id, name: user.name, detail: String(note).trim().slice(0, 80) });
      }
      window.Perm.audit({ action: 'write', subjectId: user.id, subjectName: user.name, fields: ['dataCorrectionRequest'] });
      showToast('更正申请已记录，辅导员会尽快联系你');
    });
  }

  function switchTab(name) {
    for (var k in tabs) { if(tabs[k]) tabs[k].style.display='none'; }
    if (tabs[name]) tabs[name].style.display='block';
    if (name==='plan') renderPlan();
    if (name==='notice') renderNotice();
    if (name==='appeal') renderAppeal();
    if (name==='wrongbook') renderWrongBook();
    if (name==='privacy') renderPrivacy();
  }
  document.querySelectorAll('.nav-item').forEach(function(item){
    item.addEventListener('click',function(){
      document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active');});
      this.classList.add('active');
      switchTab(this.dataset.nav);
    });
  });
  var mmBar=document.getElementById('multiModalBar');if(mmBar)mmBar.style.display='';
  document.getElementById('multiModalToggle').addEventListener('click',function(){mmBar.classList.toggle('open');});

  function mmReady(){ return !!(window.MM && typeof window.MM.ocrFile==='function'); }
  function mmHtml(s){ return window.MM ? MM.textToHtml(s||'') : esc(s||''); }
  function engineLabel(e){ var m={tesseract:'本地 Tesseract',vlm:'多模态大模型','vlm-asr':'大模型 ASR',mock:'模拟数据'}; return m[e]||e||'未知'; }
  function pickImg(callback){ var i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=function(){var f=i.files&&i.files[0];if(f)callback(f);};i.click(); }
  function setProg(progEl,fillEl,pct){ if(progEl)progEl.style.display=''; if(fillEl)fillEl.style.width=(pct||0)+'%'; }

  // ---- OCR 拍照识别 ----
  document.getElementById('btnOcrDemo').addEventListener('click',function(){
    var resEl=document.getElementById('ocrResult'),progEl=document.getElementById('ocrProgress'),fillEl=document.getElementById('ocrProgressFill');
    if(!mmReady()){ resEl.innerHTML='<strong>识别结果：</strong><br>'+(window.MM?esc(MM.mockOcrText):'高数第三章课后习题…'); return; }
    pickImg(function(file){
      setProg(progEl,fillEl,5); resEl.innerHTML='识别中…';
      MM.ocrFile(file,{onProgress:function(info){setProg(progEl,fillEl,info.progress||0);}}).then(function(res){
        setProg(progEl,fillEl,100);
        resEl.innerHTML='<strong>识别结果：</strong> <span class="risk-factor-tag">'+esc(engineLabel(res.engine))+'</span><br>'+mmHtml(res.text);
        showToast(res.mock?'OCR 已降级为模拟结果':'OCR 识别完成');
      }).catch(function(err){ resEl.innerHTML='<strong>识别失败：</strong>'+esc(err.message); });
    });
  });

  // ---- 错题拍照答疑 ----
  document.getElementById('btnQaDemo').addEventListener('click',function(){
    var resEl=document.getElementById('qaResult'),progEl=document.getElementById('qaProgress'),fillEl=document.getElementById('qaProgressFill');
    if(!mmReady()){ resEl.innerHTML='<strong>解题思路：</strong><br>'+(window.MM?mmHtml(MM.mockSolveText):'1. 求导…'); return; }
    pickImg(function(file){
      setProg(progEl,fillEl,5); resEl.innerHTML='正在识别题目并生成解析…';
      MM.solveFile(file,{onProgress:function(info){setProg(progEl,fillEl,info.progress||0);}}).then(function(res){
        setProg(progEl,fillEl,100);
        var kp=(res.matched||[]).map(function(k){return '<span class="risk-factor-tag">'+esc(k.title)+'</span>';}).join(' ');
        resEl.innerHTML='<strong>题目识别：</strong>'+esc(res.title||(res.ocrText||'').slice(0,30)||'—')+
          '<br><strong>关联知识点：</strong>'+(kp||'—')+
          '<br><strong>解题思路：</strong><br>'+mmHtml(res.text)+
          '<div class="mm-actions"><button type="button" class="btn btn-sm btn-outline" id="qaSaveBook">存入错题本</button></div>';
        document.getElementById('qaSaveBook').addEventListener('click',function(){
          if(!window.MM||!MM.wrongBook) return;
          MM.wrongBook.save({ studentId:user.id,
            subject:(res.matched&&res.matched[0]&&res.matched[0].course)||'未分类',
            title:res.title||(res.ocrText||'').slice(0,30),
            ocrText:res.ocrText||'', solution:res.text||'', image:res.image||'',
            knowledgePoints:(res.matched||[]).map(function(k){return k.title;}) });
          var sync = (window.MM && MM.warning) ? MM.warning.sync({ studentId:user.id, studentName:user.name }) : null;
          showToast(sync && sync.created.length ? ('已存入错题本，回流 ' + sync.created.length + ' 条预警候选') : '已存入错题本');
          renderWrongBook();
        });
        showToast(res.mock?'答疑已降级为模拟结果':'答疑完成');
      }).catch(function(err){ resEl.innerHTML='<strong>答疑失败：</strong>'+esc(err.message); });
    });
  });

  // ---- ASR 实时听写 ----
  var asrSession=null;
  document.getElementById('btnAsrDemo').addEventListener('click',function(){
    var resEl=document.getElementById('asrResult'),progEl=document.getElementById('asrProgress'),fillEl=document.getElementById('asrProgressFill');
    if(asrSession){ asrSession.stop(); asrSession=null; showToast('已停止录音'); return; }
    if(!mmReady()||!MM.asrSupported()){ resEl.innerHTML='<strong>转写结果：</strong><br>'+esc(window.MM?MM.mockAsrText:'（当前环境不支持实时听写）'); showToast('已给出模拟转写结果'); return; }
    var buffer='';
    setProg(progEl,fillEl,15);
    resEl.innerHTML='🎙 正在聆听…再次点击可停止';
    asrSession=MM.asrLive({
      onInterim:function(t){ resEl.innerHTML='<strong>实时转写：</strong>'+esc(buffer+t); },
      onFinal:function(t){ buffer+=t; },
      onError:function(err){ asrSession=null; resEl.innerHTML='<strong>语音识别失败：</strong>'+esc(err.message); },
      onEnd:function(){ asrSession=null; setProg(progEl,fillEl,100);
        resEl.innerHTML='<strong>转写结果：</strong><br>'+(buffer.trim()?esc(buffer.trim()):'（未识别到语音内容，请检查麦克风）'); }
    });
  });

  // ---- 错题本 ----
  // 只允许操作属于当前登录学生的错题（错题本在教师端/学生端间共享同一份 localStorage）
  function ownRec(id){ if(!window.MM||!MM.wrongBook) return null; return MM.wrongBook.list({studentId:user.id}).filter(function(x){return x.id===id;})[0]; }
  function renderWrongBook(){
    var box=document.getElementById('tabWrongBook'); if(!box) return;
    var list=(window.MM&&MM.wrongBook)?MM.wrongBook.list({studentId:user.id}):[];
    var h='<h3 style="font-size:16px;font-weight:600;margin-bottom:4px;">我的错题本 <span class="risk-badge risk-medium" style="font-size:10px;">'+list.length+' 题</span></h3>';
    var stats=(window.MM&&MM.wrongBook&&MM.wrongBook.stats)?MM.wrongBook.stats({studentId:user.id}):[];
    if(stats.length){
      h+='<div class="card" style="padding:12px;margin-bottom:8px;"><div style="font-size:13px;font-weight:600;margin-bottom:6px;">薄弱知识点 <span style="font-size:10px;color:var(--color-text-muted);">未掌握 ≥ 3 题将自动回流给辅导员</span></div>';
      stats.slice(0,6).forEach(function(s){
        var cls=s.pending>=5?'risk-high':(s.pending>=3?'risk-medium':'risk-low');
        h+='<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;padding:3px 0;border-bottom:1px dashed var(--color-border-light);"><span>'+esc(s.knowledgePoint)+' <span style="color:var(--color-text-muted);">('+esc(s.subject)+')</span></span><span class="risk-badge '+cls+'" style="font-size:10px;">未掌握 '+s.pending+' / 共 '+s.total+'</span></div>';
      });
      h+='</div>';
    }
    if(!list.length){
      h+='<div class="card" style="padding:16px;color:var(--color-text-muted);font-size:12px;">还没有错题。点击上方「AI 多模态」→「上传错题照片」，识别后点「存入错题本」即可自动归档。</div>';
      box.innerHTML=h; return;
    }
    var statusText={unmastered:'未掌握',reviewing:'复习中',mastered:'已掌握'};
    var statusCls={unmastered:'risk-high',reviewing:'risk-medium',mastered:'risk-low'};
    list.forEach(function(it){
      h+='<div class="card" style="padding:12px;margin-top:8px;">'+
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">'+
        '<strong style="font-size:13px;">'+esc(it.title||'未命名错题')+'</strong>'+
        '<span class="risk-badge '+(statusCls[it.status]||'risk-medium')+'" style="font-size:10px;">'+(statusText[it.status]||'未掌握')+'</span></div>'+
        '<div style="font-size:11px;color:var(--color-text-muted);margin-top:4px;">'+esc(it.subject)+' · '+esc((it.createdAt||'').slice(0,10))+' · 已复习 '+it.reviewCount+' 次</div>'+
        '<div style="font-size:11px;margin-top:6px;max-height:90px;overflow:auto;">'+mmHtml(it.solution)+'</div>'+
        '<div class="mm-actions">'+
        '<button type="button" class="btn btn-sm btn-outline" data-wb-review="'+it.id+'">复习一次</button>'+
        '<button type="button" class="btn btn-sm btn-outline" data-wb-master="'+it.id+'">标记掌握</button>'+
        '<button type="button" class="btn btn-sm btn-outline" data-wb-del="'+it.id+'" style="color:#d93025;">删除</button>'+
        '</div></div>';
    });
    box.innerHTML=h;
    box.querySelectorAll('[data-wb-review]').forEach(function(b){ b.addEventListener('click',function(){
      var id=this.getAttribute('data-wb-review');
      var rec=ownRec(id);
      if(!rec){ showToast('该错题不属于当前学生，已跳过'); return; }
      MM.wrongBook.update(id,{reviewCount:(rec.reviewCount||0)+1,status:'reviewing'});
      renderWrongBook(); showToast('已记录一次复习');
    }); });
    box.querySelectorAll('[data-wb-master]').forEach(function(b){ b.addEventListener('click',function(){
      var id=this.getAttribute('data-wb-master');
      if(!ownRec(id)){ showToast('该错题不属于当前学生，已跳过'); return; }
      MM.wrongBook.update(id,{status:'mastered'});
      renderWrongBook(); showToast('已标记为掌握');
    }); });
    box.querySelectorAll('[data-wb-del]').forEach(function(b){ b.addEventListener('click',function(){
      var id=this.getAttribute('data-wb-del');
      if(!ownRec(id)){ showToast('该错题不属于当前学生，已跳过'); return; }
      MM.wrongBook.remove(id);
      renderWrongBook(); showToast('已删除');
    }); });
  }
  /* ---------------- 身份标签 + 首轮引导 ---------------- */

  function setupIdentity() {
    if (!window.Session) return;
    var box = document.getElementById('identityBox');
    if (box) window.Session.mountChip(box);
    var replay = document.getElementById('replayTourBtn');
    if (replay) replay.addEventListener('click', function () {
      if (window.Onboarding) window.Onboarding.start('student', { force: true });
    });
  }

  function setupOnboarding() {
    if (!window.Onboarding) return;
    window.Onboarding.defineSteps('student', [
      { target: '#tabProfile',
        before: function () { switchTab('profile'); },
        title: '这是你的学业画像',
        body: '风险等级、综合评分、工单状态都由辅导员的最新评估同步过来；出勤率与作业提交率来自你的过程数据。<br>下方的雷达图是各科成绩分布。' },
      { target: '.nav-item[data-nav="plan"]',
        before: function () { switchTab('profile'); },
        title: '第二步：认领学习计划',
        body: '辅导员会根据你的预警因素生成帮扶方案，你在这里看到每周任务与配套资源，完成后点「标记完成」即可。' },
      { target: '.nav-item[data-nav="wrongbook"]',
        before: function () { switchTab('wrongbook'); },
        title: '第三步：错题拍照归档',
        body: '用上方「AI 多模态 → 上传错题照片」识别题目，确认后存入错题本。<br>同一个知识点累计 <b>3 题未掌握</b> 就会自动回流给辅导员，形成预警线索。' },
      { target: '.nav-item[data-nav="appeal"]',
        before: function () { switchTab('appeal'); },
        title: '遇到困难，随时申报',
        body: '学业辅导、心理辅导、生活困难都可以在这里提交，会生成一张申报工单交给辅导员。<br>想再看一遍引导，点右上角「使用引导」。' }
    ]);
    window.Onboarding.maybeAutoStart('student');
  }

if(window.MM&&MM.warning){try{MM.warning.sync({studentId:user.id,studentName:user.name});}catch(e){}}
renderSidebar(); renderProfile(); setupIdentity(); setupOnboarding();
})();
