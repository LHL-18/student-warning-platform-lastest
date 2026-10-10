/**

 * app.js — 学业预警帮扶平台 前端逻辑

 * 布局：顶部导航 + 左侧班级-学生树 + 右侧Tab内容区

 */

(function () {

  'use strict';

  // 路由守卫：非教师身份（未登录 / 身份不符 / 会话过期）直接回登录页
  if (window.Session && !window.Session.guard('teacher')) return;



  // ================================================================

  //  DOM 引用

  // ================================================================

  var studentForm = document.getElementById('studentForm');

  var submitBtn = document.getElementById('submitBtn');

  var submitBtnText = document.getElementById('submitBtnText');

  var clearBtn = document.getElementById('clearBtn');

  var formError = document.getElementById('formError');



  var contentEmpty = document.getElementById('contentEmpty');

  var contentDetail = document.getElementById('contentDetail');

  var resultLoading = document.getElementById('resultLoading');

  var resultContent = document.getElementById('resultContent');

  var resultError = document.getElementById('resultError');

  var resultErrorText = document.getElementById('resultErrorText');

  var retryBtn = document.getElementById('retryBtn');

  var exportBtn = document.getElementById('exportBtn');

  var newAnalysisBtn = document.getElementById('newAnalysisBtn');



  var apiModeBadge = document.getElementById('apiModeBadge');

  var historyList = document.getElementById('historyList');

  var clearHistoryBtn = document.getElementById('clearHistoryBtn');



  var step1 = document.getElementById('step1');

  var step2 = document.getElementById('step2');

  var step3 = document.getElementById('step3');

  var stepLines = document.querySelectorAll('.step-line');



  var riskBadge = document.getElementById('riskBadge');

  var riskBody = document.getElementById('riskBody');

  var supportBody = document.getElementById('supportBody');

  var auditBadge = document.getElementById('auditBadge');

  var auditBody = document.getElementById('auditBody');



  var ocrImageBtn = document.getElementById('ocrImageBtn');

  var ocrFileInput = document.getElementById('ocrFileInput');

  var ocrPreviewBar = document.getElementById('ocrPreviewBar');

  var ocrPreviewImg = document.getElementById('ocrPreviewImg');

  var ocrBarStatus = document.getElementById('ocrBarStatus');

  var ocrBarFill = document.getElementById('ocrBarFill');

  var dropOverlay = document.getElementById('dropOverlay');



  var sidebarTree = document.getElementById('sidebarTree');

  var sidebarSearch = document.getElementById('sidebarSearch');

  var addStudentBtn = document.getElementById('addStudentBtn');

  var studentModal = document.getElementById('studentModal');

  var modalTitle = document.getElementById('modalTitle');

  var modalCloseBtn = document.getElementById('modalClose');



  var studentAvatar = document.getElementById('studentAvatar');

  var studentInfoName = document.getElementById('studentInfoName');

  var studentInfoId = document.getElementById('studentInfoId');

  var studentInfoClass = document.getElementById('studentInfoClass');

  var studentInfoRisk = document.getElementById('studentInfoRisk');

  var infoGrades = document.getElementById('infoGrades');

  var infoHomework = document.getElementById('infoHomework');

  var infoAttendance = document.getElementById('infoAttendance');



  var editStudentBtn = document.getElementById('editStudentBtn');

  var analyzeStudentBtn = document.getElementById('analyzeStudentBtn');



  var tabItems = document.querySelectorAll('.tab-item');

  var tabDetail = document.getElementById('tabDetail');

  var tabHistory = document.getElementById('tabHistory');



  var studentClassField = document.getElementById('studentClass');

  var studentLabField = document.getElementById('studentLab');

  var studentCodeQualityField = document.getElementById('studentCodeQuality');

  var studentLabReportField = document.getElementById('studentLabReport');

  var infoLab = document.getElementById('infoLab');

  var infoCodeQuality = document.getElementById('infoCodeQuality');

  var infoLabReport = document.getElementById('infoLabReport');

  var exportReportBtn = document.getElementById('exportReportBtn');

  var studentInfoStatus = document.getElementById('studentInfoStatus');

  var supportActions = document.getElementById('supportActions');

  var auditActions = document.getElementById('auditActions');

  var operationLogList = document.getElementById('operationLogList');



  var importModal = document.getElementById('importModal');

  var importFileInput = document.getElementById('importFileInput');

  var importDropZone = document.getElementById('importDropZone');

  var importPreviewWrap = document.getElementById('importPreviewWrap');

  var importPreviewTable = document.getElementById('importPreviewTable');

  var importStats = document.getElementById('importStats');

  var importConfirmBtn = document.getElementById('importConfirmBtn');

  var importResult = document.getElementById('importResult');

  var importCancelBtn = document.getElementById('importCancelBtn');

  var ledgerBody = document.getElementById('ledgerBody');

  var filterClass = document.getElementById('filterClass');

  var filterRisk = document.getElementById('filterRisk');

  var filterSearch = document.getElementById('filterSearch');

  var exportLedgerBtn = document.getElementById('exportLedgerBtn');

  var importModalCloseBtn = document.getElementById('importModalClose');



  var contentDashboard = document.getElementById('contentDashboard');

  var statCards = document.getElementById('statCards');

  var chartPie = document.getElementById('chartPie');

  var chartBar = document.getElementById('chartBar');

  var chartLine = document.getElementById('chartLine');

  var pieLegend = document.getElementById('pieLegend');

  var dashboardTableBody = document.getElementById('dashboardTableBody');

  var knowledgeTree = document.getElementById('knowledgeTree');

  var knowledgeDetail = document.getElementById('knowledgeDetail');

  var tabKnowledge = document.getElementById('tabKnowledge');

  var knowledgeSearch = document.getElementById('knowledgeSearch');

  var highlightedKnowledgeId = null;
  var btnStartDemo = document.getElementById('btnStartDemo');


  var ticketCard = document.getElementById('ticketCard');
  var ticketIdEl = document.getElementById('ticketId');
  var ticketTimeEl = document.getElementById('ticketTime');
  var ticketReasonEl = document.getElementById('ticketReason');
  var ticketStatusEl = document.getElementById('ticketStatus');
  var btnUpgrade = document.getElementById('btnUpgrade');
  var btnResolve = document.getElementById('btnResolve');
  var sidebarStatusFilter = document.getElementById('sidebarStatusFilter');
  var tabPlan = document.getElementById('tabPlan');
  var planHeader = document.getElementById('planHeader');
  var planContent = document.getElementById('planContent');
  var planHistory = document.getElementById('planHistory');
  var planStatus = document.getElementById('planStatus');
  var planCreatedAt = document.getElementById('planCreatedAt');
  var planActions = document.getElementById('planActions');
  var btnApprovePlan = document.getElementById('btnApprovePlan');
  var btnRejectPlan = document.getElementById('btnRejectPlan');
  var btnEditPlan = document.getElementById('btnEditPlan');



  // ================================================================

  //  状态

  // ================================================================

  var isMock = CONFIG.apiMode === 'mock';

  var currentResult = null;

  var lastSubmittedData = null;

  var ocrProcessing = false;

  var selectedStudentId = null;

  var editingStudentId = null;

  var selectedTab = 'detail';



  // ================================================================

  //  模拟数据

  // ================================================================

  // 花名册：来自 students.js（教师端 / 学生端 / 登录页共享的单一数据源）
  var mockStudents = (function () {
    var seed = (typeof ROSTER_SEED !== 'undefined' && ROSTER_SEED) ? ROSTER_SEED : (window.ROSTER_SEED || []);
    if (!seed || !seed.length) console.warn('[app] 花名册为空：请确认 students.js 已在本页加载');
    return JSON.parse(JSON.stringify(seed));
  })();



  for (var si = 0; si < mockStudents.length; si++) {

    mockStudents[si].status = mockStudents[si].status || 'pending';

    mockStudents[si].operationLog = mockStudents[si].operationLog || [];

  }



  function computeMockRisk(student) {

    if (student.status === 'resolved') return '\u4f4e';

    if (!student.grades && !student.homework && !student.attendance) return 'none';

    var analysis = analyzeRiskLevel(student.grades || '', student.homework || '', student.attendance || '');

    return analysis.level;

  }



  function getClassGroups() {

    var groups = {};

    for (var i = 0; i < mockStudents.length; i++) {

      var cn = mockStudents[i].className || '\u672a\u5206\u73ed';

      if (!groups[cn]) groups[cn] = [];

      groups[cn].push(mockStudents[i]);

    }

    return groups;

  }



  // ================================================================

  //  侧栏渲染

  // ================================================================

  /**
   * 班级预警概览（左侧栏底部）。
   * 目的有两个：① 把树列表下方的大片留白变成有用的整体态势；
   * ② 让"某个班是不是整体偏高"一眼可见，而不必逐个点开学生。
   * 统计的是**全体学生**（不受搜索/状态筛选影响），否则筛选后态势会跟着变，容易误读。
   */
  function renderSidebarSummary() {
    var box = document.getElementById('sidebarSummary');
    if (!box) return;
    var all = (mockStudents || []);
    if (!all.length) {
      box.innerHTML = '<div class="sidebar-summary-empty">暂无学生数据</div>';
      return;
    }
    var high = 0, mid = 0, low = 0, pending = 0, resolved = 0;
    for (var i = 0; i < all.length; i++) {
      var r = all[i]._riskLevel || computeMockRisk(all[i]);
      all[i]._riskLevel = r;
      // 与 getDashboardData() 保持**同一套互斥规则**：已办结不再计入风险档，
      // 否则会出现"统计卡高风险 1 / 侧栏高风险 2"这种自相矛盾。
      if (all[i].status === 'resolved') { resolved++; }
      else if (r === '\u9ad8') high++;
      else if (r === '\u4e2d') mid++;
      else low++;
      if (all[i].status === 'pending') pending++;
    }
    var total = all.length;
    function pct(n) { return total ? (n / total * 100) : 0; }
    var cls = getClassGroups();
    var classCount = Object.keys(cls).length;

    var h = '<div class="sidebar-summary-head"><span>班级预警概览</span><b>' + total + ' 人 / ' + classCount + ' 班</b></div>';
    h += '<div class="sidebar-summary-bar">';
    if (high) h += '<div class="sidebar-summary-seg" style="width:' + pct(high) + '%;background:#d93025;"></div>';
    if (mid) h += '<div class="sidebar-summary-seg" style="width:' + pct(mid) + '%;background:#e37400;"></div>';
    if (low) h += '<div class="sidebar-summary-seg" style="width:' + pct(low) + '%;background:#0d904f;"></div>';
    if (resolved) h += '<div class="sidebar-summary-seg" style="width:' + pct(resolved) + '%;background:#1a73e8;"></div>';
    h += '</div>';
    h += '<div class="sidebar-summary-legend">'
      + '<span class="sidebar-summary-item"><span class="sidebar-summary-dot" style="background:#d93025;"></span>高风险 <b>' + high + '</b></span>'
      + '<span class="sidebar-summary-item"><span class="sidebar-summary-dot" style="background:#e37400;"></span>中风险 <b>' + mid + '</b></span>'
      + '<span class="sidebar-summary-item"><span class="sidebar-summary-dot" style="background:#0d904f;"></span>低风险 <b>' + low + '</b></span>'
      + (resolved ? '<span class="sidebar-summary-item"><span class="sidebar-summary-dot" style="background:#1a73e8;"></span>已办结 <b>' + resolved + '</b></span>' : '')
      + '</div>';
    h += '<div class="sidebar-summary-foot">待干预 ' + pending + ' 人'
      + (pending ? '' : '（当前无待办）') + '</div>';
    box.innerHTML = h;
  }

  /** 顶部模块名（二级导航左侧的面包屑），让两层导航的关系显式可见 */
  function setTabBarModule(text) {
    var el = document.getElementById('tabBarModule');
    if (el && text) el.textContent = text;
  }

  function renderSidebar(filterText) {

    if (!sidebarTree) return;

    var groups = getClassGroups();

    var classNames = Object.keys(groups).sort();

    var html = '';

    var filterLower = (filterText || '').toLowerCase().trim();

    for (var c = 0; c < classNames.length; c++) {

      var cn = classNames[c];

      var students = groups[cn];

      var visibleCount = 0;

      var studentItems = '';

      for (var s = 0; s < students.length; s++) {

        var st = students[s];

        var risk = st._riskLevel || computeMockRisk(st);

        st._riskLevel = risk;

        var dotClass = 'risk-dot';

        if (risk === '\u9ad8') dotClass += ' risk-dot-high';

        else if (risk === '\u4e2d') dotClass += ' risk-dot-medium';

        else if (risk === '\u4f4e') dotClass += ' risk-dot-low';

        else dotClass += ' risk-dot-none';

        var nameLower = st.name.toLowerCase();

        var idLower = st.id.toLowerCase();

        var hidden = false;
        // Status filter
        var sFilter = sidebarStatusFilter ? sidebarStatusFilter.value : '';
        if (sFilter === 'pending' && st.status !== 'pending') hidden = true;
        else if (sFilter === 'processing' && st.status !== 'supporting' && st.status !== 'reviewing') hidden = true;
        else if (sFilter === 'resolved' && st.status !== 'resolved') hidden = true;

        if (filterLower) {

          if (nameLower.indexOf(filterLower) === -1 && idLower.indexOf(filterLower) === -1) hidden = true;

        }

        var activeClass = (selectedStudentId === st.id) ? ' active' : '';

        var filteredClass = hidden ? ' filtered-out' : '';

        if (!hidden) visibleCount++;

        studentItems += '<li class="student-item' + activeClass + filteredClass + '" data-student-id="' + st.id + '"><span class="' + dotClass + '"></span><span class="student-item-name">' + escapeHtml(st.name) + '</span><span class="student-item-id">' + escapeHtml(st.id) + '</span></li>';

      }

      html += '<div class="class-group"><div class="class-group-header" data-class="' + escapeHtml(cn) + '"><span class="class-group-arrow expanded">\u25b6</span><span>' + escapeHtml(cn) + '</span><span class="class-group-count">' + visibleCount + '/' + students.length + '</span></div><ul class="student-list" style="max-height:' + (students.length * 40) + 'px;">' + studentItems + '</ul></div>';

    }

    sidebarTree.innerHTML = html;

    renderSidebarSummary();

    var headers = sidebarTree.querySelectorAll('.class-group-header');

    for (var h = 0; h < headers.length; h++) {

      headers[h].addEventListener('click', function () {

        var arrow = this.querySelector('.class-group-arrow');

        var list = this.nextElementSibling;

        if (list.classList.contains('collapsed')) { list.classList.remove('collapsed'); arrow.classList.add('expanded'); }

        else { list.classList.add('collapsed'); arrow.classList.remove('expanded'); }

      });

    }

    var items = sidebarTree.querySelectorAll('.student-item:not(.filtered-out)');

    for (var i2 = 0; i2 < items.length; i2++) {

      items[i2].addEventListener('click', function () { selectStudent(this.getAttribute('data-student-id')); });

    }

  }



  function filterSidebar() { renderSidebar(sidebarSearch ? sidebarSearch.value : ''); }



  // ================================================================

  //  选择学生

  // ================================================================

  /* 统一的教师端数据访问留痕入口。
   * 只记字段**名**不记值（避免访问日志本身泄露敏感数据）；
   * 未登录 / Perm 未加载 / 写失败都不影响主流程。 */
  function auditAccess(action, subjectId, subjectName, fields) {
    if (!window.Perm) return;
    try {
      var stu = subjectId ? findStudentById(subjectId) : null;
      window.Perm.audit({
        action: action,
        subjectId: subjectId || '',
        subjectName: subjectName || (stu ? stu.name : ''),
        fields: fields || []
      });
    } catch (e) {}
  }

  function selectStudent(studentId) {

    selectedStudentId = studentId;

    var student = null;

    for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === studentId) { student = mockStudents[i]; break; } }

    if (!student) return;

    // 教师查看学生详情 = 一次数据访问，留痕（学生端「隐私中心」可见）
    auditAccess('view', studentId, student.name, ['name', 'className', 'grades', 'homework', 'attendance', 'riskLevel', 'status']);

    // 证据链区块跟随当前选中的学生刷新
    if (typeof renderEvidenceCard === 'function') renderEvidenceCard();

    renderSidebar(sidebarSearch ? sidebarSearch.value : '');

    if (contentDashboard) contentDashboard.style.display = 'none';

    if (contentEmpty) contentEmpty.style.display = 'none';

    if (contentDetail) contentDetail.style.display = '';

    if (studentAvatar) studentAvatar.textContent = student.name.charAt(0);

    if (studentInfoName) studentInfoName.textContent = student.name;

    if (studentInfoId) studentInfoId.textContent = student.id;

    if (studentInfoClass) studentInfoClass.textContent = student.className || '\u672a\u5206\u73ed';

    var risk = student._riskLevel || computeMockRisk(student);

    student._riskLevel = risk;

    var card = contentDetail ? contentDetail.querySelector('.student-info-card') : null;

    if (studentInfoRisk) {

      if (risk === '\u9ad8') { studentInfoRisk.textContent = '\u9ad8\u98ce\u9669'; studentInfoRisk.className = 'risk-badge risk-high'; }

      else if (risk === '\u4e2d') { studentInfoRisk.textContent = '\u4e2d\u98ce\u9669'; studentInfoRisk.className = 'risk-badge risk-medium'; }

      else if (risk === '\u4f4e') { studentInfoRisk.textContent = '\u4f4e\u98ce\u9669'; studentInfoRisk.className = 'risk-badge risk-low'; }

      else { studentInfoRisk.textContent = '\u672a\u8bc4\u4f30'; studentInfoRisk.className = 'risk-badge'; }

    }

    if (card) { card.className = 'student-info-card risk-' + (risk === '\u9ad8' ? 'high' : risk === '\u4e2d' ? 'medium' : 'low'); }

    if (infoGrades) infoGrades.textContent = student.grades || '\u2014';

    if (infoHomework) infoHomework.textContent = student.homework || '\u2014';

    if (infoAttendance) infoAttendance.textContent = student.attendance || '\u2014';

    if (infoLab) infoLab.textContent = student.lab || '\u2014';

    if (infoCodeQuality) infoCodeQuality.textContent = student.codeQuality || '\u2014';

    if (infoLabReport) infoLabReport.textContent = student.labReport || '\u2014';

    // 六维指标空状态引导：只要有一项有内容就隐藏提示（说明这是已分析过的学生）
    var hintEl = document.getElementById('infoBlocksHint');
    if (hintEl) {
      var hasAny = !!(student.grades || student.homework || student.attendance || student.lab || student.codeQuality || student.labReport);
      if (hasAny) { hintEl.classList.add('is-hidden'); }
      else { hintEl.classList.remove('is-hidden'); }
    }

    // Render ticket card
    if (ticketCard && student.ticketId) {
      ticketCard.style.display = '';
      ticketIdEl.textContent = student.ticketId || '--';
      ticketTimeEl.textContent = student.ticketTime || '--';
      ticketReasonEl.textContent = student.ticketReason || '--';
      var ts = student.status || 'pending';
      var tsLabel = ts === 'pending' ? '待干预' : (ts === 'supporting' || ts === 'reviewing') ? '处理中' : '已办结';
      var tsCls = ts === 'pending' ? 'status-pending' : (ts === 'supporting' || ts === 'reviewing') ? 'status-supporting' : 'status-resolved';
      ticketStatusEl.textContent = tsLabel;
      ticketStatusEl.className = 'status-badge ' + tsCls;
      if (btnUpgrade) btnUpgrade.style.display = ts === 'resolved' ? 'none' : '';
      if (btnResolve) btnResolve.style.display = ts === 'resolved' ? 'none' : '';
    } else if (ticketCard) {
      ticketCard.style.display = 'none';
    }
    var st = student.status || 'pending';

    updateStatusDisplay(st);

    renderOperationLog(studentId);

    var ring = document.getElementById('studentRiskRing');

    if (ring) ring.style.display = 'none';

    switchTab('detail');

    showResultUI('empty');

    currentResult = null;

  }





  // ================================================================

  //  Tab 切换

  // ================================================================

  // 工单状态的**唯一**权威表。注意：侧栏筛选器提供的是 pending/processing/resolved，
  // 而这里还必须覆盖 supporting/reviewing/escalated——任何地方都不该再自己定义一份局部映射，
  // 否则漏键就会渲染成 "undefined"（历史 bug：renderLedger / renderDashboardTable 各缺 processing）。
  var STATUS_LABELS = { pending: '待干预', processing: '处理中', supporting: '帮扶中', reviewing: '核查中', resolved: '已解除', escalated: '已升级' };
  /** 取状态文案，永远不返回 undefined */
  function statusLabel(s) { return STATUS_LABELS[s] || STATUS_LABELS.pending; }

  var STATUS_CLASSES = { pending: 'status-pending', supporting: 'status-supporting', reviewing: 'status-reviewing', resolved: 'status-resolved', escalated: 'status-pending' };



  function updateStatusDisplay(status) {

    if (!studentInfoStatus) return;

    studentInfoStatus.textContent = STATUS_LABELS[status] || '待干预';

    studentInfoStatus.className = 'status-badge ' + (STATUS_CLASSES[status] || 'status-pending');

    if (supportActions) supportActions.style.display = (status === 'pending' || status === 'supporting') ? '' : 'none';

    if (auditActions) auditActions.style.display = (status === 'reviewing' || (currentResult && currentResult.auditResult)) ? '' : 'none';

  }



  /**
   * 隐藏所有二级页签面板（keepId 指定的那个除外）。
   *
   * 原来每个分支各管各的：kbadmin/checkin/plan/knowledge/tickets/flow 分支会顺带隐藏
   * 自己关心的那几个，但**默认分支只处理 tabDetail/tabHistory**——于是"访问过知识库再回到
   * 学生详情"时，tabKnowledge 仍带 .active 且内联 display:block，两个面板同时渲染、
   * 内容叠在一起（知识库的搜索框会出现在 tab 栏上方）。
   * 这里做一次统一兜底，任何分支都不可能再漏。
   */
  function hideOtherTabPanels(keepId) {
    var panels = document.querySelectorAll('.tab-panel');
    for (var i = 0; i < panels.length; i++) {
      if (keepId && panels[i].id === keepId) continue;
      panels[i].style.display = 'none';
      panels[i].classList.remove('active');
    }
    var extra = [contentDashboard, contentEmpty, contentDetail];
    for (var ei = 0; ei < extra.length; ei++) {
      if (extra[ei] && extra[ei].id !== keepId) extra[ei].style.display = 'none';
    }
  }

  function showView(viewId) {
    var tabId = 'tab' + viewId.charAt(0).toUpperCase() + viewId.slice(1);
    var target = viewId === 'dashboard' ? contentDashboard : viewId === 'empty' ? contentEmpty : document.getElementById(tabId);
    hideOtherTabPanels(target ? target.id : null);
    if (target) { target.style.display = viewId === 'flow' ? '' : 'block'; target.classList.add('active'); }
    if (contentDetail && (viewId === 'detail' || viewId === 'history' || viewId === 'tickets')) contentDetail.style.display = '';
    if (viewId !== 'settings' && settingsPanel) settingsPanel.style.display = 'none';
    return target;
  }

  function switchTab(tabName) {

    // 统一兜底：先隐藏所有面板（含 .active），再由下面的分支显式显示目标面板
    showView(tabName);

    for (var i = 0; i < tabItems.length; i++) {

      if (tabItems[i].getAttribute('data-tab') === tabName) tabItems[i].classList.add('active');

      else tabItems[i].classList.remove('active');

    }

    if (tabName === 'kbadmin') { selectedTab='kbadmin'; if(contentDetail)contentDetail.style.display='none'; if(tabKbAdmin){tabKbAdmin.style.display='block';tabKbAdmin.classList.add('active');} if(tabDetail){tabDetail.style.display='none';tabDetail.classList.remove('active');} if(tabHistory){tabHistory.style.display='none';tabHistory.classList.remove('active');} if(contentDashboard)contentDashboard.style.display='none'; if(tabKnowledge){tabKnowledge.style.display='none';tabKnowledge.classList.remove('active');} if(tabPlan){tabPlan.style.display='none';tabPlan.classList.remove('active');} if(tabCheckin){tabCheckin.style.display='none';tabCheckin.classList.remove('active');} renderKbAdmin(); return; }
    if (tabName === 'checkin') { selectedTab='checkin'; if(contentDetail)contentDetail.style.display='none'; if(tabCheckin){tabCheckin.style.display='block';tabCheckin.classList.add('active');} if(tabDetail){tabDetail.style.display='none';tabDetail.classList.remove('active');} if(tabHistory){tabHistory.style.display='none';tabHistory.classList.remove('active');} if(contentDashboard)contentDashboard.style.display='none'; if(tabKnowledge){tabKnowledge.style.display='none';tabKnowledge.classList.remove('active');} if(tabPlan){tabPlan.style.display='none';tabPlan.classList.remove('active');} if(tabKbAdmin){tabKbAdmin.style.display='none';tabKbAdmin.classList.remove('active');} renderCheckinTable(); return; }
    if (tabName === 'plan') {
      selectedTab = 'plan';
      if (contentDetail) contentDetail.style.display = 'none';
      if (tabPlan) { tabPlan.style.display = 'block'; tabPlan.classList.add('active'); }
      if (tabDetail) { tabDetail.style.display = 'none'; tabDetail.classList.remove('active'); }
      if (tabHistory) { tabHistory.style.display = 'none'; tabHistory.classList.remove('active'); }
      if (contentDashboard) contentDashboard.style.display = 'none';
      if (tabKnowledge) { tabKnowledge.style.display = 'none'; tabKnowledge.classList.remove('active'); }
      try { renderSupportPlan(); } catch (e) { console.error(e); if (planContent) planContent.innerHTML = '<div class="history-empty">帮扶方案暂时无法加载，请稍后重试</div>'; }
      try { renderSimilarCases(); } catch (e2) { console.error(e2); }
      return;
    }
    if (tabName === 'knowledge') {

      selectedTab = 'knowledge';

      if (tabKnowledge) { tabKnowledge.style.display = 'block'; tabKnowledge.classList.add('active'); }

      if (tabDetail) { tabDetail.style.display = 'none'; tabDetail.classList.remove('active'); }

      if (tabHistory) { tabHistory.style.display = 'none'; tabHistory.classList.remove('active'); }

      if (contentDashboard) contentDashboard.style.display = 'none';

      if (contentDetail) contentDetail.style.display = 'none';

      if (tabPlan) { tabPlan.style.display = 'none'; tabPlan.classList.remove('active'); }

      if (tabCheckin) { tabCheckin.style.display = 'none'; tabCheckin.classList.remove('active'); }

      if (tabKbAdmin) { tabKbAdmin.style.display = 'none'; tabKbAdmin.classList.remove('active'); }

      renderKnowledgeTree();

      return;

    }

    if (tabName === 'flow') {
      selectedTab = 'flow';
      if (tabFlow) { tabFlow.style.display = ''; tabFlow.classList.add('active'); }
      if (tabDetail) { tabDetail.style.display = 'none'; tabDetail.classList.remove('active'); }
      if (tabHistory) { tabHistory.style.display = 'none'; tabHistory.classList.remove('active'); }
      if (contentDashboard) contentDashboard.style.display = 'none';
      if (contentDetail) contentDetail.style.display = 'none';
      if (tabKnowledge) { tabKnowledge.style.display = 'none'; tabKnowledge.classList.remove('active'); }
      if (tabPlan) { tabPlan.style.display = 'none'; tabPlan.classList.remove('active'); }
      if (tabCheckin) tabCheckin.style.display = 'none';
      if (tabKbAdmin) tabKbAdmin.style.display = 'none';
      renderFlowPanel();
      return;
    }
    if (tabName === 'tickets') {
      selectedTab = 'tickets';
      if (contentDetail) contentDetail.style.display = '';
      if (contentDashboard) contentDashboard.style.display = 'none';
      if (tabDetail) { tabDetail.style.display = 'none'; tabDetail.classList.remove('active'); }
      if (tabHistory) { tabHistory.style.display = 'none'; tabHistory.classList.remove('active'); }
      if (tabTickets) { tabTickets.style.display = 'block'; tabTickets.classList.add('active'); }
      if (tabKnowledge) { tabKnowledge.style.display = 'none'; tabKnowledge.classList.remove('active'); }
      if (tabPlan) { tabPlan.style.display = 'none'; tabPlan.classList.remove('active'); }
      if (tabCheckin) { tabCheckin.style.display = 'none'; tabCheckin.classList.remove('active'); }
      if (tabKbAdmin) { tabKbAdmin.style.display = 'none'; tabKbAdmin.classList.remove('active'); }
      if (tabFlow) { tabFlow.style.display = 'none'; tabFlow.classList.remove('active'); }
      renderTickets();
      return;
    }
    if (tabName === 'dashboard') { showDashboard(); return; }

    if (contentDetail) contentDetail.style.display = (tabName === 'detail' || tabName === 'history') ? '' : 'none';

    if (tabDetail) {

      tabDetail.style.display = tabName === 'detail' ? '' : 'none';

      if (tabName === 'detail') tabDetail.classList.add('active');

      else tabDetail.classList.remove('active');

    }

    if (tabHistory) {

      tabHistory.style.display = tabName === 'history' ? '' : 'none';

      if (tabName === 'history') { tabHistory.classList.add('active'); renderAppealReviews(); }

      else tabHistory.classList.remove('active');

    }

  }



  function showResultUI(state) {

    if (resultLoading) resultLoading.style.display = state === 'loading' ? '' : 'none';

    if (resultContent) resultContent.style.display = state === 'result' ? '' : 'none';

    if (resultError) resultError.style.display = state === 'error' ? '' : 'none';

  }



  // ================================================================

  //  弹窗

  // ================================================================

  function openModal(isEdit) {

    editingStudentId = isEdit ? selectedStudentId : null;

    if (modalTitle) modalTitle.textContent = isEdit ? '\u7f16\u8f91\u5b66\u751f' : '\u65b0\u589e\u5b66\u751f';

    if (submitBtnText) submitBtnText.textContent = isEdit ? '\ud83d\udcbe \u4fdd\u5b58\u4fee\u6539' : '\ud83d\udd0d \u63d0\u4ea4\u5206\u6790';

    if (isEdit && selectedStudentId) {

      var student = null;

      for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === selectedStudentId) { student = mockStudents[i]; break; } }

      if (student) {

        document.getElementById('studentName').value = student.name || '';

        document.getElementById('studentId').value = student.id || '';

        if (studentClassField) studentClassField.value = student.className || '';

        document.getElementById('studentGrades').value = student.grades || '';

        document.getElementById('studentHomework').value = student.homework || '';

        document.getElementById('studentAttendance').value = student.attendance || '';

      }

    } else { studentForm.reset(); hideFormError(); }

    if (studentModal) studentModal.style.display = '';

    document.getElementById('studentName').focus();

  }



  function closeModal() { if (studentModal) studentModal.style.display = 'none'; hideFormError(); }



  function showFormError(msg) { formError.textContent = msg; formError.style.display = ''; }

  function hideFormError() { formError.style.display = 'none'; }



  // ================================================================

  //  初始化 + 事件绑定

  // ================================================================

  // 持久化学生状态

  function saveStudentStates() {

    var states = {};

    for (var i = 0; i < mockStudents.length; i++) {

      var s = mockStudents[i];

      states[s.id] = {
        name: s.name || '', className: s.className || '',
        grades: s.grades || '', homework: s.homework || '', attendance: s.attendance || '',
        riskLevel: s._riskLevel || '', riskScore: (s._riskScore === undefined ? '' : s._riskScore),
        status: s.status || 'pending',
        ticketId: s.ticketId || '', ticketTime: s.ticketTime || '', ticketReason: s.ticketReason || '',
        supportPlan: s.supportPlan || null
      };

    }

    localStorage.setItem('studentWarningStates', JSON.stringify(states));

  }



  function loadStudentStates() {

    var raw = localStorage.getItem('studentWarningStates');

    if (!raw) return;

    try {

      var states = JSON.parse(raw);

      for (var i = 0; i < mockStudents.length; i++) {

        var s = mockStudents[i];

        if (states[s.id]) {

          var st = states[s.id];

          if (st.name) s.name = st.name;

          if (st.className) s.className = st.className;

          if (st.grades) s.grades = st.grades;

          if (st.homework) s.homework = st.homework;

          if (st.attendance) s.attendance = st.attendance;

          if (st.riskLevel) s._riskLevel = st.riskLevel;

          if (st.riskScore !== undefined && st.riskScore !== '') s._riskScore = st.riskScore;

          if (st.status) s.status = st.status;

          if (st.ticketId) s.ticketId = st.ticketId;

          if (st.ticketTime) s.ticketTime = st.ticketTime;

          if (st.ticketReason) s.ticketReason = st.ticketReason;

          if (st.supportPlan) s.supportPlan = st.supportPlan;

        }

      }

      // 教师端运行期新增的学生（CSV 导入 / 手动新增）也要在重启后恢复
      var known = {};
      for (var k = 0; k < mockStudents.length; k++) known[mockStudents[k].id] = true;
      Object.keys(states).forEach(function (id) {
        if (known[id]) return;
        var st = states[id] || {};
        mockStudents.push({
          id: id, name: st.name || ('学生' + id), className: st.className || '未分班',
          grades: st.grades || '', homework: st.homework || '', attendance: st.attendance || '',
          status: st.status || 'pending', _riskLevel: st.riskLevel || '',
          _riskScore: (st.riskScore === undefined ? '' : st.riskScore),
          ticketId: st.ticketId || '', ticketTime: st.ticketTime || '', ticketReason: st.ticketReason || '',
          supportPlan: st.supportPlan || null
        });
      });

    } catch(e) {}

  }





  // 设置面板

  var settingsPanel = document.getElementById('settingsPanel');

  var ruleSelector = document.getElementById('ruleSelector');

  var applyRuleBtn = document.getElementById('applyRuleBtn');

  var currentRuleLabel = document.getElementById('currentRuleLabel');

  var scoreDetail = document.getElementById('scoreDetail');



  function initSettings() {

    renderAccessSummary();

    if (!ruleSelector) return;

    var names = RiskPluginManager.getNames();

    ruleSelector.innerHTML = names.map(function(n) {

      return '<option value="' + n.id + '"' + (n.id === RiskPluginManager.getActive() ? ' selected' : '') + '>' + n.name + '</option>';

    }).join('');

    updateRuleLabel();

  }



  var accessSummaryEl = document.getElementById('accessSummary');

  /**
   * 教师端「数据访问自查」汇总：只统计**教师侧**的访问次数。
   * 刻意不展示"某学生打开过自己的隐私页"这类信息——那是反向监控，本项目不做。
   */
  function renderAccessSummary() {
    if (!accessSummaryEl || !window.Perm) return;
    var now = new Date();
    var mm = now.getMonth() + 1;
    var ym = now.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm;
    var list = window.Perm.log().filter(function (r) {
      return r.actorRole === 'teacher' && String(r.at || '').slice(0, 7) === ym;
    });
    var by = { view: 0, export: 0, write: 0 };
    list.forEach(function (r) { if (by[r.action] !== undefined) by[r.action]++; });
    accessSummaryEl.textContent = ym + ' 本月 ' + list.length + ' 次（查看 ' + by.view + ' · 导出 ' + by.export + ' · 修改 ' + by.write + '）';
  }

  /* ================================================================
   *  政策沙盒 / 影子模式（PROMPT-06）
   *
   *  ⚠️ 硬约束：本区块**只算不写**。
   *  下面的所有函数都是纯计算 + DOM 渲染，绝不修改
   *  studentWarningStates / studentWarningHistory / warningSnapshots，
   *  也不调用 saveStudentStates / addToHistory / writeWarningSnapshot。
   *  影子模式的全部意义就是"零副作用"——只有点「应用此规则」才写
   *  riskPluginActive（那也只是切换当前生效规则，不回溯改历史）。
   *  验收项 1 会用「三个键的 JSON 字符串逐字节相等」来守住这条线。
   * ================================================================ */

  var sandboxState = null;      // 最近一次试算结果（内存态，取消即丢弃）
  var sandboxChart = null;      // ECharts 实例，重渲染前先 dispose

  /** 各规则的出厂阈值（从三套插件源码里读出来的真实参数） */
  function sandboxDefaults(ruleId) {
    if (ruleId === 'strict') return { failLine: 60, attLine: 80, hwLine: 70, labLine: 70 };
    return { failLine: 60, attLine: 70, hwLine: 70, labLine: 70 };
  }

  /** 花名册快照（只读）：种子 + 运行期新增 + 已保存状态 */
  function sandboxRoster() {
    var list = (window.RosterUtil && RosterUtil.all) ? RosterUtil.all() : (mockStudents || []);
    return list.map(function (s) {
      return {
        id: String(s.id), name: s.name, className: s.className || '未分班',
        grades: s.grades || '', homework: s.homework || '',
        attendance: s.attendance || '', lab: s.lab || '',
        labReport: s.labReport || '', codeQuality: s.codeQuality || ''
      };
    });
  }

  /**
   * 纯函数：用指定规则 + 阈值给整份花名册打分。不写任何存储。
   * @returns {{ok:boolean, error?:string, rows?:Array, counts?:object, total?:number, usable?:number}}
   */
  function sandboxScoreAll(ruleId, thresholds) {
    var plugin = RiskPluginManager.plugins[ruleId];
    if (!plugin) return { ok: false, error: '规则不存在：' + ruleId };
    var roster = sandboxRoster();
    if (!roster.length) return { ok: false, error: '花名册为空，数据不足，无法试算' };
    var usable = 0;
    var counts = { '高': 0, '中': 0, '低': 0 };
    var rows = roster.map(function (s) {
      if (s.grades || s.attendance || s.homework || s.labReport) usable++;
      var r = plugin.score({
        name: s.name, studentId: s.id, grades: s.grades, homework: s.homework,
        attendance: s.attendance, lab: s.lab, codeQuality: s.codeQuality, labReport: s.labReport
      }, thresholds);
      counts[r.level] = (counts[r.level] || 0) + 1;
      return { id: s.id, name: s.name, className: s.className, level: r.level, score: r.score };
    });
    return { ok: true, ruleId: ruleId, thresholds: thresholds, rows: rows, counts: counts, total: rows.length, usable: usable };
  }

  function sandboxRank(lv) { return lv === '高' ? 3 : (lv === '中' ? 2 : 1); }

  /** 两组试算结果做差异分析（纯函数） */
  function sandboxDiff(base, next) {
    var bmap = {};
    (base.rows || []).forEach(function (r) { bmap[r.id] = r; });
    var res = {
      newly: 0, downgraded: 0, escalated: 0, eased: 0, unchanged: 0,
      onlyNew: [], onlyOld: [], both: [], all: []
    };
    (next.rows || []).forEach(function (n) {
      var b = bmap[n.id];
      if (!b) return;
      var hitOld = b.level !== '低', hitNew = n.level !== '低';
      var item = {
        id: n.id, name: n.name, className: n.className,
        oldLevel: b.level, newLevel: n.level,
        oldScore: b.score, newScore: n.score, delta: n.score - b.score
      };
      res.all.push(item);
      if (b.level === n.level) res.unchanged++;
      else if (!hitOld && hitNew) res.newly++;
      else if (hitOld && !hitNew) res.downgraded++;
      else if (sandboxRank(n.level) > sandboxRank(b.level)) res.escalated++;
      else res.eased++;
      if (!hitOld && hitNew) res.onlyNew.push(item);
      else if (hitOld && !hitNew) res.onlyOld.push(item);
      else if (hitOld && hitNew) res.both.push(item);
    });
    return res;
  }

  function sandboxReadThresholds() {
    function num(id, dflt) {
      var el = document.getElementById(id);
      var v = el ? parseInt(el.value, 10) : NaN;
      return isNaN(v) ? dflt : v;
    }
    var base = sandboxDefaults(sandboxRuleSel ? sandboxRuleSel.value : 'basic');
    return {
      failLine: num('sbFailLine', base.failLine),
      attLine: num('sbAttLine', base.attLine),
      hwLine: num('sbHwLine', base.hwLine),
      labLine: num('sbLabLine', base.labLine)
    };
  }

  function sandboxFillThresholds(ruleId) {
    var d = sandboxDefaults(ruleId);
    var map = { sbFailLine: d.failLine, sbAttLine: d.attLine, sbHwLine: d.hwLine, sbLabLine: d.labLine };
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) el.value = map[id]; });
  }

  /** 执行一次试算（mode: 'vs' 对比当前生效规则；'ab' 与模态框里选的 B 规则对比） */
  function sandboxRun(mode, ruleBId) {
    var t0 = Date.now();
    var ruleA = sandboxRuleSel ? sandboxRuleSel.value : RiskPluginManager.getActive();
    var thA = sandboxReadThresholds();
    var active = RiskPluginManager.getActive();
    var ruleB = (mode === 'ab' && ruleBId) ? ruleBId : active;

    var a = sandboxScoreAll(ruleA, thA);
    if (!a.ok) { showToast(a.error); return null; }
    var b = sandboxScoreAll(ruleB, mode === 'ab' ? null : null);   // B 用其出厂阈值（即系统当前真实行为）

    sandboxState = {
      mode: mode || 'vs',
      a: { ruleId: ruleA, name: (RiskPluginManager.plugins[ruleA] || {}).name || ruleA, thresholds: thA, result: a },
      b: { ruleId: ruleB, name: (RiskPluginManager.plugins[ruleB] || {}).name || ruleB, thresholds: null, result: b },
      diff: sandboxDiff(b, a),
      elapsed: Date.now() - t0
    };
    openSandboxModal(sandboxState);
    return sandboxState;
  }

  /** 应用试算中的规则：这里是唯一允许"写"的地方，且只写当前生效规则 */
  function sandboxApply() {
    if (!sandboxState) { showToast('请先试算'); return; }
    var id = sandboxState.a.ruleId, nm = sandboxState.a.name;
    if (id === RiskPluginManager.getActive()) { showToast('该规则已经是当前生效规则'); return; }
    if (!confirm('确认切换到「' + nm + '」？\n\n切换后：\n· 只影响之后的判定\n· 历史预警不会被重新判定')) return;
    RiskPluginManager.setActive(id);
    updateRuleLabel();
    if (ruleSelector) ruleSelector.value = id;
    // 留痕：切换规则属于对全班风险等级的修改
    auditAccess('write', '', '', ['riskLevel']);
    showToast('已切换为「' + nm + '」，历史预警不会被重新判定');
    closeSandboxModal();
  }

  function sandboxCancel() {
    sandboxState = null;
    closeSandboxModal();
    showToast('已取消试算，系统状态未改变');
  }

  function closeSandboxModal() {
    var m = document.getElementById('sandboxModal');
    if (m) m.style.display = 'none';
    if (sandboxChart) { try { sandboxChart.dispose(); } catch (e) {} sandboxChart = null; }
  }

  function sandboxDiffTableHtml(list, emptyText) {
    if (!list.length) return '<div style="font-size:12px;color:var(--color-text-muted);padding:10px;">' + emptyText + '</div>';
    var h = '<table class="ledger-table" style="width:100%;font-size:12px;"><thead><tr>' +
      '<th>姓名</th><th>学号</th><th>班级</th><th>原等级</th><th>新等级</th><th>分数变化</th></tr></thead><tbody>';
    list.forEach(function (r) {
      var color = function (lv) { return lv === '高' ? '#c5221f' : lv === '中' ? '#e37400' : '#137333'; };
      var d = r.delta > 0 ? ('+' + r.delta) : String(r.delta);
      h += '<tr><td>' + escapeHtml(r.name) + '</td><td>' + escapeHtml(r.id) + '</td><td>' + escapeHtml(r.className) + '</td>' +
        '<td style="color:' + color(r.oldLevel) + ';">' + escapeHtml(r.oldLevel) + '</td>' +
        '<td style="color:' + color(r.newLevel) + ';">' + escapeHtml(r.oldLevel) + ' → ' + escapeHtml(r.newLevel) + '</td>' +
        '<td>' + escapeHtml(String(r.oldScore)) + ' → ' + escapeHtml(String(r.newScore)) + '（' + escapeHtml(d) + '）</td></tr>';
    });
    return h + '</tbody></table>';
  }

  function openSandboxModal(st) {
    var modal = document.getElementById('sandboxModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'sandboxModal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = '<div class="modal-panel modal-wide"><div class="modal-header">' +
        '<h2 class="modal-title">政策沙盒 · 影子模式试算</h2>' +
        '<button class="modal-close" id="sandboxModalClose">&times;</button></div>' +
        '<div class="modal-body" id="sandboxModalBody" style="max-height:72vh;overflow:auto;"></div></div>';
      document.body.appendChild(modal);
      document.getElementById('sandboxModalClose').addEventListener('click', closeSandboxModal);
      modal.addEventListener('click', function (e) { if (e.target === modal) closeSandboxModal(); });
    }
    var body = document.getElementById('sandboxModalBody');
    var a = st.a, b = st.b, d = st.diff;    var ruleOpts = RiskPluginManager.getNames().map(function (n) {
      return '<option value="' + n.id + '"' + (n.id === b.ruleId ? ' selected' : '') + '>' + escapeHtml(n.name) + '</option>';
    }).join('');

    var h = '<div style="padding:10px;background:#fff7e6;border:1px solid #ffd591;border-radius:4px;font-size:12px;color:#8c4a00;line-height:1.8;margin-bottom:12px;">' +
      '<strong>试算结果不会写入任何学生档案，仅供决策参考。</strong><br>切换规则只影响之后的判定，不追溯修改历史预警。</div>';

    h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;font-size:12px;flex-wrap:wrap;">' +
      '<span>试算规则 A：<strong>' + escapeHtml(a.name) + '</strong>' +
      '（阈值 不及格<' + a.thresholds.failLine + ' · 出勤<' + a.thresholds.attLine + '% · 作业<' + a.thresholds.hwLine + '% · 实验<' + a.thresholds.labLine + '%）</span>' +
      '<span style="color:var(--color-text-muted);">对比规则 B：</span>' +
      '<select id="sandboxRuleB" class="filter-select">' + ruleOpts + '</select>' +
      '<button class="btn btn-sm btn-outline" id="btnSandboxRerunB">用 B 重新对比</button>' +
      '<span style="color:var(--color-text-muted);">耗时 ' + st.elapsed + ' ms · 花名册 ' + a.result.total + ' 人</span>' +
      '</div>';

    if (!a.result.usable) {
      h += '<div style="padding:10px;background:var(--color-bg);border-radius:4px;font-size:12px;color:var(--color-text-muted);">数据不足：花名册中没有任何成绩/出勤/作业数据，无法给出有意义的试算结果。</div>';
    }

    h += '<div class="stat-cards" style="grid-template-columns:repeat(3,1fr);margin-bottom:6px;">' +
      '<div class="stat-card"><div class="stat-card-label">高风险（规则 A）</div><div class="stat-card-value" style="color:#c5221f;">' + a.result.counts['高'] + ' 人</div><div style="font-size:11px;color:var(--color-text-muted);">规则 B：' + b.result.counts['高'] + ' 人</div></div>' +
      '<div class="stat-card"><div class="stat-card-label">中风险（规则 A）</div><div class="stat-card-value" style="color:#e37400;">' + a.result.counts['中'] + ' 人</div><div style="font-size:11px;color:var(--color-text-muted);">规则 B：' + b.result.counts['中'] + ' 人</div></div>' +
      '<div class="stat-card"><div class="stat-card-label">低风险（规则 A）</div><div class="stat-card-value" style="color:#137333;">' + a.result.counts['低'] + ' 人</div><div style="font-size:11px;color:var(--color-text-muted);">规则 B：' + b.result.counts['低'] + ' 人</div></div>' +
      '</div>';

    h += '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;margin:10px 0;padding:8px 10px;background:var(--color-bg);border-radius:4px;">' +
      '<span>相比「' + escapeHtml(b.name) + '」：</span>' +
      '<span>新增预警 <strong style="color:#c5221f;">' + d.newly + '</strong> 条</span>' +
      '<span>降级 <strong style="color:#137333;">' + d.downgraded + '</strong> 条</span>' +
      '<span>等级加重 <strong>' + d.escalated + '</strong> 条</span>' +
      '<span>等级减轻 <strong>' + d.eased + '</strong> 条</span>' +
      '<span>不变 <strong>' + d.unchanged + '</strong> 条</span>' +
      '</div>';

    h += '<div id="sandboxChart" style="height:240px;margin-bottom:12px;"></div>';

    h += '<div style="font-size:13px;font-weight:600;margin-bottom:6px;">名单差异 <span style="font-weight:400;font-size:11px;color:var(--color-text-muted);">（"命中"= 判定为中/高风险）</span></div>' +
      '<div style="display:flex;gap:6px;margin-bottom:8px;">' +
      '<button class="ledger-btn" data-sbtab="onlyNew">仅规则 A 命中（' + d.onlyNew.length + '）</button>' +
      '<button class="ledger-btn" data-sbtab="onlyOld">仅规则 B 命中（' + d.onlyOld.length + '）</button>' +
      '<button class="ledger-btn" data-sbtab="both">两者都命中（' + d.both.length + '）</button>' +
      '<button class="ledger-btn" data-sbtab="all">全部（' + d.all.length + '）</button>' +
      '</div><div id="sandboxDiffTable"></div>';

    h += '<div style="display:flex;gap:8px;margin-top:14px;">' +
      '<button class="btn btn-sm btn-primary" id="btnSandboxApplyInModal">应用此规则（' + escapeHtml(a.name) + '）</button>' +
      '<button class="btn btn-sm btn-outline" id="btnSandboxCancelInModal">取消</button>' +
      '</div>';

    body.innerHTML = h;

    // 必须先让弹层可见再做任何"依赖尺寸"的渲染（ECharts 在 display:none 的容器里
    // 初始化会得到 0×0 画布，表现为图表区一片空白）
    modal.style.display = '';

    var tabsData = { onlyNew: d.onlyNew, onlyOld: d.onlyOld, both: d.both, all: d.all };
    var emptyTexts = { onlyNew: '没有"仅规则 A 命中"的学生', onlyOld: '没有"仅规则 B 命中"的学生', both: '没有"两者都命中"的学生', all: '没有可比对的学生' };
    function showTab(key) {
      var box = document.getElementById('sandboxDiffTable');
      if (box) box.innerHTML = sandboxDiffTableHtml(tabsData[key] || [], emptyTexts[key] || '');
    }
    body.querySelectorAll('[data-sbtab]').forEach(function (btn) {
      btn.addEventListener('click', function () { showTab(this.getAttribute('data-sbtab')); });
    });
    showTab('onlyNew');

    var rerunBtn = document.getElementById('btnSandboxRerunB');
    if (rerunBtn) rerunBtn.addEventListener('click', function () {
      var sel = document.getElementById('sandboxRuleB');
      sandboxRun('ab', sel ? sel.value : null);
    });
    var applyBtn = document.getElementById('btnSandboxApplyInModal');
    if (applyBtn) applyBtn.addEventListener('click', sandboxApply);
    var cancelBtn = document.getElementById('btnSandboxCancelInModal');
    if (cancelBtn) cancelBtn.addEventListener('click', sandboxCancel);

    // 柱状图：新旧规则三档人数对比（复用本地 echarts，不引入新库）
    var chartEl = document.getElementById('sandboxChart');
    if (chartEl && window.echarts) {
      if (sandboxChart) { try { sandboxChart.dispose(); } catch (e) {} }
      sandboxChart = echarts.init(chartEl);
      sandboxChart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['规则 B：' + b.name, '规则 A：' + a.name], top: 0 },
        grid: { left: 40, right: 20, top: 40, bottom: 30 },
        xAxis: { type: 'category', data: ['高风险', '中风险', '低风险'] },
        yAxis: { type: 'value', minInterval: 1 },
        series: [
          { name: '规则 B：' + b.name, type: 'bar', data: [b.result.counts['高'], b.result.counts['中'], b.result.counts['低']], itemStyle: { color: '#8ab4f8' } },
          { name: '规则 A：' + a.name, type: 'bar', data: [a.result.counts['高'], a.result.counts['中'], a.result.counts['低']], itemStyle: { color: '#1a73e8' } }
        ]
      });
    }

    modal.style.display = '';
  }

  var sandboxRuleSel = document.getElementById('sandboxRule');
  var btnSandboxRun = document.getElementById('btnSandboxRun');
  var btnSandboxCompare = document.getElementById('btnSandboxCompare');
  var btnSandboxReset = document.getElementById('btnSandboxReset');

  /* 只读诊断接口：供自动化验收脚本独立核对"零副作用"与试算数字。
   * 只暴露纯计算函数与最近一次试算结果，**不提供任何写入能力**。 */
  window.PolicySandbox = {
    scoreAll: function (ruleId, thresholds) { return sandboxScoreAll(ruleId, thresholds || sandboxDefaults(ruleId)); },
    diff: sandboxDiff,
    defaults: sandboxDefaults,
    peek: function () { return sandboxState ? { mode: sandboxState.mode, elapsed: sandboxState.elapsed, a: sandboxState.a, b: sandboxState.b, diff: sandboxState.diff } : null; }
  };

  function initSandbox() {
    if (!sandboxRuleSel) return;
    sandboxRuleSel.innerHTML = RiskPluginManager.getNames().map(function (n) {
      return '<option value="' + n.id + '">' + escapeHtml(n.name) + '</option>';
    }).join('');
    sandboxRuleSel.value = RiskPluginManager.getActive();
    sandboxFillThresholds(sandboxRuleSel.value);
    sandboxRuleSel.addEventListener('change', function () { sandboxFillThresholds(this.value); });
    if (btnSandboxRun) btnSandboxRun.addEventListener('click', function () { sandboxRun('vs'); });
    if (btnSandboxCompare) {
      btnSandboxCompare.addEventListener('click', function () {
        // A/B 版本对比：B 默认取一个与 A 不同的规则（弹层里可再改）
        var a = sandboxRuleSel.value, other = null;
        var names = RiskPluginManager.getNames();
        for (var i = 0; i < names.length; i++) { if (names[i].id !== a) { other = names[i].id; break; } }
        sandboxRun('ab', other || a);
      });
    }
    if (btnSandboxReset) {
      btnSandboxReset.addEventListener('click', function () {
        sandboxFillThresholds(sandboxRuleSel.value);
        showToast('已恢复该规则的默认阈值');
      });
    }
  }

  function updateRuleLabel() {    var active = RiskPluginManager.getActive();

    var plugin = RiskPluginManager.plugins[active];

    if (currentRuleLabel) currentRuleLabel.textContent = plugin ? '(' + plugin.name + ')' : '';

  }



  function applyRule() {

    if (!ruleSelector) return;

    var newRule = ruleSelector.value;

    RiskPluginManager.setActive(newRule);

    updateRuleLabel();

    // Recalculate all students

    for (var i = 0; i < mockStudents.length; i++) {

      var s = mockStudents[i];

      var result = RiskPluginManager.score({

        name: s.name, studentId: s.id, grades: s.grades || '',

        homework: s.homework || '', attendance: s.attendance || '',

        lab: s.lab || '', codeQuality: s.codeQuality || '', labReport: s.labReport || ''

      });

      s._riskLevel = result.level;

      s._riskScore = result.score;

      // 批量重算也是一次"修改"，逐生留痕（学生端能看到自己的等级被改过）
      auditAccess('write', s.id, s.name, ['riskLevel', 'riskScore']);

    }

    saveStudentStates();

    renderSidebar(sidebarSearch ? sidebarSearch.value : '');

    if (selectedStudentId) selectStudent(selectedStudentId);

    showToast('已切换为：' + (RiskPluginManager.plugins[newRule] ? RiskPluginManager.plugins[newRule].name : newRule));

    if (settingsPanel) settingsPanel.style.display = 'none';

  }



  function renderScoreDetail(scoringResult) {

    if (!scoreDetail || !scoringResult || !scoringResult.details) return;

    scoreDetail.style.display = '';

    var activePlugin = RiskPluginManager.plugins[RiskPluginManager.getActive()];

    var ruleName = activePlugin ? activePlugin.name : '加权综合版';

    var levelText = scoringResult.level === '高' ? '高风险' : scoringResult.level === '中' ? '中风险' : '低风险';

    var levelCls = scoringResult.level === '高' ? 'risk-high' : scoringResult.level === '中' ? 'risk-medium' : 'risk-low';

    var html = '';

    // 总分概览

    html += '<div class="score-overview">';

    html += '<div class="score-overview-left"><span class="score-big">' + scoringResult.score + '</span><span class="score-unit">分</span></div>';

    html += '<div class="score-overview-right"><span class="risk-badge ' + levelCls + '">' + levelText + '</span><span class="score-rule-name">' + ruleName + '</span></div>';

    html += '</div>';

    // 明细表格

    html += '<table class="score-table"><thead><tr><th>考核指标</th><th>单项得分</th><th>权重占比</th><th>扣分说明</th></tr></thead><tbody>';

    scoringResult.details.forEach(function(d) {

      var penalty = (d.maxScore && d.score < d.maxScore) || (d.score < 60) || (d.penalty && d.penalty > 0);

      var rowCls = penalty ? ' score-row-penalty' : ' score-row-ok';

      var penaltyNote = penalty ? (d.penalty ? '-' + d.penalty : '-' + (100 - (d.score || 0))) : '正常';

      html += '<tr class="' + rowCls + '"><td>' + d.field + '</td><td>' + (d.score || 0) + '</td><td>' + (d.weight ? (d.weight * 100).toFixed(0) + '%' : '-') + '</td><td>' + penaltyNote + '</td></tr>';

    });

    html += '</tbody></table>';

    // 规则说明按钮

    html += '<div class="score-footer"><button class="btn btn-text" id="viewRuleBtn">查看评分规则</button></div>';

    scoreDetail.innerHTML = html;

    // Bind rule view button

    var btn = document.getElementById('viewRuleBtn');

    if (btn) {

      btn.addEventListener('click', function() {

        var desc = activePlugin ? activePlugin.description : '';

        if (!desc) { showToast('暂无规则说明'); return; }

        // Create simple alert/modal

        var ruleModal = document.getElementById('ruleDescModal');

        if (!ruleModal) {

          ruleModal = document.createElement('div');

          ruleModal.id = 'ruleDescModal';

          ruleModal.className = 'modal-overlay';

          ruleModal.style.display = '';

          ruleModal.innerHTML = '<div class="modal-panel" style="max-width:480px;"><div class="modal-header"><h2 class="modal-title">' + ruleName + ' - 评分标准</h2><button class="modal-close" id="ruleModalClose">&times;</button></div><div class="modal-body" style="font-size:13px;line-height:1.8;">' + desc + '</div></div>';

          document.body.appendChild(ruleModal);

          document.getElementById('ruleModalClose').addEventListener('click', function() { ruleModal.remove(); });

          ruleModal.addEventListener('click', function(e) { if (e.target === ruleModal) ruleModal.remove(); });

        }

      });

    }

  }



  function initDemoPlans() {
    for (var ip = 0; ip < mockStudents.length; ip++) {
      var s = mockStudents[ip];
      if (s.supportPlan && s.supportPlan.weeks && s.supportPlan.weeks.length > 0) continue;
      // Generate demo plan: 2 weeks, 3 days each
      var items1 = [];
      for (var d = 0; d < 3; d++) {
        var kb = knowledgeBase[d % knowledgeBase.length];
        items1.push({ day: d+1, task: '学习《' + kb.title + '》', resource: (kb.resources||['讲义'])[0], duration: '2h', knowledgeId: kb.id, item: kb });
      }
      var items2 = [];
      for (var d2 = 0; d2 < 3; d2++) {
        var kb2 = knowledgeBase[(d2+3) % knowledgeBase.length];
        items2.push({ day: d2+1, task: '复习《' + kb2.title + '》并完成习题', resource: '习题集', duration: '1.5h', knowledgeId: kb2.id, item: kb2 });
      }
      s.supportPlan = { status: 'draft', createdAt: formatTime(new Date()), weeks: [
        { week: 1, title: '第 1 周', items: items1 },
        { week: 2, title: '第 2 周', items: items2 }
      ], history: [{action:'系统初始化',time:formatTime(new Date()),operator:'系统'}] };
    }
  }

  // ================================================================
  //  身份标签 + 首轮引导
  // ================================================================

  function setupIdentity() {
    if (!window.Session) return;
    var box = document.getElementById('identityBox');
    if (box) window.Session.mountChip(box);
    var replay = document.getElementById('replayTourBtn');
    if (replay) replay.addEventListener('click', function () {
      if (window.Onboarding) window.Onboarding.start('teacher', { force: true });
    });
  }

  function setupOnboarding() {
    if (!window.Onboarding) return;
    window.Onboarding.defineSteps('teacher', [
      { target: '#sidebarTree',
        before: function () { if (typeof closeModal === 'function') closeModal(); switchTab('detail'); showDashboard(); },
        title: '这里是你的班级花名册',
        body: '左侧按班级分组列出全部学生，名字前的圆点就是风险等级：<br><b style="color:#0d904f">绿=低</b> · <b style="color:#e37400">橙=中</b> · <b style="color:#d93025">红=高</b>。<br>点击任意学生即可查看他的画像与预警详情。' },
      { target: '#addStudentBtn',
        title: '第一步：把名单录进来',
        body: '可以点「新增学生」单独录入，也可以用「批量导入」上传 CSV 成绩单（支持学号/姓名/班级/各科成绩/出勤率等列）。<br>名单会被持久化，下次启动依然在。' },
      { target: '#studentForm',
        before: function () { openModal(false); },
        title: '第二步：跑一次预警分析',
        body: '填好成绩、作业、出勤后提交，系统会依次运行 <b>预警分析师 → 帮扶规划师 → 执行监督员</b> 三个 Agent，输出风险等级、帮扶方案和核查结论。<br>未配置密钥时会自动降级为模拟结果，流程仍然完整。' },
      { target: '#settingsNav',
        before: function () { if (typeof closeModal === 'function') closeModal(); var sp = document.getElementById('settingsPanel'); if (sp) sp.style.display = ''; },
        title: '第三步：选一套评分规则',
        body: '内置三套可插拔规则：<code>基础宽松版</code> / <code>加权综合版</code> / <code>严格预警版</code>。<br>点「应用并重算」后，全班风险等级会立刻按新规则刷新。' },
      { target: '#knowledgeTree',
        before: function () { switchTab('knowledge'); },
        title: '配套的课程知识库',
        body: '5 门课 / 25 个知识点，用于把预警因素映射成可执行的学习资源。<br>你还可以在「知识库管理」里上传 txt/csv/xlsx 文档扩充知识点。' },
      { target: '#btnStartDemo',
        before: function () { switchTab('detail'); showDashboard(); },
        title: '想快速看全流程？',
        body: '点右下角「启动演示」会自动跑完一整套流程（录入 → 预警 → 帮扶计划 → 打卡核验 → 错题回流），适合答辩前热身。<br>之后想再看这个引导，点右上角「使用引导」即可。' }
    ]);
    window.Onboarding.maybeAutoStart('teacher');
  }

  /* ================================================================
   *  DemoSeed 钩子（一键载入完整演示数据用）
   *  把这些内部数据结构收在 app.js 里，demoSeed.js 只调用、不复制格式，
   *  将来改内部结构时不会出现"种子数据格式漂移"。
   * ================================================================ */
  function initDemoSeedHooks() {
    window.DemoSeedHooks = {
      roster: function () { return mockStudents || []; },
      setStatus: function (studentId, status) {
        for (var i = 0; i < mockStudents.length; i++) {
          if (String(mockStudents[i].id) === String(studentId)) { mockStudents[i].status = status; return true; }
        }
        return false;
      },
      writeSnapshot: function (studentId) { return !!writeWarningSnapshot(studentId); },
      getSnapshot: function (studentId) {
        var all = loadSnapshots();
        return (all && all[studentId]) ? all[studentId] : null;
      },
      addHistory: function (studentId) {
        var stu = findStudentById(studentId);
        if (!stu) return false;
        var data = {
          name: stu.name, studentId: stu.id,
          grades: stu.grades || '', homework: stu.homework || '', attendance: stu.attendance || '',
          lab: stu.lab || '', codeQuality: stu.codeQuality || '', labReport: stu.labReport || ''
        };
        var scored = RiskPluginManager.score(data);
        addToHistory({
          studentId: stu.id,
          studentName: stu.name,
          timestamp: formatTime(new Date()),
          riskAnalysis: { level: scored.level, score: scored.score },
          source: '演示数据'
        });
        return true;
      },
      commit: function () { saveStudentStates(); loadStudentStates(); return true; },
      refresh: function () {
        renderSidebar();
        renderDashboard();
        if (typeof renderLedger === 'function') renderLedger();
        return true;
      }
    };
    if (window.DemoSeed) window.DemoSeedReady = true;
  }

  /** 「一键载入数据」：把 localStorage 写满，让评审打开就能看到完整状态 */
  function bindDemoSeedButton() {
    var btn = document.getElementById('btnSeedDemo');
    if (!btn || !window.DemoSeed) return;
    btn.addEventListener('click', function () {
      if (!confirm('载入完整演示数据？\n\n会写入：学生风险状态、判定快照、预警历史、帮扶工单、案例库（含已结案/已升级）、\n申诉（待复核/已采纳/已驳回）、多源行为数据与逐人授权、错题本、访问审计日志。\n\n· 不含任何真实个人信息，全部为本地生成的演示数据\n· 会先清空上述演示数据再写入（登录状态与引导标记保留）\n\n确认继续？')) return;
      btn.disabled = true;
      var old = btn.textContent;
      btn.textContent = '载入中…';
      setTimeout(function () {
        var r = window.DemoSeed.seed({ fresh: true });
        btn.disabled = false;
        btn.textContent = old;
        if (!r) { showToast('载入失败'); return; }
        var s = r.stats;
        var msg = '演示数据已载入：学生 ' + s.students + ' · 快照 ' + s.snapshots + ' · 工单 ' + s.tickets
          + ' · 案例 ' + s.cases + ' · 申诉 ' + s.appeals + ' · 行为数据 ' + s.signals
          + ' 人（已授权 ' + s.consents + '）';
        showToast(msg);
        if (r.errors && r.errors.length) console.warn('[DemoSeed] 部分步骤失败：', r.errors);
        showDashboard();
      }, 60);
    });
  }

  function init() { initDemoPlans(); updateApiBadge(); initSettings(); initSandbox(); loadStudentStates(); loadHistory(); renderSidebar(); bindEvents(); setupOcrEvents(); setupDropEvents(); switchTab('detail'); showDashboard(); setupIdentity(); setupOnboarding(); initFocusPanel(); initDemoSeedHooks(); bindDemoSeedButton(); }



  function updateApiBadge() { if (!apiModeBadge) return;

    if (isMock) { apiModeBadge.textContent = '\u6a21\u62df\u6a21\u5f0f'; apiModeBadge.className = 'badge badge-mock'; }

    else { apiModeBadge.textContent = '\u771f\u5b9e\u6a21\u5f0f'; apiModeBadge.className = 'badge badge-real'; }

  }



  function bindEvents() {

    if (studentForm) studentForm.addEventListener('submit', handleSubmit);

    if (clearBtn) clearBtn.addEventListener('click', function () { studentForm.reset(); hideFormError(); });

    if (retryBtn) retryBtn.addEventListener('click', handleRetry);

    if (btnStartDemo) btnStartDemo.addEventListener('click', function () { if (demoRunning) stopDemo(); else startDemo(); });

    exportBtn.addEventListener('click', function() { handleExport(false); });

    if (exportReportBtn) exportReportBtn.addEventListener('click', handleExportReport);

    if (newAnalysisBtn) newAnalysisBtn.addEventListener('click', handleNewAnalysis);

    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', handleClearHistory);

    if (addStudentBtn) addStudentBtn.addEventListener('click', function () { openModal(false); });

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

    if (editStudentBtn) editStudentBtn.addEventListener('click', function () { openModal(true); });

    if (analyzeStudentBtn) analyzeStudentBtn.addEventListener('click', function () {

      openModal(false);

      if (selectedStudentId) {

        var student = null;

        for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === selectedStudentId) { student = mockStudents[i]; break; } }

        if (student) {

          document.getElementById('studentName').value = student.name || '';

          document.getElementById('studentId').value = student.id || '';

          if (studentClassField) studentClassField.value = student.className || '';

          document.getElementById('studentGrades').value = student.grades || '';

          document.getElementById('studentHomework').value = student.homework || '';

          document.getElementById('studentAttendance').value = student.attendance || '';

          if (studentLabField) studentLabField.value = student.lab || '';

          if (studentCodeQualityField) studentCodeQualityField.value = student.codeQuality || '';

          if (studentLabReportField) studentLabReportField.value = student.labReport || '';

        }

      }

    });

    if (studentModal) { studentModal.addEventListener('click', function (e) { if (e.target === studentModal) closeModal(); }); }

    if (sidebarSearch) sidebarSearch.addEventListener('input', filterSidebar);
    if (sidebarStatusFilter) sidebarStatusFilter.addEventListener('change', function() {
      renderSidebar(sidebarSearch ? sidebarSearch.value : '');
    });

    if (knowledgeSearch) knowledgeSearch.addEventListener('input', function() { var q = this.value; var results = searchKnowledge(q); highlightedKnowledgeId = null; renderKnowledgeTreeFiltered(results); });

    for (var t = 0; t < tabItems.length; t++) {

      tabItems[t].addEventListener('click', function () {

        var tabName = this.getAttribute('data-tab');

        switchTab(tabName);

        selectedTab = tabName;

        if (tabName === 'history') { loadHistory(); if (selectedStudentId) renderOperationLog(selectedStudentId); renderLedger(); }

      });

    }

    var navItems = document.querySelectorAll('.nav-item');

    var NAV_LABEL = { warning: '学情预警', knowledge: '课程知识库', classroom: '班级管理', flow: '任务流', settings: '系统设置' };

    for (var n = 0; n < navItems.length; n++) {

      navItems[n].addEventListener('click', function () {

        for (var j = 0; j < navItems.length; j++) navItems[j].classList.remove('active');

        var nav = this.getAttribute('data-nav');

        setTabBarModule(NAV_LABEL[nav] || '学情预警');

        if (nav === 'classroom') { this.classList.add('active'); openImportModal(); }

        else if (nav === 'knowledge') { this.classList.add('active'); switchTab('knowledge'); }

        else if (nav === 'settings') { if (settingsPanel) { var sp = settingsPanel; sp.style.display = sp.style.display === 'none' ? '' : 'none'; } renderAccessSummary(); this.classList.add('active'); }

        else if (nav === 'flow') { this.classList.add('active'); switchTab('flow'); }

        else if (nav === 'warning') { this.classList.add('active'); showDashboard(); }

        else { showToast('模块开发中'); this.classList.add('active'); }

      });

    }

    if (importModalCloseBtn) importModalCloseBtn.addEventListener('click', closeImportModal);

    if (importCancelBtn) importCancelBtn.addEventListener('click', closeImportModal);

    if (importModal) importModal.addEventListener('click', function(e) { if (e.target === importModal) closeImportModal(); });

    if (importDropZone) {

      importDropZone.addEventListener('click', function() { if (importFileInput) importFileInput.click(); });

      importDropZone.addEventListener('dragover', function(e) { e.preventDefault(); });

      importDropZone.addEventListener('drop', function(e) { e.preventDefault(); var files = e.dataTransfer.files; if (files && files.length > 0) handleImportFile(files[0]); });

    }

    if (importFileInput) importFileInput.addEventListener('change', function() { if (this.files && this.files[0]) handleImportFile(this.files[0]); });

    if (importConfirmBtn) importConfirmBtn.addEventListener('click', confirmImport);

    if (filterClass) filterClass.addEventListener('change', applyLedgerFilters);

    if (filterRisk) filterRisk.addEventListener('change', applyLedgerFilters);

    if (filterSearch) filterSearch.addEventListener('input', function() { currentLedgerFilters.search = this.value.toLowerCase(); renderLedger(); });

    if (exportLedgerBtn) exportLedgerBtn.addEventListener('click', exportLedger);

    if (applyRuleBtn) applyRuleBtn.addEventListener('click', applyRule);
    if (btnUpgrade) btnUpgrade.addEventListener('click', function() {
      if (!selectedStudentId) return;
      var student = null;
      for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === selectedStudentId) { student = mockStudents[i]; break; } }
      if (!student) return;
      var newLevel = student._riskLevel === '低' ? '中' : '高';
      student._riskLevel = newLevel;
      changeStudentStatus(selectedStudentId, 'escalated');
      addOperationLog(selectedStudentId, 'manual_upgrade', '手动升级预警为' + (newLevel === '高' ? '高风险' : '中风险'));
      selectStudent(selectedStudentId);
      saveStudentStates();
      renderSidebar();
      showToast('预警已升级为' + (newLevel === '高' ? '高风险' : '中风险'));
    });
    if (btnApprovePlan) btnApprovePlan.addEventListener('click', approvePlan);
    if (btnRejectPlan) btnRejectPlan.addEventListener('click', rejectPlan);
    if (btnEditPlan) btnEditPlan.addEventListener('click', editPlan);
    if (ckDateFilter) ckDateFilter.addEventListener('change', renderCheckinTable);
    if (ckStatusFilter) ckStatusFilter.addEventListener('change', renderCheckinTable);
    if (ckVerifyFilter) ckVerifyFilter.addEventListener('change', renderCheckinTable);
    if (ckSearch) ckSearch.addEventListener('input', renderCheckinTable);
    if (ckSelectAll) ckSelectAll.addEventListener('change', function() { var cbs = ckTableBody.querySelectorAll('.ck-checkbox'); cbs.forEach(function(cb) { cb.checked = this.checked; }.bind(this)); });
    if (btnBatchApprove) btnBatchApprove.addEventListener('click', function() { batchVerify('approved'); });
    if (btnBatchReject) btnBatchReject.addEventListener('click', function() { batchVerify('rejected'); });
    if (document.getElementById('btnOcrDemo')) document.getElementById('btnOcrDemo').addEventListener('click', realOcrWithImage);
    if (document.getElementById('btnAsrDemo')) document.getElementById('btnAsrDemo').addEventListener('click', realAsrLive);
    if (document.getElementById('btnAsrFile')) document.getElementById('btnAsrFile').addEventListener('click', realAsrFile);
    if (document.getElementById('asrFileInput')) document.getElementById('asrFileInput').addEventListener('change', function () { var f = this.files && this.files[0]; if (f) handleAsrFile(f); this.value = ''; });
    if (document.getElementById('btnQaDemo')) document.getElementById('btnQaDemo').addEventListener('click', realQa);
    if (document.getElementById('btnAgentConfig')) document.getElementById('btnAgentConfig').addEventListener('click', openAgentConfig);
    if (document.getElementById('btnTalentSort')) document.getElementById('btnTalentSort').addEventListener('click', function () {
      talentSortDesc = !talentSortDesc;
      this.textContent = '按优势得分排序 ' + (talentSortDesc ? '↓' : '↑');
      renderTalentList();
    });
    if (document.getElementById('btnTalentExport')) document.getElementById('btnTalentExport').addEventListener('click', exportTalentList);
    if (document.getElementById('agentModalClose')) document.getElementById('agentModalClose').addEventListener('click', function() { agentModal.style.display = 'none'; saveAgentConfig(); });
    if (agentModal) agentModal.addEventListener('click', function(e) { if (e.target === agentModal) { agentModal.style.display = 'none'; saveAgentConfig(); } });
    var agentTabs = agentModal ? agentModal.querySelectorAll('.tab-item') : [];
    agentTabs.forEach(function(t) { t.addEventListener('click', function() { currentAgent = normalizeAgentKey(this.getAttribute('data-agent')); saveAgentConfig(); renderAgentTab(); }); });
    if (document.getElementById('agentTemp')) document.getElementById('agentTemp').addEventListener('input', function() { document.getElementById('tempVal').textContent = this.value; });
    if (document.getElementById('agentTokens')) document.getElementById('agentTokens').addEventListener('input', function() { document.getElementById('tokenVal').textContent = this.value; });
    if (document.getElementById('btnResetPrompt')) document.getElementById('btnResetPrompt').addEventListener('click', resetAgentPrompt);
    if (document.getElementById('btnTestAgent')) document.getElementById('btnTestAgent').addEventListener('click', testAgent);
    if (exportDropdownWrap) {
      document.getElementById('btnExportDropdown').addEventListener('click', toggleExportMenu);
      exportDropdownMenu.querySelectorAll('.dropdown-item').forEach(function(item) {
        item.addEventListener('click', function() {
          var type = this.getAttribute('data-export');
          if (type === 'students') { exportStudentsXLSX(); auditAccess('export', '', '', ['name', 'studentId', 'className', 'grades', 'riskLevel', 'status']); }
          else if (type === 'tickets') { exportTicketsXLSX(); auditAccess('export', '', '', ['ticketId', 'studentId', 'type', 'status']); }
          else if (type === 'checkin') { exportCheckinXLSX(); auditAccess('export', '', '', ['studentId', 'date', 'verified']); }
          exportDropdownMenu.style.display = 'none';
          showToast('报表已导出');
        });
      });
    }
    if (ckDetailClose) ckDetailClose.addEventListener('click', function() { ckDetailModal.style.display = 'none'; });
    if (ckDetailModal) ckDetailModal.addEventListener('click', function(e) { if (e.target === ckDetailModal) ckDetailModal.style.display = 'none'; });
    if (kbAdminSearch) kbAdminSearch.addEventListener('input', renderKbAdmin);
    if (document.getElementById('btnAddKb')) document.getElementById('btnAddKb').addEventListener('click', function() { openKbEdit(null); });
    if (document.getElementById('btnSimUpload')) document.getElementById('btnSimUpload').addEventListener('click', realKbUpload);
    if (document.getElementById('btnKbTest')) document.getElementById('btnKbTest').addEventListener('click', kbTestSearch);
    if (document.getElementById('btnKbSave')) document.getElementById('btnKbSave').addEventListener('click', saveKbEntry);
    if (document.getElementById('kbEditClose')) document.getElementById('kbEditClose').addEventListener('click', function() { kbEditModal.style.display = 'none'; });
    if (kbEditModal) kbEditModal.addEventListener('click', function(e) { if (e.target === kbEditModal) kbEditModal.style.display = 'none'; });
    if (btnResolve) btnResolve.addEventListener('click', function() {
      if (!selectedStudentId) return;
      if (!confirm('确认标记为已办结？')) return;
      changeStudentStatus(selectedStudentId, 'resolved');
      addOperationLog(selectedStudentId, 'manual_resolve', '手动标记已办结');
      selectStudent(selectedStudentId);
      saveStudentStates();
      renderSidebar();
      showToast('工单已办结');
    });

    if (resultContent) {

      resultContent.addEventListener('click', function (e) {

        var btn = e.target.closest('[data-action]');

        if (btn) { e.preventDefault(); handleCardAction(btn.getAttribute('data-action')); }

      });

    }

    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && studentModal && studentModal.style.display !== 'none') closeModal(); });

  }



  // ================================================================

  //  表单处理

  // ================================================================

  function validateFormInput() {

    var errors = [];

    var id = document.getElementById('studentId').value.trim();

    if (id && !/^\d{6,12}$/.test(id)) errors.push('学号格式不正确（6-12位数字）');

    var grades = document.getElementById('studentGrades').value.trim();

    var scores = grades.match(/(\d+)\s*分/g);

    if (scores) {

      for (var i = 0; i < scores.length; i++) {

        var s = parseInt(scores[i].match(/\d+/)[0]);

        if (s < 0 || s > 100) { errors.push('成绩分数应在0-100之间（发现: ' + s + '）'); break; }

      }

    }

    return errors;

  }



    function handleSubmit(e) {

    e.preventDefault();

    var name = document.getElementById('studentName').value.trim();

    var id = document.getElementById('studentId').value.trim();

    if (!name) { showFormError('\u8bf7\u8f93\u5165\u5b66\u751f\u59d3\u540d'); return; }

    if (!id) { showFormError('\u8bf7\u8f93\u5165\u5b66\u53f7'); return; }

    hideFormError();

    var className = studentClassField ? studentClassField.value.trim() : '';

    var data = {

      name: name, studentId: id, className: className,

      grades: document.getElementById('studentGrades').value.trim(),

      homework: document.getElementById('studentHomework').value.trim(),

      attendance: document.getElementById('studentAttendance').value.trim(),

      lab: studentLabField ? studentLabField.value.trim() : '',

      codeQuality: studentCodeQualityField ? studentCodeQualityField.value.trim() : '',

      labReport: studentLabReportField ? studentLabReportField.value.trim() : ''

    };

    lastSubmittedData = data;

    if (editingStudentId) {

      for (var i = 0; i < mockStudents.length; i++) {

        if (mockStudents[i].id === editingStudentId) { mockStudents[i].name = name; mockStudents[i].id = id; mockStudents[i].className = className; mockStudents[i].grades = data.grades; mockStudents[i].homework = data.homework; mockStudents[i].attendance = data.attendance; delete mockStudents[i]._riskLevel; break; }

      }

    } else {

      var exists = false;

      for (var j = 0; j < mockStudents.length; j++) {

        if (mockStudents[j].id === id) { mockStudents[j].name = name; mockStudents[j].className = className; mockStudents[j].grades = data.grades; mockStudents[j].homework = data.homework; mockStudents[j].attendance = data.attendance;

          mockStudents[j].lab = data.lab || '';

          mockStudents[j].codeQuality = data.codeQuality || '';

          mockStudents[j].labReport = data.labReport || ''; delete mockStudents[j]._riskLevel; exists = true; break; }

      }

      if (!exists) mockStudents.push({ id: id, name: name, className: className || '\u672a\u5206\u73ed', grades: data.grades, homework: data.homework, attendance: data.attendance, lab: data.lab||'', codeQuality: data.codeQuality||'', labReport: data.labReport||'' });

    }

    closeModal();

    selectedStudentId = id;

    renderSidebar(sidebarSearch ? sidebarSearch.value : '');

    selectStudent(id);

    showResultUI('loading');

    setSubmitting(true);

    runStepper(function () {});

    callAPI(data).then(function (result) { finishStepper(); setTimeout(function () { handleResult(result); }, 600); }).catch(function (err) { handleError(err); });

  }



  function handleRetry() {

    if (lastSubmittedData) {

      showResultUI('loading'); setSubmitting(true); runStepper(function () {});

      callAPI(lastSubmittedData).then(function (result) { finishStepper(); setTimeout(function () { handleResult(result); }, 600); }).catch(function (err) { handleError(err); });

    }

  }



  function handleNewAnalysis() { showResultUI('empty'); currentResult = null; }



  function setSubmitting(disabled) { submitBtn.disabled = disabled; submitBtnText.textContent = disabled ? '\u5206\u6790\u4e2d...' : '\ud83d\udd0d \u63d0\u4ea4\u5206\u6790'; }



  // ================================================================

  //  步进器

  // ================================================================

  function resetStepper() { [step1, step2, step3].forEach(function (s) { s.className = 'step'; }); stepLines.forEach(function (l) { l.className = 'step-line'; }); }

  function activateStep(stepIndex, callback) { var steps = [step1, step2, step3]; var step = steps[stepIndex]; step.className = 'step active'; setTimeout(function () { step.className = 'step done'; if (stepIndex < 2) stepLines[stepIndex].className = 'step-line done'; if (callback) callback(); }, 400); }

  function runStepper(finalCallback) { resetStepper(); setTimeout(function () { activateStep(0, function () { setTimeout(function () { activateStep(1, function () { if (finalCallback) finalCallback(); }); }, 300); }); }, 200); }

  function finishStepper() { step3.className = 'step active'; setTimeout(function () { step3.className = 'step done'; stepLines[1].className = 'step-line done'; }, 400); }



  // ================================================================

  //  结果渲染

  // ================================================================

  function handleResult(result) {

    currentResult = result; setSubmitting(false); showResultUI('result');

    if (supportActions) supportActions.style.display = '';

    if (auditActions) auditActions.style.display = '';

    if (exportReportBtn) exportReportBtn.style.display = '';
    // Generate ticket ID if first analysis
    if (!result.ticketId) {
      for (var ti = 0; ti < mockStudents.length; ti++) {
        if (mockStudents[ti].id === result.studentId) {
          if (!mockStudents[ti].ticketId) {
            mockStudents[ti].ticketId = 'WT-' + result.studentId + '-' + new Date().toISOString().slice(2,10).replace(/-/g,'');
            mockStudents[ti].ticketTime = result.timestamp;
            mockStudents[ti].ticketReason = (result.riskAnalysis.factors || []).slice(0,3).join('；');
          }
          result.ticketId = mockStudents[ti].ticketId;
          result.ticketTime = mockStudents[ti].ticketTime;
          result.ticketReason = mockStudents[ti].ticketReason;
          break;
        }
      }
    }

    renderResultCards(result); addToHistory(result); updateStudentRiskInSidebar(result);

    // 预警解释快照：在"生成预警"这一刻把判定依据固化下来。
    // 为什么必须快照而不能实时重算：规则（riskPluginActive）随时可被教师切换，
    // 如果申诉时用"现在的规则"重算，结论可能和当初完全不同，申诉就成了打移动靶。
    writeWarningSnapshot(result.studentId);

    // 快照刚更新过，证据链条区块要同步刷新（否则会停在"暂无关联证据"）
    if (typeof renderEvidenceCard === 'function') renderEvidenceCard();
    // Generate support plan from knowledge matches
    var factors = result.riskAnalysis.factors || [];
    var matchedKb = typeof matchKnowledge !== 'undefined' ? matchKnowledge(factors) : [];
    // Fallback: always include at least 5 knowledge items
    if (matchedKb.length < 3 && typeof knowledgeBase !== 'undefined') {
      for (var fbi = 0; fbi < Math.min(5, knowledgeBase.length); fbi++) {
        var alreadyIn = false;
        for (var mbi = 0; mbi < matchedKb.length; mbi++) {
          if (matchedKb[mbi].id === knowledgeBase[fbi].id) { alreadyIn = true; break; }
        }
        if (!alreadyIn) matchedKb.push(knowledgeBase[fbi]);
      }
    }
    if (matchedKb.length > 0 && typeof generateLearningPath !== 'undefined') {
      var lp = generateLearningPath(matchedKb);
      for (var wi = 0; wi < lp.length; wi++) {
        for (var di = 0; di < lp[wi].items.length; di++) {
          lp[wi].items[di].duration = '2h';
          lp[wi].items[di].knowledgeId = lp[wi].items[di].item ? lp[wi].items[di].item.id : '';
        }
      }
      for (var si = 0; si < mockStudents.length; si++) {
        if (mockStudents[si].id === result.studentId) {
          mockStudents[si].supportPlan = mockStudents[si].supportPlan || {};
          mockStudents[si].supportPlan.status = mockStudents[si].supportPlan.status || 'draft';
          mockStudents[si].supportPlan.createdAt = formatTime(new Date());
          mockStudents[si].supportPlan.weeks = lp;
          if (!mockStudents[si].supportPlan.history) mockStudents[si].supportPlan.history = [];
          mockStudents[si].supportPlan.history.unshift({action:'created',time:formatTime(new Date()),operator:'系统'});
          break;
        }
      }
    }
    saveStudentStates();

  }



  function handleError(err) { setSubmitting(false); showResultUI('error'); resultErrorText.textContent = err.message || '\u5206\u6790\u8bf7\u6c42\u5931\u8d25'; console.error('[API Error]', err); }



  function updateStudentRiskInSidebar(result) {

    var risk = result.riskAnalysis.level;

    for (var i = 0; i < mockStudents.length; i++) {
      if (mockStudents[i].id === result.studentId) {
        mockStudents[i]._riskLevel = risk;
        if (result.riskAnalysis.score !== undefined) mockStudents[i]._riskScore = result.riskAnalysis.score;
        break;
      }
    }

    var card = contentDetail ? contentDetail.querySelector('.student-info-card') : null;

    if (studentInfoRisk) {

      if (risk === '\u9ad8') { studentInfoRisk.textContent = '\u9ad8\u98ce\u9669'; studentInfoRisk.className = 'risk-badge risk-high'; }

      else if (risk === '\u4e2d') { studentInfoRisk.textContent = '\u4e2d\u98ce\u9669'; studentInfoRisk.className = 'risk-badge risk-medium'; }

      else { studentInfoRisk.textContent = '\u4f4e\u98ce\u9669'; studentInfoRisk.className = 'risk-badge risk-low'; }

    }

    if (card) { card.className = 'student-info-card risk-' + (risk === '\u9ad8' ? 'high' : risk === '\u4e2d' ? 'medium' : 'low'); }

    if (result && result.riskAnalysis && result.riskAnalysis.score !== undefined) updateRiskRing(result.riskAnalysis.score);

  }







  function renderResultCards(result) {
    var risk = result.riskAnalysis;
    var support = result.supportPlan;
    var audit = result.auditResult;
    var riskCardEl = document.getElementById('riskCard');
    var supportCardEl = document.getElementById('supportCard');
    var auditCardEl = document.getElementById('auditCard');
    if (riskCardEl) riskCardEl.className = 'card card-warning';
    if (supportCardEl) supportCardEl.className = 'card card-support';
    if (auditCardEl) auditCardEl.className = 'card card-audit';
    var levelClass = '';
    var levelText = '';
    if (risk.level === '高') { levelClass = 'risk-high'; levelText = '高风险'; }
    else if (risk.level === '中') { levelClass = 'risk-medium'; levelText = '中风险'; }
    else { levelClass = 'risk-low'; levelText = '低风险'; }
    riskBadge.textContent = levelText;
    riskBadge.className = 'risk-badge ' + levelClass;
    var riskHtml = '';
    if (risk.score !== undefined) riskHtml += '<p><strong>风险评分：</strong><span class="highlight-num">' + risk.score + '</span> / 100</p>';
    if (risk.details) riskHtml += '<p>' + escapeHtml(risk.details) + '</p>';
    if (risk.factors && risk.factors.length > 0) {
      riskHtml += '<p style="margin-top:8px;"><strong>风险因素：</strong></p><ul class="result-list result-list-warn">';
      risk.factors.forEach(function (f) { riskHtml += '<li>' + escapeHtml(f) + '</li>'; });
      riskHtml += '</ul>';
    }
    riskBody.innerHTML = riskHtml;
    var supportHtml = '';
    if (support.summary) supportHtml += '<p>' + escapeHtml(support.summary) + '</p>';
    if (support.recommendations && support.recommendations.length > 0) {
      supportHtml += '<p style="margin-top:8px;"><strong>帮扶措施：</strong></p><ul class="result-list result-list-measure">';
      support.recommendations.forEach(function (r) { supportHtml += '<li>' + escapeHtml(r) + '</li>'; });
      supportHtml += '</ul>';
    }
    var auditClass = audit.status === 'pass' ? 'audit-pass' : 'audit-fail';
    var auditText = audit.status === 'pass' ? '核查通过' : '核查未通过';
    auditBadge.textContent = auditText;
    auditBadge.className = 'audit-badge ' + auditClass;
    var auditHtml = '<p>' + escapeHtml(audit.message) + '</p>';
    if (audit.details) auditHtml += '<p style="margin-top:4px;color:#5f6368;font-size:12px;">' + escapeHtml(audit.details) + '</p>';
    auditBody.innerHTML = auditHtml;
  }

  var riskRingEl = document.getElementById('studentRiskRing');
  var riskRingFill = document.getElementById('riskRingFill');
  var riskRingText = document.getElementById('riskRingText');
  var CIRCUMFERENCE = 2 * Math.PI * 30;

  function updateRiskRing(score) {
    if (!riskRingEl || !riskRingFill || !riskRingText) return;
    riskRingEl.style.display = '';
    var offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
    riskRingFill.style.strokeDasharray = CIRCUMFERENCE;
    riskRingFill.style.strokeDashoffset = offset;
    riskRingText.textContent = score;
    riskRingFill.setAttribute('class', 'risk-ring-fill');
    if (score < 40) riskRingFill.setAttribute('class', riskRingFill.getAttribute('class') + ' score-high');
    else if (score < 80) riskRingFill.setAttribute('class', riskRingFill.getAttribute('class') + ' score-medium');
    else riskRingFill.setAttribute('class', riskRingFill.getAttribute('class') + ' score-low');
  }



  // ================================================================

  //  导出报告

  // ================================================================

  function handleExport() {

    var includePath = arguments[0] === true;

    if (!currentResult) return;

    var text = buildExportText(currentResult, includePath);

    auditAccess('export', currentResult.studentId, currentResult.studentName, ['riskAnalysis', 'supportPlan', 'auditResult']);

    if (window.electronAPI && window.electronAPI.exportToFile) {

      window.electronAPI.exportToFile(text).then(function (res) { if (res.success) showToast('报告已保存'); else showToast('保存失败'); });

    } else { navigator.clipboard.writeText(text).then(function () { showToast('报告已复制到剪贴板'); }).catch(function () { showToast('导出失败'); }); }

  }



  function handleExportReport() {

    handleExport(true);

  }



  function buildExportText(result) {

    var lines = ['\u2501' .repeat(40), '  \u5b66\u4e1a\u9884\u8b66\u5e2e\u6276\u5e73\u53f0 \u2014 \u5206\u6790\u62a5\u544a', '\u2501'.repeat(40), '', '\u5b66\u751f\u59d3\u540d\uff1a' + (result.studentName || '\u2014'), '\u5b66    \u53f7\uff1a' + (result.studentId || '\u2014'), '\u5206\u6790\u65f6\u95f4\uff1a' + (result.timestamp || '\u2014'), '', '\u3010\u9884\u8b66\u5206\u6790\u3011', '\u98ce\u9669\u7b49\u7ea7\uff1a' + result.riskAnalysis.level];

    if (result.riskAnalysis.score !== undefined) lines.push('\u98ce\u9669\u8bc4\u5206\uff1a' + result.riskAnalysis.score + ' / 100');

    if (result.riskAnalysis.details) lines.push('\u8be6\u7ec6\uff1a' + result.riskAnalysis.details);

    if (result.riskAnalysis.factors && result.riskAnalysis.factors.length > 0) { lines.push('\u98ce\u9669\u56e0\u7d20\uff1a'); result.riskAnalysis.factors.forEach(function (f, i) { lines.push('  ' + (i + 1) + '. ' + f); }); }

    lines.push(''); lines.push('\u3010\u5e2e\u6276\u65b9\u6848\u3011');

    if (result.supportPlan.summary) lines.push(result.supportPlan.summary);

    if (result.supportPlan.recommendations) { lines.push('\u63aa\u65bd\uff1a'); result.supportPlan.recommendations.forEach(function (r, i) { lines.push('  ' + (i + 1) + '. ' + r); }); }

    lines.push(''); lines.push('\u3010\u6838\u67e5\u7ed3\u8bba\u3011');

    lines.push('\u7ed3\u679c\uff1a' + (result.auditResult.status === 'pass' ? '\u5408\u683c' : '\u4e0d\u5408\u683c'));

    lines.push('\u5904\u7f6e\uff1a' + result.auditResult.message);

    if (result.auditResult.details) lines.push('\u8be6\u7ec6\uff1a' + result.auditResult.details);

    lines.push(''); lines.push('\u2501'.repeat(40));

    return lines.join('\n');

  }



  // ================================================================

  //  历史记录 + 台账

  // ================================================================

  function loadHistory() { var raw = localStorage.getItem('studentWarningHistory'); var items = []; try { items = raw ? JSON.parse(raw) : []; } catch (e) { localStorage.removeItem('studentWarningHistory'); } renderHistory(items); }



  function addToHistory(result) {

    var raw = localStorage.getItem('studentWarningHistory');

    var items = []; try { items = raw ? JSON.parse(raw) : []; } catch (e) { items = []; }

    var entry = { studentName: result.studentName, studentId: result.studentId, riskLevel: result.riskAnalysis.level, timestamp: result.timestamp || formatTime(new Date()), result: result };

    if (!items.some(function(i) { return i.studentId === entry.studentId && i.timestamp === entry.timestamp; })) items.unshift(entry);

    if (items.length > 50) items = items.slice(0, 50);

    localStorage.setItem('studentWarningHistory', JSON.stringify(items));

    renderHistory(items);

  }



  function renderHistory(items) {

    historyList.innerHTML = '';

    if (items.length === 0) { var li = document.createElement('li'); li.className = 'history-empty'; li.textContent = '\u6682\u65e0\u8bb0\u5f55'; historyList.appendChild(li); return; }

    items.forEach(function (item) {

      var li = document.createElement('li'); var lc = ''; var lt = '';

      if (item.riskLevel === '\u9ad8') { lt = '\u9ad8\u98ce\u9669'; lc = '#c5221f'; }

      else if (item.riskLevel === '\u4e2d') { lt = '\u4e2d\u98ce\u9669'; lc = '#e37400'; }

      else { lt = '\u4f4e\u98ce\u9669'; lc = '#137333'; }

      li.innerHTML = '<div class="history-item-header"><span class="history-item-name">' + escapeHtml(item.studentName) + ' (' + escapeHtml(item.studentId) + ')</span><span class="history-item-time">' + escapeHtml(item.timestamp) + '</span></div><div class="history-item-level" style="color:' + lc + ';">' + lt + '</div>';

      li.addEventListener('click', function () { selectedStudentId = item.result.studentId; renderSidebar(); selectStudent(item.result.studentId); currentResult = item.result; showResultUI('result'); renderResultCards(item.result); switchTab('detail'); });

      historyList.appendChild(li);

    });

  }



  function handleClearHistory() { if (!confirm('\u786e\u5b9a\u6e05\u7a7a\u6240\u6709\u5386\u53f2\u8bb0\u5f55\uff1f')) return; localStorage.removeItem('studentWarningHistory'); renderHistory([]); showToast('\u5386\u53f2\u5df2\u6e05\u7a7a'); }

  /* ================================================================
   *  申诉复核（双向闭环的教师侧）
   *  数据来自 appeals.js（localStorage:warningAppeals）。
   *  采纳 = 结论必填 + 该生工单状态置为"核查中" + 风险等级降一级 + 留痕；
   *  驳回 = 结论必填，预警状态不变。所有写入都走 Appeals.review 统一入口。
   * ================================================================ */

  var appealReviewList = document.getElementById('appealReviewList');
  var appealPendingBadge = document.getElementById('appealPendingBadge');
  var RISK_TXT = { '\u9ad8': '\u9ad8\u98ce\u9669', '\u4e2d': '\u4e2d\u98ce\u9669', '\u4f4e': '\u4f4e\u98ce\u9669' };

  function appealLevelDown(lv) {
    if (lv === '\u9ad8') return '\u4e2d';
    if (lv === '\u4e2d') return '\u4f4e';
    return lv;   // 低风险不再降
  }

  function renderAppealReviews() {
    if (!appealReviewList) return;
    var all = window.Appeals ? window.Appeals.sorted() : [];
    var st = window.Appeals ? window.Appeals.stats() : { pending: 0, accepted: 0, rejected: 0 };

    if (appealPendingBadge) {
      appealPendingBadge.textContent = st.pending + ' 待复核';
      appealPendingBadge.className = 'risk-badge ' + (st.pending ? 'risk-high' : 'risk-low');
    }

    if (!all.length) {
      appealReviewList.innerHTML = '<div class="ledger-empty" style="padding:12px;color:var(--color-text-muted);font-size:12px;">暂无学生申诉。学生在「学业画像 → 预警解释卡 → 我要申诉」提交后会实时出现在这里。</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < all.length; i++) {
      var a = all[i];
      var snap = a.snapshot || {};
      var label = (window.Appeals.STATUS[a.status] || '待复核');
      var cls = a.status === 'accepted' ? 'risk-low' : (a.status === 'rejected' ? 'risk-medium' : 'risk-high');
      var factorLines = (snap.factors || []).map(function (f) {
        return '<div style="font-size:11px;">· ' + escapeHtml(f.label || '') + (f.rawValue ? '（' + escapeHtml(f.rawValue) + '）' : '') + ' 贡献 ' + escapeHtml(String(f.contribution)) + ' 分</div>';
      }).join('');
      html += '<div class="appeal-row" data-appeal="' + escapeHtml(a.id) + '" style="border-top:1px dashed var(--color-border-light);padding:10px 0;">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">' +
        '<div><span class="risk-badge ' + cls + '" style="font-size:10px;">' + escapeHtml(label) + '</span> ' +
        '<strong>' + escapeHtml(a.studentName || '未知') + '</strong> ' +
        '<span style="font-size:11px;color:var(--color-text-muted);">' + escapeHtml(a.studentId || '') + ' · ' + escapeHtml(a.className || '未分班') + '</span></div>' +
        '<span style="font-size:11px;color:var(--color-text-muted);">' + escapeHtml(String(a.createdAt || '').slice(0, 16).replace('T', ' ')) + '</span></div>' +
        '<div style="font-size:12px;margin-top:4px;">申诉类型：' + escapeHtml(a.type || '其他') + ' · 预警时间 ' + escapeHtml(String(a.warningAt || '').slice(0, 16).replace('T', ' ')) + '</div>' +
        '<div style="font-size:12px;color:var(--color-text-secondary);margin-top:4px;">理由：' + escapeHtml(a.reason || '') + '</div>' +
        '<div class="appeal-detail" style="display:none;margin-top:6px;padding:8px;background:var(--color-bg);border-radius:4px;">' +
        '<div style="font-size:11px;font-weight:600;margin-bottom:4px;">当时的判定依据快照（复核关键依据）</div>' +
        '<div style="font-size:11px;">规则：' + escapeHtml(snap.pluginName || '—') + '（' + escapeHtml(snap.pluginId || '—') + '） · 结论 ' + escapeHtml(snap.riskLevel || '—') + ' · 安全分 ' + escapeHtml(String(snap.riskScore)) + '</div>' +
        '<div style="font-size:11px;">快照时间：' + escapeHtml(String(snap.at || '').slice(0, 16).replace('T', ' ')) + '</div>' +
        (factorLines || '<div style="font-size:11px;color:var(--color-text-muted);">该规则不提供分维度明细</div>') +
        (a.conclusion ? '<div style="font-size:11px;margin-top:6px;color:#166534;">复核结论：' + escapeHtml(a.conclusion) + '（' + escapeHtml(a.reviewer || '') + '）</div>' : '') +
        '</div>' +
        '<div style="margin-top:8px;display:flex;gap:8px;">' +
        '<button class="ledger-btn" data-ap-toggle="' + escapeHtml(a.id) + '">展开快照</button>' +
        (a.status === 'pending' ? '<button class="ledger-btn" data-ap-accept="' + escapeHtml(a.id) + '">采纳申诉</button>' +
          '<button class="ledger-btn" data-ap-reject="' + escapeHtml(a.id) + '">驳回申诉</button>' : '') +
        '</div></div>';
    }
    appealReviewList.innerHTML = html;

    appealReviewList.querySelectorAll('[data-ap-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var row = this.closest('.appeal-row');
        var d = row ? row.querySelector('.appeal-detail') : null;
        if (!d) return;
        var shown = d.style.display !== 'none';
        d.style.display = shown ? 'none' : 'block';
        this.textContent = shown ? '展开快照' : '收起快照';
      });
    });
    appealReviewList.querySelectorAll('[data-ap-accept]').forEach(function (b) {
      b.addEventListener('click', function () { reviewAppeal(this.getAttribute('data-ap-accept'), 'accepted'); });
    });
    appealReviewList.querySelectorAll('[data-ap-reject]').forEach(function (b) {
      b.addEventListener('click', function () { reviewAppeal(this.getAttribute('data-ap-reject'), 'rejected'); });
    });
  }

  /**
   * 复核一条申诉。这是唯一的写入口（UI 事件里不直接碰 localStorage）。
   * @param {string} id 申诉 id
   * @param {string} decision 'accepted' | 'rejected'
   */
  function reviewAppeal(id, decision) {
    if (!window.Appeals) return;
    if (window.Perm && !Perm.can('teacher', 'appeal:review', false)) { showToast('当前身份无权复核申诉'); return; }
    var me = (window.Session && Session.current()) || { name: '教师' };
    var a = Appeals.get(id);
    if (!a) { showToast('申诉不存在'); return; }
    if (a.status !== 'pending') { showToast('该申诉已复核过'); return; }

    var conclusion = prompt(decision === 'accepted' ? '请输入采纳理由（必填）：' : '请输入驳回理由（必填）：');
    if (!conclusion || !String(conclusion).trim()) { showToast('复核结论不能为空'); return; }

    var res = Appeals.review(id, { status: decision, conclusion: String(conclusion).trim(), reviewer: me.name || '教师' });
    if (!res.ok) { showToast(res.error || '复核失败'); return; }

    var stu = findStudentById(a.studentId);
    if (decision === 'accepted' && stu) {
      var oldLevel = stu._riskLevel || '';
      var newLevel = appealLevelDown(oldLevel);
      stu.status = 'reviewing';                 // 复用既有状态机：核查中
      stu._riskLevel = newLevel;
      saveStudentStates();
      // 写一条预警历史留痕（结构保持与普通分析结果兼容，历史列表点开不会报错）
      var note = '申诉复核采纳：风险等级由 ' + (RISK_TXT[oldLevel] || oldLevel || '未知') + ' 调整为 ' + (RISK_TXT[newLevel] || newLevel);
      addHistoryEntry({
        studentName: stu.name, studentId: stu.id, riskLevel: newLevel,
        timestamp: formatTime(new Date()), note: note,
        result: {
          studentName: stu.name, studentId: stu.id, timestamp: formatTime(new Date()),
          riskAnalysis: { level: newLevel, score: (stu._riskScore === undefined ? '' : stu._riskScore), details: note, factors: ['申诉复核：' + String(conclusion).trim()] },
          supportPlan: { summary: '（申诉复核留痕，未生成新方案）', recommendations: [], resources: [] },
          auditResult: { status: 'pass', message: '申诉复核采纳', details: String(conclusion).trim() }
        }
      });
      renderSidebar(sidebarSearch ? sidebarSearch.value : '');
      if (selectedStudentId === stu.id) {
        // 详情面板上的等级徽章/工单状态同步刷新
        var badge = document.getElementById('studentInfoRisk');
        if (badge) {
          badge.textContent = RISK_TXT[newLevel] || '\u4f4e\u98ce\u9669';
          badge.className = 'risk-badge ' + (newLevel === '\u9ad8' ? 'risk-high' : newLevel === '\u4e2d' ? 'risk-medium' : 'risk-low');
        }
        if (typeof updateStatusDisplay === 'function') updateStatusDisplay('reviewing');
      }
    }

    if (window.Session && Session.log) Session.log({ event: 'appeal_' + decision, role: 'teacher', id: id, name: me.name || '' });
    if (window.Perm) Perm.audit({ action: 'write', subjectId: a.studentId, subjectName: a.studentName, fields: ['appealStatus', 'appealConclusion', 'riskLevel'] });

    renderAppealReviews();
    showToast(decision === 'accepted' ? '已采纳申诉，风险等级降一级' : '已驳回申诉');
  }

  /** 追加一条预警历史（不改动原有 addToHistory 的分析结果逻辑） */
  function addHistoryEntry(entry) {
    var raw = localStorage.getItem('studentWarningHistory');
    var items = []; try { items = raw ? JSON.parse(raw) : []; } catch (e) { items = []; }
    items.unshift(entry);
    if (items.length > 50) items = items.slice(0, 50);
    try { localStorage.setItem('studentWarningHistory', JSON.stringify(items)); } catch (e) {}
    renderHistory(items);
  }







  // ================================================================

  //  OCR

  // ================================================================

  function setupOcrEvents() {

    if (ocrImageBtn) { ocrImageBtn.addEventListener('click', function () { if (ocrProcessing) return; ocrFileInput.click(); }); }

    if (ocrFileInput) { ocrFileInput.addEventListener('change', function () { var file = ocrFileInput.files[0]; if (file) processOcrFile(file); ocrFileInput.value = ''; }); }

    document.addEventListener('paste', function (e) { if (ocrProcessing) return; var items = e.clipboardData && e.clipboardData.items; if (!items) return; for (var i = 0; i < items.length; i++) { if (items[i].type.indexOf('image') !== -1) { e.preventDefault(); processOcrFile(items[i].getAsFile()); return; } } });

    if (window.electronAPI && window.electronAPI.onOcrProgress) { window.electronAPI.onOcrProgress(function (data) { if (ocrBarFill) ocrBarFill.style.width = data.progress + '%'; }); }

  }



  function processOcrFile(file) {
    if (!file || ocrProcessing) return;
    ocrProcessing = true;
    if (ocrPreviewBar) ocrPreviewBar.style.display = '';
    if (ocrBarFill) ocrBarFill.style.width = '0%';
    if (ocrBarStatus) ocrBarStatus.textContent = '识别中…';

    var reader = new FileReader();
    reader.onload = function (e) { if (ocrPreviewImg) ocrPreviewImg.src = e.target.result; };
    reader.readAsDataURL(file);

    if (!window.MM) {
      ocrProcessing = false;
      setTimeout(function () { if (ocrPreviewBar) ocrPreviewBar.style.display = 'none'; }, 2000);
      return;
    }

    MM.ocrFile(file, {
      onProgress: function (info) {
        if (ocrBarFill) ocrBarFill.style.width = (info.progress || 0) + '%';
        if (ocrBarStatus) ocrBarStatus.textContent = info.status || '识别中…';
      }
    }).then(function (res) {
      ocrProcessing = false;
      if (ocrBarFill) ocrBarFill.style.width = '100%';
      if (ocrBarStatus) ocrBarStatus.textContent = res.mock ? '已使用模拟结果（真实 OCR 不可用）' : ('识别完成 · ' + engineLabel(res.engine));
      fillOcrResult(res.text);
      var box = document.getElementById('ocrResult');
      if (box) box.innerHTML = '<strong>识别结果</strong> ' + engineTag(res) + '<br>' + MM.textToHtml(res.text || '');
      showToast(res.mock ? 'OCR 已降级为模拟结果' : 'OCR 识别完成');
      setTimeout(function () { if (ocrPreviewBar) ocrPreviewBar.style.display = 'none'; }, 2500);
    }).catch(function (err) {
      ocrProcessing = false;
      if (ocrBarStatus) ocrBarStatus.textContent = '识别失败：' + (err && err.message);
      showToast('OCR 识别失败');
    });
  }
  function fillOcrResult(text) {

    var gf = document.getElementById('studentGrades'); if (gf && text) gf.value = text;

  }



  function setupDropEvents() {

    document.addEventListener('dragover', function (e) { e.preventDefault(); if (!ocrProcessing && dropOverlay) dropOverlay.style.display = ''; });

    document.addEventListener('dragleave', function (e) { if (e.target === document) { if (dropOverlay) dropOverlay.style.display = 'none'; } });

    document.addEventListener('drop', function (e) { e.preventDefault(); if (dropOverlay) dropOverlay.style.display = 'none'; if (ocrProcessing) return; var files = e.dataTransfer && e.dataTransfer.files; if (files && files.length > 0 && files[0].type.indexOf('image') !== -1) processOcrFile(files[0]); });

  }



  var toastTimer = null;

  function showToast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.style.display = ''; if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.style.display = 'none'; }, 2500); }



  function formatTime(date) { return date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()); }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function escapeHtml(str) { if (str === null || str === undefined) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }



  // ================================================================

  //  API 层

  // ================================================================

  function callAPI(data) { if (isMock) return callMockAPI(data); return callRealAPI(data).catch(function(err) { console.warn('[API] fallback to mock'); showToast('API\u5931\u8d25\uff0c\u5df2\u5207\u6362\u6a21\u62df\u6570\u636e'); return callMockAPI(data); }); }



  function callMockAPI(data) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try {
          console.log('[MOCK] Scoring with RiskPluginManager...');
          var scoring = RiskPluginManager.score(data);
          console.log('[MOCK] Score result:', scoring);
          var result = buildMockResult(data, scoring);
          console.log('[MOCK] Build result:', result);
          resolve(result);
        } catch(e) {
          console.error('[MOCK] Error:', e.message);
          reject(e);
        }
      }, 500);
    });
  }



  function analyzeRiskLevel(grades, homework, attendance, lab, codeQuality, labReport) {

    var gs = scoreField(grades, "grades"), hs = scoreField(homework, "homework"), as = scoreField(attendance, "attendance");

    // Parse numeric scores for course analysis

    var courseScores = 0, courseCount = 0;

    var scoreMatches = (grades || '').match(/(\d+)\s*\u5206/g);

    if (scoreMatches) {

      for (var sm = 0; sm < scoreMatches.length; sm++) {

        var sv = parseInt(scoreMatches[sm].match(/\d+/)[0]);

        if (sv >= 0 && sv <= 100) { courseScores += sv; courseCount++; }

      }

    }

    var avgScore = courseCount > 0 ? courseScores / courseCount : 100;

    // 成绩维度：数值分数与「定性描述」都要计入。
    // 原实现只看 "NN分"，于是"高数不及格，英语挂科"这类纯文字描述会被当成满分 100，
    // 直接把高风险学生算成低风险（test-risk.js 王五用例抓的就是这个）。
    var courseFactor = Math.min(courseCount > 0 ? Math.round(avgScore) : 100, gs);

    var hwFactor = hs;

    var attFactor = as;

    // Weight: courses 40%, homework 20%, attendance 20%, lab 10%, code 5%, lab report 5%

    var ls = scoreField(lab || '', 'attendance');

    var cs = scoreField(codeQuality || '', 'homework');

    var lrs = scoreField(labReport || '', 'homework');

    var ts = Math.round(courseFactor * 0.4 + hwFactor * 0.2 + attFactor * 0.2 + ls * 0.1 + cs * 0.05 + lrs * 0.05);

    // 不及格科目数的硬下限：口径与 riskPlugins/rules/strict.js 保持一致——
    // 任一科不及格至少中风险，两科及以上（或叠加缺交/旷课）直接高风险。
    // 只靠加权求和时，作业/出勤/实验三个默认满分维度会把 60 分托底，永远进不了高风险区。
    var failedCount = countFailedSubjects(grades);
    if (failedCount >= 2) ts = Math.min(ts, 30);
    else if (failedCount === 1) ts = Math.min(ts, 70);

    return { level: ts>=80?'\u4f4e':ts>=40?'\u4e2d':'\u9ad8', score: ts, factors: collectRiskFactors(grades, homework, attendance, lab, codeQuality, labReport) };

  }

  /**
   * 统计「不及格科目数」：既认数值分（<60），也认定性描述（不及格/挂科/补考/重修）。
   * 按已知课程名逐个判断，避免"英语不及格，其他良好"被漏掉或被重复计数。
   */
  function countFailedSubjects(grades) {
    var text = String(grades || '');
    var COURSES = ['\u9ad8\u6570', '\u82f1\u8bed', '\u7f16\u7a0b', '\u8ba1\u7b97\u673a\u57fa\u7840'];
    var FAIL_WORDS = ['\u4e0d\u53ca\u683c', '\u6302\u79d1', '\u672a\u901a\u8fc7', '\u8865\u8003', '\u91cd\u4fee'];
    var n = 0;
    for (var i = 0; i < COURSES.length; i++) {
      var idx = text.indexOf(COURSES[i]);
      if (idx === -1) continue;
      var seg = text.slice(idx, idx + COURSES[i].length + 6);
      var hit = false;
      for (var f = 0; f < FAIL_WORDS.length; f++) {
        if (seg.indexOf(FAIL_WORDS[f]) !== -1) { hit = true; break; }
      }
      if (!hit) {
        var m = seg.match(/[^0-9]*(\d+)/);
        if (m && parseInt(m[1], 10) < 60) hit = true;
      }
      if (hit) n++;
    }
    return n;
  }



  function scoreField(text, type) {

    if (!text) return 100; var s = 100;

    getPositiveKeywords(type).forEach(function(k) { if (text.indexOf(k)!==-1) s = Math.min(100, s+3); });

    getNegativeKeywords(type).forEach(function(n) { if (text.indexOf(n.word)!==-1 && !isNegated(text, n.word)) s -= n.penalty; });

    return Math.max(0, Math.min(100, s));

  }



  function isNegated(text, kw) { return ["\u65e0","\u6ca1\u6709","\u672a","\u4ece\u672a","\u4ece\u4e0d","\u6ca1"].some(function(n){return text.indexOf(n+kw)!==-1}); }



  function getPositiveKeywords(type) { if (type==="grades") return ["\u4f18\u79c0","\u826f\u597d","\u6ee1\u5206","\u524d\u5217","\u8fdb\u6b65"]; if (type==="homework") return ["\u6309\u65f6","\u5168\u90e8\u63d0\u4ea4","\u8ba4\u771f"]; return ["\u5168\u52e4","\u6b63\u5e38"]; }



  function getNegativeKeywords(type) {

    if (type==="grades") return [{word:"\u6302\u79d1",penalty:35},{word:"\u4e0d\u53ca\u683c",penalty:35},{word:"\u91cd\u4fee",penalty:35},{word:"\u4e0b\u6ed1",penalty:28},{word:"\u504f\u79d1",penalty:28},{word:"\u4e0d\u7406\u60f3",penalty:28}];

    if (type==="homework") return [{word:"\u4e0d\u4ea4\u4f5c\u4e1a",penalty:35},{word:"\u672a\u4ea4",penalty:35},{word:"\u8fdf\u4ea4",penalty:28},{word:"\u8d28\u91cf\u5dee",penalty:28}];

    return [{word:"\u65f7\u8bfe",penalty:35},{word:"\u7f3a\u52e4",penalty:30},{word:"\u8fdf\u5230",penalty:28}];

  }



  function collectRiskFactors(grades, homework, attendance, lab, codeQuality, labReport) {

    var factors = [];

    var fields = [

      {text:grades||'',label:"\u6210\u7ee9",kw:getNegativeKeywords("grades")},

      {text:homework||'',label:"\u4f5c\u4e1a",kw:getNegativeKeywords("homework")},

      {text:attendance||'',label:"\u51fa\u52e4",kw:getNegativeKeywords("attendance")},

      {text:lab||'',label:"\u5b9e\u9a8c\u8003\u52e4",kw:getNegativeKeywords("attendance")},

      {text:codeQuality||'',label:"\u4ee3\u7801\u8d28\u91cf",kw:getNegativeKeywords("homework")},

      {text:labReport||'',label:"\u5b9e\u9a8c\u62a5\u544a",kw:getNegativeKeywords("homework")}

    ];

    for (var f = 0; f < fields.length; f++) {

      var txt = fields[f].text;

      if (!txt) continue;

      for (var k = 0; k < fields[f].kw.length; k++) {

        var kw = fields[f].kw[k].word;

        if (txt.indexOf(kw) !== -1 && !isNegated(txt, kw)) {

          factors.push("\u3010" + fields[f].label + "\u3011" + kw);

        }

      }

    }

    return factors;

  }



  function buildMockResult(data, analysis) {

    var rl=analysis.level, rs, rd, rf, ss, sr, srs, as, am, ad;

    if (rl==="\u9ad8") { rs=Math.min(analysis.score,35); rd="\u5b58\u5728\u4e25\u91cd\u5b66\u4e1a\u98ce\u9669\uff0c\u9700\u7acb\u5373\u4ecb\u5165"; rf=analysis.factors.length>0?analysis.factors:["\u5b58\u5728\u4e0d\u53ca\u683c\u79d1\u76ee","\u51fa\u52e4\u7387\u4f4e","\u4f5c\u4e1a\u8d28\u91cf\u5dee"];

      ss="\u542f\u52a8\u7d27\u6025\u5e2e\u6276\u65b9\u6848"; sr=["\u5b89\u6392\u5b66\u4e1a\u5bfc\u5e08","\u8f85\u5bfc\u5458\u8c08\u8bdd","\u5236\u5b9a\u8865\u4e60\u8ba1\u5212","\u5bb6\u6821\u534f\u540c","\u5f00\u653e\u8d44\u6e90\u5e93"];

      srs=[{name:"\u9ad8\u7b49\u6570\u5b66",summary:"\u6781\u9650\u4e0e\u8fde\u7eed\u3001\u5bfc\u6570\u4e0e\u5fae\u5206\u6838\u5fc3\u77e5\u8bc6\u70b9\u8bb2\u89e3",url:"https://kb.example.com/math-basics",type:"course"},{name:"\u5927\u5b66\u82f1\u8bed",summary:"\u56db\u7ea7\u6838\u5fc3\u8bcd\u6c47\u3001\u9605\u8bfb\u7406\u89e3\u6280\u5de7\u8bad\u7ec3",url:"https://kb.example.com/english-4",type:"course"},{name:"C\u8bed\u8a00\u7a0b\u5e8f\u8bbe\u8ba1",summary:"\u6307\u9488\u3001\u7ed3\u6784\u4f53\u3001\u6587\u4ef6\u64cd\u4f5c\u4e13\u9879\u7ec3\u4e60",url:"https://kb.example.com/c-lang",type:"exercise"}];

      as="fail"; am="\u6838\u67e5\u4e0d\u5408\u683c,\u89e6\u53d1\u4e8c\u6b21\u9884\u8b66"; ad="\u5217\u5165\u91cd\u70b9\u5173\u6ce8\u540d\u5355"; }

    else if (rl==="\u4f4e") { rs=Math.max(analysis.score,80); rd="\u5b66\u4e1a\u8868\u73b0\u826f\u597d\uff0c\u65e0\u660e\u663e\u98ce\u9669"; rf=[];

      ss="\u7ef4\u6301\u5f53\u524d\u72b6\u6001"; sr=["\u5b9a\u671f\u590d\u76d8","\u63d0\u4f9b\u8fdb\u9636\u8d44\u6e90","\u53c2\u4e0e\u5b66\u79d1\u7ade\u8d5b"];

      srs=[{name:"\u5b66\u79d1\u7ade\u8d5b\u8f85\u5bfc",summary:"ACM/\u6570\u5b66\u5efa\u6a21\u5907\u8d5b\u8d44\u6599",url:"https://kb.example.com/competition",type:"course"},{name:"\u5b66\u672f\u524d\u6cbf\u8bb2\u5ea7",summary:"\u4eba\u5de5\u667a\u80fd\u3001\u5927\u6570\u636e\u65b9\u5411\u524d\u6cbf\u8bb2\u5ea7",url:"https://kb.example.com/lectures",type:"video"}];

      as="pass"; am="\u6838\u67e5\u901a\u8fc7,\u8fdb\u5165\u5f52\u6863\u56de\u8bbf"; ad="\u5217\u5165\u5b9a\u671f\u56de\u8bbf\u540d\u5355"; }

    else { rs=Math.max(analysis.score,40); rd="\u5b58\u5728\u4e00\u5b9a\u5b66\u4e1a\u98ce\u9669"; rf=analysis.factors.length>0?analysis.factors:["\u4e2a\u522b\u79d1\u76ee\u504f\u4f4e","\u51fa\u52e4\u5076\u6709\u6ce2\u52a8"];

      ss="\u91c7\u53d6\u9884\u9632\u6027\u5e72\u9884"; sr=["\u5b66\u79d1\u8001\u5e08\u5173\u6ce8","\u6bcf\u6708\u56de\u8bbf","\u63d0\u4f9b\u7b54\u7591\u8d44\u6e90","\u53c2\u52a0\u7ecf\u9a8c\u5206\u4eab"];

      srs=[{name:"\u5b66\u4e60\u7b56\u7565\u6307\u5bfc",summary:"\u9ad8\u6548\u7b14\u8bb0\u6cd5\u3001\u65f6\u95f4\u7ba1\u7406\u4e0e\u590d\u4e60\u89c4\u5212",url:"https://kb.example.com/study-skills",type:"guide"},{name:"\u5b66\u79d1\u7b54\u7591\u7cfb\u7edf",summary:"\u5728\u7ebf\u9884\u7ea6\u5b66\u79d1\u8001\u5e08\u4e00\u5bf9\u4e00\u7b54\u7591",url:"https://kb.example.com/qa-system",type:"tool"},{name:"\u4f18\u79c0\u5b66\u957f\u7ecf\u9a8c\u5206\u4eab",summary:"\u9ad8\u5206\u5b66\u957f\u5b66\u4e60\u65b9\u6cd5\u4e0e\u8003\u8bd5\u6280\u5de7",url:"https://kb.example.com/peer-sharing",type:"video"}];

      as="fail"; am="\u6838\u67e5\u4e0d\u5408\u683c,\u89e6\u53d1\u4e8c\u6b21\u9884\u8b66"; ad="\u5217\u5165\u8ddf\u8e2a\u89c2\u5bdf\u540d\u5355"; }

    var scoringResult = RiskPluginManager.score({name:data.name,studentId:data.studentId,grades:data.grades||'',homework:data.homework||'',attendance:data.attendance||'',lab:data.lab||'',codeQuality:data.codeQuality||'',labReport:data.labReport||''});

    return { studentName:data.name, studentId:data.studentId, timestamp:formatTime(new Date()), _scoringResult: scoringResult, riskAnalysis:{level:rl,score:rs,details:rd,factors:rf}, supportPlan:{summary:ss,recommendations:sr,resources:srs}, auditResult:{status:as,message:am,details:ad} };

  }







  // ================================================================

  //  Real API

  // ================================================================

  var cachedToken = null, tokenExpiresAt = 0;

  function callRealAPI(data) {
    var token = CONFIG.real.apiKey || '';
    return callChatAPI(token, data).then(function(response) { return parseRealResponse(response, data); });
  }

  function getToken() {

    var now = Math.floor(Date.now()/1000);

    if (cachedToken && now < tokenExpiresAt - 300) return Promise.resolve(cachedToken);

    return fetch(CONFIG.real.tokenUrl, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appKey:CONFIG.real.appKey,appSecret:CONFIG.real.appSecret})}).then(function(r){return r.json();}).then(function(d){if(d.accessToken){cachedToken=d.accessToken;tokenExpiresAt=now+(d.expiresIn||7200);return cachedToken;}throw new Error('Token\u5f02\u5e38');});

  }

  function callChatAPI(token, studentData) {
    var cfg = (typeof agentConfigs !== 'undefined' && agentConfigs) ? (agentConfigs.agent1 || agentConfigs.warning || null) : null;
    var sysPrompt = (cfg && (cfg.systemPrompt || cfg.prompt)) ? (cfg.systemPrompt || cfg.prompt)
      : '你是一个专业的学业预警分析师。请根据以下学生数据，分析其学业风险等级，识别风险因素，并给出预警结论。';
    sysPrompt += '\n\n\u8bf7\u4e25\u683c\u6309\u4ee5\u4e0b\u4e09\u6bb5\u8f93\u51fa\uff0c\u6bb5\u9996\u6807\u9898\u5fc5\u987b\u539f\u6837\u4fdd\u7559\uff1a\n' +
      '\u3010\u9884\u8b66\u5206\u6790\u3011\u98ce\u9669\u7b49\u7ea7\uff08\u9ad8\u98ce\u9669/\u4e2d\u98ce\u9669/\u4f4e\u98ce\u9669\uff09\u3001\u98ce\u9669\u8bc4\u5206\uff080-100\uff09\u3001\u98ce\u9669\u56e0\u7d20\uff08\u9010\u6761\u7f16\u53f7\uff09\n' +
      '\u3010\u5e2e\u6276\u65b9\u6848\u3011\u5e2e\u6276\u63aa\u65bd\uff08\u9010\u6761\u7f16\u53f7\uff09\u3001\u8d44\u6e90\u63a8\u8350\n' +
      '\u3010\u6838\u67e5\u7ed3\u8bba\u3011\u6838\u67e5\u901a\u8fc7\u6216\u6838\u67e5\u4e0d\u5408\u683c\uff0c\u5e76\u8bf4\u660e\u7406\u7531';
    var body = JSON.stringify({
      model: 'qwen-vl-plus',
      messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: buildRealInput(studentData) }],
      temperature: (cfg && cfg.temperature !== undefined) ? cfg.temperature : 0.3,
      max_tokens: (cfg && cfg.maxTokens) ? cfg.maxTokens : 2048
    });
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { try { controller.abort(); } catch (e) {} }, 60000) : null;
    function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
    return fetch(CONFIG.real.chatUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token},
      body: body,
      signal: controller ? controller.signal : undefined
    }).then(function(r) {
      clearTimer();
      if (!r.ok) {
        return r.text().then(function(t) { throw new Error('\u63a5\u53e3\u8fd4\u56de HTTP ' + r.status + '\uff1a' + String(t).slice(0, 200)); });
      }
      return r.json();
    }).then(function(data) {
      if (data && data.error) throw new Error('\u63a5\u53e3\u9519\u8bef\uff1a' + (data.error.message || JSON.stringify(data.error)));
      return data;
    }).catch(function(err) {
      clearTimer();
      console.error('[API] \u8bf7\u6c42\u5931\u8d25\uff1a', err && (err.message || err));
      throw err;
    });
  }

  function buildRealInput(data) { return ['\u59d3\u540d:'+data.name,'\u5b66\u53f7:'+data.studentId,'\u6210\u7ee9:'+(data.grades||'\u672a\u586b'),'\u4f5c\u4e1a:'+(data.homework||'\u672a\u586b'),'\u51fa\u52e4:'+(data.attendance||'\u672a\u586b')].join('\n'); }

  function extractContent(obj) { if(!obj)return"";if(typeof obj==="string")return obj;try{var c=obj.data&&obj.data.choices&&obj.data.choices[0];if(c&&c.message&&typeof c.message.content==="string")return c.message.content;c=obj.choices&&obj.choices[0];if(c&&c.message&&typeof c.message.content==="string")return c.message.content}catch(e){}try{return JSON.stringify(obj)}catch(e2){return String(obj)}; }

  function splitSections(text) { if(!text)return{warning:"",support:"",conclusion:""};var r={warning:"",support:"",conclusion:""};var ps=[{key:"warning",tags:["\u9884\u8b66\u5206\u6790","\u3010\u9884\u8b66\u5206\u6790\u3011"]},{key:"support",tags:["\u5e2e\u6276\u65b9\u6848","\u3010\u5e2e\u6276\u65b9\u6848\u3011"]},{key:"conclusion",tags:["\u6838\u67e5\u7ed3\u8bba","\u3010\u6838\u67e5\u7ed3\u8bba\u3011"]}];var pos=[];for(var p=0;p<ps.length;p++){for(var t=0;t<ps[p].tags.length;t++){var idx=text.indexOf(ps[p].tags[t]);if(idx!==-1){pos.push({key:ps[p].key,start:idx,tag:ps[p].tags[t]});break;}}}pos.sort(function(a,b){return a.start-b.start});for(var i2=0;i2<pos.length;i2++){var se=pos[i2].start+pos[i2].tag.length;var ee=(i2+1<pos.length)?pos[i2+1].start:text.length;r[pos[i2].key]=text.substring(se,ee).trim();}if(pos.length===0)r.warning=text;return r; }

  function extractRiskLevel(text) { if(text.indexOf("\u9ad8\u98ce\u9669")!==-1)return"\u9ad8";if(text.indexOf("\u4e2d\u98ce\u9669")!==-1||text.indexOf("\u4e2d\u7b49\u98ce\u9669")!==-1)return"\u4e2d";if(text.indexOf("\u4f4e\u98ce\u9669")!==-1)return"\u4f4e";return"\u4e2d"; }

  function extractRiskScore(text) { var m=text.match(/(\d+)/);return m?parseInt(m[1],10):50; }

  function extractFactors(text) { var f=[];var lines=text.split(/\n/);for(var i=0;i<lines.length;i++){var m=lines[i].match(/^\d+[.)]\s*(.+)/);if(m&&m[1]&&m[1].length>3)f.push(m[1]);}return f; }

  function extractSummary(text) { if(!text)return"";var p=text.split(/\n/);for(var i=0;i<p.length;i++){if(p[i].trim()&&p[i].indexOf("\u63aa\u65bd")===-1&&p[i].indexOf("\u8d44\u6e90")===-1&&!p[i].match(/^\d+[.)]/)&&p[i].trim().length>10)return p[i].trim();}return text.substring(0,100); }

  function extractListItems(text, marker) { var items=[];if(!text)return items;var idx=text.indexOf(marker);if(idx===-1)return items;var lines=text.substring(idx).split(/\n/);for(var i=0;i<lines.length;i++){var m=lines[i].match(/^\d+[.)]\s*(.+)/);if(m&&m[1]&&m[1].length>3)items.push(m[1]);else if(lines[i].trim()&&lines[i].indexOf("-")===0&&lines[i].length>5)items.push(lines[i].substring(1).trim());}return items; }

  function parseRealResponse(response, inputData) {
    // Wrap response in Kingdee format for compatibility
    if (response && response.choices && !response.data) {
      response = { data: response };
    }


    var content=extractContent(response), sections=splitSections(content), auditText=sections.conclusion||"", passed=auditText.indexOf("\u5408\u683c")!==-1&&auditText.indexOf("\u4e0d\u5408\u683c")===-1;

    var kbResources=[]; try{var raw=null;if(response&&response.data&&response.data.knowledgeResources)raw=response.data.knowledgeResources;else if(response&&response.knowledgeResources)raw=response.knowledgeResources;if(raw&&Array.isArray(raw)){for(var kr=0;kr<raw.length;kr++){var rr=raw[kr];if(typeof rr==='string')kbResources.push(rr);else if(rr&&rr.name)kbResources.push({name:rr.name||'',summary:rr.summary||rr.description||'',url:rr.url||rr.link||'',type:rr.type||'document'});}} }catch(e){}

    var textResources=extractListItems(sections.support||"","\u8d44\u6e90"); if(kbResources.length===0&&textResources.length>0)kbResources=textResources;

    return {studentName:inputData.name,studentId:inputData.studentId,timestamp:formatTime(new Date()),riskAnalysis:{level:extractRiskLevel(sections.warning||""),score:extractRiskScore(sections.warning||""),details:sections.warning||content.substring(0,200),factors:extractFactors(sections.warning||"")},supportPlan:{summary:extractSummary(sections.support||""),recommendations:extractListItems(sections.support||"","\u63aa\u65bd"),resources:kbResources},auditResult:{status:passed?"pass":"fail",message:passed?"\u6838\u67e5\u901a\u8fc7,\u8fdb\u5165\u5f52\u6863\u56de\u8bbf":"\u6838\u67e5\u4e0d\u5408\u683c,\u89e6\u53d1\u4e8c\u6b21\u9884\u8b66",details:auditText}};

  }



  // ================================================================

  //  状态机 + 操作日志

  // ================================================================

  function changeStudentStatus(studentId, newStatus) { auditAccess('write', studentId, '', ['status']); var old='pending';for(var i=0;i<mockStudents.length;i++){if(mockStudents[i].id===studentId){old=mockStudents[i].status||'pending';mockStudents[i].status=newStatus;if(newStatus==='resolved')mockStudents[i]._riskLevel='\u4f4e';break;}} addOperationLog(studentId,'status_change','\u72b6\u6001\u4ece"'+STATUS_LABELS[old]+'"\u53d8\u66f4\u4e3a"'+STATUS_LABELS[newStatus]+'"',old,newStatus);if(selectedStudentId===studentId){updateStatusDisplay(newStatus);if(newStatus==='resolved'){showResultUI('empty');currentResult=null;}} renderSidebar(sidebarSearch?sidebarSearch.value:'');showToast('\u72b6\u6001\u5df2\u66f4\u65b0\uff1a'+STATUS_LABELS[newStatus]);
    // 工单结案/升级 → 沉淀为案例（PROMPT-07：系统会越用越准的唯一证据）
    if (newStatus === 'resolved' || newStatus === 'escalated') { try { settleCase(studentId, newStatus); } catch (e) {} }
  }

  /* ================================================================
   *  案例库沉淀 + 反哺（PROMPT-07）
   * ================================================================ */

  /** 执行期打卡完成度 0-1（打卡数据是当天记录，按本人记录算） */
  function caseCheckinRate(studentId) {
    if (typeof checkinData === 'undefined' || !checkinData) return 0;
    var mine = checkinData.filter(function (c) { return String(c.studentId) === String(studentId); });
    if (!mine.length) return 0;
    var done = mine.filter(function (c) { return c.status === 'completed' || c.verified === 'approved'; }).length;
    return Math.round((done / mine.length) * 100) / 100;
  }

  /** 从生成工单到结案的天数；拿不到工单时间就记 0，不编造 */
  function caseDurationDays(studentId) {
    var stu = findStudentById(studentId);
    var raw = stu && stu.ticketTime;
    var t = raw ? Date.parse(String(raw).replace(/-/g, '/')) : NaN;
    if (isNaN(t)) return 0;
    return Math.max(0, Math.round((Date.now() - t) / 86400000));
  }

  /**
   * 工单状态变为 resolved/escalated 时沉淀案例。
   * factors 优先取 warningSnapshots；快照缺失就存空数组（不造数据）。
   */
  function settleCase(studentId, outcome) {
    if (!window.Cases) return null;
    var stu = findStudentById(studentId);
    if (!stu) return null;
    var snap = null;
    try { snap = (JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}') || {})[studentId] || null; } catch (e) { snap = null; }
    var factors = (snap && Object.prototype.toString.call(snap.factors) === '[object Array]')
      ? snap.factors.map(function (f) { return { dim: f.dim, label: f.label, contribution: f.contribution }; })
      : [];
    var planText = (stu.supportPlan && (stu.supportPlan.summary || '')) || '';
    var res = Cases.add({
      ticketId: stu.ticketId || ('W-' + studentId),
      studentId: studentId,
      className: stu.className || '未分班',
      riskLevel: (snap && snap.riskLevel) || stu._riskLevel || '',
      riskScore: (snap && snap.riskScore !== undefined) ? snap.riskScore : (stu._riskScore || ''),
      factors: factors,
      planName: Cases.classifyPlan(planText),
      planSummary: planText,
      checkinRate: caseCheckinRate(studentId),
      outcome: outcome,
      durationDays: caseDurationDays(studentId),
      closedAt: new Date().toISOString()
    });
    if (res && res.ok) {
      showToast((outcome === 'escalated' ? '工单已升级：' : '工单已结案：') + '已沉淀案例 ' + res.case.id);
      if (selectedTab === 'dashboard') renderDashboard();
      if (selectedTab === 'plan') renderSupportPlan();
    }
    return res;
  }

  /** 当前选中学生的判定快照（检索相似案例的查询向量） */
  function currentSnapshot(studentId) {
    var id = studentId || selectedStudentId;
    if (!id) return null;
    try { return (JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}') || {})[id] || null; } catch (e) { return null; }
  }

  var lastCaseRetrieval = null;   // 最近一次案例检索结果（内存态）
  var lastAgent2Input = null;     // 最近一次注入 Agent2 的完整输入（供验收核查脱敏）

  /** 「帮扶方案」页的「相似历史案例」区块 */
  function renderSimilarCases() {
    var box = document.getElementById('similarCasesBlock');
    if (!box) return;
    var sid = selectedStudentId;
    if (!sid) { box.innerHTML = ''; return; }
    if (!window.Cases) { box.innerHTML = ''; return; }
    var found = Cases.findSimilar(currentSnapshot(sid), 3);
    var h = '<div class="card" style="padding:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
      '<div style="font-size:13px;font-weight:600;">相似历史案例 <span class="risk-badge risk-low" style="font-size:10px;">' + found.items.length + ' 条</span></div>' +
      '<div style="font-size:11px;color:var(--color-text-muted);">本次方案参考了 ' + found.items.length + ' 条历史案例' +
      (found.skipped ? '（另有 ' + found.skipped + ' 条字段不全已跳过）' : '') + '</div></div>';
    if (!found.items.length) {
      h += '<div style="font-size:12px;color:var(--color-text-muted);margin-top:8px;padding:10px;background:var(--color-bg);border-radius:4px;">无历史案例可参考：该生还没有已结案/已升级的历史工单，帮扶方案由 Agent2 独立生成。</div>';
    } else {
      if (found.note) h += '<div style="font-size:11px;color:#b45309;margin-top:6px;">' + escapeHtml(found.note) + '</div>';
      h += '<div style="margin-top:8px;">';
      found.items.forEach(function (c) {
        var oc = c.outcome === 'resolved' ? 'risk-low' : 'risk-high';
        h += '<div style="border:1px solid var(--color-border-light);border-radius:4px;padding:8px;margin-bottom:6px;font-size:12px;">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">' +
          '<span><strong>相似度 ' + (c.score * 100).toFixed(0) + '%</strong> · ' + escapeHtml(c.className) + ' · ' + escapeHtml(c.riskLevel || '—') + '风险' +
          ' <span class="risk-badge ' + oc + '" style="font-size:10px;">' + escapeHtml(Cases.OUTCOME[c.outcome] || c.outcome) + '</span></span>' +
          '<span style="color:var(--color-text-muted);font-size:11px;">' + escapeHtml(String(c.closedAt || '').slice(0, 10)) + '</span></div>' +
          '<div style="color:var(--color-text-secondary);margin-top:4px;">相似理由：' + escapeHtml(c.reason) + '</div>' +
          '<div style="color:var(--color-text-muted);margin-top:4px;">当时方案：' + escapeHtml(c.planName || '其他') +
          ' · 打卡完成度 ' + Math.round((c.checkinRate || 0) * 100) + '% · 耗时 ' + (c.durationDays || 0) + ' 天</div>' +
          (c.planSummary ? '<div style="color:var(--color-text-muted);margin-top:4px;max-height:44px;overflow:hidden;">' + escapeHtml(String(c.planSummary).slice(0, 120)) + '</div>' : '') +
          '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    box.innerHTML = h;
  }

  /** 「班级概览」的「有效干预方式」统计（按方案类型汇总解除率） */
  function renderInterventionStats() {
    var box = document.getElementById('interventionStats');
    if (!box) return;
    if (!window.Cases) { box.innerHTML = ''; return; }
    var rows = Cases.effectiveness();
    if (!rows.length) {
      box.innerHTML = '<div style="font-size:12px;color:var(--color-text-muted);padding:8px;">暂无已结案案例。工单标记为「已解除」或「已升级」后，这里会自动汇总哪种干预方式更有效。</div>';
      return;
    }
    var h = '<table class="mini-table" style="width:100%;font-size:12px;"><thead><tr>' +
      '<th>干预方式</th><th>样本数</th><th>解除</th><th>升级</th><th>解除率</th><th>平均打卡完成度</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var color = r.resolveRate >= 60 ? '#137333' : (r.resolveRate >= 30 ? '#e37400' : '#c5221f');
      h += '<tr><td>' + escapeHtml(r.planName) + (r.enough ? '' : ' <span style="font-size:10px;color:var(--color-text-muted);">样本不足</span>') + '</td>' +
        '<td>' + r.total + '</td><td>' + r.resolved + '</td><td>' + r.escalated + '</td>' +
        '<td style="color:' + color + ';font-weight:600;">' + r.resolveRate + '%</td>' +
        '<td>' + (r.avgCheckin === null ? '—' : Math.round(r.avgCheckin * 100) + '%') + '</td></tr>';
    });
    h += '</tbody></table>';
    box.innerHTML = h;
  }

  /* 只读诊断接口：供验收脚本核查"注入 Agent2 的上下文已脱敏"、案例检索结果等。 */
  window.CaseRefeed = {
    lastRetrieval: function () { return lastCaseRetrieval; },
    lastAgent2Input: function () { return lastAgent2Input; },
    findSimilar: function (studentId, k) { return window.Cases ? Cases.findSimilar(currentSnapshot(studentId), k) : null; },
    effectiveness: function () { return window.Cases ? Cases.effectiveness() : []; }
  };

  function handleCardAction(action) { var sid=selectedStudentId;if(!sid)return;switch(action){case'assign-mentor':if(!currentResult){showToast('\u8bf7\u5148\u63d0\u4ea4\u5206\u6790');return;}changeStudentStatus(sid,'supporting');addOperationLog(sid,'mentor_assigned','\u5df2\u5206\u914d\u5b66\u4e1a\u5bfc\u5e08',null,null);showToast('\u5bfc\u5e08\u5df2\u5206\u914d');break;case'start-support':if(!currentResult){showToast('\u8bf7\u5148\u63d0\u4ea4\u5206\u6790');return;}changeStudentStatus(sid,'supporting');addOperationLog(sid,'support_started','\u5e2e\u6276\u65b9\u6848\u5df2\u542f\u52a8','pending','supporting');showToast('\u5e2e\u6276\u5df2\u542f\u52a8');break;case'record-progress':var pg=prompt('\u8bf7\u8f93\u5165\u5e2e\u6276\u8fdb\u5c55\u5907\u6ce8\uff1a');if(pg)addOperationLog(sid,'progress_recorded',pg,null,null);break;case'upload-audit':var aud=prompt('\u8bf7\u8f93\u5165\u6838\u67e5\u8bb0\u5f55\uff1a');if(aud)addOperationLog(sid,'audit_uploaded',aud,null,null);break;case'mark-pass':changeStudentStatus(sid,'resolved');addOperationLog(sid,'audit_pass','\u6838\u67e5\u901a\u8fc7\uff0c\u9884\u8b66\u89e3\u9664','reviewing','resolved');break;case'mark-fail':addOperationLog(sid,'audit_fail','\u6838\u67e5\u672a\u901a\u8fc7\uff0c\u9700\u7ee7\u7eed\u5e2e\u6276',null,null);changeStudentStatus(sid,'supporting');break;case'trigger-warning':addOperationLog(sid,'warning_triggered','\u89e6\u53d1\u4e8c\u6b21\u9884\u8b66\uff0c\u5347\u7ea7\u5173\u6ce8\u7ea7\u522b',null,null);showToast('\u4e8c\u6b21\u9884\u8b66\u5df2\u89e6\u53d1');break;} }

  function addOperationLog(studentId, action, note, oldStatus, newStatus) { var entry={studentId:studentId,action:action,operator:'\u7cfb\u7edf',time:formatTime(new Date()),note:note};for(var i=0;i<mockStudents.length;i++){if(mockStudents[i].id===studentId){if(!mockStudents[i].operationLog)mockStudents[i].operationLog=[];mockStudents[i].operationLog.unshift(entry);break;}} if(selectedStudentId===studentId)renderOperationLog(studentId); }

  function renderOperationLog(studentId) { if(!operationLogList)return;var student=null;for(var i=0;i<mockStudents.length;i++){if(mockStudents[i].id===studentId){student=mockStudents[i];break;}} if(!student||!student.operationLog||student.operationLog.length===0){operationLogList.innerHTML='<div class="history-empty">\u6682\u65e0\u64cd\u4f5c\u8bb0\u5f55</div>';return;}var html='';for(var j=0;j<student.operationLog.length;j++){var e=student.operationLog[j];var dc='operation-log-dot';if(e.action==='status_change')dc+=' op-dot-'+(e.newStatus||'pending');else dc+=' op-dot-action';html+='<div class="operation-log-entry"><span class="'+dc+'"></span><div class="operation-log-body"><div class="operation-log-note">'+escapeHtml(e.note)+'</div><div class="operation-log-meta">'+escapeHtml(e.operator)+' '+'\u00b7'+' '+escapeHtml(e.time)+'</div></div></div>';} operationLogList.innerHTML=html; }



  // ================================================================


  // ===== 帮扶方案 =====
  var tabPlan = document.getElementById('tabPlan');
  var planHeader = document.getElementById('planHeader');
  var planContent = document.getElementById('planContent');
  var planHistory = document.getElementById('planHistory');
  var planStatus = document.getElementById('planStatus');
  var planCreatedAt = document.getElementById('planCreatedAt');
  var planActions = document.getElementById('planActions');
  var btnApprovePlan = document.getElementById('btnApprovePlan');
  var btnRejectPlan = document.getElementById('btnRejectPlan');
  var btnEditPlan = document.getElementById('btnEditPlan');

  function renderSupportPlan() {
    if (!tabPlan) return;
    var student = null;
    for (var i = 0; i < mockStudents.length; i++) {
      if (mockStudents[i].id === selectedStudentId) { student = mockStudents[i]; break; }
    }
    if (!student) {
      if (planHeader) planHeader.style.display = 'none';
      if (planActions) planActions.style.display = 'none';
      if (planStatus) planStatus.textContent = '待选择学生';
      if (planContent) planContent.innerHTML = '<div class="card history-empty"><strong>请先在左侧选择学生</strong><div style="margin-top:8px;">点击左侧花名册中的学生后，这里会显示个性化帮扶方案。</div></div>';
      if (planHistory) planHistory.innerHTML = '<div class="history-empty">选择学生后可查看方案修改历史</div>';
      return;
    }
    // Auto-generate plan if missing
    // 注意：任务流由 Agent2 生成的方案是 supportPlan.actions（含 success_criteria），
    // 没有 weeks。此时**不能**再自动生成"周计划"覆盖它 —— 那会把辅导员要审批的
    // 真实方案替换掉，也会让 Agent3 失去可核查的依据。
    var flowPlanActions = student.supportPlan && student.supportPlan.actions && student.supportPlan.actions.length;
    if (!flowPlanActions && (!student.supportPlan || !student.supportPlan.weeks)) {
      var factors = student._riskLevel ? ['风险等级：' + (student._riskLevel === '高' ? '高风险' : student._riskLevel === '中' ? '中风险' : '低风险')] : [];
      // Add grade-based factors
      var grades = student.grades || '';
      var courses = ['高数','英语','编程','计算机基础'];
      courses.forEach(function(c) {
        var m = grades.match(new RegExp(c + '[^0-9]*(\\d+)'));
        if (m) { var s = parseInt(m[1]); if (s < 60) factors.push('【' + c + '】不及格(' + s + '分)'); }
      });
      var matchedKb = typeof matchKnowledge !== 'undefined' ? matchKnowledge(factors) : [];
    // Fallback: always include at least 5 knowledge items
    if (matchedKb.length < 3 && typeof knowledgeBase !== 'undefined') {
      for (var fbi = 0; fbi < Math.min(5, knowledgeBase.length); fbi++) {
        var alreadyIn = false;
        for (var mbi = 0; mbi < matchedKb.length; mbi++) {
          if (matchedKb[mbi].id === knowledgeBase[fbi].id) { alreadyIn = true; break; }
        }
        if (!alreadyIn) matchedKb.push(knowledgeBase[fbi]);
      }
    }
      if (matchedKb.length === 0) {
        // Fallback: match a few default topics
        for (var ki = 0; ki < Math.min(3, knowledgeBase.length); ki++) {
          if (matchedKb.length < 3) matchedKb.push(knowledgeBase[ki]);
        }
      }
      if (typeof generateLearningPath !== 'undefined') {
        var lp = generateLearningPath(matchedKb);
        for (var wi = 0; wi < lp.length; wi++) {
          for (var di = 0; di < lp[wi].items.length; di++) {
            lp[wi].items[di].duration = '2h';
            lp[wi].items[di].knowledgeId = lp[wi].items[di].item ? lp[wi].items[di].item.id : '';
          }
        }
        student.supportPlan = { status: 'draft', createdAt: formatTime(new Date()), weeks: lp, history: [{action:'自动生成',time:formatTime(new Date()),operator:'系统'}] };
      }
    }
    if (!student.supportPlan || (!student.supportPlan.weeks && !(student.supportPlan.actions && student.supportPlan.actions.length))) {
      // Always generate a fallback plan
      var fbItems = [];
      for (var fi = 0; fi < Math.min(5, knowledgeBase.length); fi++) {
        var kbi = knowledgeBase[fi];
        fbItems.push({ day: fi+1, task: '学习《' + kbi.title + '》', resource: (kbi.resources||['讲义'])[0], duration: '2h', knowledgeId: kbi.id, item: kbi });
      }
      student.supportPlan = { status: 'draft', createdAt: formatTime(new Date()), weeks: [
        { week: 1, title: '第 1 周', items: fbItems.slice(0,3) },
        { week: 2, title: '第 2 周', items: fbItems.slice(3,5) }
      ], history: [{action:'自动生成',time:formatTime(new Date()),operator:'系统'}] };
      // Fall through to render below
      // Plan now available, continue rendering
    }
    var pl = student.supportPlan;
    // 流程生成的方案可能没有 status/history（老数据或首次落库），补齐默认值，
    // 否则下面的审批按钮会因为 history 不存在而报错。
    if (!pl.status) pl.status = 'draft';
    if (!pl.createdAt) pl.createdAt = formatTime(new Date());
    if (!pl.history) pl.history = [{ action: '由三 Agent 任务流生成', time: pl.createdAt, operator: '系统' }];
    if (planActions) planActions.style.display = pl.status === 'approved' ? 'none' : '';
    if (planHeader) planHeader.style.display = '';
    var stLabel = pl.status === 'approved' ? '已通过' : pl.status === 'rejected' ? '已驳回' : '草稿';
    var stCls = pl.status === 'approved' ? 'status-resolved' : pl.status === 'rejected' ? 'status-pending' : 'status-supporting';
    if (planStatus) { planStatus.textContent = stLabel; planStatus.className = 'status-badge ' + stCls; }
    if (planCreatedAt) planCreatedAt.textContent = '创建于 ' + (pl.createdAt || '');
    var html = '';
    if (pl.actions && pl.actions.length) {
      // Agent2 生成的行动式方案：逐条显示负责人 / 期限 / 可核查完成标准。
      // 完成标准必须显示出来 —— 辅导员审批的就是它，Agent3 复核的也是它。
      html += '<div class="learning-path-week"><div class="learning-path-week-header">帮扶行动（' + pl.actions.length + ' 项，来自 Agent2）</div>';
      for (var ai = 0; ai < pl.actions.length; ai++) {
        var act = pl.actions[ai];
        var crit = (act.success_criteria && act.success_criteria[0]) || {};
        html += '<div class="learning-path-item"><span class="learning-path-day">' + escapeHtml(act.action_id || ('A' + (ai + 1))) + '</span>' +
          '<span class="plan-task-text">' + escapeHtml(act.description || '') + '</span>' +
          '<span style="font-size:10px;color:var(--color-text-muted);">' + escapeHtml(act.owner || '') + ' · 第 ' + (act.deadline_day || '-') + ' 天</span></div>' +
          '<div style="font-size:11px;color:var(--color-text-muted);padding:0 0 8px 54px;">完成标准：' + escapeHtml(crit.metric || '') + ' ' + escapeHtml(crit.target || '') + '（数据来源：' + escapeHtml(crit.data_source || '') + '）</div>';
      }
      html += '</div>';
      if (pl.summary) html += '<div style="font-size:11px;color:var(--color-text-muted);margin-top:6px;">' + escapeHtml(pl.summary) + '</div>';
    } else {
      for (var w = 0; w < pl.weeks.length; w++) {
        var week = pl.weeks[w];
        html += '<div class="learning-path-week"><div class="learning-path-week-header">' + week.title + '</div>';
        for (var d = 0; d < week.items.length; d++) {
          var item = week.items[d];
          html += '<div class="learning-path-item" data-week="' + w + '" data-day="' + d + '"><span class="learning-path-day">Day ' + item.day + '</span><span class="plan-task-text">' + escapeHtml(item.task) + '</span><span style="font-size:10px;color:var(--color-text-muted);">' + escapeHtml(item.resource) + '</span><span style="font-size:10px;color:var(--color-text-muted);">' + (item.duration || '2h') + '</span></div>';
        }
        html += '</div>';
      }
    }
    planContent.innerHTML = html;
    var histHtml = '';
    if (pl.history && pl.history.length > 0) {
      for (var h = 0; h < pl.history.length; h++) {
        var entry = pl.history[h];
        histHtml += '<div class="operation-log-entry"><span class="operation-log-dot op-dot-action"></span><div class="operation-log-body"><div class="operation-log-note">' + escapeHtml(entry.action) + '</div><div class="operation-log-meta">' + escapeHtml(entry.operator) + ' ' + '\u00b7' + ' ' + escapeHtml(entry.time) + '</div></div></div>';
      }
    } else { histHtml = '<div class="history-empty">暂无修改记录</div>'; }
    if (planHistory) planHistory.innerHTML = histHtml;
  }

  function approvePlan() {
    var student = null;
    for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === selectedStudentId) { student = mockStudents[i]; break; } }
    if (!student || !student.supportPlan) return;
    student.supportPlan.status = 'approved';
    student.supportPlan.history.unshift({action:'通过',time:formatTime(new Date()),operator:'教师'});
    if (typeof changeStudentStatus !== 'undefined') changeStudentStatus(selectedStudentId, 'supporting');
    if (typeof addOperationLog !== 'undefined') addOperationLog(selectedStudentId, 'plan_approved', '帮扶方案已通过');
    renderSupportPlan();
    showToast('方案已通过并下发');
  }

  function rejectPlan() {
    var reason = prompt('请输入驳回原因：');
    if (!reason) return;
    var student = null;
    for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === selectedStudentId) { student = mockStudents[i]; break; } }
    if (!student || !student.supportPlan) return;
    student.supportPlan.status = 'rejected';
    student.supportPlan.history.unshift({action:'驳回: '+reason,time:formatTime(new Date()),operator:'教师'});
    if (typeof addOperationLog !== 'undefined') addOperationLog(selectedStudentId, 'plan_rejected', '帮扶方案已驳回: ' + reason);
    renderSupportPlan();
    showToast('方案已驳回');
  }

  function editPlan() {
    var student = null;
    for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === selectedStudentId) { student = mockStudents[i]; break; } }
    if (!student || !student.supportPlan) return;
    var isEditing = planContent.getAttribute('data-editing') === 'true';
    if (isEditing) {
      planContent.setAttribute('data-editing', 'false');
      btnEditPlan.textContent = '编辑';
      planContent.querySelectorAll('.plan-task-text').forEach(function(el) { el.contentEditable = 'false'; el.style.outline = ''; });
      var items = planContent.querySelectorAll('.learning-path-item');
      items.forEach(function(item) {
        var w = parseInt(item.getAttribute('data-week')); var d = parseInt(item.getAttribute('data-day'));
        var text = item.querySelector('.plan-task-text');
        if (text && student.supportPlan.weeks[w] && student.supportPlan.weeks[w].items[d]) {
          student.supportPlan.weeks[w].items[d].task = text.textContent.trim();
        }
      });
      student.supportPlan.history.unshift({action:'手动编辑',time:formatTime(new Date()),operator:'教师'});
      if (typeof addOperationLog !== 'undefined') addOperationLog(selectedStudentId, 'plan_edited', '帮扶方案已手动编辑');
      renderSupportPlan();
      showToast('方案已保存');
    } else {
      planContent.setAttribute('data-editing', 'true');
      btnEditPlan.textContent = '保存';
      planContent.querySelectorAll('.plan-task-text').forEach(function(el) { el.contentEditable = 'true'; el.style.outline = '1px dashed var(--color-primary)'; el.style.padding = '2px 4px'; });
      showToast('编辑模式：修改任务后点击保存');
    }
  }

  // ===== 打卡管理 =====
  var tabCheckin = document.getElementById('tabCheckin');
  var ckTableBody = document.getElementById('ckTableBody');
  var ckDateFilter = document.getElementById('ckDateFilter');
  var ckStatusFilter = document.getElementById('ckStatusFilter');
  var ckVerifyFilter = document.getElementById('ckVerifyFilter');
  var ckSearch = document.getElementById('ckSearch');
  var ckSelectAll = document.getElementById('ckSelectAll');
  var btnBatchApprove = document.getElementById('btnBatchApprove');
  var btnBatchReject = document.getElementById('btnBatchReject');
  var ckDetailModal = document.getElementById('ckDetailModal');
  var ckDetailBody = document.getElementById('ckDetailBody');
  var ckDetailClose = document.getElementById('ckDetailClose');

  var checkinData = [
    { id:'CK-001', studentId:'2024100101', studentName:'张三', date:'2026-07-15', type:'text', content:'已完成高数第一章习题10道，通过函数极限定义掌握了\u03b5-\u03b4语言', status:'completed', verified:'approved', overdue:false },
    { id:'CK-002', studentId:'2024100102', studentName:'李四', date:'2026-07-15', type:'image', content:'\\image\\高数作业拍照\\/image\\', status:'completed', verified:'pending', overdue:false },
    { id:'CK-003', studentId:'2024100103', studentName:'王五', date:'2026-07-15', type:'text', content:'C语言上机实验完成，调试通过3个排序算法程序', status:'completed', verified:'approved', overdue:false },
    { id:'CK-004', studentId:'2024100201', studentName:'赵六', date:'2026-07-15', type:'text', content:'', status:'pending', verified:'pending', overdue:true },
    { id:'CK-005', studentId:'2024100202', studentName:'孙七', date:'2026-07-16', type:'document', content:'电子版实验报告已上传至云盘链接', status:'completed', verified:'pending', overdue:false },
    { id:'CK-006', studentId:'2024100101', studentName:'张三', date:'2026-07-16', type:'text', content:'背诵英语四级核心词汇50个，完成阅读理解1篇', status:'completed', verified:'approved', overdue:false },
    { id:'CK-007', studentId:'2024100201', studentName:'赵六', date:'2026-07-16', type:'text', content:'', status:'pending', verified:'pending', overdue:true },
    { id:'CK-008', studentId:'2024100301', studentName:'周八', date:'2026-07-16', type:'image', content:'\\image\\编程作业截图\\/image\\', status:'completed', verified:'rejected', overdue:false }
  ];

  function renderCheckinTable() {
    if (!ckTableBody) return;
    var dFilter = ckDateFilter ? ckDateFilter.value : '';
    var sFilter = ckStatusFilter ? ckStatusFilter.value : '';
    var vFilter = ckVerifyFilter ? ckVerifyFilter.value : '';
    var search = (ckSearch ? ckSearch.value : '').toLowerCase();
    var filtered = checkinData.filter(function(c) {
      if (dFilter && c.date !== dFilter) return false;
      if (sFilter && c.status !== sFilter) return false;
      if (vFilter && c.verified !== vFilter) return false;
      if (search && c.studentName.toLowerCase().indexOf(search) === -1) return false;
      return true;
    });
    // Update date filter options
    if (ckDateFilter) {
      var dates = []; checkinData.forEach(function(c) { if (dates.indexOf(c.date) === -1) dates.push(c.date); });
      dates.sort();
      ckDateFilter.innerHTML = '<option value="">全部日期</option>' + dates.map(function(d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
      ckDateFilter.value = dFilter;
    }
    if (!filtered.length) { ckTableBody.innerHTML = '<tr><td colspan="7" class="ledger-empty">暂无打卡记录</td></tr>'; return; }
    var typeLabels = { text:'文字', image:'图片', document:'文档' };
    var html = '';
    filtered.forEach(function(c) {
      var overdueTag = c.overdue ? ' <span class="risk-badge risk-high" style="font-size:10px;">逾期</span>' : '';
      html += '<tr data-ckid="' + c.id + '">' +
        '<td><input type="checkbox" class="ck-checkbox" data-ckid="' + c.id + '"></td>' +
        '<td>' + c.studentName + overdueTag + '</td><td>' + c.date + '</td><td>' + (typeLabels[c.type] || c.type) + '</td>' +
        '<td><span class="status-badge ' + (c.status === 'completed' ? 'status-resolved' : 'status-pending') + '">' + (c.status === 'completed' ? '已完成' : '未打卡') + '</span></td>' +
        '<td><span class="status-badge ' + (c.verified === 'approved' ? 'status-resolved' : c.verified === 'rejected' ? 'status-pending' : 'status-supporting') + '">' + (c.verified === 'approved' ? '已通过' : c.verified === 'rejected' ? '已驳回' : '待核验') + '</span></td>' +
        '<td><button class="ledger-btn" data-action="ck-detail" data-ckid="' + c.id + '">查看</button></td></tr>';
    });
    ckTableBody.innerHTML = html;
    // Bind click to view detail
    ckTableBody.querySelectorAll('.ledger-btn').forEach(function(b) {
      b.addEventListener('click', function(e) { e.stopPropagation(); showCheckinDetail(this.getAttribute('data-ckid')); });
    });
    ckTableBody.querySelectorAll('tr[data-ckid]').forEach(function(tr) {
      tr.addEventListener('click', function(e) { if (!e.target.closest('input')) showCheckinDetail(this.getAttribute('data-ckid')); });
    });
    // Select all
    if (ckSelectAll) ckSelectAll.checked = false;
  }

  /* ================================================================
   *  学生申报工单（学生端「困难申报」→ 教师端接单处理闭环）
   *  数据来自共享模块 tickets.js（localStorage:supportTickets），
   *  两端不各写一份存储代码，避免键名/字段漂移。
   * ================================================================ */

  var tabTickets = document.getElementById('tabTickets');
  var ticketList = document.getElementById('ticketList');
  var ticketStats = document.getElementById('ticketStats');

  function ticketStatusClass(s) {
    return s === 'closed' ? 'risk-low' : (s === 'accepted' ? 'risk-medium' : 'risk-high');
  }

  function ticketLog(entry) {
    var me = (window.Session && Session.current()) || { name: '教师' };
    return { at: new Date().toISOString(), by: me.name || '教师', action: entry };
  }

  function renderTickets() {
    if (!ticketList) return;
    var all = (window.Tickets ? Tickets.sorted() : []);
    var st = (window.Tickets ? Tickets.stats() : { pending: 0, accepted: 0, closed: 0, urgent: 0 });

    if (ticketStats) {
      ticketStats.innerHTML =
        '<div class="stat-card" style="flex:1;"><div class="stat-card-label">待处理</div><div class="stat-card-value" style="color:#d93025;">' + st.pending + '</div></div>' +
        '<div class="stat-card" style="flex:1;"><div class="stat-card-label">处理中</div><div class="stat-card-value" style="color:#1a73e8;">' + st.accepted + '</div></div>' +
        '<div class="stat-card" style="flex:1;"><div class="stat-card-label">已结案</div><div class="stat-card-value" style="color:#0d904f;">' + st.closed + '</div></div>' +
        '<div class="stat-card" style="flex:1;"><div class="stat-card-label">紧急未结</div><div class="stat-card-value" style="color:#e37400;">' + st.urgent + '</div></div>';
    }

    if (!all.length) {
      ticketList.innerHTML = '<div class="ledger-empty" style="padding:14px;color:var(--color-text-muted);font-size:12px;">暂无学生申报。学生端提交「困难申报」后会实时出现在这里。</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < all.length; i++) {
      var t = all[i];
      var label = (window.Tickets.STATUS[t.status] || '待处理');
      var log = (t.handleLog || []).map(function (l) {
        return '<div style="font-size:11px;color:var(--color-text-muted);">· ' + escapeHtml((l.at || '').slice(0, 16).replace('T', ' ')) + ' ' + escapeHtml(l.by || '') + ' ' + escapeHtml(l.action || '') + '</div>';
      }).join('');
      html += '<div class="ticket-row" data-ticket="' + escapeHtml(t.id) + '" style="border-top:1px dashed var(--color-border-light);padding:10px 0;">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">' +
        '<div><span class="risk-badge ' + ticketStatusClass(t.status) + '" style="font-size:10px;">' + escapeHtml(label) + '</span> ' +
        (t.urgency === 'urgent' ? '<span class="risk-badge risk-high" style="font-size:10px;">紧急</span> ' : '') +
        '<strong>' + escapeHtml(t.studentName || '未知') + '</strong> ' +
        '<span style="font-size:11px;color:var(--color-text-muted);">' + escapeHtml(t.studentId || '') + ' · ' + escapeHtml(t.className || '未分班') + '</span></div>' +
        '<span style="font-size:11px;color:var(--color-text-muted);">' + escapeHtml(String(t.createdAt || '').slice(0, 16).replace('T', ' ')) + '</span></div>' +
        '<div style="font-size:12px;margin-top:4px;">类型：' + escapeHtml(t.type || '其他') + ' · 工单号 ' + escapeHtml(t.id) + '</div>' +
        '<div class="ticket-detail" style="display:none;margin-top:6px;padding:8px;background:var(--color-bg);border-radius:4px;font-size:12px;">' +
        '<div><strong>描述：</strong>' + escapeHtml(t.desc || '') + '</div>' +
        '<div style="margin-top:4px;"><strong>联系方式：</strong>' + escapeHtml(t.contact || '未填写') + '</div>' +
        (t.handler ? '<div style="margin-top:4px;"><strong>处理人：</strong>' + escapeHtml(t.handler) + '</div>' : '') +
        (t.result ? '<div style="margin-top:4px;color:#166534;"><strong>处理结论：</strong>' + escapeHtml(t.result) + '</div>' : '') +
        (log ? '<div style="margin-top:6px;">' + log + '</div>' : '') +
        '</div>' +
        '<div style="margin-top:8px;display:flex;gap:8px;">' +
        '<button class="ledger-btn" data-tk-toggle="' + escapeHtml(t.id) + '">展开详情</button>' +
        (t.status === 'pending' ? '<button class="ledger-btn" data-tk-accept="' + escapeHtml(t.id) + '">接单</button>' : '') +
        (t.status !== 'closed' ? '<button class="ledger-btn" data-tk-close="' + escapeHtml(t.id) + '">填写处理结论</button>' : '') +
        '</div></div>';
    }
    ticketList.innerHTML = html;

    ticketList.querySelectorAll('[data-tk-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        var row = this.closest('.ticket-row');
        var d = row ? row.querySelector('.ticket-detail') : null;
        if (!d) return;
        var shown = d.style.display !== 'none';
        d.style.display = shown ? 'none' : 'block';
        this.textContent = shown ? '展开详情' : '收起详情';
      });
    });
    ticketList.querySelectorAll('[data-tk-accept]').forEach(function (b) {
      b.addEventListener('click', function () { ticketAccept(this.getAttribute('data-tk-accept')); });
    });
    ticketList.querySelectorAll('[data-tk-close]').forEach(function (b) {
      b.addEventListener('click', function () { ticketClose(this.getAttribute('data-tk-close')); });
    });
  }

  function ticketAccept(id) {
    if (!window.Tickets) return;
    if (window.Perm && !Perm.can('teacher', 'ticket:handle', false)) { showToast('当前身份无权处理申报'); return; }
    var me = (window.Session && Session.current()) || { name: '教师' };
    var t = Tickets.get(id);
    if (!t) { showToast('工单不存在'); return; }
    Tickets.update(id, { status: 'accepted', handler: me.name || '教师' }, ticketLog('接单'));
    if (window.Session && Session.log) Session.log({ event: 'ticket_accept', role: 'teacher', id: id, name: me.name || '' });
    if (window.Perm) Perm.audit({ action: 'write', subjectId: t.studentId, subjectName: t.studentName, fields: ['status', 'handler'] });
    renderTickets();
    showToast('已接单：' + (t.studentName || t.studentId));
  }

  function ticketClose(id) {
    if (!window.Tickets) return;
    if (window.Perm && !Perm.can('teacher', 'ticket:handle', false)) { showToast('当前身份无权处理申报'); return; }
    var me = (window.Session && Session.current()) || { name: '教师' };
    var t = Tickets.get(id);
    if (!t) { showToast('工单不存在'); return; }
    var result = prompt('请输入处理结论（必填）：');
    if (!result || !String(result).trim()) { showToast('处理结论不能为空'); return; }
    Tickets.update(id, { status: 'closed', result: String(result).trim(), handler: t.handler || me.name || '教师' }, ticketLog('结案：' + String(result).trim().slice(0, 40)));
    if (window.Session && Session.log) Session.log({ event: 'ticket_close', role: 'teacher', id: id, name: me.name || '' });
    if (window.Perm) Perm.audit({ action: 'write', subjectId: t.studentId, subjectName: t.studentName, fields: ['status', 'result'] });
    renderTickets();
    showToast('已结案');
  }

  function showCheckinDetail(ckid) {    var c = null;
    for (var i = 0; i < checkinData.length; i++) { if (checkinData[i].id === ckid) { c = checkinData[i]; break; } }
    if (!c || !ckDetailModal || !ckDetailBody) return;
    var typeLabel = { text:'文字打卡', image:'图片打卡', document:'文档打卡' };
    var contentHtml = c.content;
    if (c.type === 'image') contentHtml = contentHtml.replace('\\image\\', '<div style="background:#f0f0f0;height:120px;display:flex;align-items:center;justify-content:center;border-radius:4px;margin:8px 0;">[图片预览模拟：' + c.studentName + '的打卡截图]</div>').replace('\\/image\\', '');
    ckDetailBody.innerHTML = '<p><strong>学生：</strong>' + c.studentName + '</p><p><strong>日期：</strong>' + c.date + '</p><p><strong>类型：</strong>' + (typeLabel[c.type] || c.type) + '</p><p><strong>内容：</strong></p><div style="background:#f8f9fb;padding:10px;border-radius:4px;margin:8px 0;">' + contentHtml + '</div><p><strong>核验状态：</strong>' + (c.verified === 'approved' ? '已通过' : c.verified === 'rejected' ? '已驳回' : '待核验') + '</p>';
    ckDetailModal.style.display = '';
  }

  function batchVerify(action) {
    var checked = ckTableBody.querySelectorAll('.ck-checkbox:checked');
    if (!checked.length) { showToast('请先选择打卡记录'); return; }
    var comment = action === 'rejected' ? (prompt('请输入驳回评语：') || '未填写评语') : '';
    checked.forEach(function(cb) {
      var ckid = cb.getAttribute('data-ckid');
      for (var i = 0; i < checkinData.length; i++) {
        if (checkinData[i].id === ckid) { checkinData[i].verified = action; if (action === 'rejected') checkinData[i].comment = comment; break; }
      }
    });
    showToast((action === 'approved' ? '已通过' : '已驳回') + ' ' + checked.length + ' 条记录');
    renderCheckinTable();
  }


  // ===== 导出功能 =====
  var exportDropdownWrap = document.getElementById('exportDropdownWrap');
  var exportDropdownMenu = document.getElementById('exportDropdownMenu');

  function toggleExportMenu() {
    if (!exportDropdownMenu) return;
    exportDropdownMenu.style.display = exportDropdownMenu.style.display === 'none' ? '' : 'none';
  }

  function exportStudentsXLSX() {
    var data = [['姓名','学号','班级','高数','英语','编程','计算机基础','风险等级','工单状态']];
    mockStudents.forEach(function(s) {
      var g = s.grades || '';
      var scores = {};
      ['高数','英语','编程','计算机基础'].forEach(function(c) {
        var m = g.match(new RegExp(c + '[^0-9]*(\\d+)')); scores[c] = m ? m[1] : '-';
      });
      var riskLabel = s._riskLevel === '高' ? '高风险' : s._riskLevel === '中' ? '中风险' : '低风险';
      var stLabel = s.status === 'pending' ? '待干预' : (s.status === 'supporting' || s.status === 'reviewing') ? '处理中' : '已办结';
      data.push([s.name, s.id, s.className, scores['高数'], scores['英语'], scores['编程'], scores['计算机基础'], riskLabel, stLabel]);
    });
    downloadXLSX(data, '班级学生信息');
  }

  function exportTicketsXLSX() {
    var data = [['工单编号','学生姓名','学号','班级','风险等级','触发原因','触发时间','工单状态']];
    mockStudents.forEach(function(s) {
      if (!s.ticketId) return;
      var riskLabel = s._riskLevel === '高' ? '高风险' : s._riskLevel === '中' ? '中风险' : '低风险';
      var stLabel = s.status === 'pending' ? '待干预' : (s.status === 'supporting' || s.status === 'reviewing') ? '处理中' : '已办结';
      data.push([s.ticketId, s.name, s.id, s.className, riskLabel, s.ticketReason||'', s.ticketTime||'', stLabel]);
    });
    downloadXLSX(data, '预警工单报表');
  }

  function exportCheckinXLSX() {
    var data = [['日期','总打卡人数','已完成','完成率']];
    var dateStats = {};
    checkinData.forEach(function(c) {
      if (!dateStats[c.date]) dateStats[c.date] = { total: 0, completed: 0 };
      dateStats[c.date].total++;
      if (c.status === 'completed') dateStats[c.date].completed++;
    });
    for (var d in dateStats) {
      if (dateStats.hasOwnProperty(d)) {
        var s = dateStats[d];
        data.push([d, s.total, s.completed, Math.round(s.completed / s.total * 100) + '%']);
      }
    }
    downloadXLSX(data, '打卡完成率报表');
  }

  function downloadXLSX(data, filename) {
    var ws = XLSX.utils.aoa_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename + '_' + formatTime(new Date()).replace(/[:\s]/g, '_') + '.xlsx');
  }


  // ===== 知识库管理 =====
  var tabKbAdmin = document.getElementById('tabKbAdmin');
  var kbAdminBody = document.getElementById('kbAdminBody');
  var kbAdminSearch = document.getElementById('kbAdminSearch');
  var kbTestQuery = document.getElementById('kbTestQuery');
  var kbTestResults = document.getElementById('kbTestResults');
  var kbEditModal = document.getElementById('kbEditModal');
  var kbUploadBar = document.getElementById('kbUploadBar');
  var editingKbId = null;

  function renderKbAdmin() {
    if (!kbAdminBody) return;
    var q = (kbAdminSearch ? kbAdminSearch.value : '').toLowerCase();
    var items = knowledgeBase.filter(function(k) {
      return !q || k.title.toLowerCase().indexOf(q) !== -1 || k.course.toLowerCase().indexOf(q) !== -1;
    });
    var html = '';
    items.forEach(function(k) {
      var chunkStatus = k.chunkStatus || '已分块';
      var indexStatus = k.indexStatus || '已索引';
      var perm = k.visible || 'all';
      html += '<tr><td>' + escapeHtml(k.title) + '</td><td>' + escapeHtml(k.course) + '</td><td><span class="knowledge-difficulty diff-' + k.difficulty + '">' + k.difficulty + '</span></td><td style="color:#0d904f;">' + chunkStatus + '</td><td style="color:#1a73e8;">' + indexStatus + '</td><td>' + (perm === 'all' ? '学生+教师' : '仅教师') + '</td><td><button class="ledger-btn" data-action="kb-edit" data-kbid="' + k.id + '">编辑</button> <button class="ledger-btn" data-action="kb-delete" data-kbid="' + k.id + '" style="color:#d93025;">删除</button></td></tr>';
    });
    if (!items.length) html = '<tr><td colspan="7" class="ledger-empty">暂无知识点</td></tr>';
    kbAdminBody.innerHTML = html;
    kbAdminBody.querySelectorAll('[data-action="kb-edit"]').forEach(function(b) {
      b.addEventListener('click', function(e) { e.stopPropagation(); openKbEdit(this.getAttribute('data-kbid')); });
    });
    kbAdminBody.querySelectorAll('[data-action="kb-delete"]').forEach(function(b) {
      b.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!confirm('确认删除该知识点？')) return;
        var kbid = this.getAttribute('data-kbid');
        for (var i = knowledgeBase.length - 1; i >= 0; i--) { if (knowledgeBase[i].id === kbid) { knowledgeBase.splice(i, 1); break; } }
        renderKbAdmin(); showToast('已删除');
      });
    });
  }

  function openKbEdit(kbid) {
    editingKbId = kbid || null;
    document.getElementById('kbEditTitle').textContent = kbid ? '编辑知识点' : '新增知识点';
    if (kbid) {
      var item = null;
      for (var i = 0; i < knowledgeBase.length; i++) { if (knowledgeBase[i].id === kbid) { item = knowledgeBase[i]; break; } }
      if (item) {
        document.getElementById('kbEditTitleInput').value = item.title || '';
        document.getElementById('kbEditCourse').value = item.course || '高等数学';
        document.getElementById('kbEditSummary').value = item.summary || '';
        document.getElementById('kbEditDiff').value = item.difficulty || '基础';
        document.getElementById('kbEditPerm').value = item.visible || 'all';
      }
    } else {
      document.getElementById('kbEditTitleInput').value = '';
      document.getElementById('kbEditSummary').value = '';
    }
    if (kbEditModal) kbEditModal.style.display = '';
  }

  function saveKbEntry() {
    var title = document.getElementById('kbEditTitleInput').value.trim();
    if (!title) { showToast('请输入标题'); return; }
    var course = document.getElementById('kbEditCourse').value;
    var summary = document.getElementById('kbEditSummary').value.trim();
    var diff = document.getElementById('kbEditDiff').value;
    var perm = document.getElementById('kbEditPerm').value;
    if (editingKbId) {
      for (var i = 0; i < knowledgeBase.length; i++) {
        if (knowledgeBase[i].id === editingKbId) {
          knowledgeBase[i].title = title; knowledgeBase[i].course = course;
          knowledgeBase[i].summary = summary; knowledgeBase[i].difficulty = diff;
          knowledgeBase[i].visible = perm; break;
        }
      }
    } else {
      var newId = 'kb-' + Date.now().toString(36);
      knowledgeBase.push({ id: newId, title: title, course: course, summary: summary,
        difficulty: diff, visible: perm, tags: [], resources: [], resourceLinks: [],
        content: summary, examples: [], exercises: [], chunkStatus: '已分块', indexStatus: '已索引' });
    }
    if (kbEditModal) kbEditModal.style.display = 'none';
    renderKbAdmin();
    showToast(editingKbId ? '已更新' : '已添加');
  }

  // ===== 知识库上传（真实解析 txt/md/csv/json/xlsx）=====
  function persistKbExtra(entries) {
    try {
      var arr = JSON.parse(localStorage.getItem('kbExtraEntries') || '[]');
      localStorage.setItem('kbExtraEntries', JSON.stringify(arr.concat(entries).slice(-300)));
    } catch (e) {}
  }

  function loadKbExtra() {
    try {
      var arr = JSON.parse(localStorage.getItem('kbExtraEntries') || '[]');
      for (var i = 0; i < arr.length; i++) {
        var dup = false;
        for (var j = 0; j < knowledgeBase.length; j++) { if (knowledgeBase[j].id === arr[i].id) { dup = true; break; } }
        if (!dup) knowledgeBase.push(arr[i]);
      }
    } catch (e) {}
  }

  function realKbUpload() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.csv,.json,.xlsx,.xls';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (!window.MM || typeof MM.parseToKnowledge !== 'function') { simUpload(); return; }
      if (kbUploadBar) { kbUploadBar.style.display = ''; kbUploadBar.style.width = '10%'; kbUploadBar.textContent = '解析文件中：' + file.name; }
      var courseSel = document.getElementById('kbEditCourse');
      MM.parseToKnowledge(file, { course: (courseSel && courseSel.value) || '通识' }).then(function (entries) {
        for (var i = 0; i < entries.length; i++) knowledgeBase.push(entries[i]);
        persistKbExtra(entries);
        if (kbUploadBar) { kbUploadBar.style.width = '100%'; kbUploadBar.textContent = '上传完成：已解析 ' + entries.length + ' 个分块并写入知识库'; }
        renderKbAdmin();
        if (typeof renderKnowledgeTree === 'function') renderKnowledgeTree();
        showToast('已解析并入库 ' + entries.length + ' 个分块');
      }).catch(function (err) {
        if (kbUploadBar) { kbUploadBar.style.width = '100%'; kbUploadBar.textContent = '解析失败：' + ((err && err.message) || '未知错误'); }
        showToast('文件解析失败');
      });
    };
    input.click();
  }

  function simUpload() {
    if (kbUploadBar) kbUploadBar.style.display = '';
    var steps = ['解析文件中...', '生成文本分块...', '向量化处理中...', '写入索引库...'];
    var i = 0;
    var timer = setInterval(function() {
      if (kbUploadBar && i < steps.length) { kbUploadBar.textContent = steps[i]; kbUploadBar.style.width = ((i + 1) * 25) + '%'; i++; }
      else { clearInterval(timer);
        if (kbUploadBar) { kbUploadBar.textContent = '上传完成！已生成 3 个分块并完成向量化索引'; kbUploadBar.style.width = '100%'; }
        var newItem = { id:'kb-' + Date.now().toString(36), title:'新上传：' + ['数据结构基础','算法导论','Python入门'][Math.floor(Math.random()*3)],
          course:['程序设计基础','计算机导论'][Math.floor(Math.random()*2)], summary:'模拟上传生成的知识点', difficulty:'基础',
          tags:[], resources:[], resourceLinks:[], content:'模拟内容', examples:[], exercises:[], chunkStatus:'已分块(3块)', indexStatus:'已索引', visible:'all' };
        knowledgeBase.push(newItem);
        renderKbAdmin();
        showToast('模拟文件上传完成');
      }
    }, 600);
  }

  loadKbExtra();
  function kbTestSearch() {
    var q = kbTestQuery ? kbTestQuery.value.trim() : '';
    if (!q) return;
    var results = [];
    knowledgeBase.forEach(function(k) {
      var score = 0;
      if (k.title.indexOf(q) !== -1) score += 0.5;
      if (k.summary && k.summary.indexOf(q) !== -1) score += 0.3;
      if (k.tags && k.tags.some(function(t) { return t.indexOf(q) !== -1; })) score += 0.2;
      score = Math.min(0.99, score);
      if (score >= 0.2) results.push({ item: k, score: score });
    });
    results.sort(function(a, b) { return b.score - a.score; });
    if (!results.length) { kbTestResults.innerHTML = '<div style="color:var(--color-text-muted);">未找到匹配结果</div>'; return; }
    kbTestResults.innerHTML = results.slice(0, 8).map(function(r) {
      return '<div style="padding:6px 0;border-bottom:1px solid var(--color-border-light);display:flex;justify-content:space-between;"><span><strong>' + r.item.title + '</strong> <span style="font-size:10px;color:var(--color-text-muted);">' + r.item.course + '</span></span><span style="color:#1a73e8;font-weight:600;">' + Math.round(r.score * 100) + '%</span></div>';
    }).join('');
  }


  // ===== Agent配置 =====
  // 提示词与温度的唯一事实来源是 agents.js（与 docs/三Agent协同专属提示词.md 逐字对齐）；
  // app.js 只负责把配置读出来给界面用，避免把提示词再抄一份造成两份真相。
  var agentModal = document.getElementById('agentModal');
  var AGENTS = window.Agents;
  var defaultAgentConfigs = AGENTS ? AGENTS.DEFAULT_CONFIGS : {
    agent1: { role: '预警分析师', systemPrompt: '（agents.js 未加载）', temperature: 0.3, maxTokens: 2048 },
    agent2: { role: '帮扶规划师', systemPrompt: '（agents.js 未加载）', temperature: 0.7, maxTokens: 4096 },
    agent3: { role: '执行监督员', systemPrompt: '（agents.js 未加载）', temperature: 0.1, maxTokens: 1024 }
  };
  // 旧版本把三 Agent 存在 warning/support/audit 三个键下。Agents.migrateConfigs 会把
  // "用户没改过的内置短提示词"升级为文档版，同时保留老师自己改过的内容。
  var agentConfigs = AGENTS ? AGENTS.loadConfigs() : defaultAgentConfigs;
  var currentAgent = 'agent1';

  /** 界面沿用老的 data-agent 键名（warning/support/audit），内部统一用 agent1/2/3。 */
  function normalizeAgentKey(key) {
    if (key === 'warning') return 'agent1';
    if (key === 'support') return 'agent2';
    if (key === 'audit') return 'agent3';
    return key || 'agent1';
  }

  function openAgentConfig() {
    if (!agentModal) return;
    currentAgent = 'agent1';
    renderAgentTab();
    agentModal.style.display = '';
    if (agentModal.querySelector('.tab-item.active')) agentModal.querySelector('.tab-item.active').classList.add('active');
  }

  function renderAgentTab() {
    var cfg = agentConfigs[currentAgent];
    if (!cfg) return;
    var desc = currentAgent === 'agent1' ? '风险识别与证据解释（不改动系统评分）'
      : currentAgent === 'agent2' ? '帮扶方案生成与资源匹配（只针对辅导员确认的问题）'
      : '执行期复核（只在有真实执行证据后触发）';
    document.getElementById('agentDescription').textContent =
      cfg.role + ' - ' + desc + '｜提示词版本 ' + (cfg.promptVersion || (AGENTS && AGENTS.VERSION) || '-') +
      (cfg.customized ? '｜已自定义' : '｜文档内置版');
    // 兼容两种字段名：新配置用 systemPrompt，老数据可能是 prompt
    document.getElementById('agentPrompt').value = cfg.systemPrompt || cfg.prompt || '';
    document.getElementById('agentTemp').value = cfg.temperature;
    document.getElementById('tokenVal').textContent = cfg.maxTokens;
    document.getElementById('agentTokens').value = cfg.maxTokens;
    document.getElementById('tempVal').textContent = cfg.temperature;
    var tabs = agentModal.querySelectorAll('.tab-item');
    tabs.forEach(function(t) { t.classList.remove('active'); if (normalizeAgentKey(t.getAttribute('data-agent')) === currentAgent) t.classList.add('active'); });
  }

  function saveAgentConfig() {
    var cfg = agentConfigs[currentAgent];
    if (!cfg) return;
    var typed = document.getElementById('agentPrompt').value;
    cfg.systemPrompt = typed;
    // 与内置文档版不一致即视为自定义：界面上必须能看出来，避免"以为用的是文档版"
    var builtin = (AGENTS && AGENTS.DEFAULT_CONFIGS[currentAgent]) ? AGENTS.DEFAULT_CONFIGS[currentAgent].systemPrompt : '';
    cfg.customized = !!typed && typed !== builtin;
    cfg.temperature = parseFloat(document.getElementById('agentTemp').value);
    cfg.maxTokens = parseInt(document.getElementById('agentTokens').value);
    if (AGENTS) AGENTS.saveConfigs(agentConfigs);
    else localStorage.setItem('agentConfigs', JSON.stringify(agentConfigs));
    showToast((cfg.role || 'Agent') + ' 配置已保存');
  }

  function resetAgentPrompt() {
    var builtin = (AGENTS && AGENTS.DEFAULT_CONFIGS[currentAgent]) ? AGENTS.DEFAULT_CONFIGS[currentAgent].systemPrompt : '';
    document.getElementById('agentPrompt').value = builtin;
    var cfg = agentConfigs[currentAgent];
    if (cfg) {
      cfg.systemPrompt = builtin;
      cfg.customized = false;
      cfg.promptVersion = AGENTS ? AGENTS.VERSION : cfg.promptVersion;
    }
    showToast('已恢复文档内置提示词');
  }

  /**
   * 「测试配置」：不再贴一段写死的假输出，而是真的跑一次契约层
   * （降级模板 + 结构校验），让老师看到"这个 Agent 会产出什么、是否合规"。
   */
  function testAgent() {
    var cfg = agentConfigs[currentAgent];
    saveAgentConfig();
    var result = document.getElementById('agentTestResult');
    result.style.display = '';
    if (!AGENTS || !window.AgentBridge) {
      result.innerHTML = '<strong>Agents 契约层未加载</strong>（agents.js / agentBridge.js 未就绪）';
      return;
    }
    var sid = selectedStudentId || (mockStudents[0] && mockStudents[0].id);
    var input;
    try {
      if (currentAgent === 'agent1') {
        input = AgentBridge.buildAnalysisInput({ studentId: sid });
      } else if (currentAgent === 'agent2') {
        // Agent2 只处理"辅导员确认过的问题"：这里用 Agent1 降级输出的 findings 模拟确认后的输入
        var a1 = AgentBridge.buildAnalysisInput({ studentId: sid });
        input = AgentBridge.buildPlanInput({ studentId: sid, findings: AGENTS.mock('agent1', a1).findings, cases: null, planPeriodDays: 30 });
      } else {
        input = AgentBridge.buildReviewInput({ studentId: sid });
      }
    } catch (e) {
      result.innerHTML = '<strong>构造输入失败：</strong>' + escapeHtml(e.message);
      return;
    }
    var out = AGENTS.mock(currentAgent, input);
    var v = AGENTS.validate(currentAgent, out, input);
    var summary = AgentBridge.summarize(currentAgent, out);
    var html = '<strong>降级模板输出（temp=' + cfg.temperature + ', tokens=' + cfg.maxTokens + '）：</strong>' +
      '<div style="margin-top:6px;">' + summary.lines.map(function (l) { return escapeHtml(l); }).join('<br>') + '</div>' +
      '<div style="margin-top:8px;font-weight:600;color:' + (v.valid ? 'var(--color-success)' : 'var(--color-danger)') + ';">' +
      '结构校验：' + (v.valid ? '通过' : '未通过（' + v.errors.length + ' 项）') + '</div>';
    if (!v.valid) {
      html += '<div style="font-size:11px;">' + v.errors.map(function (e) { return escapeHtml(e.code + ' @ ' + e.path); }).join('<br>') + '</div>';
    }
    result.innerHTML = html;
  }


  // ===== 多模态能力：OCR / ASR / 拍照答疑 =====
  function simProgress(el, fillEl, callback) {
    if (!el || !fillEl) return;
    el.style.display = ''; fillEl.style.width = '0%';
    var w = 0;
    var timer = setInterval(function() {
      w += Math.random() * 30 + 10;
      if (w >= 100) { w = 100; clearInterval(timer); if (callback) setTimeout(callback, 300); }
      fillEl.style.width = w + '%';
    }, 400);
  }

  function engineLabel(engine) {
    var map = { tesseract: '本地 Tesseract', vlm: '多模态大模型', 'vlm-asr': '大模型 ASR', webspeech: '实时听写', mock: '模拟数据' };
    return map[engine] || engine || '未知';
  }

  function engineTag(res) {
    var c = res && res.confidence !== undefined && res.confidence !== null ? ' · 置信度 ' + Math.round(res.confidence) + '%' : '';
    return '<span class="risk-factor-tag">' + escapeHtml(engineLabel(res && res.engine)) + c + '</span>';
  }

  function mmReady() { return !!(window.MM && typeof window.MM.ocrFile === 'function'); }

  function pickImageFile(callback) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function () { var f = input.files && input.files[0]; if (f) callback(f); };
    input.click();
  }

  function realOcrWithImage() {
    if (!mmReady()) { simOcr(); return; }
    pickImageFile(function (file) {
      var box = document.getElementById('ocrResult');
      var prog = document.getElementById('ocrProgress');
      var fill = document.getElementById('ocrProgressFill');
      if (prog) prog.style.display = '';
      if (fill) fill.style.width = '5%';
      if (box) box.innerHTML = '识别中…';
      MM.ocrFile(file, {
        onProgress: function (info) { if (fill) fill.style.width = (info.progress || 0) + '%'; }
      }).then(function (res) {
        if (fill) fill.style.width = '100%';
        if (box) box.innerHTML = '<strong>识别结果</strong> ' + engineTag(res) + '<br>' + MM.textToHtml(res.text || '');
        var tag = document.getElementById('ocrEngineTag');
        if (tag) tag.textContent = '最近一次：' + engineLabel(res.engine) + (res.confidence !== undefined && res.confidence !== null ? '（置信度 ' + Math.round(res.confidence) + '%）' : '');
        showToast(res.mock ? 'OCR 已降级为模拟结果' : 'OCR 识别完成');
      }).catch(function (err) {
        if (box) box.innerHTML = '<strong>识别失败：</strong>' + escapeHtml((err && err.message) || '未知错误');
        showToast('OCR 识别失败');
      });
    });
  }

  var asrSession = null;

  function realAsrLive() {
    var box = document.getElementById('asrResult');
    var prog = document.getElementById('asrProgress');
    var fill = document.getElementById('asrProgressFill');
    if (asrSession) { asrSession.stop(); asrSession = null; showToast('已停止录音'); return; }
    if (!mmReady() || !MM.asrSupported()) {
      if (box) box.innerHTML = '<strong>提示：</strong>当前环境不支持实时听写，可改用「音频文件」；已给出模拟转写结果。';
      simAsr();
      return;
    }
    var buffer = '';
    if (prog) prog.style.display = '';
    if (fill) fill.style.width = '15%';
    if (box) box.innerHTML = '🎙 正在聆听…再次点击「实时听写」可停止';
    asrSession = MM.asrLive({
      onInterim: function (text) { if (box) box.innerHTML = '<strong>实时转写：</strong>' + escapeHtml(buffer + text); },
      onFinal: function (text) { buffer += text; },
      onError: function (err) {
        asrSession = null;
        if (fill) fill.style.width = '0%';
        if (box) box.innerHTML = '<strong>语音识别失败：</strong>' + escapeHtml(err.message);
      },
      onEnd: function () {
        asrSession = null;
        if (fill) fill.style.width = '100%';
        var text = buffer.trim();
        if (box) box.innerHTML = '<strong>转写结果</strong> <span class="risk-factor-tag">实时听写</span><br>' + (text ? escapeHtml(text) : '（未识别到语音内容，请检查麦克风）');
        if (text) showToast('语音转写完成');
      }
    });
  }

  function realAsrFile() {
    var input = document.getElementById('asrFileInput');
    if (!input) return;
    input.click();
  }

  function handleAsrFile(file) {
    if (!file) return;
    var box = document.getElementById('asrResult');
    var prog = document.getElementById('asrProgress');
    var fill = document.getElementById('asrProgressFill');
    if (!mmReady()) { simAsr(); return; }
    if (prog) prog.style.display = '';
    if (fill) fill.style.width = '30%';
    if (box) box.innerHTML = '正在转写音频…';
    MM.asrFile(file).then(function (res) {
      if (fill) fill.style.width = '100%';
      if (box) box.innerHTML = '<strong>转写结果</strong> ' + engineTag(res) + '<br>' + escapeHtml(res.text || '');
      showToast(res.mock ? 'ASR 已降级为模拟结果' : '语音转写完成');
    }).catch(function (err) {
      if (box) box.innerHTML = '<strong>转写失败：</strong>' + escapeHtml((err && err.message) || '未知错误');
      showToast('语音转写失败');
    });
  }

  function realQa() {
    if (!mmReady()) { simQa(); return; }
    pickImageFile(function (file) {
      var box = document.getElementById('qaResult');
      var prog = document.getElementById('qaProgress');
      var fill = document.getElementById('qaProgressFill');
      if (prog) prog.style.display = '';
      if (fill) fill.style.width = '5%';
      if (box) box.innerHTML = '正在识别题目并生成解析…';
      MM.solveFile(file, {
        onProgress: function (info) { if (fill) fill.style.width = (info.progress || 0) + '%'; }
      }).then(function (res) {
        if (fill) fill.style.width = '100%';
        var kb = (res.matched || []).map(function (k) { return '<span class="risk-factor-tag">' + escapeHtml(k.title) + '</span>'; }).join(' ');
        if (box) {
          box.innerHTML = '<strong>题目识别：</strong>' + escapeHtml(res.title || (res.ocrText || '').slice(0, 40) || '—') +
            '<br><strong>关联知识点：</strong>' + (kb || '—') +
            '<br><strong>解题思路：</strong><br>' + MM.textToHtml(res.text) +
            '<div class="mm-actions"><button type="button" class="btn btn-sm btn-outline" id="qaSaveBtn">存入错题本</button></div>';
        }
        var saveBtn = document.getElementById('qaSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', function () { saveQaToBook(res); });
        showToast(res.mock ? '答疑已降级为模拟结果' : '答疑完成');
      }).catch(function (err) {
        if (box) box.innerHTML = '<strong>答疑失败：</strong>' + escapeHtml((err && err.message) || '未知错误');
        showToast('答疑失败');
      });
    });
  }

  function saveQaToBook(res) {
    if (!window.MM || !MM.wrongBook) return;
    MM.wrongBook.save({
      subject: (res.matched && res.matched[0] && res.matched[0].course) || '未分类',
      title: res.title || (res.ocrText || '').slice(0, 30),
      ocrText: res.ocrText || '',
      solution: res.text || '',
      image: res.image || '',
      knowledgePoints: (res.matched || []).map(function (k) { return k.title; })
    });
    showToast('已存入错题本');
  }

  // ===== 旧版模拟入口（MM 未加载 / 引擎不可用时兜底）=====
  function simOcr() {
    var res = document.getElementById('ocrResult');
    simProgress(document.getElementById('ocrProgress'), document.getElementById('ocrProgressFill'), function() {
      res.innerHTML = '<strong>识别完成：</strong><br>"高数第三章习题第5题：求函数 f(x)=x³-3x²+2 的极值点与极值。<br>第6题：计算定积分 ∫(0,π) sin²x dx。<br>解题思路：第5题用导数判定法，第6题用降幂公式转化。"';
      showToast('OCR 识别完成');
    });
  }

  function simAsr() {
    var res = document.getElementById('asrResult');
    simProgress(document.getElementById('asrProgress'), document.getElementById('asrProgressFill'), function() {
      res.innerHTML = '<strong>转写完成：</strong><br>"老师您好，我在做高数作业的时候遇到了几个问题。第一个是关于极限的证明题，我不知道怎么用ε-δ语言来证明。第二个是复合函数求导的时候，我总是搞混链式法则的顺序。希望老师能帮我讲解一下。"';
      showToast('ASR 转写完成');
    });
  }

  function simQa() {
    var res = document.getElementById('qaResult');
    simProgress(document.getElementById('qaProgress'), document.getElementById('qaProgressFill'), function() {
      var matched = knowledgeBase.filter(function(k) { return k.title.indexOf('导数') !== -1 || k.title.indexOf('积分') !== -1; }).slice(0, 2);
      var kbLinks = matched.map(function(k) { return '<span class="risk-factor-tag">' + k.title + '</span>'; }).join(' ');
      res.innerHTML = '<strong>题目识别：</strong>高数-导数与极值问题<br><strong>关联知识点：</strong>' + kbLinks + '<br><strong>解题思路：</strong>1. 求 f\u2019(x)=3x²-6x=3x(x-2)，得驻点 x=0, x=2；2. 求 f\u2019\u2019(x)=6x-6，判定 x=0 为极大值点(f\u2019\u2019(0)=-6<0)，x=2 为极小值点(f\u2019\u2019(2)=6>0)；3. 极值：f(0)=2(极大), f(2)=-2(极小)。';
      showToast('答疑完成');
    });
  }
  // 多模态栏
  var multiModalBar = document.getElementById('multiModalBar');
  var multiModalToggle = document.getElementById('multiModalToggle');
  if (multiModalBar) multiModalBar.style.display = '';
  if (multiModalToggle) {
    multiModalToggle.addEventListener('click', function() {
      multiModalBar.classList.toggle('open');
    });
  }


  // ===== 一键演示 =====
  var demoRunning = false;
  var demoTimer = null;


  // btnStartDemo moved to top

  function setDemoProgress(pct) {
    if (demoBar) demoBar.style.display = '';
    if (demoBarFill) demoBarFill.style.width = pct + '%';
  }

  function demoStep(delay, fn, msg) {
    demoTimer = setTimeout(function() {
      if (!demoRunning) return;
      if (msg) showToast(msg);
      if (fn) fn();
    }, delay);
  }

  function startDemo() {
    if (demoRunning) return;
    demoRunning = true;
    if (btnStartDemo) { btnStartDemo.textContent = '■ 停止演示'; btnStartDemo.className = 'topbar-demo-btn is-running'; }
    setDemoProgress(0);

    // Step 1: Import students (2s)
    demoStep(500, function() {
      setDemoProgress(10);
      openImportModal();
    }, 'Step 1/7: 导入学生成绩数据');
    demoStep(2000, function() {
      setDemoProgress(25);
      closeImportModal();
      // Auto-create demo students
      var demos = [
        {id:'demo01',name:'演示学生A',className:'软件工程2101',grades:'高数 45 分，英语 60 分，编程 55 分',homework:'作业缺交率40%',attendance:'出勤率65%',lab:'迟到3次',codeQuality:'代码质量差',labReport:'实验报告缺交2次'},
        {id:'demo02',name:'演示学生B',className:'软件工程2101',grades:'高数 85 分，英语 90 分，编程 88 分',homework:'全部按时提交',attendance:'全勤',lab:'全勤',codeQuality:'代码规范良好',labReport:'全部提交'}
      ];
      demos.forEach(function(d) {
        var ex = false;
        for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === d.id) { ex = true; break; } }
        if (!ex) mockStudents.push(d);
      });
      renderSidebar();
      selectedStudentId = 'demo01';
      selectStudent('demo01');
    }, 'Step 2/7: 自动计算风险生成预警工单');

    // Step 3: Submit analysis (3s)
    demoStep(4500, function() {
      setDemoProgress(35);
      var s = null;
      for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === 'demo01') { s = mockStudents[i]; break; } }
      if (s) {
        var data = {name:s.name,studentId:s.id,className:s.className,grades:s.grades||'',homework:s.homework||'',attendance:s.attendance||'',lab:s.lab||'',codeQuality:s.codeQuality||'',labReport:s.labReport||''};
        lastSubmittedData = data;
        showResultUI('loading'); setSubmitting(true); runStepper(function(){});
        callAPI(data).then(function(result) { finishStepper(); setTimeout(function() { handleResult(result); }, 600); });
      }
    }, 'Step 3/7: 提交分析生成预警工单');
    demoStep(8000, function() {
      setDemoProgress(50);
      // Generate plan
      switchTab('plan');
      if (selectedStudentId) {
        for (var i = 0; i < mockStudents.length; i++) {
          if (mockStudents[i].id === selectedStudentId && !mockStudents[i].supportPlan) {
            mockStudents[i].supportPlan = {status:'draft',createdAt:formatTime(new Date()),weeks:[
              {week:1,title:'第 1 周',items:[{day:1,task:'学习高等数学基础',resource:'核心讲义',duration:'2h'},{day:2,task:'编程练习',resource:'入门习题',duration:'2h'}]}
            ],history:[{action:'created',time:formatTime(new Date()),operator:'系统'}]};
            break;
          }
        }
      }
      renderSupportPlan();
      showDashboard();
    }, 'Step 4/7: 生成个性化帮扶方案');

    // Step 5: Checkin simulation (2s)
    demoStep(10000, function() {
      setDemoProgress(65);
      switchTab('checkin');
      renderCheckinTable();
    }, 'Step 5/7: 模拟学生提交打卡');
    demoStep(11500, function() {
      setDemoProgress(75);
      var cbs = document.querySelectorAll('.ck-checkbox');
      cbs.forEach(function(cb, i) { if (i < 3) { cb.checked = true; cb.dispatchEvent(new Event('change')); } });
      batchVerify('approved');
    }, 'Step 6/7: 自动核验打卡并标记异常');

    // Step 7: Show dashboard + finish
    demoStep(13000, function() {
      setDemoProgress(90);
      switchTab('detail');
      selectedStudentId = 'demo02';
      selectStudent('demo02');
      showDashboard();
      renderDashboard();
    }, 'Step 7/7: 生成统计报表');
    demoStep(15000, function() {
      setDemoProgress(100);
      stopDemo();
    }, '演示完成！平台核心功能已全部展示');
  }

  function stopDemo() {
    demoRunning = false;
    if (demoTimer) clearTimeout(demoTimer);
    setDemoProgress(0);
    if (demoBar) demoBar.style.display = 'none';
    if (btnStartDemo) { btnStartDemo.textContent = '▶ 启动演示'; btnStartDemo.className = 'topbar-demo-btn'; }
    setSubmitting(false);
    showToast('演示已终止，可手动操作');
  }


  //  CSV导入

  // ================================================================

  function parseCSV(text) { if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});if(lines.length<2)return{headers:[],rows:[]};var delim=lines[0].indexOf('\t')!==-1?'\t':',';var headers=[],cur='',iq=false;for(var i=0;i<lines[0].length;i++){var ch=lines[0][i];if(ch==='"')iq=!iq;else if(ch===delim&&!iq){headers.push(cur.trim());cur='';}else cur+=ch;}headers.push(cur.trim());var rows=[];for(var r=1;r<lines.length;r++){var vals=[];cur='';iq=false;for(var i2=0;i2<lines[r].length;i2++){var ch2=lines[r][i2];if(ch2==='"')iq=!iq;else if(ch2===delim&&!iq){vals.push(cur.trim());cur='';}else cur+=ch2;}vals.push(cur.trim());var row={};for(var h=0;h<headers.length;h++){if(h<vals.length)row[headers[h]]=vals[h];}rows.push(row);}return{headers:headers,rows:rows}; }

  function importPercent(row, key) { var raw=row[key];if(raw===undefined||raw===null||raw==='')raw=row[key+'(%)'];var value=parseFloat(raw);return isNaN(value)?100:Math.max(0,Math.min(100,value)); }

  function analyzeRiskLevelNumeric(row) { var cf=['\u9ad8\u6570','\u82f1\u8bed','\u7f16\u7a0b','\u8ba1\u7b97\u673a\u57fa\u7840'];var cs=0,cc=0;for(var i=0;i<cf.length;i++){var v=parseFloat(row[cf[i]]);if(!isNaN(v)){cs+=v;cc++;}} var ca=cc>0?cs/cc:60;var att=importPercent(row,'\u51fa\u52e4\u7387');var hw=importPercent(row,'\u4f5c\u4e1a\u63d0\u4ea4\u7387');var lab=importPercent(row,'\u4e0a\u673a\u5b9e\u9a8c\u5b8c\u6210\u7387');var score=Math.round(ca*0.4+att*0.2+hw*0.2+lab*0.2);score=Math.max(0,Math.min(100,score));return{level:score<40?'\u9ad8':score<80?'\u4e2d':'\u4f4e',score:score,factors:[]}; }

  var importParsedRows=[];

  function openImportModal() { if(importModal)importModal.style.display='';if(importPreviewWrap)importPreviewWrap.style.display='none';if(importResult)importResult.style.display='none';if(importConfirmBtn)importConfirmBtn.disabled=true;importParsedRows=[]; }

  function closeImportModal() { if(importModal)importModal.style.display='none'; }

  function handleImportFile(file) { var reader=new FileReader();reader.onload=function(e){var parsed=parseCSV(e.target.result);if(parsed.rows.length===0){showToast('\u672a\u89e3\u6790\u5230\u6570\u636e');return;}importParsedRows=parsed.rows;if(importPreviewWrap)importPreviewWrap.style.display='';if(importStats)importStats.innerHTML='\u5171\u89e3\u6790 <strong>'+parsed.rows.length+'</strong> \u6761\u8bb0\u5f55';if(importConfirmBtn)importConfirmBtn.disabled=false;var thead=document.querySelector('#importPreviewTable thead');var tbody=document.querySelector('#importPreviewTable tbody');if(thead)thead.innerHTML='<tr>'+parsed.headers.map(function(h){return'<th>'+escapeHtml(h)+'</th>';}).join('')+'</tr>';if(tbody){var rh='';for(var r=0;r<Math.min(parsed.rows.length,10);r++){rh+='<tr>'+parsed.headers.map(function(h){return'<td>'+escapeHtml(parsed.rows[r][h]||'')+'</td>';}).join('')+'</tr>';}if(parsed.rows.length>10)rh+='<tr><td colspan="'+parsed.headers.length+'" style="text-align:center;color:#9aa0a6;">... \u8fd8\u6709 '+(parsed.rows.length-10)+' \u6761</td></tr>';tbody.innerHTML=rh;}};reader.readAsText(file,'UTF-8'); }

  function confirmImport() { if(importParsedRows.length===0)return;var hc=0,mc=0,lc=0;for(var i=0;i<importParsedRows.length;i++){var row=importParsedRows[i];var name=row['\u59d3\u540d']||row['\u59d3\u540d']||'';var id=row['\u5b66\u53f7']||row['\u5b66\u53f7']||'';var cls=row['\u73ed\u7ea7']||row['\u73ed\u7ea7']||'\u672a\u5206\u73ed';if(!name||!id)continue;var num=analyzeRiskLevelNumeric(row);var gt='';var cf2=['\u9ad8\u6570','\u82f1\u8bed','\u7f16\u7a0b','\u8ba1\u7b97\u673a\u57fa\u7840'];for(var c=0;c<cf2.length;c++){if(row[cf2[c]])gt+=cf2[c]+' '+row[cf2[c]]+' \u5206';if(c<cf2.length-1)gt+='\uff0c';}var att=importPercent(row,'\u51fa\u52e4\u7387');var hw=importPercent(row,'\u4f5c\u4e1a\u63d0\u4ea4\u7387');var lab=importPercent(row,'\u4e0a\u673a\u5b9e\u9a8c\u5b8c\u6210\u7387');var found=false;for(var s=0;s<mockStudents.length;s++){if(mockStudents[s].id===id){mockStudents[s].name=name;mockStudents[s].className=cls;mockStudents[s].grades=gt;mockStudents[s].homework='\u4f5c\u4e1a\u63d0\u4ea4\u7387 '+hw+'%';mockStudents[s].attendance='\u51fa\u52e4\u7387 '+att+'%\uff0c\u4e0a\u673a\u5b9e\u9a8c\u5b8c\u6210\u7387 '+lab+'%';mockStudents[s]._riskLevel=num.level;mockStudents[s].status='pending';found=true;break;}} if(!found)mockStudents.push({id:id,name:name,className:cls,grades:gt,homework:'\u4f5c\u4e1a\u63d0\u4ea4\u7387 '+hw+'%',attendance:'\u51fa\u52e4\u7387 '+att+'%\uff0c\u4e0a\u673a\u5b9e\u9a8c\u5b8c\u6210\u7387 '+lab+'%',status:'pending',_riskLevel:num.level});if(num.level==='\u9ad8')hc++;else if(num.level==='\u4e2d')mc++;else lc++;}renderSidebar();if(importResult){importResult.style.display='';importResult.className='import-result import-result-success';importResult.innerHTML='\u5bfc\u5165\u5b8c\u6210\uff1a\u5171 <strong>'+(hc+mc+lc)+'</strong> \u6761 | \u9ad8\u98ce\u9669 <strong style="color:#c5221f;">'+hc+'</strong> | \u4e2d\u98ce\u9669 <strong style="color:#e37400;">'+mc+'</strong> | \u4f4e\u98ce\u9669 <strong style="color:#137333;">'+lc+'</strong>';}if(importConfirmBtn)importConfirmBtn.disabled=true;importParsedRows=[];if(selectedTab==='history')renderLedger();showToast('\u5bfc\u5165\u5b8c\u6210\uff1a'+(hc+mc+lc)+' \u6761'); }



  // ================================================================

  //  台账

  // ================================================================

  var currentLedgerFilters={class:'',risk:'',search:''};

  function getLedgerData() { var data=[];var raw=localStorage.getItem('studentWarningHistory');var hi=[];try{hi=raw?JSON.parse(raw):[];if(Object.prototype.toString.call(hi)!=='[object Array]')hi=[];}catch(e){hi=[];}for(var i=0;i<mockStudents.length;i++){var s=mockStudents[i];if(s._riskLevel){var lt='';for(var h=0;h<hi.length;h++){if(hi[h].studentId===s.id){lt=hi[h].timestamp;break;}}data.push({id:s.id,name:s.name,className:s.className||'\u672a\u5206\u73ed',riskLevel:s._riskLevel,status:s.status||'pending',timestamp:lt||'',grades:s.grades,homework:s.homework,attendance:s.attendance});}}return data; }

  function renderLedger() { if(!ledgerBody)return;var data=getLedgerData();var f=currentLedgerFilters;var filtered=data.filter(function(d){if(f.class&&d.className!==f.class)return false;if(f.risk&&d.riskLevel!==f.risk)return false;if(f.search){var sl=f.search.toLowerCase();if(d.name.toLowerCase().indexOf(sl)===-1&&d.id.toLowerCase().indexOf(sl)===-1)return false;}return true;});if(filtered.length===0){ledgerBody.innerHTML='<tr><td colspan="8" class="ledger-empty">\u6682\u65e0\u9884\u8b66\u8bb0\u5f55</td></tr>';return;}var lm={'\u9ad8':'\u9ad8\u98ce\u9669','\u4e2d':'\u4e2d\u98ce\u9669','\u4f4e':'\u4f4e\u98ce\u9669'};var lc2={'\u9ad8':'risk-high','\u4e2d':'risk-medium','\u4f4e':'risk-low'};var sl2=STATUS_LABELS;var html='';for(var i=0;i<filtered.length;i++){var d=filtered[i];html+='<tr data-student-id="'+d.id+'"><td>'+escapeHtml(d.name)+'</td><td>'+escapeHtml(d.id)+'</td><td>'+escapeHtml(d.className)+'</td><td><span class="risk-badge '+lc2[d.riskLevel]+'">'+lm[d.riskLevel]+'</span></td><td>--</td><td><span class="status-badge status-'+d.status+'">'+statusLabel(d.status)+'</span></td><td style="font-size:11px;color:var(--color-text-muted);">'+escapeHtml(d.timestamp)+'</td><td><div class="ledger-actions"><button class="ledger-btn" data-action="reanalyze" data-sid="'+d.id+'">\u91cd\u65b0\u5206\u6790</button></div></td></tr>';}ledgerBody.innerHTML=html;ledgerBody.querySelectorAll('tr[data-student-id]').forEach(function(tr){tr.addEventListener('click',function(e){if(e.target.closest('.ledger-btn'))return;selectStudent(this.getAttribute('data-student-id'));switchTab('detail');});});ledgerBody.querySelectorAll('.ledger-btn').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();reAnalyzeFromLedger(this.getAttribute('data-sid'));});});if(filterClass){var classes=[];for(var ci=0;ci<data.length;ci++){if(classes.indexOf(data[ci].className)===-1)classes.push(data[ci].className);}classes.sort();var sel='<option value="">\u5168\u90e8\u73ed\u7ea7</option>';for(var ci2=0;ci2<classes.length;ci2++){sel+='<option value="'+classes[ci2]+'"'+(f.class===classes[ci2]?' selected':'')+'>'+classes[ci2]+'</option>';}filterClass.innerHTML=sel;}}

  function applyLedgerFilters() { currentLedgerFilters.class=filterClass?filterClass.value:'';currentLedgerFilters.risk=filterRisk?filterRisk.value:'';currentLedgerFilters.search=filterSearch?filterSearch.value.toLowerCase():'';renderLedger(); }

  function exportLedger() { auditAccess('export', '', '', ['name', 'studentId', 'className', 'riskLevel', 'status']); var data=getLedgerData();var csv='\u59d3\u540d,\u5b66\u53f7,\u73ed\u7ea7,\u98ce\u9669\u7b49\u7ea7,\u5de5\u5355\u72b6\u6001,\u5206\u6790\u65f6\u95f4\n';var lm2={'\u9ad8':'\u9ad8\u98ce\u9669','\u4e2d':'\u4e2d\u98ce\u9669','\u4f4e':'\u4f4e\u98ce\u9669'};var sl3={pending:'\u5f85\u5e72\u9884',supporting:'\u5e2e\u6276\u4e2d',reviewing:'\u6838\u67e5\u4e2d',resolved:'\u5df2\u89e3\u9664'};for(var i=0;i<data.length;i++){var d=data[i];csv+=[d.name,d.id,d.className,lm2[d.riskLevel]||d.riskLevel,sl3[d.status]||'\u5f85\u5e72\u9884',d.timestamp].join(',')+'\n';}var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=UTF-8'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='\u9884\u8b66\u53f0\u8d26_'+formatTime(new Date()).replace(/[:\s]/g,'_')+'.csv';a.click();URL.revokeObjectURL(url);showToast('\u53f0\u8d26\u5df2\u5bfc\u51fa'); }

  function reAnalyzeFromLedger(studentId) { for(var i=0;i<mockStudents.length;i++){if(mockStudents[i].id===studentId){var s=mockStudents[i];var data={name:s.name,studentId:s.id,className:s.className||'',grades:s.grades||'',homework:s.homework||'',attendance:s.attendance||''};lastSubmittedData=data;selectedStudentId=studentId;selectStudent(studentId);showResultUI('loading');setSubmitting(true);runStepper(function(){});callAPI(data).then(function(result){finishStepper();setTimeout(function(){handleResult(result);},600);}).catch(function(err){handleError(err);});return;}}showToast('\u672a\u627e\u5230\u8be5\u5b66\u751f\u6570\u636e'); }







  // ================================================================

  //  班级概览看板

  // ================================================================

  function getDashboardData() { var total=mockStudents.length,high=0,mid=0,low=0,resolved=0;for(var i=0;i<mockStudents.length;i++){var r=mockStudents[i]._riskLevel;if(mockStudents[i].status==='resolved')resolved++;else if(r==='高')high++;else if(r==='中')mid++;else if(r==='低')low++;}var cc2={'高数':[0,0],'英语':[0,0],'编程':[0,0],'计算机基础':[0,0]};for(var i2=0;i2<mockStudents.length;i2++){var g=mockStudents[i2].grades||'';var cs=['高数','英语','编程','计算机基础'];for(var c2=0;c2<cs.length;c2++){var re=new RegExp(cs[c2]+'[^0-9]*(\\d+)');var m2=g.match(re);if(m2){var sc=parseInt(m2[1],10);cc2[cs[c2]][0]++;if(sc>=60)cc2[cs[c2]][1]++;}}}var pr={};for(var k in cc2){pr[k]=cc2[k][0]>0?Math.round(cc2[k][1]/cc2[k][0]*100):0;}return{total:total,high:high,mid:mid,resolved:resolved,low:low,passRates:pr,students:mockStudents.slice()}; }
  /**
   * 统计卡片。之前 0 值卡片只是一个孤零零的"0"，看起来像没数据；
   * 这里统一补一行次要说明，让 0 也读得出含义（"暂无"而不是"坏了"）。
   */
  function renderStatCards(data) {
    if (!statCards) return;
    var classCount = Object.keys(getClassGroups()).length;
    function card(label, value, sub) {
      return '<div class="stat-card"><div class="stat-card-label">' + label + '</div>'
        + '<div class="stat-card-row"><span class="stat-card-value">' + value + '</span>'
        + (sub ? '<span class="stat-card-sub">' + sub + '</span>' : '')
        + '</div></div>';
    }
    var html = card('总人数', data.total, classCount ? '覆盖 ' + classCount + ' 个班级' : '');
    html += card('高风险', data.high, data.high ? '需优先干预' : '暂无高风险');
    html += card('中风险', data.mid, data.mid ? '建议关注' : '暂无中风险');
    html += card('已解除预警', data.resolved, data.resolved ? '已办结' : '暂无办结');
    statCards.innerHTML = html;
  }
  var chartInstances = {};
  function renderPieChart(data) {
    if (!chartPie) return;
    var total = data.total || data.high + data.mid + data.low + data.resolved || 1;
    if (chartInstances.pie) chartInstances.pie.dispose();
    var chart = echarts.init(chartPie);
    chartInstances.pie = chart;
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['50%', '75%'], center: ['50%', '45%'],
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14 } },
        data: [
          { value: data.high, name: '高风险', itemStyle: { color: '#d93025' } },
          { value: data.mid, name: '中风险', itemStyle: { color: '#e37400' } },
          { value: data.low, name: '低风险', itemStyle: { color: '#0d904f' } },
          { value: data.resolved, name: '已解除', itemStyle: { color: '#6b7280' } }
        ].filter(function(d) { return d.value > 0; })
      }]
    });
  }
  function renderBarChart(data) {
    if (!chartBar) return;
    var pr = data.passRates;
    if (chartInstances.bar) chartInstances.bar.dispose();
    var chart = echarts.init(chartBar);
    chartInstances.bar = chart;
    // 0% 的科目：柱子高度为 0 会让人误以为"没数据"，这里给一个浅色最小高度 + 灰色标签区分
    function bar(v, color) {
      var val = Number(v) || 0;
      var isZero = val <= 0;
      return {
        value: val,
        itemStyle: { color: isZero ? '#dadce0' : color, borderRadius: [4, 4, 0, 0] },
        label: { color: isZero ? '#9aa0a6' : '#5f6368' }
      };
    }
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 16, top: 28, bottom: 4, containLabel: true },
      xAxis: { type: 'category', data: ['高数', '英语', '编程', '计算机基础'], axisTick: { show: false }, axisLine: { lineStyle: { color: '#dadce0' } }, axisLabel: { fontSize: 11, color: '#5f6368' } },
      yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%', fontSize: 11, color: '#9aa0a6' }, splitLine: { lineStyle: { color: '#f1f3f4' } } },
      series: [{
        type: 'bar', barWidth: '46%', barMinHeight: 4,
        data: [
          bar(pr['高数'], '#1a73e8'),
          bar(pr['英语'], '#9334e6'),
          bar(pr['编程'], '#0d904f'),
          bar(pr['计算机基础'], '#e37400')
        ],
        label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11, fontWeight: 600 }
      }]
    });
  }
  function renderLineChart(data) {
    if (!chartLine) return;
    if (chartInstances.line) chartInstances.line.dispose();
    var history = [];
    try { history = JSON.parse(localStorage.getItem('studentWarningHistory') || '[]'); } catch (e) { history = []; }
    var counts = {};
    for (var hi = 0; hi < history.length; hi++) {
      var rawDate = history[hi] && (history[hi].at || history[hi].time || history[hi].createdAt || history[hi].timestamp);
      var dt = rawDate ? new Date(rawDate) : null;
      if (!dt || isNaN(dt.getTime())) continue;
      var key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).replace(/^([0-9])$/, '0$1') + '-' + String(dt.getDate()).replace(/^([0-9])$/, '0$1');
      counts[key] = (counts[key] || 0) + 1;
    }
    if (!Object.keys(counts).length) {
      chartLine.innerHTML = '<div class="history-empty">暂无历史预警记录，跑一次分析后可见</div>';
      return;
    }
    var chart = echarts.init(chartLine);
    chartInstances.line = chart;
    var last = new Date();
    var first = new Date(last.getTime() - 29 * 86400000);
    var labels = [], trendData = [];
    for (var d = 0; d < 30; d++) {
      var day = new Date(first.getTime() + d * 86400000);
      var dayKey = day.getFullYear() + '-' + String(day.getMonth() + 1).replace(/^([0-9])$/, '0$1') + '-' + String(day.getDate()).replace(/^([0-9])$/, '0$1');
      labels.push((29 - d) + '天前');
      trendData.push(counts[dayKey] || 0);
    }
    var note = document.getElementById('trendDataNote');
    if (!note) { note = document.createElement('div'); note.id = 'trendDataNote'; note.style.cssText = 'font-size:11px;color:var(--color-text-muted);margin-top:4px;'; chartLine.parentNode.appendChild(note); }
    note.textContent = '仅有 ' + Object.keys(counts).length + ' 天历史数据，趋势仅供参考';
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 10, bottom: 20 },
      xAxis: { type: 'category', data: labels, axisLabel: { interval: 6, fontSize: 10 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'line', data: trendData, smooth: true,
        lineStyle: { color: '#1a73e8', width: 2 },
        itemStyle: { color: '#1a73e8' },
        areaStyle: { color: 'rgba(26,115,232,0.06)' }
      }]
    });
  }
  function renderDashboardTable(data) { if(!dashboardTableBody)return;var lm={'高':'高风险','中':'中风险','低':'低风险'};var lc2={'高':'risk-high','中':'risk-medium','低':'risk-low'};var sl2=STATUS_LABELS;var html='';for(var i=0;i<data.students.length;i++){var s=data.students[i];var rl=s._riskLevel||'低';var score=(s._riskScore===undefined||s._riskScore==='')?null:s._riskScore;if(score===null&&typeof RiskPluginManager!=='undefined'){try{score=RiskPluginManager.score({name:s.name,studentId:s.id,grades:s.grades||'',homework:s.homework||'',attendance:s.attendance||'',lab:s.lab||'',codeQuality:s.codeQuality||'',labReport:s.labReport||''}).score;}catch(e){score=null;}}html+='<tr data-student-id="'+s.id+'"><td>'+escapeHtml(s.name)+'</td><td>'+escapeHtml(s.id)+'</td><td>'+escapeHtml(s.className||'未分班')+'</td><td><span class="risk-badge '+lc2[rl]+'">'+lm[rl]+'</span></td><td>'+(score===null?'<span style="color:var(--color-text-muted);">—</span>':score)+'</td><td><span class="status-badge status-'+(s.status||'pending')+'">'+statusLabel(s.status)+'</span></td><td><button class="ledger-btn" data-action="view-student" data-sid="'+s.id+'">查看详情</button></td></tr>';}dashboardTableBody.innerHTML=html;dashboardTableBody.querySelectorAll('tr[data-student-id]').forEach(function(tr){tr.addEventListener('click',function(e){if(e.target.closest('.ledger-btn'))return;selectStudent(this.getAttribute('data-student-id'));switchTab('detail');});});dashboardTableBody.querySelectorAll('.ledger-btn').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();selectStudent(this.getAttribute('data-sid'));switchTab('detail');});}); }
  // ================================================================
  //  错题回流预警（学生端错题本 → 教师端预警候选）
  // ================================================================

  function findStudentById(id) {
    for (var i = 0; i < mockStudents.length; i++) { if (mockStudents[i].id === id) return mockStudents[i]; }
    return null;
  }

  /* ================================================================
   *  预警判定依据快照（localStorage:warningSnapshots）
   *  { [学号]: { at, pluginId, pluginName, riskLevel, riskScore,
   *              factors:[{dim,label,rawValue,weight,contribution,hit}],
   *              evidenceRefs:[] } }
   *  只在"生成预警"时写入；切换评分规则不会批量重写，保证旧快照可追溯。
   * ================================================================ */

  var SNAPSHOT_KEY = 'warningSnapshots';
  var SNAPSHOT_MAX = 200;

  function loadSnapshots() {
    try {
      var raw = localStorage.getItem(SNAPSHOT_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    } catch (e) { return {}; }
  }

  function saveSnapshots(obj) {
    try {
      // 超过上限时按 at 倒序裁剪，只保留最近的
      var keys = Object.keys(obj);
      if (keys.length > SNAPSHOT_MAX) {
        keys.sort(function (a, b) { return String(obj[b].at || '').localeCompare(String(obj[a].at || '')); });
        var trimmed = {};
        for (var i = 0; i < SNAPSHOT_MAX; i++) trimmed[keys[i]] = obj[keys[i]];
        obj = trimmed;
      }
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(obj));
    } catch (e) { /* 配额满等异常不影响主流程 */ }
  }

  /**
   * 为某学生生成一份判定依据快照。
   * 依据来自当前生效的评分规则：若插件实现了 detail()，就存分维度明细；
   * 未实现则 factors 为空数组，学生端会显示"该规则不提供分维度明细"。
   */
  function writeWarningSnapshot(studentId) {
    try {
      if (!studentId) return null;
      var stu = findStudentById(studentId);
      if (!stu) return null;
      var data = {
        name: stu.name, studentId: stu.id,
        grades: stu.grades || '', homework: stu.homework || '', attendance: stu.attendance || '',
        lab: stu.lab || '', codeQuality: stu.codeQuality || '', labReport: stu.labReport || ''
      };
      var scored = RiskPluginManager.score(data);
      var pid = RiskPluginManager.getActive();
      var plugin = RiskPluginManager.plugins[pid];
      var factors = [];
      if (plugin && typeof plugin.detail === 'function') {
        var d = plugin.detail(data);
        if (d && Object.prototype.toString.call(d.factors) === '[object Array]') factors = d.factors;
      }
      var all = loadSnapshots();
      all[studentId] = {
        at: new Date().toISOString(),
        pluginId: pid,
        pluginName: plugin ? plugin.name : pid,
        riskLevel: scored.level,
        riskScore: scored.score,
        factors: factors,
        // 证据链：只**引用**已有数据（错题本 / 任务流运行记录 / 申报工单），不新建存储、不造数据
        evidenceRefs: (window.Evidence ? window.Evidence.collect(studentId) : [])
      };
      saveSnapshots(all);
      return all[studentId];
    } catch (e) {
      return null;
    }
  }

  function getPendingCandidates() {
    if (!window.MM || !MM.warning) return [];
    return MM.warning.list().filter(function (c) { return c.status === 'pending'; });
  }

  /* ================================================================
   *  证据链下钻（教师端）
   *  数据来自快照里的 evidenceRefs（只引用已有模块），详情按需解析；
   *  引用可能已过保留期，此时明确提示而不是报错。
   * ================================================================ */

  var evidenceCard = document.getElementById('evidenceCard');
  var evidenceCount = document.getElementById('evidenceCount');
  var evidenceSummary = document.getElementById('evidenceSummary');

  function currentEvidenceRefs() {
    if (!selectedStudentId) return [];
    try {
      var snaps = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '{}') || {};
      var s = snaps[selectedStudentId];
      return (s && Object.prototype.toString.call(s.evidenceRefs) === '[object Array]') ? s.evidenceRefs : [];
    } catch (e) { return []; }
  }

  function evidenceTypeSummary(refs) {
    var g = window.Evidence ? window.Evidence.group(refs) : {};
    var parts = [];
    var LABEL = (window.Evidence && window.Evidence.TYPE_LABEL) || {};
    ['wrongbook', 'ocr', 'asr', 'flowrun', 'ticket'].forEach(function (t) {
      if (g[t] && g[t].length) parts.push((LABEL[t] || t) + ' ' + g[t].length + ' 条');
    });
    return parts.join(' · ');
  }

  function renderEvidenceCard() {
    if (!evidenceCard) return;
    if (!selectedStudentId) { evidenceCard.style.display = 'none'; return; }
    evidenceCard.style.display = '';
    var refs = currentEvidenceRefs();
    if (evidenceCount) {
      evidenceCount.textContent = refs.length + ' 条';
      evidenceCount.className = 'risk-badge ' + (refs.length ? 'risk-low' : 'risk-medium');
    }
    if (evidenceSummary) {
      evidenceSummary.textContent = refs.length
        ? ('该学生的风险结论由以下 ' + refs.length + ' 条证据支撑（' + evidenceTypeSummary(refs) + '）')
        : '暂无关联证据（该预警由规则引擎直接命中）';
    }
  }

  function evidenceDetailHtml(res, idx) {
    if (!res.ok) {
      return '<div style="font-size:12px;color:var(--color-text-muted);">' + (res.expired ? '该证据已过保留期' : ('读取失败：' + escapeHtml(res.error || '未知原因'))) + '</div>';
    }
    var h = '<div style="font-size:12px;font-weight:600;margin-bottom:6px;">' + escapeHtml(res.title || '') + '</div>';
    if (res.rows) {
      h += '<div style="font-size:12px;line-height:1.9;">';
      res.rows.forEach(function (r) {
        h += '<div><span style="color:var(--color-text-muted);">' + escapeHtml(r.k) + '：</span>' + escapeHtml(r.v) + '</div>';
      });
      h += '</div>';
    }
    if (res.text) {
      h += '<div style="margin-top:8px;padding:8px;background:#fff;border:1px solid var(--color-border-light);border-radius:4px;font-size:12px;white-space:pre-wrap;max-height:200px;overflow:auto;">' + escapeHtml(res.text) + '</div>';
    }
    if (res.solution) {
      h += '<div style="margin-top:6px;font-size:12px;"><span style="color:var(--color-text-muted);">解答/结论：</span>' + escapeHtml(res.solution).slice(0, 600) + '</div>';
    }
    if (res.run) {
      // 复用任务流页的时间线渲染（同一个 HTML 构造器，不是重写一份）
      h += '<div style="margin-top:8px;">' + flowTimelineHtml(res.run) + '</div>';
    }
    return h;
  }

  function showEvidenceModal() {
    var refs = currentEvidenceRefs();
    var stu = selectedStudentId ? findStudentById(selectedStudentId) : null;
    if (window.Perm) Perm.audit({ action: 'view', subjectId: selectedStudentId || '', subjectName: stu ? stu.name : '', fields: ['evidence'] });

    var modal = document.getElementById('evidenceModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'evidenceModal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = '<div class="modal-panel modal-wide"><div class="modal-header">' +
        '<h2 class="modal-title">证据链' + (stu ? ' · ' + escapeHtml(stu.name) : '') + '</h2>' +
        '<button class="modal-close" id="evidenceModalClose">&times;</button></div>' +
        '<div class="modal-body" id="evidenceModalBody" style="max-height:70vh;overflow:auto;"></div></div>';
      document.body.appendChild(modal);
      document.getElementById('evidenceModalClose').addEventListener('click', function () { modal.style.display = 'none'; });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
    }

    var body = document.getElementById('evidenceModalBody');
    var h = '<div style="font-size:13px;font-weight:600;margin-bottom:10px;">该学生的风险结论由以下 ' + refs.length + ' 条证据支撑</div>';
    if (!refs.length) {
      h += '<div style="font-size:12px;color:var(--color-text-muted);padding:10px;background:var(--color-bg);border-radius:4px;">暂无关联证据（该预警由规则引擎直接命中）</div>';
    } else {
      var g = window.Evidence ? window.Evidence.group(refs) : {};
      var LABEL = (window.Evidence && window.Evidence.TYPE_LABEL) || {};
      var idx = 0;
      ['wrongbook', 'ocr', 'asr', 'flowrun', 'ticket'].forEach(function (type) {
        var list = g[type] || [];
        if (!list.length) return;
        h += '<div style="margin-bottom:10px;"><div style="font-size:12px;font-weight:600;margin-bottom:4px;">' + escapeHtml(LABEL[type] || type) +
          ' <span style="font-weight:400;color:var(--color-text-muted);">' + list.length + ' 条</span></div>';
        list.forEach(function (r) {
          h += '<div style="border:1px solid var(--color-border-light);border-radius:4px;padding:8px;margin-bottom:6px;">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:12px;">' +
            '<span>' + escapeHtml(r.label || '') + '</span>' +
            '<span style="color:var(--color-text-muted);font-size:11px;">' + escapeHtml(String(r.at || '').slice(0, 16).replace('T', ' ')) +
            ' <button class="ledger-btn" data-ev="' + idx + '" style="margin-left:6px;">查看详情</button></span></div>' +
            '<div id="evidenceDetail' + idx + '" style="display:none;margin-top:8px;border-top:1px dashed var(--color-border-light);padding-top:8px;"></div>' +
            '</div>';
          idx++;
        });
        h += '</div>';
      });
    }
    body.innerHTML = h;

    var flat = refs.slice();
    body.querySelectorAll('[data-ev]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = parseInt(this.getAttribute('data-ev'), 10);
        var box = document.getElementById('evidenceDetail' + i);
        if (!box) return;
        if (box.style.display !== 'none') { box.style.display = 'none'; this.textContent = '查看详情'; return; }
        var res;
        try { res = window.Evidence.resolve(flat[i]); }
        catch (e) { res = { ok: false, error: (e && e.message) || '解析失败' }; }
        box.innerHTML = evidenceDetailHtml(res, i);
        box.style.display = '';
        this.textContent = '收起';
      });
    });

    modal.style.display = '';
  }

  if (evidenceCard) {
    var btnShowEvidence = document.getElementById('btnShowEvidence');
    if (btnShowEvidence) btnShowEvidence.addEventListener('click', showEvidenceModal);
  }

  function renderMultimodalWarnings() {
    var wrap = document.getElementById('mmWarningWrap');
    var box = document.getElementById('mmWarningList');
    if (!wrap || !box) return;
    if (!window.MM || !MM.warning) { wrap.style.display = 'none'; return; }
    var all = MM.warning.list();
    var pending = all.filter(function (c) { return c.status === 'pending'; });
    if (!all.length) { wrap.style.display = 'none'; box.innerHTML = ''; return; }
    wrap.style.display = '';
    var html = '';
    if (!pending.length) {
      html = '<div class="ledger-empty" style="padding:10px;">暂无待处理候选（已处理 ' + (all.length - pending.length) + ' 条）</div>';
    } else {
      html += '<div class="table-scroll" style="max-height:none;"><table class="mini-table"><thead><tr>' +
        '<th>学生</th><th>薄弱知识点</th><th>课程</th><th>未掌握</th><th>建议等级</th><th>来源</th><th>更新时间</th><th>操作</th></tr></thead><tbody>';
      for (var i = 0; i < pending.length; i++) {
        var c = pending[i];
        var stu = findStudentById(c.studentId);
        var cls = c.level === '高' ? 'risk-high' : 'risk-medium';
        html += '<tr>' +
          '<td>' + escapeHtml(c.studentName || (stu && stu.name) || c.studentId || '未知') + (stu ? '' : ' <span style="font-size:10px;color:#d93025;">(不在花名册)</span>') + '</td>' +
          '<td>' + escapeHtml(c.knowledgePoint) + '</td>' +
          '<td>' + escapeHtml(c.course || '-') + '</td>' +
          '<td>' + c.count + ' 题</td>' +
          '<td><span class="risk-badge ' + cls + '">' + (c.level === '高' ? '高风险' : '中风险') + '</span></td>' +
          '<td>' + escapeHtml(c.source || '错题本回流') + '</td>' +
          '<td>' + escapeHtml((c.updatedAt || '').slice(0, 16).replace('T', ' ')) + '</td>' +
          '<td><button class="ledger-btn" data-wc-convert="' + c.id + '">生成预警工单</button> ' +
          '<button class="ledger-btn" data-wc-ignore="' + c.id + '" style="color:#d93025;">忽略</button></td>' +
          '</tr>';
      }
      html += '</tbody></table></div>';
    }
    box.innerHTML = html;
    box.querySelectorAll('[data-wc-convert]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); convertCandidateToTicket(this.getAttribute('data-wc-convert')); });
    });
    box.querySelectorAll('[data-wc-ignore]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        MM.warning.update(this.getAttribute('data-wc-ignore'), { status: 'ignored', updatedAt: new Date().toISOString() });
        renderMultimodalWarnings();
        showToast('已忽略该预警候选');
      });
    });
  }

  function convertCandidateToTicket(id) {
    if (!window.MM || !MM.warning) return;
    var c = null, list = MM.warning.list();
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { c = list[i]; break; } }
    if (!c) return;
    var stu = findStudentById(c.studentId);
    if (stu) {
      var old = stu._riskLevel || '';
      stu._riskLevel = (old === '高' || c.level === '高') ? '高' : '中';
      stu.status = 'pending';
      addOperationLog(stu.id, 'multimodal_warning',
        '错题回流预警：' + c.reason + '（建议' + (c.level === '高' ? '高' : '中') + '风险，来源：学生端错题本）', null, 'pending');
      saveStudentStates();
      renderSidebar(sidebarSearch ? sidebarSearch.value : '');
    }
    MM.warning.update(id, { status: 'converted', convertedAt: new Date().toISOString() });
    renderMultimodalWarnings();
    showToast(stu ? ('已生成预警工单：' + stu.name) : '已生成预警工单（该学号不在花名册）');
  }

  // 其他窗口（学生端）写入候选 / 申报时自动刷新
  window.addEventListener('storage', function (e) {
    if (!e) return;
    if (e.key === 'warningCandidates') { try { renderMultimodalWarnings(); } catch (err) {} }
    if (e.key === (window.Tickets ? Tickets.KEY : 'supportTickets')) {
      try { if (selectedTab === 'tickets') renderTickets(); } catch (err) {}
    }
    if (e.key === (window.Appeals ? Appeals.KEY : 'warningAppeals')) {
      try { renderAppealReviews(); } catch (err) {}
    }
  });

  /* ================================================================
   *  可重点培养名单（PROMPT-08 正向预警 / 育优）
   *  与风险评分完全独立：只在展示层把两套结果并列，
   *  特意同时显示风险等级——"高风险但某维度有潜力"的学生最容易在帮扶中被忽略，
   *  这正是这份名单的价值点。
   * ================================================================ */

  var talentSortDesc = true;
  var talentRenderedRows = [];   // 导出时复用页面上的顺序，保证"导出内容与页面一致"

  function talentRows() {
    var roster = (window.RosterUtil && RosterUtil.all) ? RosterUtil.all() : (mockStudents || []);
    var states = {};
    try { states = JSON.parse(localStorage.getItem('studentWarningStates') || '{}') || {}; } catch (e) { states = {}; }
    var rows = roster.map(function (s) {
      var res = window.PositiveRuleManager ? PositiveRuleManager.evaluateStudent(s) : null;
      var st = states[s.id] || {};
      var strongList = (res && res.strengths) ? res.strengths : [];
      return {
        id: String(s.id), name: s.name, className: s.className || '未分班',
        score: res ? res.score : 0,
        level: res ? res.level : '-',
        dataEnough: res ? res.dataEnough : false,
        tags: strongList.slice(0, 3).map(function (x) { return x.label + ' ' + x.score; }),
        strengths: strongList,
        riskLevel: st.riskLevel || s._riskLevel || '低',
        riskScore: st.riskScore !== undefined ? st.riskScore : (s._riskScore !== undefined ? s._riskScore : '')
      };
    });
    rows.sort(function (a, b) {
      return talentSortDesc ? (b.score - a.score) : (a.score - b.score);
    });
    return rows;
  }

  function renderTalentList() {
    var box = document.getElementById('talentTable');
    if (!box) return;
    if (!window.PositiveRuleManager) { box.innerHTML = ''; return; }
    var rows = talentRows();
    talentRenderedRows = rows;
    if (!rows.length) {
      box.innerHTML = '<div style="font-size:12px;color:var(--color-text-muted);padding:8px;">花名册为空，暂无可评估的学生。</div>';
      return;
    }
    var h = '<table class="mini-table" style="width:100%;font-size:12px;"><thead><tr>' +
      '<th>学生</th><th>班级</th><th>优势得分</th><th>优势等级</th><th>优势标签</th><th>风险等级</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var riskCls = r.riskLevel === '高' ? 'risk-high' : (r.riskLevel === '中' ? 'risk-medium' : 'risk-low');
      var lvColor = r.level === 'A' ? '#137333' : (r.level === 'B' ? '#1a73e8' : 'var(--color-text-muted)');
      h += '<tr>' +
        '<td>' + escapeHtml(r.name) + ' <span style="color:var(--color-text-muted);font-size:11px;">' + escapeHtml(r.id) + '</span></td>' +
        '<td>' + escapeHtml(r.className) + '</td>' +
        '<td><strong style="color:' + lvColor + ';">' + r.score + '</strong></td>' +
        '<td style="color:' + lvColor + ';">' + escapeHtml(r.level) + '</td>' +
        '<td>' + (r.tags.length ? escapeHtml(r.tags.join(' · ')) : '<span style="color:var(--color-text-muted);">暂无明显优势项</span>') + '</td>' +
        '<td><span class="risk-badge ' + riskCls + '" style="font-size:10px;">' + escapeHtml(r.riskLevel) + '风险</span></td>' +
        '</tr>';
    });
    h += '</tbody></table>';
    box.innerHTML = h;
  }

  /** 导出育优名单：内容与页面（含排序）保持一致，复用现有 downloadXLSX */
  function exportTalentList() {
    var rows = talentRenderedRows.length ? talentRenderedRows : talentRows();
    var aoa = [['学生', '学号', '班级', '优势得分', '优势等级', '优势标签', '风险等级']];
    rows.forEach(function (r) {
      aoa.push([r.name, r.id, r.className, r.score, r.level, r.tags.join(' / '), r.riskLevel + '风险']);
    });
    aoa.push([]);
    aoa.push(['说明：本名单仅供辅导员参考，不作为任何奖励的自动依据；涉及奖学金/保研等一律以学校政策为准。']);
    downloadXLSX(aoa, '育优名单');
    showToast('育优名单已导出（' + rows.length + ' 人）');
  }

  /* ================================================================
   *  重点关注名单（多源行为画像 · MVP-2 落地）
   *  合规要点：只纳入**已单独授权**的学生；查看即写审计；文案标注"仅供参考、不自动决策"。
   * ================================================================ */

  function renderFocusList() {
    var box = document.getElementById('focusList');
    if (!box) return;
    if (!window.CampusProfile) { box.innerHTML = ''; return; }

    var res = CampusProfile.focusList({ limit: 10 });

    if (!res.ok || res.empty) {
      var tip = res.reason === 'no-signals'
        ? '尚未载入校园行为数据。点「载入演示行为数据」可体验完整流程（真实场景由校方数据接口写入）。'
        : (res.reason === 'no-consent'
          ? '暂无学生授权使用校园行为数据。按 PIPL「单独同意」要求，学生需在【学生端 → 隐私中心】逐人授权后才会进入名单。'
          : '算法模块未就绪。');
      box.innerHTML = '<div style="font-size:12px;color:var(--color-text-muted);padding:10px;background:var(--color-bg);border-radius:4px;">'
        + escapeHtml(tip) + (res.excluded ? '（已排除 ' + res.excluded + ' 名未授权学生）' : '') + '</div>';
      return;
    }

    // 查看行为画像属于敏感数据访问，必须留痕
    auditAccess('view', '', '', ['campusSignals', 'fusionScore']);

    var h = '<div style="font-size:11px;color:var(--color-text-muted);margin:6px 0;">'
      + '已授权 ' + res.granted + ' 人 · 已排除 ' + res.excluded + ' 名未授权学生 · 数据截至 '
      + escapeHtml(String(res.asOf || '').slice(0, 10)) + '（共 ' + res.days + ' 天）</div>';
    h += '<table class="mini-table" style="width:100%;font-size:12px;"><thead><tr>'
      + '<th>学生</th><th>班级</th><th>关注度</th><th>主要贡献来源</th><th>证据冲突</th><th>建议动作</th></tr></thead><tbody>';
    res.rows.forEach(function (r) {
      var top = (r.contributions || []).slice(0, 2).map(function (c) {
        return c.label + (c.contribution > 0 ? ' ↑' : ' ↓');
      }).join(' · ') || '—';
      var lv = r.score >= 60 ? '#c5221f' : (r.score >= 30 ? '#e37400' : '#137333');
      h += '<tr>'
        + '<td>' + escapeHtml(r.name) + ' <span style="color:var(--color-text-muted);font-size:11px;">' + escapeHtml(r.id) + '</span></td>'
        + '<td>' + escapeHtml(r.className) + '</td>'
        + '<td><strong style="color:' + lv + ';">' + r.score + '</strong></td>'
        + '<td>' + escapeHtml(top) + '</td>'
        + '<td>' + (r.conflict >= 0.5
          ? '<span class="risk-badge risk-medium" style="font-size:10px;" title="各源信号互相矛盾，建议先人工核实">冲突 ' + r.conflict + '</span>'
          : '<span style="color:var(--color-text-muted);">' + r.conflict + '</span>') + '</td>'
        + '<td><button type="button" class="ledger-btn" data-focus-student="' + escapeHtml(r.id) + '">查看画像</button></td>'
        + '</tr>';
    });
    h += '</tbody></table>';
    h += '<div style="font-size:11px;color:var(--color-text-muted);margin-top:8px;line-height:1.7;">'
      + '· 关注度是**相对值**（只在同一批已授权学生之间可比），由个体基线偏离度融合得到，不是风险等级；<br>'
      + '· 系统不做任何自动决策：名单只用于安排核实与帮扶，不进入任何奖惩或排名；<br>'
      + '· 「证据冲突」高说明各源互相矛盾（如成绩好但作息异常），这类学生建议先人工核实。</div>';
    box.innerHTML = h;

    box.querySelectorAll('[data-focus-student]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = this.getAttribute('data-focus-student');
        showFocusDetail(id);
      });
    });
  }

  /** 单个学生的画像明细（教师端） */
  function showFocusDetail(studentId) {
    var res = CampusProfile.focusList({ limit: 1000 });
    var row = null;
    (res.rows || []).forEach(function (r) { if (r.id === studentId) row = r; });
    if (!row) { showToast('未找到该学生的画像'); return; }
    var stu = findStudentById(studentId);
    var h = '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + escapeHtml(stu ? stu.name : row.name) + ' · 关注度 ' + row.score + '</div>';
    h += '<table class="ledger-table" style="width:100%;font-size:12px;"><thead><tr><th>来源</th><th>偏离度 z</th><th>加权贡献</th></tr></thead><tbody>';
    (row.contributions || []).forEach(function (c) {
      h += '<tr><td>' + escapeHtml(c.label) + '</td><td>' + c.z + '</td><td>' + c.contribution + '</td></tr>';
    });
    h += '</tbody></table>';
    h += '<div style="font-size:11px;color:var(--color-text-muted);margin-top:8px;">z 为相对该生自身基线的偏离倍数；贡献为 z × 权重 × 时间衰减。'
      + '关注度 = 各源贡献融合后的标准化分数，仅供辅导员参考。</div>';

    var modal = document.getElementById('focusModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'focusModal';
      modal.className = 'modal-overlay';
      modal.style.display = 'none';
      modal.innerHTML = '<div class="modal-panel modal-wide"><div class="modal-header">'
        + '<h2 class="modal-title">行为画像明细</h2>'
        + '<button class="modal-close" id="focusModalClose">&times;</button></div>'
        + '<div class="modal-body" id="focusModalBody" style="max-height:70vh;overflow:auto;"></div></div>';
      document.body.appendChild(modal);
      document.getElementById('focusModalClose').addEventListener('click', function () { modal.style.display = 'none'; });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });
    }
    document.getElementById('focusModalBody').innerHTML = h;
    modal.style.display = '';
  }

  function initFocusPanel() {
    var btnSeed = document.getElementById('btnSeedCampus');
    var btnGrant = document.getElementById('btnGrantAllDemo');
    var btnBuild = document.getElementById('btnBuildFocus');
    if (!btnSeed || !window.CampusProfile) return;

    btnSeed.addEventListener('click', function () {
      var roster = (window.RosterUtil && RosterUtil.all) ? RosterUtil.all() : (mockStudents || []);
      var r = CampusProfile.seedDemo(roster, { days: 112 });
      if (!r.ok) { showToast(r.error || '载入失败'); return; }
      showToast('已载入 ' + r.students + ' 名学生的 ' + r.days + ' 天演示行为数据');
      renderFocusList();
    });
    if (btnGrant) {
      btnGrant.addEventListener('click', function () {
        if (!confirm('演示用途：为花名册全体学生批量标记「已同意」。\n\n真实产品中必须由每名学生自己在隐私中心授权，这里只是为了让演示不卡在授权环节。\n\n确认继续？')) return;
        var roster = (window.RosterUtil && RosterUtil.all) ? RosterUtil.all() : (mockStudents || []);
        var ids = roster.map(function (s) { return String(s.id); });
        var r = CampusProfile.setConsentBulk(ids, true, { actor: 'demo-bulk' });
        if (window.Session && Session.log) Session.log({ event: 'campus_consent_bulk_demo', role: 'teacher', detail: r.count + ' 人' });
        showToast('已（演示）授权 ' + r.count + ' 名学生');
        renderFocusList();
      });
    }
    btnBuild.addEventListener('click', function () {
      if (!CampusProfile.hasSignals()) { showToast('请先载入行为数据'); return; }
      renderFocusList();
      showToast('名单已生成（仅供辅导员参考）');
    });
  }

  function renderDashboard() { var data=getDashboardData();renderStatCards(data);renderPieChart(data);renderBarChart(data);renderLineChart(data);renderDashboardTable(data);renderMultimodalWarnings();renderInterventionStats();renderTalentList();renderFocusList(); }

  // ================================================================
  //  任务流（FlowEngine）：工具 / 执行器注册 + 面板
  // ================================================================

  var tabFlow = document.getElementById('tabFlow');

  function summarizeAnalysis(res) {
    if (!res) return '（无分析结果）';
    if (typeof res === 'string') return res;
    var ra = res.riskAnalysis || {};
    var parts = [];
    if (ra.level) parts.push('风险等级：' + ra.level);
    if (ra.score !== undefined) parts.push('风险评分：' + ra.score);
    if (ra.details) parts.push(ra.details);
    if (ra.factors && ra.factors.length) parts.push('风险因素：' + (Array.isArray(ra.factors) ? ra.factors.join('、') : ra.factors));
    return parts.join('；') || JSON.stringify(res).slice(0, 200);
  }

  function registerFlowTools() {
    var FE = window.FlowEngine;
    if (!FE) return;

    FE.registerTool('ocr', function (input) {
      if (!window.MM) return Promise.reject(new Error('多模态能力层未加载'));
      var img = input && input.image;
      if (!img) return Promise.reject(new Error('缺少图片输入'));
      if (typeof File !== 'undefined' && img instanceof File) return MM.ocrFile(img);
      return MM.ocr(img);
    });

    FE.registerTool('ocr.vlm', function (input) {
      if (!window.MM) return Promise.reject(new Error('多模态能力层未加载'));
      var img = input && input.image;
      if (typeof File !== 'undefined' && img instanceof File) return MM.ocrFile(img, { engine: 'vlm' });
      return MM.ocr(img, { engine: 'vlm' });
    });

    FE.registerTool('knowledge.match', function (input) {
      var matched = (window.MM && MM.matchKnowledge) ? MM.matchKnowledge((input && input.text) || '', (input && input.limit) || 3) : [];
      return { matched: matched, count: matched.length, titles: matched.map(function (k) { return k.title; }) };
    });

    FE.registerTool('solve', function (input) {
      if (!window.MM) return Promise.reject(new Error('多模态能力层未加载'));
      var solving = (typeof File !== 'undefined' && input.image instanceof File)
        ? MM.solveFile(input.image, { ocrText: input.ocrText })
        : MM.solve(input.image, { ocrText: input.ocrText });
      return solving.then(function (res) {
        return {
          text: res.text, matched: res.matched, engine: res.engine, mock: res.mock,
          title: res.title || ((res.ocrText || '').slice(0, 30) || '错题')
        };
      });
    });

    FE.registerTool('wrongBook.save', function (input) {
      if (!window.MM || !MM.wrongBook) return Promise.reject(new Error('错题本不可用'));
      var matched = input.matched || [];
      var rec = MM.wrongBook.save({
        studentId: input.studentId,
        subject: (matched[0] && matched[0].course) || '未分类',
        title: input.title, ocrText: input.ocrText, solution: input.solution,
        image: (typeof input.image === 'string' && input.image.indexOf('data:') === 0) ? input.image : '',
        knowledgePoints: matched.map(function (k) { return k.title; })
      });
      if (!rec) throw new Error('错题本写入失败：存储空间不足');
      return { id: rec.id, knowledgePoints: rec.knowledgePoints, subject: rec.subject };
    });

    FE.registerTool('warning.sync', function (input) {
      if (!window.MM || !MM.warning) return { created: 0, updated: 0, candidates: [] };
      var r = MM.warning.sync({ studentId: input.studentId, studentName: input.studentName, source: '任务流·错题闭环' });
      return {
        created: r.created.length, updated: r.updated.length,
        candidates: r.created.map(function (c) { return c.knowledgePoint + '(' + c.count + '题)'; })
      };
    });

    FE.registerTool('parse.student', function (input) {
      var text = (input && input.text) || '';
      var name = (text.match(/(?:姓名|学生)[：:\s]*([\u4e00-\u9fa5]{2,4})/) || [])[1] || '';
      var sid = (text.match(/(?:学号|编号)[：:\s]*(\d{6,})/) || text.match(/\b(\d{9,12})\b/) || [])[1] || '';
      var scoreRe = /([\u4e00-\u9fa5A-Za-z]{2,10})\s*[：:\s]+(\d{1,3})\s*分?/g;
      var courses = [], m;
      while ((m = scoreRe.exec(text)) !== null) { courses.push(m[1] + ' ' + m[2] + ' 分'); }
      var summary = '姓名：' + (name || '未识别') + '｜学号：' + (sid || '未识别') + '｜成绩：' + (courses.join('，') || '未识别');
      return { name: name, studentId: sid, courses: courses, gradesText: courses.join('，'), summary: summary };
    });

    FE.registerTool('form.fill', function (input) {
      var p = (input && input.parsed) || {};
      var filled = [];
      function set(id, val) { var el = document.getElementById(id); if (el && val) { el.value = val; filled.push(id); } }
      set('studentName', p.name);
      set('studentId', p.studentId);
      set('studentGrades', p.gradesText);
      return { filled: filled.join('、') || '（无可填字段）' };
    });

    FE.registerTool('profile.load', function (input) {
      var stu = findStudentById(input && input.studentId);
      if (!stu) throw new Error('未找到学生：' + (input && input.studentId));
      return {
        id: stu.id, name: stu.name, className: stu.className,
        grades: stu.grades, homework: stu.homework, attendance: stu.attendance,
        riskLevel: stu._riskLevel || ''
      };
    });

    FE.registerTool('analysis', function (input) {
      var p = input.profile || {};
      var data = { name: p.name, studentId: p.id, grades: p.grades, homework: p.homework, attendance: p.attendance, lab: '', codeQuality: '', labReport: '' };
      return callAPI(data).then(function (res) {
        var ra = (res && res.riskAnalysis) || {};
        return { text: summarizeAnalysis(res), level: ra.level || '中', reason: ra.details || '', raw: res };
      });
    });

    FE.registerTool('case.retrieve', function (input) {
      // 案例库反哺：检索相似历史案例，产出**脱敏**上下文交给 Agent2。
      // 检索为空/案例库为空时返回空上下文，流程照常走（Agent2 退化为原始行为）。
      var studentId = input && input.studentId;
      var snap = currentSnapshot(studentId);
      var found = window.Cases ? Cases.findSimilar(snap, 3) : { items: [], total: 0, note: '无历史案例可参考', skipped: 0 };
      var ctx = window.Cases ? Cases.buildAgentContext(found.items) : { text: '无历史案例可参考。', count: 0, anonymized: true };
      lastCaseRetrieval = {
        studentId: studentId, note: found.note, skipped: found.skipped || 0,
        items: found.items.map(function (c) {
          return {
            id: c.id, ticketId: c.ticketId, className: c.className, score: c.score, reason: c.reason,
            planName: c.planName, planSummary: c.planSummary, outcome: c.outcome,
            durationDays: c.durationDays, checkinRate: c.checkinRate, riskLevel: c.riskLevel
          };
        }),
        context: ctx.text, count: ctx.count
      };
      return {
        count: ctx.count,
        context: ctx.text,
        note: found.note,
        items: lastCaseRetrieval.items
      };
    });

    FE.registerTool('plan.generate', function (input) {
      var p = input.profile || {};
      var caseCount = Number(input.caseCount || 0);
      var caseContext = input.caseContext || '';
      // 记录注入 Agent2 的完整输入，便于验收核查"上下文不含姓名/学号"
      lastAgent2Input = { analysis: input.analysis || '', caseContext: caseContext, caseCount: caseCount, profileName: p.name, profileId: p.id };
      var matched = (typeof matchKnowledge === 'function') ? matchKnowledge([input.analysis || '', p.grades || '']) : [];
      var weeks = (typeof generateLearningPath === 'function') ? generateLearningPath(matched) : [];
      var text = weeks.length
        ? weeks.map(function (w) { return w.title + '：' + w.items.map(function (it) { return it.task; }).join('；'); }).join('\n')
        : '建议每周安排 2 次学业辅导，开放对应课程 MOOC 资源，并每月回访一次。';
      // 有案例时把"参考了多少条"写进方案末尾；无案例则明确标注，不假装有依据
      text += caseCount > 0
        ? '\n（本方案参考了 ' + caseCount + ' 条历史案例）'
        : '\n（无历史案例可参考）';
      return { text: text, matched: matched.map(function (k) { return k.title; }), caseCount: caseCount, caseContext: caseContext };
    });

    // ===== 三 Agent 契约层的输入构造工具（确定性映射，不含任何模型判断）=====

    /** 读画像 + 跑规则引擎：Agent1 的 rule_result 与 evidence 都从这里来 */
    FE.registerTool('agent.profile.load', function (input) {
      var bridge = window.AgentBridge;
      var stu = findStudentById(input && input.studentId);
      if (!stu) throw new Error('未找到学生：' + (input && input.studentId));
      var ruleResult = bridge ? bridge.ruleResultFor(stu.id, stu, {}) : null;
      return {
        id: stu.id, name: stu.name, className: stu.className,
        grades: stu.grades, homework: stu.homework, attendance: stu.attendance,
        lab: stu.lab || '', labReport: stu.labReport || '', codeQuality: stu.codeQuality || '',
        riskLevel: stu._riskLevel || '', ruleResult: ruleResult
      };
    });

    FE.registerTool('agent1.buildInput', function (input) {
      var bridge = window.AgentBridge;
      if (!bridge) throw new Error('数据桥未加载（agentBridge.js）');
      var built = bridge.buildAnalysisInput({
        studentId: (input && input.studentId) || selectedStudentId,
        ruleLevel: input && input.ruleResult ? input.ruleResult.risk_level : undefined,
        ruleScore: input && input.ruleResult ? input.ruleResult.risk_score : undefined
      });
      // 证据编号要在界面上可见，方便辅导员把结论与原始数据对上号
      return built;
    });

    FE.registerTool('agent2.buildInput', function (input) {
      var bridge = window.AgentBridge;
      if (!bridge) throw new Error('数据桥未加载（agentBridge.js）');
      return bridge.buildPlanInput({
        studentId: (input && input.studentId) || selectedStudentId,
        findings: input && input.findings,
        cases: input && input.cases,
        planPeriodDays: (input && input.planPeriodDays) || 30
      });
    });

    /** 汇总执行证据：Agent3 的输入必须来自真实记录，没有记录就明写"未提供" */
    FE.registerTool('agent3.gatherEvidence', function (input) {
      var bridge = window.AgentBridge;
      if (!bridge) throw new Error('数据桥未加载（agentBridge.js）');
      return bridge.gatherReview({
        studentId: (input && input.studentId) || selectedStudentId,
        reviewDays: input && input.reviewDays,
        ctxPlan: input && input.ctxPlan
      });
    });

    FE.registerTool('agent3.buildInput', function (input) {
      var bridge = window.AgentBridge;
      if (!bridge) throw new Error('数据桥未加载（agentBridge.js）');
      return bridge.buildReviewInput({
        studentId: (input && input.studentId) || selectedStudentId,
        review: input && input.review
      });
    });

    FE.registerTool('warning.ticket', function (input) {
      var stu = findStudentById(input && input.studentId);
      if (!stu) throw new Error('未找到学生：' + (input && input.studentId));
      stu._riskLevel = input.level === '高' ? '高' : (input.level || '中');
      if (stu._riskLevel === '低') stu._riskLevel = '中';
      stu.status = 'pending';
      stu.ticketId = 'W-' + Date.now().toString(36).toUpperCase();
      stu.ticketTime = formatTime(new Date());
      stu.ticketReason = input.reason || '';
      // 方案落库时保留 actions 与成功标准：没有它们，Agent3 复核时只能判"证据不足"
      // （这正是"闭环"能否成立的关键，所以不能只存一段文字摘要）。
      var bridge = window.AgentBridge;
      if (input.planOutput && bridge) {
        var sp = bridge.planToSupportPlan(input.planOutput);
        sp.summary = sp.summary || (input.plan || '');
        // 补齐审批流程需要的字段：方案详情页的"通过/驳回"会写 status 与 history
        sp.status = sp.status || 'draft';
        sp.createdAt = sp.createdAt || formatTime(new Date());
        sp.history = sp.history || [{ action: '由三 Agent 任务流生成', time: sp.createdAt, operator: '系统' }];
        stu.supportPlan = sp;
      } else {
        stu.supportPlan = { summary: input.plan || '', recommendations: [], resources: [] };
      }
      addOperationLog(stu.id, 'flow_ticket',
        '任务流生成预警工单｜原因：' + (input.reason || '') + '｜方案：' + String(input.plan || '').slice(0, 80), null, 'pending');
      saveStudentStates();
      renderSidebar(sidebarSearch ? sidebarSearch.value : '');
      return {
        ticketId: stu.ticketId, student: stu.name, level: stu._riskLevel,
        actionCount: (stu.supportPlan && stu.supportPlan.actions) ? stu.supportPlan.actions.length : 0
      };
    });
  }

  function registerFlowRunners() {
    var FE = window.FlowEngine;
    if (!FE) return;
    FE.registerRunner('notify', function (step, ctx) {
      var msg = FE.resolve(step.message, ctx) || '';
      showToast(msg.length > 50 ? msg.slice(0, 50) + '…' : msg);
      return Promise.resolve({ message: msg });
    });

    /**
     * Agent 节点执行器：把"契约层（agents.js/agentBridge.js）"接到流程引擎上。
     * 流程引擎只负责在输出未通过结构校验时阻断并转人工（见 flowEngine.guardFailure），
     * 这里负责：取配置 → 构造输入 → 调模型 → 校验重试 → 返回带校验结论的结果。
     */
    FE.registerRunner('agent', function (step, ctx) {
      var bridge = window.AgentBridge, agents = window.Agents;
      if (!agents) return Promise.reject(new Error('Agent 契约层未加载（agents.js）'));
      var agentId = step.agent || step.agentId || 'agent1';
      var studentId = (ctx.input && ctx.input.studentId) || selectedStudentId;
      var input = FE.resolve(step.input, ctx);

      // 节点声明的 input 是"已构造好的契约输入"；万一为空则用数据桥兜底重算一遍。
      try {
        if (bridge && (!input || !input.case_id)) {
          if (agentId === 'agent1') input = bridge.buildAnalysisInput({ studentId: studentId });
          else if (agentId === 'agent2') input = bridge.buildPlanInput({ studentId: studentId, findings: [] });
          else input = bridge.buildReviewInput({ studentId: studentId });
        }
      } catch (e) {
        return Promise.reject(new Error('构造 ' + agentId + ' 输入失败：' + e.message));
      }

      var configs = agents.loadConfigs();
      var agentApi = CONFIG.agentApi || {};
      var multimodalCfg = (window.MM && typeof MM.cfg === 'function') ? MM.cfg() : (CONFIG.multimodal || {});
      var model = (configs[agentId] && configs[agentId].model) ||
        (agentApi.models && agentApi.models[agentId]) || agentApi.model || multimodalCfg.vlmModel || 'qwen-vl-plus';
      return agents.run({
        agentId: agentId,
        input: input,
        caller: agentLLMCaller,
        config: configs[agentId],
        model: model,
        maxAttempts: 2
      }).then(function (rec) {
        // 留痕之外再给一次界面反馈：辅导员需要知道这次是真实模型还是降级结果。
        if (rec.engine === 'mock') showToast(agents.DEFAULT_CONFIGS[agentId].role + '：未配置模型密钥，已用降级模板（结构校验通过）');
        else if (rec.status !== 'ok') showToast(agents.DEFAULT_CONFIGS[agentId].role + '：输出未通过校验，已转人工');
        return rec;
      });
    });
  }

  /**
   * 三 Agent 的大模型调用器。
   * 复用 multimodal 段的 chatUrl/apiKey 配置（与 OCR/答疑同一条链路），
   * 未配置密钥或调用失败时返回 null —— 契约层会自动降级为结构合法的模板输出。
   */
  function agentLLMCaller(prompt, meta) {
    var cfg = (window.MM && typeof MM.cfg === 'function') ? MM.cfg() : (CONFIG.multimodal || {});
    var agentApi = CONFIG.agentApi || {};
    var apiKey = String(agentApi.apiKey || cfg.apiKey || '');
    var chatUrl = agentApi.chatUrl || cfg.chatUrl || (CONFIG.real && CONFIG.real.chatUrl) || '';
    // 占位符（YOUR_...）不算配置，否则会拿着假 key 去请求，报错还很难排查。
    if (!apiKey || /^YOUR_/i.test(apiKey) || !chatUrl) return Promise.reject(new Error('Agent API 未配置'));
    var conf = (meta && meta.config) || {};
    var body = {
      model: (meta && meta.model) || conf.model ||
        (agentApi.models && agentApi.models[meta && meta.agentId]) || agentApi.model || cfg.vlmModel || 'qwen-vl-plus',
      // prompt 已由契约层拼成「系统提示词 + 输入 + （可选）修复指令」，整体交给模型即可
      messages: [{ role: 'user', content: prompt }],
      temperature: conf.temperature === undefined ? 0.3 : conf.temperature,
      max_tokens: conf.maxTokens || 2048
    };
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { try { controller.abort(); } catch (e) {} }, 60000) : null;
    return fetch(chatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(body),
      signal: controller ? controller.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('接口返回 HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      var content = d && d.choices && d.choices[0] && d.choices[0].message ? d.choices[0].message.content : null;
      if (Array.isArray(content)) content = content.map(function (p) { return p && p.text ? p.text : ''; }).join('');
      if (typeof content === 'string' && content.replace(/^\s+|\s+$/g, '')) return content;
      throw new Error('模型返回内容为空');
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      console.warn('[Agent] 模型调用失败，降级为模板输出：', err && err.message);
      throw err;
    });
  }

  function renderFlowPanel() {
    if (!tabFlow) return;
    var FE = window.FlowEngine;
    if (!FE) { tabFlow.innerHTML = '<div style="padding:20px;">任务流引擎未加载</div>'; return; }
    var flows = FE.list();
    var html = '<div style="padding:16px 20px;">';
    html += '<h3 style="font-size:16px;font-weight:600;margin-bottom:4px;">任务流编排</h3>';
    html += '<p style="font-size:12px;color:var(--color-text-muted);margin-bottom:12px;">把多步 AI 流程抽象为 JSON DSL，每次运行都会留下可回放的时间线。</p>';
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
    for (var i = 0; i < flows.length; i++) {
      var f = flows[i];
      html += '<div class="card" style="flex:1;min-width:260px;padding:12px;">' +
        '<div style="font-size:14px;font-weight:600;">' + (f.icon || '') + ' ' + escapeHtml(f.name) + '</div>' +
        '<div style="font-size:11px;color:var(--color-text-muted);margin:6px 0 10px;line-height:1.6;">' + escapeHtml(f.description || '') + '</div>' +
        '<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px;">共 ' + f.steps.length + ' 个节点' + (f.needsImage ? ' · 需要图片' : '') + '</div>' +
        '<button class="btn btn-sm btn-primary" data-flow-run="' + f.id + '">运行</button> ' +
        '<button class="btn btn-sm btn-outline" data-flow-view="' + f.id + '">查看定义</button>' +
        '</div>';
    }
    html += '</div>';
    html += '<div id="flowTimeline" style="margin-top:14px;"></div>';
    html += '<div id="flowHistory" style="margin-top:14px;"></div>';
    html += '</div>';
    tabFlow.innerHTML = html;
    tabFlow.querySelectorAll('[data-flow-run]').forEach(function (b) {
      b.addEventListener('click', function () { runFlowById(this.getAttribute('data-flow-run')); });
    });
    tabFlow.querySelectorAll('[data-flow-view]').forEach(function (b) {
      b.addEventListener('click', function () { showFlowDefinition(this.getAttribute('data-flow-view')); });
    });
    renderFlowTimeline(FE.current());
    renderFlowHistory();
  }

  function showFlowDefinition(id) {
    var FE = window.FlowEngine;
    var def = FE.get(id);
    var box = document.getElementById('flowTimeline');
    if (!def || !box) return;
    box.innerHTML = '<div class="card" style="padding:12px;"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">' +
      escapeHtml(def.name) + ' · 定义</div><pre style="font-size:11px;white-space:pre-wrap;max-height:320px;overflow:auto;margin:0;">' +
      escapeHtml(JSON.stringify(def, null, 2)) + '</pre></div>';
  }

  function runFlowById(id) {
    var FE = window.FlowEngine;
    var def = FE.get(id);
    if (!def) return;
    var sid = selectedStudentId || (mockStudents[0] && mockStudents[0].id);
    var stu = findStudentById(sid);
    var ctx = { studentId: sid, studentName: stu ? stu.name : '' };
    if (def.needsImage) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = function () {
        var f = input.files && input.files[0];
        if (!f) return;
        ctx.image = f;
        executeFlow(id, ctx);
      };
      input.click();
      return;
    }
    executeFlow(id, ctx);
  }

  function executeFlow(id, ctx) {
    var FE = window.FlowEngine;
    var box = document.getElementById('flowTimeline');
    if (box) box.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--color-text-muted);">任务流运行中…</div>';
    FE.run(id, ctx).then(function (run) {
      renderFlowTimeline(run);
      renderFlowHistory();
      var failed = null;
      for (var i = 0; i < run.steps.length; i++) { if (run.steps[i].status === 'failed') { failed = run.steps[i]; break; } }
      if (run.status === 'success') showToast('任务流完成：' + run.flowName);
      else if (failed) showToast('任务流失败：' + failed.error);
    });
  }

  /** 任务流时间线的 HTML 构造器（被任务流页与证据链弹层共用，避免两份渲染逻辑） */
  function flowTimelineHtml(run) {
    if (!run) return '';
    var statusMap = { running: '运行中', success: '成功', failed: '失败', blocked: '已阻断待人工' };
    var badge = run.status === 'success' ? 'risk-low' : (run.status === 'failed' ? 'risk-high' : 'risk-medium');
    var h = '<div class="card" style="padding:12px;">' +
      '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + escapeHtml(run.flowName) +
      ' <span class="risk-badge ' + badge + '" style="font-size:10px;">' + (statusMap[run.status] || run.status) + '</span>' +
      ' <span style="font-size:10px;color:var(--color-text-muted);font-weight:400;">' + escapeHtml((run.startedAt || '').slice(11, 19)) + '</span></div>';
    for (var i = 0; i < run.steps.length; i++) {
      var s = run.steps[i];
      // blocked = Agent 输出未通过结构校验，流程按文档要求停在人工节点，不是"成功"也不是"崩溃"
      var icon = s.status === 'success' ? '✔' : (s.status === 'failed' ? '✖' : (s.status === 'blocked' ? '⏸' : '◌'));
      var color = s.status === 'success' ? '#0d904f' : (s.status === 'failed' ? '#d93025' : (s.status === 'blocked' ? '#b45309' : '#b45309'));
      var detail = s.error ? ((s.status === 'blocked' ? '未通过校验：' : '错误：') + s.error) : (typeof s.output === 'string' ? s.output : JSON.stringify(s.output || ''));
      var mockLabel = s.output && typeof s.output === 'object' && s.output.mock ? '<strong style="color:var(--color-warning);">模拟结果（未联网） </strong>' : '';
      h += '<div style="display:flex;gap:8px;font-size:11px;padding:5px 0;border-bottom:1px dashed var(--color-border-light);">' +
        '<span style="color:' + color + ';">' + icon + '</span>' +
        '<span style="min-width:160px;font-weight:600;">' + escapeHtml(s.label) + '</span>' +
        '<span style="min-width:60px;color:var(--color-text-muted);">' + escapeHtml(s.type) + '</span>' +
        '<span style="flex:1;color:var(--color-text-muted);word-break:break-all;">' + mockLabel + escapeHtml(String(detail).slice(0, 200)) + '</span>' +
        '</div>';
    }
    h += '</div>';
    return h;
  }

  function renderFlowTimeline(run) {
    var box = document.getElementById('flowTimeline');
    if (!box || !run) return;
    box.innerHTML = flowTimelineHtml(run);
  }

  function renderFlowHistory() {
    var box = document.getElementById('flowHistory');
    if (!box || !window.FlowEngine) return;
    var runs = FlowEngine.runs().slice(0, 8);
    var h = '<div class="card" style="padding:12px;"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">运行历史</div>';
    if (!runs.length) h += '<div style="font-size:11px;color:var(--color-text-muted);">暂无运行记录</div>';
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      var cls = (r.status === 'success' || r.status === 'blocked') ? 'risk-low' : (r.status === 'failed' ? 'risk-high' : 'risk-medium');
      var statusText = { running: '运行中', success: '成功', failed: '失败', blocked: '已阻断待人工' }[r.status] || r.status;
      h += '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:4px 0;border-bottom:1px dashed var(--color-border-light);">' +
        '<span>' + (r.icon || '') + ' ' + escapeHtml(r.flowName) + '</span>' +
        '<span><span class="risk-badge ' + cls + '" style="font-size:10px;">' + escapeHtml(statusText) + '</span> ' +
        '<span style="color:var(--color-text-muted);">' + escapeHtml((r.startedAt || '').replace('T', ' ').slice(0, 19)) + '</span></span>' +
        '</div>';
    }
    h += '</div>';
    box.innerHTML = h;
  }

  registerFlowTools();
  registerFlowRunners();
  if (window.FlowEngine) {
    FlowEngine.onUpdate(function (run) { if (document.getElementById('flowTimeline')) renderFlowTimeline(run); });
  }
  function showDashboard() { hideOtherTabPanels(); if(contentDashboard)contentDashboard.style.display='';if(contentEmpty)contentEmpty.style.display='none';if(contentDetail)contentDetail.style.display='none';renderDashboard(); }



  // ================================================================

  //  知识库

  // ================================================================

  function renderKnowledgeTreeFiltered(filteredItems) {

    if (!knowledgeTree) return;

    var items = filteredItems || knowledgeBase;

    var courses = [];

    for (var i = 0; i < items.length; i++) { var cn = items[i].course; if (courses.indexOf(cn) === -1) courses.push(cn); }

    var html = '';

    for (var c = 0; c < courses.length; c++) {

      var cn = courses[c];

      var topics = items.filter(function(k) { return k.course === cn; });

      html += '<div class="knowledge-course-group"><div class="knowledge-course-header"><span class="knowledge-course-arrow expanded">\u25b6</span><span>' + escapeHtml(cn) + '</span><span class="class-group-count">' + topics.length + '</span></div><ul class="knowledge-topic-list">';

      for (var tp = 0; tp < topics.length; tp++) {

        var t = topics[tp];

        var aCls = (highlightedKnowledgeId === t.id) ? ' active' : '';

        html += '<li class="knowledge-topic-item' + aCls + '" data-kbid="' + t.id + '"><span>' + escapeHtml(t.title) + '</span><span class="knowledge-difficulty diff-' + t.difficulty + '">' + t.difficulty + '</span></li>';

      }

      html += '</ul></div>';

    }

    if (items.length === 0) html = '<div style="padding:12px;font-size:12px;color:var(--color-text-muted);">未找到匹配知识点</div>';

    knowledgeTree.innerHTML = html;

    knowledgeTree.querySelectorAll('.knowledge-course-header').forEach(function(h) { h.addEventListener('click', function() { var a=this.querySelector('.knowledge-course-arrow'),l=this.nextElementSibling; if(l.classList.contains('collapsed')){l.classList.remove('collapsed');a.classList.add('expanded');}else{l.classList.add('collapsed');a.classList.remove('expanded');}}); });

    knowledgeTree.querySelectorAll('.knowledge-topic-item').forEach(function(it) { it.addEventListener('click', function() { var kbid=this.getAttribute('data-kbid'); showKnowledgeDetail(kbid); knowledgeTree.querySelectorAll('.knowledge-topic-item').forEach(function(x){x.classList.remove('active');}); this.classList.add('active'); highlightedKnowledgeId=kbid; }); });

    if (highlightedKnowledgeId) { var ai=knowledgeTree.querySelector('.knowledge-topic-item[data-kbid="'+highlightedKnowledgeId+'"]'); if(ai){ai.scrollIntoView({block:'nearest'});showKnowledgeDetail(highlightedKnowledgeId);}}

  }



  function renderKnowledgeTree() {

    renderKnowledgeTreeFiltered(null);

  }

  function showKnowledgeDetail(kbid) { if(!knowledgeDetail)return;var item=null;for(var i=0;i<knowledgeBase.length;i++){if(knowledgeBase[i].id===kbid){item=knowledgeBase[i];break;}}if(!item)return;knowledgeDetail.innerHTML='<div class="knowledge-detail-title">'+escapeHtml(item.title)+'</div><div class="knowledge-detail-meta"><span>\ud83d\udcda '+escapeHtml(item.course)+'</span><span class="knowledge-difficulty diff-'+item.difficulty+'">'+item.difficulty+'</span></div><div class="knowledge-detail-summary">'+escapeHtml(item.summary)+'</div><div class="knowledge-detail-section"><h4>\ud83d\udcce \u5b66\u4e60\u8d44\u6e90</h4>'+(item.resources||[]).map(function(r){return'<span class="knowledge-resource-item">'+escapeHtml(r)+'</span>';}).join('')+'</div><div class="knowledge-detail-section"><h4>\ud83c\udff7 \u6807\u7b7e</h4>'+(item.tags||[]).map(function(t){return'<span class="knowledge-tag-item">'+escapeHtml(t)+'</span>';}).join('')+'</div>'; }

  function navigateToKnowledge(kbid) { highlightedKnowledgeId=kbid;switchTab('knowledge');renderKnowledgeTree(); }



  // ================================================================

  //  启动

  // ================================================================

  try {

    init();

  } catch(e) {

    document.body.innerHTML = '<div style="padding:20px;color:#d93025;font-family:sans-serif;"><h2>JS 初始化错误</h2><pre>' + (e.message || e) + '</pre></div>';

    console.error('Init error:', e);

  }

})();
