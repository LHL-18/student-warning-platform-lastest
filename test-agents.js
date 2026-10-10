/**
 * test-agents.js — 三 Agent 契约层独立验证套件
 * ---------------------------------------------------------------
 * 判定基准：docs/三Agent协同专属提示词.md（提示词文本、输入模板、输出结构、通用约束、决策规则）
 * 被测实现：agents.js（T1 冻结 API）
 * 联调对象：flowEngine.js
 *
 * 设计原则：
 *  1) 期望值全部由文档独立推导（提示词在运行时从 .md 原文抽取后逐字比对，避免抄写误差）；
 *  2) 只有"结构自洽"类用例才引用 Agents.mock() 的输出，其余用测试自建的正/负样例；
 *  3) 任何断言失败都只记录，不中断后续用例；进程退出码体现结果。
 *
 * 运行：node test-agents.js
 * 退出码：0 = 全部通过；1 = 存在失败用例；2 = agents.js 缺失（契约用例未验证）
 */
var fs = require('fs');
var path = require('path');

/* ================= 环境垫片：Node 下没有 window / localStorage ================= */

var memStore = {};
var localStorageShim = {
  getItem: function (k) {
    return Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null;
  },
  setItem: function (k, v) { memStore[k] = String(v); },
  removeItem: function (k) { delete memStore[k]; },
  clear: function () { memStore = {}; },
  key: function (i) {
    var ks = Object.keys(memStore);
    return i >= 0 && i < ks.length ? ks[i] : null;
  }
};
Object.defineProperty(localStorageShim, 'length', {
  get: function () { return Object.keys(memStore).length; }
});
global.localStorage = localStorageShim;
// agents.js / flowEngine.js 都以 (typeof window !== 'undefined' ? window : this) 取全局，必须提前挂上
global.window = global;

/* ================= 断言与输出工具 ================= */

var passed = 0;
var failed = 0;
var noted = 0;
var failures = [];

function S(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 170 ? v.slice(0, 170) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    var s = JSON.stringify(v);
    return s.length > 170 ? s.slice(0, 170) + '…' : s;
  } catch (e) { return String(v); }
}

/** 一条用例：打印中文名称与期望/实际 */
function check(name, ok, expected, actual) {
  if (ok) {
    passed++;
    console.log('  PASS | ' + name + ' | 期望=' + S(expected) + ' 实际=' + S(actual));
  } else {
    failed++;
    failures.push(name + ' | 期望=' + S(expected) + ' 实际=' + S(actual));
    console.log('  FAIL | ' + name + ' | 期望=' + S(expected) + ' 实际=' + S(actual));
  }
}

/** 不计入退出码的观察项（文档未明确规定的语义，供报告分类） */
function warn(name, detail) { noted++; console.log('  WARN | ' + name + ' | ' + detail); }
function info(name, detail) { console.log('  INFO | ' + name + ' | ' + detail); }
function section(title) { console.log('\n【' + title + '】'); }

function sameList(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  var x = a.slice().sort();
  var y = b.slice().sort();
  for (var i = 0; i < x.length; i++) { if (x[i] !== y[i]) return false; }
  return true;
}

function missingFrom(required, actual) {
  var out = [];
  if (!Array.isArray(actual)) return required.slice();
  for (var i = 0; i < required.length; i++) {
    if (actual.indexOf(required[i]) === -1) out.push(required[i]);
  }
  return out;
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

/** 逐字比对的文本归一化：统一换行、去掉行尾空白与首尾空行 */
function norm(s) {
  if (typeof s !== 'string') return '';
  var lines = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (var i = 0; i < lines.length; i++) lines[i] = lines[i].replace(/\s+$/, '');
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

/* ================= 文档解析：从 .md 原文抽取判定基准 ================= */

var DOC_PATH = path.join(__dirname, 'docs', '三Agent协同专属提示词.md');
var mdText = null;
try { mdText = fs.readFileSync(DOC_PATH, 'utf8'); } catch (e) { mdText = null; }

/** 解析出所有围栏代码块，并附带所属 h2/h3 标题 */
function parseBlocks(md) {
  var lines = String(md).replace(/\r\n/g, '\n').split('\n');
  var blocks = [];
  var h2 = '';
  var h3 = '';
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var m = line.match(/^##\s+(.*)$/);
    if (m) { h2 = m[1].trim(); h3 = ''; continue; }
    m = line.match(/^###\s+(.*)$/);
    if (m) { h3 = m[1].trim(); continue; }
    m = line.match(/^```([A-Za-z]*)\s*$/);
    if (m) {
      var buf = [];
      var j = i + 1;
      while (j < lines.length && !/^```\s*$/.test(lines[j])) { buf.push(lines[j]); j++; }
      blocks.push({ h2: h2, h3: h3, lang: m[1], text: buf.join('\n') });
      i = j;
    }
  }
  return blocks;
}

function findBlock(blocks, h2Prefix, h3) {
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (b.h2.indexOf(h2Prefix) !== 0) continue;
    if (h3 !== undefined && b.h3 !== h3) continue;
    return b;
  }
  return null;
}

var docBlocks = mdText ? parseBlocks(mdText) : [];
var docCommon = findBlock(docBlocks, '通用约束', '');
var docPrompts = {
  agent1: findBlock(docBlocks, 'Agent1', '系统提示词'),
  agent2: findBlock(docBlocks, 'Agent2', '系统提示词'),
  agent3: findBlock(docBlocks, 'Agent3', '系统提示词')
};
var docInputs = {
  agent1: findBlock(docBlocks, 'Agent1', '输入模板'),
  agent2: findBlock(docBlocks, 'Agent2', '输入模板'),
  agent3: findBlock(docBlocks, 'Agent3', '输入模板')
};
var docOutputs = {
  agent1: findBlock(docBlocks, 'Agent1', '输出结构'),
  agent2: findBlock(docBlocks, 'Agent2', '输出结构'),
  agent3: findBlock(docBlocks, 'Agent3', '输出结构')
};

/** 通用约束 8 条（从文档原文切出编号项） */
function docConstraintItems() {
  var items = [];
  if (!docCommon) return items;
  var lines = norm(docCommon.text).split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (/^\d+\.\s/.test(lines[i])) items.push(lines[i].replace(/\s+$/, ''));
  }
  return items;
}

/** 决策规则表格行 */
function docDecisionRows() {
  var rows = [];
  if (!mdText) return rows;
  var lines = mdText.replace(/\r\n/g, '\n').split('\n');
  var inSec = false;
  for (var i = 0; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { inSec = lines[i].indexOf('流程引擎的决策规则') !== -1; continue; }
    if (inSec && /^\|/.test(lines[i])) {
      var cells = lines[i].replace(/^\|/, '').replace(/\|$/, '').split('|');
      var trimmed = [];
      for (var k = 0; k < cells.length; k++) trimmed.push(cells[k].replace(/^\s+|\s+$/g, ''));
      rows.push(trimmed);
    }
  }
  return rows;
}

/* ================= 文档独立推导出的契约常量 ================= */

// 输出结构必填字段（逐条对照文档"输出结构"代码块）
var DOC_REQUIRED = {
  agent1: ['case_id', 'rule_result_summary', 'findings', 'data_quality_issues', 'uncertainties', 'recommendation', 'recommendation_reason'],
  agent2: ['case_id', 'plan_title', 'overall_goal', 'period_days', 'actions', 'case_refs_used', 'assumptions', 'needs_human_input', 'risks_or_limits'],
  agent3: ['case_id', 'plan_id', 'overall_assessment', 'criteria_results', 'data_gaps', 'conflicts', 'recommendation', 'recommendation_reason']
};
var DOC_NESTED_REQUIRED = [
  { agent: 'agent1', path: 'rule_result_summary', fields: ['risk_level', 'risk_score', 'unchanged'] },
  { agent: 'agent1', path: 'findings#items', fields: ['statement', 'evidence_ids', 'confidence'] },
  { agent: 'agent2', path: 'actions#items', fields: ['action_id', 'description', 'owner', 'deadline_day', 'resources', 'success_criteria'] },
  { agent: 'agent2', path: 'actions#items.success_criteria#items', fields: ['metric', 'target', 'data_source'] },
  { agent: 'agent3', path: 'criteria_results#items', fields: ['action_id', 'metric', 'target', 'observed', 'assessment', 'evidence_ids', 'reason'] }
];
// 枚举集合（逐条对照文档输出结构里的 "a|b|c"）
var DOC_ENUMS = [
  { agent: 'agent1', path: 'rule_result_summary.risk_level.enum', values: ['高', '中', '低'] },
  { agent: 'agent1', path: 'findings#items.confidence.enum', values: ['高', '中', '低'] },
  { agent: 'agent1', path: 'recommendation.enum', values: ['建议确认', '建议复核', '证据不足'] },
  { agent: 'agent2', path: 'actions#items.owner.enum', values: ['学生', '辅导员', '任课教师'] },
  { agent: 'agent3', path: 'overall_assessment.enum', values: ['达成', '部分达成', '未达成', '证据不足'] },
  { agent: 'agent3', path: 'criteria_results#items.assessment.enum', values: ['达成', '未达成', '证据不足'] },
  { agent: 'agent3', path: 'recommendation.enum', values: ['继续原计划', '建议调整计划', '建议人工复核', '可提交结案审批'] }
];
// 输入模板字段（逐条对照文档"输入模板"代码块键名）
var DOC_INPUT_KEYS = {
  agent1: ['case_id', 'student_ref', 'period', 'rule_result', 'evidence', 'missing_fields'],
  agent2: ['case_id', 'student_ref', 'approved_findings', 'student_constraints', 'available_resources', 'case_summaries', 'plan_period_days'],
  agent3: ['case_id', 'approved_plan', 'review_period', 'execution_evidence']
};

/* ================= 测试自建样例（与实现无关，按文档推导） ================= */

// ---- Agent1 输入 / 期望输出 ----
var agent1Input = {
  case_id: 'CASE-1001',
  student_ref: 'STU-****-0103',
  period: '2025-2026-1',
  rule_result: {
    rule_name: '多指标综合预警',
    rule_version: 'v2.1',
    risk_level: '中',
    risk_score: 62,
    triggered_rules: ['R-ATT-03 出勤率低于阈值', 'R-HW-02 作业迟交次数超限']
  },
  evidence: [
    { evidence_id: 'EV-attendance_rate-1', metric: 'attendance_rate', observed: 0.71, expected: '>=0.90', observed_at: '2025-10-08T09:00:00+08:00', source: '教务系统', quality: '可信' },
    { evidence_id: 'EV-homework_late-2', metric: 'homework_late', observed: 6, expected: '<=2', observed_at: '2025-10-07T20:00:00+08:00', source: '作业平台', quality: '待核实' },
    { evidence_id: 'EV-checkin_rate-3', metric: 'checkin_rate', observed: 0.4, expected: '>=0.8', observed_at: '2025-09-20T20:00:00+08:00', source: '打卡系统', quality: '过期' }
  ],
  missing_fields: ['家庭联系方式', '期中成绩']
};
var agent1OutputOk = {
  case_id: 'CASE-1001',
  rule_result_summary: { risk_level: '中', risk_score: 62, unchanged: true },
  findings: [
    { statement: '出勤率 71% 低于 90% 阈值，与规则 R-ATT-03 一致', evidence_ids: ['EV-attendance_rate-1'], confidence: '高' },
    { statement: '作业迟交 6 次超过 2 次上限（记录待核实）', evidence_ids: ['EV-homework_late-2'], confidence: '中' }
  ],
  data_quality_issues: ['作业迟交记录来源未核实', '打卡记录已过期'],
  uncertainties: ['缺少期中成绩与家庭联系方式'],
  recommendation: '建议确认',
  recommendation_reason: '规则与可信证据一致，建议辅导员确认后进入帮扶规划'
};

// ---- Agent2 输入 / 期望输出 ----
var agent2Input = {
  case_id: 'CASE-1001',
  student_ref: 'STU-****-0103',
  approved_findings: [
    { statement: '出勤率连续四周低于阈值', evidence_ids: ['EV-attendance_rate-1'] }
  ],
  student_constraints: ['每周三下午有课', '周末不住校'],
  available_resources: ['晚间自习室', '任课教师答疑', '学习小组'],
  case_summaries: [
    { case_ref: 'CASE-A-2019', intervention: '每周三次晚间自习打卡并周报', outcome: '八周后出勤率回升至 92%', evidence_quality: '可信' },
    { case_ref: 'CASE-B-2021', intervention: '任课教师双周反馈', outcome: '作业迟交减少', evidence_quality: '待核实' }
  ],
  plan_period_days: 30
};
var agent2OutputOk = {
  case_id: 'CASE-1001',
  plan_title: '出勤改善 30 天帮扶计划',
  overall_goal: '30 天内把出勤率提升到 90% 以上，作业迟交不超过 2 次',
  period_days: 30,
  actions: [
    {
      action_id: 'A1',
      description: '每周一/三/五参加晚间自习并打卡',
      owner: '学生',
      deadline_day: 7,
      resources: ['晚间自习室'],
      success_criteria: [{ metric: 'weekly_checkin_count', target: '>=3 次/周', data_source: '打卡系统' }]
    },
    {
      action_id: 'A2',
      description: '任课教师每两周反馈一次出勤与作业情况',
      owner: '任课教师',
      deadline_day: 14,
      resources: ['教务系统'],
      success_criteria: [{ metric: 'attendance_rate', target: '>=0.90', data_source: '教务系统' }]
    }
  ],
  case_refs_used: ['CASE-A-2019'],
  assumptions: ['学生可参加晚间自习'],
  needs_human_input: [],
  risks_or_limits: ['30 天只能观察短期趋势']
};

// ---- Agent3 输入 / 期望输出 ----
var agent3Input = {
  case_id: 'CASE-1001',
  plan_id: 'PLAN-2025-1001',
  approved_plan: {
    plan_id: 'PLAN-2025-1001',
    actions: [
      { action_id: 'A1', description: '每周三次自习打卡', success_criteria: [{ metric: 'weekly_checkin_count', target: '>=3 次/周', data_source: '打卡系统' }] },
      { action_id: 'A2', description: '出勤率提升', success_criteria: [{ metric: 'attendance_rate', target: '>=0.90', data_source: '教务系统' }] },
      { action_id: 'A3', description: '作业按时提交', success_criteria: [{ metric: 'homework_on_time_rate', target: '>=0.85', data_source: '作业平台' }] }
    ]
  },
  review_period: { start: '2025-10-01', end: '2025-10-31' },
  execution_evidence: [
    { evidence_id: 'EV-checkin-1', action_id: 'A1', metric: 'weekly_checkin_count', observed: 3, observed_at: '2025-10-12T21:00:00+08:00', source: '打卡系统', quality: '可信' },
    { evidence_id: 'EV-attendance-2', action_id: 'A2', metric: 'attendance_rate', observed: 0.72, observed_at: '2025-10-20T09:00:00+08:00', source: '教务系统', quality: '可信' }
  ]
};
var agent3OutputOk = {
  case_id: 'CASE-1001',
  plan_id: 'PLAN-2025-1001',
  overall_assessment: '部分达成',
  criteria_results: [
    { action_id: 'A1', metric: 'weekly_checkin_count', target: '>=3 次/周', observed: '3', assessment: '达成', evidence_ids: ['EV-checkin-1'], reason: '第 2 周打卡 3 次，达到标准' },
    { action_id: 'A2', metric: 'attendance_rate', target: '>=0.90', observed: '0.72', assessment: '未达成', evidence_ids: ['EV-attendance-2'], reason: '10-20 出勤率 0.72，低于 0.90' },
    { action_id: 'A3', metric: 'homework_on_time_rate', target: '>=0.85', observed: '未提供', assessment: '证据不足', evidence_ids: [], reason: '复核周期内作业平台无记录，不能判定未执行' }
  ],
  data_gaps: ['缺 A3 作业提交记录'],
  conflicts: [],
  recommendation: '建议调整计划',
  recommendation_reason: 'A2 未达标，建议辅导员调整措施后继续观察'
};

/* ================= safe 调用封装（实现抛异常也要记为失败而不是崩溃） ================= */

var Agents = null;
var AgentsLoadError = null;
var FlowEngine = null;
try {
  FlowEngine = require(path.join(__dirname, 'flowEngine.js'));
} catch (e) { FlowEngine = null; }
try {
  Agents = require(path.join(__dirname, 'agents.js'));
} catch (e) { AgentsLoadError = e; }
if (!Agents && global.Agents) Agents = global.Agents; // IIFE 只挂 window 时的兜底

function safeCall(fn, args, fallback) {
  try { return fn.apply(null, args); } catch (e) {
    return { __threw: (e && e.message) || String(e), __fallback: fallback };
  }
}
function codesOf(res) {
  var out = [];
  if (res && res.errors && res.errors.length) {
    for (var i = 0; i < res.errors.length; i++) {
      if (res.errors[i] && res.errors[i].code) out.push(String(res.errors[i].code));
      else out.push('(无code)');
    }
  }
  return out;
}
function safeValidate(agentId, output, input) {
  if (!Agents || typeof Agents.validate !== 'function') return { valid: null, errors: [], __missing: 'validate' };
  var r = safeCall(Agents.validate, [agentId, output, input]);
  if (r && r.__threw) return { valid: null, errors: [], __threw: r.__threw };
  return r;
}
function expectValid(agentId, output, input, name) {
  var res = safeValidate(agentId, output, input);
  check(name, !!res && res.valid === true,
    'valid=true',
    'valid=' + (res && res.valid) + ' codes=[' + codesOf(res).join(',') + ']' + (res && res.__threw ? ' 异常:' + res.__threw : ''));
  return res;
}
/** 期望校验失败，且错误码命中 allowed（allowed 内任一即可；正则项用于文档未指定码名的语义违规） */
function expectInvalid(agentId, output, input, allowed, name) {
  var res = safeValidate(agentId, output, input);
  var codes = codesOf(res);
  var hit = [];
  for (var i = 0; i < codes.length; i++) {
    for (var j = 0; j < allowed.length; j++) {
      var a = allowed[j];
      if (a.charAt(0) === '/' ? new RegExp(a.slice(1, -1)).test(codes[i]) : codes[i] === a) { hit.push(codes[i]); }
    }
  }
  var ok = !!res && res.valid === false && codes.length > 0 && hit.length > 0;
  check(name, ok,
    'valid=false 且错误码含 [' + allowed.join('|') + ']',
    'valid=' + (res && res.valid) + ' codes=[' + codes.join(',') + ']' + (res && res.__threw ? ' 异常:' + res.__threw : ''));
  return res;
}
function pickAlias(obj, names) {
  if (!obj) return null;
  for (var i = 0; i < names.length; i++) {
    if (obj[names[i]] !== undefined && obj[names[i]] !== null) return names[i];
  }
  return null;
}
function asPromise(v) { return (v && typeof v.then === 'function') ? v : Promise.resolve(v); }

/* ================= 主流程 ================= */

var asyncQueue = [];
function step(fn) { asyncQueue.push(fn); }
function runQueue() {
  var p = Promise.resolve();
  asyncQueue.forEach(function (fn) {
    p = p.then(function () {
      return Promise.resolve().then(fn).then(null, function (e) {
        check('异步用例段执行不抛异常', false, '无异常', (e && e.message) || String(e));
      });
    });
  });
  return p;
}

function finishSuite() {
  console.log('\n========================================');
  console.log('汇总：' + passed + ' 通过 / ' + failed + ' 失败 / ' + noted + ' 观察');
  if (failures.length) {
    console.log('失败用例清单：');
    for (var i = 0; i < failures.length; i++) console.log('  ' + (i + 1) + '. ' + failures[i]);
  }
  if (AgentsMissing) {
    console.log('结论：agents.js 尚未就绪，契约用例未验证（退出码 2）。');
    process.exitCode = 2;
  } else {
    console.log('结论：' + (failed ? '存在失败用例（退出码 1）' : '全部通过（退出码 0）'));
    process.exitCode = failed ? 1 : 0;
  }
}

var AgentsMissing = false;

function main() {
  /* ---------- 第 0 节：文档基线自检（不依赖实现） ---------- */
  section('第 0 节 · 文档基线自检（判定基准是否可用）');
  check('文档 docs/三Agent协同专属提示词.md 可读取', mdText !== null && mdText.length > 500,
    '文件可读且长度>500', mdText === null ? '读取失败' : ('长度=' + mdText.length));
  if (mdText === null) { AgentsMissing = true; return Promise.resolve(); }

  var jsonBlocks = 0;
  var jsonOk = 0;
  for (var bi = 0; bi < docBlocks.length; bi++) {
    if (docBlocks[bi].lang !== 'json') continue;
    jsonBlocks++;
    try { JSON.parse(docBlocks[bi].text); jsonOk++; } catch (e) { /* 记录在下面的断言里 */ }
  }
  check('文档中 6 个输入/输出 JSON 模板均可解析', jsonBlocks === 6 && jsonOk === 6,
    'json块=6 且全部可解析', 'json块=' + jsonBlocks + ' 可解析=' + jsonOk);
  check('三个 Agent 各有 系统提示词/输入模板/输出结构 三个代码块',
    !!(docPrompts.agent1 && docInputs.agent1 && docOutputs.agent1 &&
       docPrompts.agent2 && docInputs.agent2 && docOutputs.agent2 &&
       docPrompts.agent3 && docInputs.agent3 && docOutputs.agent3),
    '9 个块齐全', '提示词块=' + [!!docPrompts.agent1, !!docPrompts.agent2, !!docPrompts.agent3].join(',') +
    ' 输入块=' + [!!docInputs.agent1, !!docInputs.agent2, !!docInputs.agent3].join(',') +
    ' 输出块=' + [!!docOutputs.agent1, !!docOutputs.agent2, !!docOutputs.agent3].join(','));
  var constraintItems = docConstraintItems();
  check('通用约束为 8 条编号项', constraintItems.length === 8, '8 条', constraintItems.length + ' 条');
  var rows = docDecisionRows();
  var dataRows = rows.filter(function (r) { return /^Agent[123]\s*后$/.test(r[0] || ''); });
  check('决策规则表含 Agent1/2/3 三行', dataRows.length === 3, '3 行', dataRows.length + ' 行');
  check('文档含 "Agent3 不能紧接 Agent2 立即运行" 的触发约束',
    mdText.indexOf('Agent3 必须由执行期结束') !== -1 && mdText.indexOf('不能紧接 Agent2 立即运行') !== -1,
    '两处关键表述存在', '触发约束=' + (mdText.indexOf('Agent3 必须由执行期结束') !== -1) + ' 反例约束=' + (mdText.indexOf('不能紧接 Agent2 立即运行') !== -1));

  /* ---------- 实现缺失时的处理 ---------- */
  if (!Agents) {
    AgentsMissing = true;
    section('第 1 节 · 契约用例（跳过）');
    console.log('  SKIP | agents.js 未能加载 | 错误=' + ((AgentsLoadError && AgentsLoadError.message) || '模块未导出 API'));
    return Promise.resolve();
  }

  /* ---------- 第 1 节：版本与默认配置 ---------- */
  section('第 1 节 · 契约常量与默认配置');
  check('VERSION 为非空字符串', typeof Agents.VERSION === 'string' && Agents.VERSION.length > 0,
    'string 且非空', S(Agents.VERSION));
  check('AGENT_IDS 恰为 agent1/agent2/agent3', sameList(Agents.AGENT_IDS, ['agent1', 'agent2', 'agent3']),
    '["agent1","agent2","agent3"]', S(Agents.AGENT_IDS));
  var temps = { agent1: 0.3, agent2: 0.7, agent3: 0.1 };
  var tokens = { agent1: 2048, agent2: 4096, agent3: 1024 };
  var cfgOk = true;
  var cfgDetail = [];
  ['agent1', 'agent2', 'agent3'].forEach(function (id) {
    var c = Agents.DEFAULT_CONFIGS && Agents.DEFAULT_CONFIGS[id];
    var ok = !!c && c.temperature === temps[id] && c.maxTokens === tokens[id] && typeof c.role === 'string' && typeof c.systemPrompt === 'string';
    if (!ok) cfgOk = false;
    cfgDetail.push(id + ':t=' + (c && c.temperature) + ',m=' + (c && c.maxTokens));
  });
  check('DEFAULT_CONFIGS 温度/上限按 T1 冻结值', cfgOk, '0.3/2048, 0.7/4096, 0.1/1024', cfgDetail.join(' '));

  /* ---------- 第 2 节：提示词逐字一致 ---------- */
  section('第 2 节 · 提示词与文档逐字一致');
  var SP = Agents.SYSTEM_PROMPTS || {};
  var CC = Agents.COMMON_CONSTRAINTS;
  check('COMMON_CONSTRAINTS 与文档"通用约束"代码块逐字一致',
    norm(CC) === norm(docCommon && docCommon.text),
    '文档全文 ' + norm(docCommon && docCommon.text).length + ' 字',
    (norm(CC) === norm(docCommon && docCommon.text)) ? '逐字一致' : ('实现 ' + norm(CC).length + ' 字，首段=' + norm(CC).slice(0, 60)));
  ['agent1', 'agent2', 'agent3'].forEach(function (id) {
    var docText = norm(docPrompts[id] && docPrompts[id].text);
    var implText = norm(SP[id]);
    check('SYSTEM_PROMPTS.' + id + ' 包含文档系统提示词全文',
      docText.length > 0 && implText.indexOf(docText) !== -1,
      '包含 ' + docText.length + ' 字文档提示词',
      implText.indexOf(docText) !== -1 ? ('包含，实现 ' + implText.length + ' 字') : ('未包含，实现 ' + implText.length + ' 字，开头=' + implText.slice(0, 60)));
  });
  ['agent1', 'agent2', 'agent3'].forEach(function (id) {
    var c = Agents.DEFAULT_CONFIGS && Agents.DEFAULT_CONFIGS[id];
    var sp = norm(c && c.systemPrompt);
    var okPrompt = sp.indexOf(norm(docPrompts[id] && docPrompts[id].text)) !== -1;
    var okCommon = sp.indexOf(norm(CC)) !== -1;
    check('DEFAULT_CONFIGS.' + id + '.systemPrompt 已附加通用约束（文档要求附加到末尾）',
      okPrompt && okCommon, '含系统提示词+通用约束', '含提示词=' + okPrompt + ' 含通用约束=' + okCommon);
  });
  var missItems = [];
  for (var ci = 0; ci < constraintItems.length; ci++) {
    if (norm(CC).indexOf(constraintItems[ci]) === -1) missItems.push(constraintItems[ci].slice(0, 12) + '…');
  }
  check('通用约束 8 条逐条出现在 COMMON_CONSTRAINTS 中', missItems.length === 0,
    '8 条全部包含', missItems.length ? ('缺 ' + missItems.join(' / ')) : '8 条全部包含');

  /* ---------- 第 3 节：SCHEMAS 形态 ---------- */
  section('第 3 节 · SCHEMAS 形态（必填字段与枚举集合）');
  var SC = Agents.SCHEMAS || {};
  ['agent1', 'agent2', 'agent3'].forEach(function (id) {
    check('SCHEMAS.' + id + ' 存在且为对象', !!SC[id] && typeof SC[id] === 'object', 'object', typeof SC[id]);
  });
  function schemaAt(schema, p) {
    var parts = String(p).split('.');
    var cur = schema;
    for (var i = 0; i < parts.length && cur; i++) {
      var raw = parts[i];
      if (raw === 'items') { cur = cur.items; continue; }
      if (raw === 'required') { cur = cur.required; continue; }
      if (raw === 'enum') { cur = cur.enum; continue; }
      if (/#items$/.test(raw)) {
        var nm = raw.slice(0, raw.length - 6);
        cur = cur.properties && cur.properties[nm] && cur.properties[nm].items;
        continue;
      }
      cur = cur.properties && cur.properties[raw];
    }
    return cur;
  }
  ['agent1', 'agent2', 'agent3'].forEach(function (id) {
    var rootReq = schemaAt(SC[id], 'required');
    var miss = missingFrom(DOC_REQUIRED[id], rootReq);
    check('SCHEMAS.' + id + ' 顶层必填 ⊇ 文档输出结构字段', miss.length === 0,
      DOC_REQUIRED[id].join(','), miss.length ? ('缺少 ' + miss.join(',')) : ('已有 ' + S(rootReq)));
  });
  DOC_NESTED_REQUIRED.forEach(function (spec) {
    var node = schemaAt(SC[spec.agent], spec.path);
    var req = node && node.required;
    var miss = missingFrom(spec.fields, req);
    check('SCHEMAS.' + spec.agent + '.' + spec.path + ' 必填 ⊇ ' + spec.fields.join('|'), miss.length === 0,
      spec.fields.join(','), miss.length ? ('缺少 ' + miss.join(',')) : ('已有 ' + S(req)));
  });
  DOC_ENUMS.forEach(function (spec) {
    var en = schemaAt(SC[spec.agent], spec.path);
    check('SCHEMAS.' + spec.agent + '.' + spec.path + ' = 文档枚举集合', sameList(en, spec.values),
      S(spec.values), S(en));
  });

  /* ---------- 第 4 节：validate 正向 ---------- */
  section('第 4 节 · validate 正向（测试自建样例，不依赖 mock）');
  expectValid('agent1', agent1OutputOk, agent1Input, 'agent1 自建合规输出 valid=true');
  expectValid('agent2', agent2OutputOk, agent2Input, 'agent2 自建合规输出 valid=true');
  expectValid('agent3', agent3OutputOk, agent3Input, 'agent3 自建合规输出 valid=true（达成/未达成/证据不足 三态并存）');
  var noEvidenceAgent3 = clone(agent3Input);
  noEvidenceAgent3.execution_evidence = [];
  var noEvidenceOut = clone(agent3OutputOk);
  noEvidenceOut.overall_assessment = '证据不足';
  for (var ni = 0; ni < noEvidenceOut.criteria_results.length; ni++) {
    noEvidenceOut.criteria_results[ni].observed = '未提供';
    noEvidenceOut.criteria_results[ni].assessment = '证据不足';
    noEvidenceOut.criteria_results[ni].evidence_ids = [];
  }
  expectValid('agent3', noEvidenceOut, noEvidenceAgent3,
    'agent3 完全无执行证据时全判"证据不足" valid=true');

  /* ---------- 第 5 节：validate 负向 · agent1 ---------- */
  section('第 5 节 · validate 负向 · agent1');
  var m;
  m = clone(agent1OutputOk); m.recommendation = '建议忽略';
  expectInvalid('agent1', m, agent1Input, ['BAD_ENUM'], 'agent1 recommendation 非法枚举 → BAD_ENUM');
  m = clone(agent1OutputOk); m.recommendation = '建议确认'; m.recommendation_reason = '';
  expectInvalid('agent1', m, agent1Input, ['MISSING_FIELD', 'BAD_TYPE'], 'agent1 recommendation_reason 为空 → MISSING_FIELD/BAD_TYPE');
  m = clone(agent1OutputOk); m.findings[0].evidence_ids = ['EV-编造-9'];
  expectInvalid('agent1', m, agent1Input, ['UNKNOWN_EVIDENCE_ID'], 'agent1 引用编造 evidence_id → UNKNOWN_EVIDENCE_ID');
  m = clone(agent1OutputOk); m.rule_result_summary.risk_score = 88;
  expectInvalid('agent1', m, agent1Input, ['RISK_SCORE_CHANGED'], 'agent1 改写 risk_score(62→88) → RISK_SCORE_CHANGED');
  m = clone(agent1OutputOk); m.rule_result_summary.risk_level = '高';
  expectInvalid('agent1', m, agent1Input, ['RISK_LEVEL_CHANGED'], 'agent1 改写 risk_level(中→高) → RISK_LEVEL_CHANGED');
  m = clone(agent1OutputOk); m.case_id = 'CASE-9999';
  expectInvalid('agent1', m, agent1Input, ['CASE_ID_MISMATCH'], 'agent1 case_id 与输入不一致 → CASE_ID_MISMATCH');
  m = clone(agent1OutputOk); m.findings = [];
  expectInvalid('agent1', m, agent1Input, ['EMPTY_FINDINGS'], 'agent1 findings 为空 → EMPTY_FINDINGS');
  m = clone(agent1OutputOk); delete m.recommendation_reason;
  expectInvalid('agent1', m, agent1Input, ['MISSING_FIELD'], 'agent1 缺必填字段 → MISSING_FIELD');
  m = clone(agent1OutputOk); m.findings[0].confidence = '很高';
  expectInvalid('agent1', m, agent1Input, ['BAD_ENUM'], 'agent1 confidence 非法枚举 → BAD_ENUM');
  var nullRes = safeValidate('agent1', null, agent1Input);
  check('agent1 输出为 null → NOT_OBJECT 且不抛异常',
    !!nullRes && nullRes.valid === false && codesOf(nullRes).indexOf('NOT_OBJECT') !== -1,
    'valid=false 且 codes 含 NOT_OBJECT', 'valid=' + (nullRes && nullRes.valid) + ' codes=[' + codesOf(nullRes).join(',') + ']');

  /* ---------- 第 6 节：validate 负向 · agent2 ---------- */
  section('第 6 节 · validate 负向 · agent2');
  m = clone(agent2OutputOk); m.actions = [];
  expectInvalid('agent2', m, agent2Input, ['EMPTY_ACTIONS'], 'agent2 actions 为空 → EMPTY_ACTIONS');
  m = clone(agent2OutputOk); m.actions[0].success_criteria = [];
  expectInvalid('agent2', m, agent2Input, ['NO_SUCCESS_CRITERIA'], 'agent2 action 无 success_criteria → NO_SUCCESS_CRITERIA');
  m = clone(agent2OutputOk); m.actions[0].success_criteria[0].data_source = '';
  expectInvalid('agent2', m, agent2Input, ['MISSING_FIELD', 'BAD_TYPE', 'NO_SUCCESS_CRITERIA'], 'agent2 criteria 缺 data_source → MISSING_FIELD 类');
  m = clone(agent2OutputOk); m.actions[0].deadline_day = 0;
  expectInvalid('agent2', m, agent2Input, ['DEADLINE_OUT_OF_RANGE'], 'agent2 deadline_day=0 越界 → DEADLINE_OUT_OF_RANGE');
  m = clone(agent2OutputOk); m.actions[0].deadline_day = 31;
  expectInvalid('agent2', m, agent2Input, ['DEADLINE_OUT_OF_RANGE'], 'agent2 deadline_day=31 > period_days=30 → DEADLINE_OUT_OF_RANGE');
  m = clone(agent2OutputOk); m.actions[0].success_criteria[0].target = '提高学习积极性'; m.actions[0].success_criteria[0].data_source = '辅导员观察';
  expectInvalid('agent2', m, agent2Input, ['NON_MEASURABLE_CRITERIA'], 'agent2 不可核验目标"提高学习积极性" → NON_MEASURABLE_CRITERIA');
  m = clone(agent2OutputOk); m.actions[0].owner = '家长';
  expectInvalid('agent2', m, agent2Input, ['BAD_ENUM'], 'agent2 owner 不在"学生|辅导员|任课教师"（家长）→ BAD_ENUM');
  // 近义值归一是实现扩展（文档只给三个取值）：允许归一，但必须可留痕
  var ownerAlias = clone(agent2OutputOk);
  ownerAlias.actions[0].owner = '班主任';
  var ownerAliasRes = safeValidate('agent2', ownerAlias, agent2Input);
  if (ownerAliasRes && ownerAliasRes.valid === true) {
    info('agent2 owner 近义值归一（实现扩展）', '"班主任"归一为"辅导员"并通过校验；repairs=' + S(ownerAliasRes.repairs));
  }
  m = clone(agent2OutputOk); m.actions[1].action_id = 'A1';
  expectInvalid('agent2', m, agent2Input, ['DUPLICATE_ACTION_ID'], 'agent2 action_id 重复 → DUPLICATE_ACTION_ID');
  m = clone(agent2OutputOk); m.case_refs_used = ['CASE-NOT-EXIST-9'];
  expectInvalid('agent2', m, agent2Input, ['UNKNOWN_CASE_REF'], 'agent2 引用不存在案例 → UNKNOWN_CASE_REF');
  m = clone(agent2OutputOk); m.case_id = 'CASE-9999';
  expectInvalid('agent2', m, agent2Input, ['CASE_ID_MISMATCH'], 'agent2 case_id 与输入不一致 → CASE_ID_MISMATCH');
  m = clone(agent2OutputOk); delete m.risks_or_limits;
  expectInvalid('agent2', m, agent2Input, ['MISSING_FIELD'], 'agent2 缺必填字段 → MISSING_FIELD');
  m = clone(agent2OutputOk); m.period_days = 99;
  var periodRes = safeValidate('agent2', m, agent2Input);
  if (periodRes && periodRes.valid === true) warn('agent2 period_days 与输入 plan_period_days 不一致仍通过校验', '输出 period_days=99 / 输入 plan_period_days=30；文档未规定错误码，属语义空缺（观察项）');
  else check('agent2 period_days 与输入 plan_period_days 不一致时被拒', true, 'valid=false', 'valid=false codes=[' + codesOf(periodRes).join(',') + ']');

  /* ---------- 第 7 节：validate 负向 · agent3 ---------- */
  section('第 7 节 · validate 负向 · agent3');
  m = clone(agent3OutputOk); m.criteria_results[2].assessment = '未达成';
  expectInvalid('agent3', m, agent3Input, ['NO_DATA_BUT_JUDGED', 'NO_EVIDENCE_IDS', '/ASSESS/', '/EVIDENCE/'], 'agent3 无数据却判"未达成" → 拒绝（未完成≠没有数据）');
  m = clone(agent3OutputOk); m.criteria_results[2].assessment = '达成';
  expectInvalid('agent3', m, agent3Input, ['NO_DATA_BUT_JUDGED', 'NO_EVIDENCE_IDS', '/ASSESS/', '/EVIDENCE/'], 'agent3 无数据却判"达成" → 拒绝');
  m = clone(agent3OutputOk); m.criteria_results.splice(2, 1);
  expectInvalid('agent3', m, agent3Input, ['NO_CRITERIA_FOR_ACTION'], 'agent3 criteria_results 缺 A3 覆盖 → NO_CRITERIA_FOR_ACTION');
  m = clone(agent3OutputOk); m.criteria_results[0].evidence_ids = ['EV-not-exist-9'];
  expectInvalid('agent3', m, agent3Input, ['UNKNOWN_EVIDENCE_ID'], 'agent3 引用不存在执行证据 → UNKNOWN_EVIDENCE_ID');
  m = clone(agent3OutputOk); m.criteria_results[1].assessment = '证据不足'; m.criteria_results[1].evidence_ids = ['EV-attendance-2'];
  var inconsistentRes = safeValidate('agent3', m, agent3Input);
  var inconsistentWarn = [];
  if (inconsistentRes && inconsistentRes.warnings) {
    for (var iw = 0; iw < inconsistentRes.warnings.length; iw++) inconsistentWarn.push(inconsistentRes.warnings[iw].code);
  }
  check('agent3 有观测数据与证据却判"证据不足" → 必须被标记（错误或警告）',
    (!!inconsistentRes && inconsistentRes.valid === false) || inconsistentWarn.length > 0,
    'valid=false 或 warnings 非空',
    'valid=' + (inconsistentRes && inconsistentRes.valid) + ' errors=[' + codesOf(inconsistentRes).join(',') + '] warnings=[' + inconsistentWarn.join(',') + ']');
  // 反向核对（O3）：输出声称"未提供"，但输入的 execution_evidence 里其实有该 action 的"可信"记录
  m = clone(agent3OutputOk); m.criteria_results[1].observed = '未提供'; m.criteria_results[1].assessment = '证据不足'; m.criteria_results[1].evidence_ids = [];
  expectInvalid('agent3', m, agent3Input, ['STALE_OBSERVATION'],
    'agent3 输入有可信执行证据却声称"未提供" → STALE_OBSERVATION（不得用陈旧快照掩盖进展）');
  m = clone(agent3OutputOk); m.overall_assessment = '达成';
  expectInvalid('agent3', m, agent3Input, ['OVERALL_INCONSISTENT'],
    'agent3 逐项含"未达成/证据不足"却判 overall="达成" → OVERALL_INCONSISTENT');
  m = clone(agent3OutputOk); m.case_id = 'CASE-9999';
  expectInvalid('agent3', m, agent3Input, ['CASE_ID_MISMATCH'], 'agent3 case_id 与输入不一致 → CASE_ID_MISMATCH');
  m = clone(agent3OutputOk); m.recommendation = '立刻通报家长';
  expectInvalid('agent3', m, agent3Input, ['BAD_ENUM'], 'agent3 recommendation 非法枚举（立刻通报家长）→ BAD_ENUM');
  var closeAttempt = clone(agent3OutputOk);
  closeAttempt.overall_assessment = '未达成';
  closeAttempt.recommendation = '可提交结案审批';
  var closeRes = safeValidate('agent3', closeAttempt, agent3Input);
  check('agent3 总体"未达成"时不得建议"可提交结案审批"（通用约束 7：不擅自结案）',
    !!closeRes && closeRes.valid === false, 'valid=false', 'valid=' + (closeRes && closeRes.valid) + ' codes=[' + codesOf(closeRes).join(',') + ']');
  var closeAlias = clone(agent3OutputOk);
  closeAlias.recommendation = '结案';
  var closeAliasRes = safeValidate('agent3', closeAlias, agent3Input);
  if (closeAliasRes && closeAliasRes.valid === true) {
    info('agent3 recommendation 近义值归一（实现扩展）', '"结案"归一为"可提交结案审批"；repairs=' + S(closeAliasRes.repairs));
  }
  m = clone(agent3OutputOk); delete m.conflicts;
  expectInvalid('agent3', m, agent3Input, ['MISSING_FIELD'], 'agent3 缺必填字段 → MISSING_FIELD');

  /* ---------- 第 7b 节：新增语义校验正反例 ---------- */
  section('第 7b 节 · 新增语义校验正反例（OVERALL_INCONSISTENT / STALE_OBSERVATION）');
  // 正向夹具 A：三个 action 都有"可信"且达标的执行证据 → 逐项全"达成"
  var allDoneInput = clone(agent3Input);
  allDoneInput.execution_evidence = [
    { evidence_id: 'EV-checkin-1', action_id: 'A1', metric: 'weekly_checkin_count', observed: 4, observed_at: '2025-10-12T21:00:00+08:00', source: '打卡系统', quality: '可信' },
    { evidence_id: 'EV-attendance-2', action_id: 'A2', metric: 'attendance_rate', observed: 0.93, observed_at: '2025-10-20T09:00:00+08:00', source: '教务系统', quality: '可信' },
    { evidence_id: 'EV-homework-3', action_id: 'A3', metric: 'homework_on_time_rate', observed: 0.9, observed_at: '2025-10-21T09:00:00+08:00', source: '作业平台', quality: '可信' }
  ];
  var allDoneOut = {
    case_id: 'CASE-1001',
    plan_id: 'PLAN-2025-1001',
    overall_assessment: '达成',
    criteria_results: [
      { action_id: 'A1', metric: 'weekly_checkin_count', target: '>=3 次/周', observed: '4', assessment: '达成', evidence_ids: ['EV-checkin-1'], reason: '第 2 周打卡 4 次，达标' },
      { action_id: 'A2', metric: 'attendance_rate', target: '>=0.90', observed: '0.93', assessment: '达成', evidence_ids: ['EV-attendance-2'], reason: '10-20 出勤率 0.93，达标' },
      { action_id: 'A3', metric: 'homework_on_time_rate', target: '>=0.85', observed: '0.90', assessment: '达成', evidence_ids: ['EV-homework-3'], reason: '作业按时率 0.90，达标' }
    ],
    data_gaps: [], conflicts: [],
    recommendation: '可提交结案审批', recommendation_reason: '各项均达标，建议由辅导员提交结案审批'
  };
  expectValid('agent3', allDoneOut, allDoneInput, '正例·逐项全"达成" + overall"达成" + 建议结案 → valid');

  // 正向夹具 B：三个 action 都有"可信"但均未达标的证据 → 逐项全"未达成"
  var noneDoneInput = clone(agent3Input);
  noneDoneInput.execution_evidence = [
    { evidence_id: 'EV-checkin-1', action_id: 'A1', metric: 'weekly_checkin_count', observed: 1, observed_at: '2025-10-12T21:00:00+08:00', source: '打卡系统', quality: '可信' },
    { evidence_id: 'EV-attendance-2', action_id: 'A2', metric: 'attendance_rate', observed: 0.72, observed_at: '2025-10-20T09:00:00+08:00', source: '教务系统', quality: '可信' },
    { evidence_id: 'EV-homework-3', action_id: 'A3', metric: 'homework_on_time_rate', observed: 0.6, observed_at: '2025-10-21T09:00:00+08:00', source: '作业平台', quality: '可信' }
  ];
  var noneDoneOut = clone(agent3OutputOk);
  noneDoneOut.overall_assessment = '未达成';
  noneDoneOut.recommendation = '建议调整计划';
  noneDoneOut.criteria_results[0].observed = '1';
  noneDoneOut.criteria_results[0].assessment = '未达成';
  noneDoneOut.criteria_results[0].evidence_ids = ['EV-checkin-1'];
  noneDoneOut.criteria_results[2].observed = '0.6';
  noneDoneOut.criteria_results[2].assessment = '未达成';
  noneDoneOut.criteria_results[2].evidence_ids = ['EV-homework-3'];
  expectValid('agent3', noneDoneOut, noneDoneInput, '正例·逐项全"未达成" + overall"未达成" → valid');

  // 反向：overall 与逐项矛盾（逐项全"达成"的三种错判）
  var overallCases = [
    { label: '逐项全"达成"却判 overall"未达成"', out: allDoneOut, input: allDoneInput, mut: function (o) { o.overall_assessment = '未达成'; o.recommendation = '建议调整计划'; } },
    { label: '逐项全"达成"却判 overall"部分达成"', out: allDoneOut, input: allDoneInput, mut: function (o) { o.overall_assessment = '部分达成'; o.recommendation = '继续原计划'; } },
    { label: '逐项全"达成"却判 overall"证据不足"', out: allDoneOut, input: allDoneInput, mut: function (o) { o.overall_assessment = '证据不足'; o.recommendation = '建议人工复核'; } }
  ];
  for (var oc = 0; oc < overallCases.length; oc++) {
    var ocOut = clone(overallCases[oc].out);
    overallCases[oc].mut(ocOut);
    expectInvalid('agent3', ocOut, overallCases[oc].input, ['OVERALL_INCONSISTENT'],
      '反例·' + overallCases[oc].label + ' → OVERALL_INCONSISTENT');
  }

  // STALE_OBSERVATION 不得误伤：输入确实没有任何执行证据时，"未提供/证据不足"必须合法
  var noEvInput2 = clone(agent3Input);
  noEvInput2.execution_evidence = [];
  var noEvOut = clone(agent3OutputOk);
  noEvOut.overall_assessment = '证据不足';
  for (var n3 = 0; n3 < noEvOut.criteria_results.length; n3++) {
    noEvOut.criteria_results[n3].observed = '未提供';
    noEvOut.criteria_results[n3].assessment = '证据不足';
    noEvOut.criteria_results[n3].evidence_ids = [];
  }
  var noEvRes = safeValidate('agent3', noEvOut, noEvInput2);
  check('正例·输入确无执行证据时"未提供 + 证据不足"不报 STALE_OBSERVATION',
    !!noEvRes && noEvRes.valid === true && codesOf(noEvRes).indexOf('STALE_OBSERVATION') === -1,
    'valid=true 且 codes 不含 STALE_OBSERVATION',
    'valid=' + (noEvRes && noEvRes.valid) + ' codes=[' + codesOf(noEvRes).join(',') + ']');
  // 边界：证据质量为"待核实"（非可信）时不属于 STALE_OBSERVATION 的触发条件
  var pendingInput = clone(agent3Input);
  pendingInput.execution_evidence = [
    { evidence_id: 'EV-checkin-1', action_id: 'A1', metric: 'weekly_checkin_count', observed: 3, observed_at: '2025-10-12T21:00:00+08:00', source: '打卡系统', quality: '可信' },
    { evidence_id: 'EV-attendance-2', action_id: 'A2', metric: 'attendance_rate', observed: 0.72, observed_at: '2025-10-20T09:00:00+08:00', source: '教务系统', quality: '待核实' }
  ];
  var pendingOut = clone(agent3OutputOk);
  pendingOut.criteria_results[1].observed = '未提供';
  pendingOut.criteria_results[1].assessment = '证据不足';
  pendingOut.criteria_results[1].evidence_ids = [];
  var pendingRes = safeValidate('agent3', pendingOut, pendingInput);
  info('边界·待核实证据 + 声称"未提供"',
    'valid=' + (pendingRes && pendingRes.valid) + ' codes=[' + codesOf(pendingRes).join(',') + ']（实现只对"可信"证据触发 STALE_OBSERVATION）');

  /* ---------- 第 8 节：parseJson ---------- */
  section('第 8 节 · parseJson 健壮性');
  var pj = Agents.parseJson;
  check('parseJson 为函数', typeof pj === 'function', 'function', typeof pj);
  if (typeof pj === 'function') {
    var r1 = safeCall(pj, ['```json\n{"a":1,"b":[2,3]}\n```']);
    check('parseJson 剥离 Markdown 围栏', !!(r1 && !r1.__threw && r1.a === 1 && r1.b && r1.b.length === 2),
      '解析出 {a:1,b:[2,3]}', S(r1));
    var r2 = safeCall(pj, ['好的，结果如下：\n{"a":{"b":"}{"},"c":"x}y","d":1}\n以上是结果，请查收。']);
    check('parseJson 处理前后废话 + 嵌套花括号/转义字符', !!(r2 && !r2.__threw && r2.a && r2.a.b === '}{' && r2.c === 'x}y' && r2.d === 1),
      '解析出 {a:{b:"}{"}, c:"x}y", d:1}', S(r2));
    var r3 = safeCall(pj, ['完全不是 JSON 的一段话']);
    check('parseJson 坏 JSON 返回 null', r3 === null, 'null', S(r3));
    var r4 = safeCall(pj, ['{"a":1}']);
    check('parseJson 直接吃纯 JSON', !!(r4 && !r4.__threw && r4.a === 1), '解析出 {a:1}', S(r4));
    var r5 = safeCall(pj, ['{"a":1']);
    check('parseJson 截断 JSON 返回 null', r5 === null, 'null', S(r5));
  } else {
    check('parseJson 剥离 Markdown 围栏', false, '函数存在', 'undefined');
  }

  /* ---------- 第 9 节：evidenceId / slugify / hashId / normalizeQuality ---------- */
  section('第 9 节 · 工具函数确定性');
  var eid = Agents.evidenceId;
  if (typeof eid === 'function') {
    // T1 冻结形态：evidenceId(prefix, metric, seq, at) → 'EV-attendance_rate-1'
    // 实现口径：prefix 是可选子前缀（null/空 即文档默认形态），'exec' 等用于区分执行期证据
    var e1 = safeCall(eid, [null, 'attendance_rate', 1]);
    var e2 = safeCall(eid, [null, 'attendance_rate', 1]);
    check('evidenceId 默认形态等于文档示例 EV-attendance_rate-1', e1 === 'EV-attendance_rate-1', 'EV-attendance_rate-1', S(e1));
    check('evidenceId 同参数确定性', e1 === e2, '两次调用相等', S(e1) + ' vs ' + S(e2));
    var eExec = safeCall(eid, ['exec', '辅导完成次数', 3]);
    check('evidenceId 支持可选子前缀（exec 用于执行期证据）',
      typeof eExec === 'string' && /^EV-exec-[A-Za-z0-9_]+-3$/.test(eExec), '^EV-exec-<metric>-3$', S(eExec));
    info('evidenceId 前缀口径', 'T1 字面调用 evidenceId("EV","attendance_rate",1)="' + S(safeCall(eid, ['EV', 'attendance_rate', 1])) +
      '"（仍会重复 EV）；实现把 prefix 当可选子前缀、内部统一传 null，建议 T1 文字注明"prefix 可为空"');
    var ids = [];
    var metrics = ['attendance_rate', 'homework_late', 'checkin_rate'];
    for (var si = 0; si < metrics.length; si++) {
      for (var qi = 1; qi <= 3; qi++) ids.push(safeCall(eid, [null, metrics[si], qi]));
    }
    var uniq = {};
    var dup = 0;
    for (var ui = 0; ui < ids.length; ui++) { if (uniq[ids[ui]]) dup++; uniq[ids[ui]] = true; }
    check('evidenceId 集合内唯一（9 组合无重复）', dup === 0, '0 重复', dup + ' 重复');
    var builtIds = safeCall(Agents.buildAgent1Input, [{
      caseId: 'CASE-1001', period: '2025-2026-1',
      ruleResult: { rule_name: '多指标综合预警', rule_version: 'v2.1', risk_level: '中', risk_score: 62, triggered_rules: ['R-ATT-03'] },
      profile: { grades: '高数 55', homework: '迟交 6 次', attendance: '出勤率 71%' }
    }]);
    if (builtIds && !builtIds.__threw && builtIds.evidence) {
      info('buildAgent1Input 生成的 evidence_id', S(builtIds.evidence.map(function (e) { return e.evidence_id; })));
    }
  } else {
    check('evidenceId 为函数', false, 'function', 'undefined');
  }
  var hid = Agents.hashId;
  if (typeof hid === 'function') {
    var h1 = safeCall(hid, ['CASE-1001']);
    var h2 = safeCall(hid, ['CASE-1001']);
    check('hashId 形如 a1-<短哈希>', typeof h1 === 'string' && /^a1-[0-9a-z]{4,16}$/.test(h1), '^a1-[0-9a-z]{4,16}$', S(h1));
    check('hashId 同参数确定性', h1 === h2, '两次调用相等', S(h1) + ' vs ' + S(h2));
    check('hashId 不同入参不同值', safeCall(hid, ['CASE-1002']) !== h1, '不同', S(h1) + ' vs ' + S(safeCall(hid, ['CASE-1002'])));
    info('hashId 用途', 'hashId 被 buildAgent1Input/buildAgent2Input 用作 student_ref 假名（如 "vv7pym"），确定性可用，但无 T1 要求的 "a1-" 前缀');
  } else {
    check('hashId 为函数', false, 'function', 'undefined');
  }
  var slug = Agents.slugify;
  if (typeof slug === 'function') {
    var s1 = safeCall(slug, ['Attendance Rate / 出勤']);
    check('slugify 去掉空白与斜杠且确定性',
      typeof s1 === 'string' && s1.length > 0 && !/\s/.test(s1) && s1.indexOf('/') === -1 && safeCall(slug, ['Attendance Rate / 出勤']) === s1,
      '无空格无斜杠且两次一致', S(s1));
  } else {
    check('slugify 为函数', false, 'function', 'undefined');
  }
  var nq = Agents.normalizeQuality;
  if (typeof nq === 'function') {
    var threeOk = true;
    var nqDetail = [];
    ['可信', '待核实', '过期'].forEach(function (q) {
      var v = safeCall(nq, [q]);
      if (v !== q) threeOk = false;
      nqDetail.push(q + '->' + S(v));
    });
    check('normalizeQuality 三值原样返回', threeOk, '可信|待核实|过期 原样', nqDetail.join(' '));
    var garbage = safeCall(nq, ['不知道']);
    check('normalizeQuality 未知输入归入三值之一', ['可信', '待核实', '过期'].indexOf(garbage) !== -1,
      '三值之一', S(garbage));
  } else {
    check('normalizeQuality 为函数', false, 'function', 'undefined');
  }

  /* ---------- 第 10 节：build*Input 字段对齐文档模板 ---------- */
  section('第 10 节 · buildAgentNInput 字段对齐文档输入模板');
  var builders = { agent1: Agents.buildAgent1Input, agent2: Agents.buildAgent2Input, agent3: Agents.buildAgent3Input };
  ['agent1', 'agent2', 'agent3'].forEach(function (id) {
    if (typeof builders[id] !== 'function') {
      check('build' + id + ' 为函数', false, 'function', 'undefined');
      return;
    }
  });
  if (typeof Agents.buildAgent1Input === 'function') {
    var built1 = safeCall(Agents.buildAgent1Input, [{
      caseId: 'CASE-1001', studentRef: 'STU-****-0103', period: '2025-2026-1',
      ruleResult: clone(agent1Input.rule_result), profile: { name: '张三', id: '2024100103' },
      missingFields: ['家庭联系方式'], at: '2025-10-09T10:00:00+08:00'
    }]);
    var miss1 = missingFrom(DOC_INPUT_KEYS.agent1, built1 && Object.keys(built1));
    check('buildAgent1Input 含文档输入模板全部字段', miss1.length === 0 && !built1.__threw,
      DOC_INPUT_KEYS.agent1.join(','), built1 && built1.__threw ? ('异常:' + built1.__threw) : ('字段=' + S(Object.keys(built1 || {}))));
    if (built1 && built1.evidence) {
      var qOk = true;
      for (var ei = 0; ei < built1.evidence.length; ei++) {
        if (['可信', '待核实', '过期'].indexOf(built1.evidence[ei].quality) === -1) qOk = false;
      }
      check('buildAgent1Input 的 evidence[].quality 仅三值', qOk, '可信|待核实|过期', S(built1.evidence.map(function (e) { return e.quality; })));
      var seen = {};
      var dupEv = 0;
      for (var ej = 0; ej < built1.evidence.length; ej++) {
        var key = built1.evidence[ej].evidence_id;
        if (seen[key]) dupEv++;
        seen[key] = true;
      }
      check('buildAgent1Input 的 evidence_id 集合内唯一', dupEv === 0, '0 重复', dupEv + ' 重复');
    }
    var extras1 = built1 && !built1.__threw ? Object.keys(built1).filter(function (k) { return DOC_INPUT_KEYS.agent1.indexOf(k) === -1; }) : [];
    if (extras1.length) info('buildAgent1Input 额外字段（文档模板之外）', extras1.join(',') + '（若含姓名/学号等可识别信息，与通用约束 8 冲突）');
    // 文档输入模板用 ${pseudonymous_student_id}，通用约束 8 要求不输出无关个人信息
    var priv = safeCall(Agents.buildAgent1Input, [{
      caseId: 'CASE-1001', period: '2025-2026-1',
      ruleResult: { rule_name: '多指标综合预警', rule_version: 'v2.1', risk_level: '中', risk_score: 62, triggered_rules: ['R-ATT-03'] },
      profile: { name: '张三', id: '2024100103', grades: '高数 55', homework: '迟交 6 次', attendance: '出勤率 71%' },
      missingFields: ['家庭联系方式']
    }]);
    var privText = priv && !priv.__threw ? JSON.stringify(priv) : '';
    check('buildAgent1Input 用假名而非真实姓名/学号（文档：pseudonymous_student_id + 通用约束 8）',
      !priv.__threw && privText.indexOf('张三') === -1 && privText.indexOf('2024100103') === -1,
      '输出不含"张三"/"2024100103"',
      priv.__threw ? ('异常:' + priv.__threw) : ('student_ref=' + S(priv.student_ref) + ' 含姓名=' + (privText.indexOf('张三') !== -1) + ' 含学号=' + (privText.indexOf('2024100103') !== -1)));
  }
  if (typeof Agents.buildAgent2Input === 'function') {
    var built2 = safeCall(Agents.buildAgent2Input, [{
      caseId: 'CASE-1001', studentRef: 'STU-****-0103',
      approvedFindings: clone(agent2Input.approved_findings), constraints: clone(agent2Input.student_constraints),
      resources: clone(agent2Input.available_resources), caseSummaries: clone(agent2Input.case_summaries), planPeriodDays: 30
    }]);
    var miss2 = missingFrom(DOC_INPUT_KEYS.agent2, built2 && Object.keys(built2));
    check('buildAgent2Input 含文档输入模板全部字段', miss2.length === 0 && !built2.__threw,
      DOC_INPUT_KEYS.agent2.join(','), built2 && built2.__threw ? ('异常:' + built2.__threw) : ('字段=' + S(Object.keys(built2 || {}))));
  }
  if (typeof Agents.buildAgent3Input === 'function') {
    var built3 = safeCall(Agents.buildAgent3Input, [{
      caseId: 'CASE-1001', planId: 'PLAN-2025-1001', approvedPlan: clone(agent3Input.approved_plan),
      reviewPeriod: clone(agent3Input.review_period), executionEvidence: clone(agent3Input.execution_evidence)
    }]);
    var miss3 = missingFrom(DOC_INPUT_KEYS.agent3, built3 && Object.keys(built3));
    check('buildAgent3Input 含文档输入模板全部字段', miss3.length === 0 && !built3.__threw,
      DOC_INPUT_KEYS.agent3.join(','), built3 && built3.__threw ? ('异常:' + built3.__threw) : ('字段=' + S(Object.keys(built3 || {}))));
  }

  /* ---------- 第 11 节：mock 结构自洽（唯一允许引用 mock 的一类） ---------- */
  section('第 11 节 · mock 输出结构自洽');
  ['agent1', 'agent2', 'agent3'].forEach(function (id) {
    var input = id === 'agent1' ? agent1Input : (id === 'agent2' ? agent2Input : agent3Input);
    step(function () {
      return asPromise(safeCall(Agents.mock, [id, input])).then(function (out) {
        if (out && out.__threw) { check('mock(' + id + ') 不抛异常', false, '对象', '异常:' + out.__threw); return; }
        var res = safeValidate(id, out, input);
        check('mock(' + id + ') 输出通过自身 validate', !!res && res.valid === true,
          'valid=true', 'valid=' + (res && res.valid) + ' codes=[' + codesOf(res).join(',') + ']');
        if (id === 'agent1') {
          var inputEv = {};
          for (var i = 0; i < agent1Input.evidence.length; i++) inputEv[agent1Input.evidence[i].evidence_id] = true;
          var badRef = [];
          for (var f = 0; f < (out.findings || []).length; f++) {
            var eids = out.findings[f].evidence_ids || [];
            for (var g = 0; g < eids.length; g++) if (!inputEv[eids[g]]) badRef.push(eids[g]);
          }
          check('mock(agent1) findings 只引用输入中的 evidence_id', badRef.length === 0, '无编造引用', badRef.length ? badRef.join(',') : '无编造引用');
          check('mock(agent1) 把待核实/过期证据写入 data_quality_issues',
            Array.isArray(out.data_quality_issues) && out.data_quality_issues.length > 0,
            '非空数组', S(out.data_quality_issues));
          check('mock(agent1) 把 missing_fields 写入 uncertainties',
            Array.isArray(out.uncertainties) && out.uncertainties.length > 0,
            '非空数组', S(out.uncertainties));
        }
        if (id === 'agent2') {
          var acts = out.actions || [];
          check('mock(agent2) 产出 2-4 条 action', acts.length >= 2 && acts.length <= 4, '2~4', acts.length);
          var noSrc = [];
          for (var a = 0; a < acts.length; a++) {
            var cs = acts[a].success_criteria || [];
            if (!cs.length) noSrc.push(acts[a].action_id + '(无criteria)');
            for (var c = 0; c < cs.length; c++) if (!cs[c].data_source) noSrc.push(acts[a].action_id + '(缺data_source)');
          }
          check('mock(agent2) 每条 action 都有带 data_source 的 success_criteria', noSrc.length === 0, '全部齐备', noSrc.length ? noSrc.join(',') : '全部齐备');
          var refsOk = true;
          var refs = out.case_refs_used || [];
          for (var r = 0; r < refs.length; r++) {
            var found = false;
            for (var s = 0; s < agent2Input.case_summaries.length; s++) if (agent2Input.case_summaries[s].case_ref === refs[r]) found = true;
            if (!found) refsOk = false;
          }
          check('mock(agent2) case_refs_used ⊆ 输入案例', refsOk, '无越界引用', refsOk ? S(refs) : ('越界:' + S(refs)));
        }
        if (id === 'agent3') {
          var covered = {};
          var cr = out.criteria_results || [];
          for (var x = 0; x < cr.length; x++) covered[cr[x].action_id] = true;
          var missA = [];
          for (var y = 0; y < agent3Input.approved_plan.actions.length; y++) {
            if (!covered[agent3Input.approved_plan.actions[y].action_id]) missA.push(agent3Input.approved_plan.actions[y].action_id);
          }
          check('mock(agent3) 覆盖全部 action', missA.length === 0, '3 个 action 全覆盖', missA.length ? ('缺 ' + missA.join(',')) : '全覆盖');
          var a3 = null;
          for (var z = 0; z < cr.length; z++) if (cr[z].action_id === 'A3') a3 = cr[z];
          check('mock(agent3) 无记录的 A3 判"证据不足"且无证据引用',
            !!a3 && a3.assessment === '证据不足' && (a3.evidence_ids || []).length === 0 && a3.observed === '未提供',
            'assessment=证据不足 observed=未提供 evidence_ids=[]', a3 ? S({ a: a3.assessment, o: a3.observed, e: a3.evidence_ids }) : 'null');
          var a2r = null;
          for (var z2 = 0; z2 < cr.length; z2++) if (cr[z2].action_id === 'A2') a2r = cr[z2];
          check('mock(agent3) 可信证据显示未达标的 A2 判"未达成"',
            !!a2r && a2r.assessment === '未达成' && (a2r.evidence_ids || []).indexOf('EV-attendance-2') !== -1,
            'assessment=未达成 且引用 EV-attendance-2', a2r ? S({ a: a2r.assessment, e: a2r.evidence_ids }) : 'null');
        }
      });
    });
  });
  // mock 的边界语义：无案例 / 无 findings / 无执行证据
  step(function () {
    var noCaseInput = clone(agent2Input);
    noCaseInput.case_summaries = [];
    return asPromise(safeCall(Agents.mock, ['agent2', noCaseInput])).then(function (out) {
      if (out && out.__threw) { check('mock(agent2) 无案例时不抛异常', false, '对象', '异常:' + out.__threw); return; }
      check('mock(agent2) 无案例时 case_refs_used 为空数组',
        Array.isArray(out.case_refs_used) && out.case_refs_used.length === 0, '[]', S(out.case_refs_used));
      var res = safeValidate('agent2', out, noCaseInput);
      check('mock(agent2) 无案例时输出仍 valid', !!res && res.valid === true, 'valid=true', 'valid=' + (res && res.valid) + ' codes=[' + codesOf(res).join(',') + ']');
    });
  });
  step(function () {
    var thinInput = clone(agent2Input);
    thinInput.approved_findings = [];
    return asPromise(safeCall(Agents.mock, ['agent2', thinInput])).then(function (out) {
      if (out && out.__threw) { check('mock(agent2) 信息不足时不抛异常', false, '对象', '异常:' + out.__threw); return; }
      check('mock(agent2) 信息不足时 needs_human_input 非空',
        Array.isArray(out.needs_human_input) && out.needs_human_input.length > 0, '非空数组', S(out.needs_human_input));
    });
  });
  step(function () {
    var emptyEvidence = clone(agent3Input);
    emptyEvidence.execution_evidence = [];
    return asPromise(safeCall(Agents.mock, ['agent3', emptyEvidence])).then(function (out) {
      if (out && out.__threw) { check('mock(agent3) 无执行证据时不抛异常', false, '对象', '异常:' + out.__threw); return; }
      var allGap = true;
      var det = [];
      for (var i = 0; i < (out.criteria_results || []).length; i++) {
        var c = out.criteria_results[i];
        det.push(c.action_id + '=' + c.assessment);
        if (c.assessment !== '证据不足') allGap = false;
      }
      check('mock(agent3) 无任何执行证据时逐项均判"证据不足"', allGap, '全部证据不足', det.join(','));
      check('mock(agent3) 无任何执行证据时 overall_assessment="证据不足"', out.overall_assessment === '证据不足', '证据不足', S(out.overall_assessment));
      var res = safeValidate('agent3', out, emptyEvidence);
      check('mock(agent3) 无执行证据时输出仍 valid', !!res && res.valid === true, 'valid=true', 'valid=' + (res && res.valid) + ' codes=[' + codesOf(res).join(',') + ']');
    });
  });

  /* ---------- 第 11b 节：缺字段降级健壮性 ---------- */
  section('第 11b 节 · 降级健壮性：缺字段不得抛异常（T1：缺字段不报错）');
  step(function () {
    var threw = null;
    var out = null;
    try { out = Agents.mock('agent1', {}); } catch (e) { threw = e; }
    check('mock("agent1", {}) 输入全空时不抛异常', !threw,
      '返回结构化对象', threw ? ('异常:' + ((threw && threw.message) || String(threw))) : ('keys=' + S(out && Object.keys(out))));
    if (!threw && out) {
      check('mock("agent1", {}) 无证据时不编造 findings，且建议"证据不足"',
        Array.isArray(out.findings) && out.findings.length === 0 && out.recommendation === '证据不足',
        'findings=[] 且 recommendation=证据不足',
        S({ findings: out.findings && out.findings.length, recommendation: out.recommendation }));
    }
  });
  step(function () {
    // run 是流程引擎的入口：降级路径必须返回结构化结果，不能同步抛异常（T1：不抛异常）
    var threw = null;
    var p = null;
    try { p = Agents.run({ agentId: 'agent1', input: {} }); } catch (e) { threw = e; }
    check('run({agentId:"agent1", input:{}}) 输入全空时同步不抛异常', !threw,
      '返回 Promise', threw ? ('同步异常:' + ((threw && threw.message) || String(threw))) : '返回 Promise');
    if (threw) return;
    return asPromise(p).then(function (res) {
      check('run({agentId:"agent1", input:{}}) 返回结构化结果（status=ok|invalid）',
        !!res && (res.status === 'ok' || res.status === 'invalid'),
        'status=ok 或 invalid', res ? ('status=' + res.status + ' ok=' + res.ok) : S(res));
      var emptyWarn = [];
      if (res && res.validation && res.validation.warnings) {
        for (var ew = 0; ew < res.validation.warnings.length; ew++) emptyWarn.push(res.validation.warnings[ew].code);
      }
      check('run 空输入降级：缺 case_id/risk_score 只 warning 不阻断（缺失必须留痕）',
        !!res && res.status === 'ok' && emptyWarn.indexOf('MISSING_CASE_ID') !== -1,
        'status=ok 且 warnings 含 MISSING_CASE_ID',
        'status=' + (res && res.status) + ' warnings=[' + emptyWarn.join(',') + ']');
    }, function (e) {
      check('run({agentId:"agent1", input:{}}) 返回结构化结果（status=ok|invalid）', false,
        'status=ok 或 invalid', 'Promise 被 reject：' + ((e && e.message) || String(e)));
    });
  });

  /* ---------- 第 12 节：run / 留痕 ---------- */
  section('第 12 节 · run() 执行与留痕');
  step(function () {
    if (typeof Agents.clear === 'function') safeCall(Agents.clear, []);
    if (typeof Agents.run !== 'function') { check('run 为函数', false, 'function', 'undefined'); return; }
    var callerArgs = [];
    return asPromise(safeCall(Agents.run, [{
      agentId: 'agent1', input: agent1Input,
      caller: function () { callerArgs.push(Array.prototype.slice.call(arguments)); return JSON.stringify(agent1OutputOk); }
    }])).then(function (r) {
      if (r && r.__threw) { check('run 正常路径不抛异常', false, '无异常', '异常:' + r.__threw); return; }
      check('run: caller 返回合规 JSON → ok/status=ok', !!r && r.ok === true && r.status === 'ok',
        'ok=true status=ok', 'ok=' + (r && r.ok) + ' status=' + (r && r.status));
      check('run: engine=real 且 attempts=1', !!r && r.engine === 'real' && r.attempts === 1,
        'engine=real attempts=1', 'engine=' + (r && r.engine) + ' attempts=' + (r && r.attempts));
      check('run: agentId/caseId/version 与调用参数一致',
        !!r && r.agentId === 'agent1' && r.caseId === 'CASE-1001' && r.version === Agents.VERSION,
        'agent1/CASE-1001/' + Agents.VERSION, 'agentId=' + (r && r.agentId) + ' caseId=' + (r && r.caseId) + ' version=' + (r && r.version));
      var stored = typeof Agents.calls === 'function' ? safeCall(Agents.calls, []) : null;
      check('run 成功后自动落库（calls() 1 条）', Array.isArray(stored) && stored.length === 1,
        '长度=1', Array.isArray(stored) ? ('长度=' + stored.length) : S(stored));
      var raw = memStore['agentCalls'];
      var parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
      check('localStorage["agentCalls"] 可直接解析为数组', Array.isArray(parsed) && parsed.length === 1,
        '数组且长度=1', raw === undefined ? '键不存在' : ('长度=' + (Array.isArray(parsed) ? parsed.length : 'NaN')));
      // 文档要求留痕含 case_id/agent_id：不只是"存在"，还要能被 calls(filter) 检索到
      var byCase = typeof Agents.calls === 'function' ? safeCall(Agents.calls, [{ caseId: 'CASE-1001' }]) : null;
      check('留痕可按 case_id 检索（calls({caseId}) 命中刚写入的记录）',
        Array.isArray(byCase) && byCase.length === 1, '长度=1', Array.isArray(byCase) ? ('长度=' + byCase.length) : S(byCase));
      var byAgent = typeof Agents.calls === 'function' ? safeCall(Agents.calls, [{ agentId: 'agent1' }]) : null;
      check('留痕可按 agent_id 检索（calls({agentId}) 命中刚写入的记录）',
        Array.isArray(byAgent) && byAgent.length === 1, '长度=1', Array.isArray(byAgent) ? ('长度=' + byAgent.length) : S(byAgent));
      // 文档要求留痕：case_id / agent_id / 提示词版本 / 模型版本 / 输入输出 / 证据引用 / 调用时间
      var rec = Array.isArray(stored) && stored.length ? stored[0] : (Array.isArray(parsed) ? parsed[0] : null);
      var fields = [
        { label: 'case_id', names: ['caseId', 'case_id'] },
        { label: 'agent_id', names: ['agentId', 'agent_id'] },
        { label: '提示词版本', names: ['version', 'promptVersion', 'prompt_version'] },
        { label: '模型版本', names: ['modelVersion', 'model_version', 'model'] },
        { label: '输入', names: ['input'] },
        { label: '输出', names: ['output'] },
        { label: '证据引用', names: ['evidenceRefs', 'evidence_refs', 'evidenceIds', 'evidence_ids'] },
        { label: '调用时间', names: ['calledAt', 'called_at', 'timestamp'] }
      ];
      for (var i = 0; i < fields.length; i++) {
        var hit = pickAlias(rec, fields[i].names);
        check('留痕含' + fields[i].label + '字段', !!hit,
          fields[i].names.join('/'), hit ? (hit + '=' + S(rec[hit])) : ('缺失，实际字段=' + S(rec ? Object.keys(rec) : null)));
      }
      var evKey = pickAlias(rec, ['evidenceRefs', 'evidence_refs', 'evidenceIds', 'evidence_ids']);
      if (evKey) {
        var evVal = rec[evKey];
        check('留痕的证据引用非空（agent1 输入含 3 条证据）',
          Array.isArray(evVal) ? evVal.length > 0 : !!evVal, '非空', S(evVal));
      }
      info('run 返回字段', S(Object.keys(r || {})));
    });
  });
  step(function () {
    if (typeof Agents.run !== 'function') return;
    if (typeof Agents.clear === 'function') safeCall(Agents.clear, []);
    var attempts = 0;
    var callArgs = [];
    return asPromise(safeCall(Agents.run, [{
      agentId: 'agent1', input: agent1Input,
      caller: function () { attempts++; callArgs.push(Array.prototype.slice.call(arguments)); return '抱歉，我无法按要求输出。'; }
    }])).then(function (r) {
      if (r && r.__threw) { check('run 无效路径不抛异常', false, '无异常', '异常:' + r.__threw); return; }
      check('run: caller 一直返回非 JSON → status=invalid 且不抛异常', !!r && r.status === 'invalid',
        'status=invalid', 'status=' + (r && r.status));
      check('run: 重试到 maxAttempts（默认 2 次）', !!r && r.attempts === 2, 'attempts=2', 'attempts=' + (r && r.attempts));
      check('run: invalid 时附带 validation 且 valid=false',
        !!r && !!r.validation && r.validation.valid === false && codesOf(r.validation).length > 0,
        'validation.valid=false 且 errors 非空', r && r.validation ? ('valid=' + r.validation.valid + ' codes=[' + codesOf(r.validation).join(',') + ']') : 'validation 缺失');
      // 文档要求"每次调用分别保存…"：失败调用同样入库；"不推进流程"由流程引擎按 status 判断
      var invalidRecs = typeof Agents.calls === 'function' ? safeCall(Agents.calls, []) : [];
      check('run: invalid 调用同样留痕（文档：每次调用必须留痕）',
        Array.isArray(invalidRecs) && invalidRecs.length === 1,
        'calls() 长度=1', Array.isArray(invalidRecs) ? ('长度=' + invalidRecs.length) : S(invalidRecs));
      check('run: invalid 留痕记录 status=invalid 且 ok=false',
        Array.isArray(invalidRecs) && invalidRecs.length === 1 && String(invalidRecs[0].status) === 'invalid' && invalidRecs[0].ok === false,
        'status=invalid 且 ok=false',
        Array.isArray(invalidRecs) && invalidRecs.length ? S({ status: invalidRecs[0].status, ok: invalidRecs[0].ok }) : 'N/A');
      var secondHasJsonHint = false;
      for (var i = 1; i < callArgs.length; i++) {
        var a = callArgs[i];
        var txt = typeof a[0] === 'string' ? a[0] : (a[0] ? JSON.stringify(a[0]) : '');
        if (txt && txt.indexOf('JSON') !== -1) secondHasJsonHint = true;
      }
      if (callArgs.length > 1 && callArgs[1][0] === undefined) {
        info('重试修复指令', 'caller 未收到请求参数，无法验证"只输出 JSON"修复指令是否附加（设计如此则忽略）');
      } else {
        check('run: 重试时向 caller 附加了要求只输出 JSON 的修复指令', secondHasJsonHint,
          '第 2 次调用参数含 JSON', '第 2 次参数=' + S(callArgs.length > 1 ? callArgs[1][0] : null));
      }
      info('run(agent1) 实际调用 caller 次数', attempts);
    });
  });
  step(function () {
    if (typeof Agents.run !== 'function') return;
    var savedCaller = null;
    return asPromise(safeCall(Agents.run, [{ agentId: 'agent3', input: agent3Input }])).then(function (r) {
      if (r && r.__threw) { check('run 无 caller 降级不抛异常', false, '无异常', '异常:' + r.__threw); return; }
      check('run: 未提供 caller → engine=mock', !!r && r.engine === 'mock', 'engine=mock', 'engine=' + (r && r.engine));
      check('run: 无 caller 时 status=ok 且输出通过校验',
        !!r && r.status === 'ok' && !!r.validation && r.validation.valid === true,
        'status=ok valid=true', 'status=' + (r && r.status) + ' valid=' + (r && r.validation && r.validation.valid));
      check('run: 无 caller 时 engine=mock 仍记录 mock 输出', !!r && !!r.output && typeof r.output === 'object',
        'output 为对象', S(r && r.output ? Object.keys(r.output) : null));
    });
  });
  step(function () {
    if (typeof Agents.record !== 'function' || typeof Agents.calls !== 'function') {
      check('record/calls 为函数', false, 'function', 'record=' + typeof Agents.record + ' calls=' + typeof Agents.calls);
      return;
    }
    safeCall(Agents.clear, []);
    for (var i = 0; i < 205; i++) safeCall(Agents.record, [{ caseId: 'CASE-' + i, agentId: 'agent1', version: Agents.VERSION, calledAt: '2025-10-09T10:00:00+08:00' }]);
    var all = safeCall(Agents.calls, []);
    check('留痕上限 200 条', Array.isArray(all) && all.length === 200, '长度=200', Array.isArray(all) ? ('长度=' + all.length) : S(all));
    check('留痕新的在前（首条为 CASE-204）', Array.isArray(all) && all.length > 0 && all[0].caseId === 'CASE-204',
      'CASE-204', Array.isArray(all) && all.length ? S(all[0].caseId) : 'N/A');
    var filtered = safeCall(Agents.calls, [{ agentId: 'agent1' }]);
    check('calls(filter) 可按 agentId 过滤', Array.isArray(filtered) && filtered.length === 200,
      '长度=200', Array.isArray(filtered) ? ('长度=' + filtered.length) : S(filtered));
    safeCall(Agents.clear, []);
    check('clear() 清空留痕', safeCall(Agents.calls, []).length === 0, '长度=0', safeCall(Agents.calls, []).length);
  });

  /* ---------- 第 13 节：流程引擎联调（真实 agent 节点 + 校验门禁） ---------- */
  section('第 13 节 · 流程引擎联调（真实 type:"agent" 节点）');
  if (!FlowEngine || typeof FlowEngine.define !== 'function') {
    check('flowEngine.js 可加载', false, 'FlowEngine.define 可用', S(FlowEngine));
  } else {
    info('agent 节点契约', 'flowEngine 原生支持 type:"agent"（字段 agent/agentNo/input/output/reject），与 flows.js 的写法一致；本节直接跑真实节点，不自建适配器');
    FlowEngine.registerTool('test.buildAgent1Input', function () { return agent1Input; });
    var gateSteps = function (caller, withAgentNo) {
      var node = { id: 'analysis', type: 'agent', agent: 'agent1', label: 'Agent1 · 预警分析师', output: 'agent1', reject: 'blocked' };
      if (withAgentNo) node.agentNo = 1;
      if (withAgentNo) node.input = '${agent1Input}';       // flows.js 的真实写法：字符串模板
      else node.input = agent1Input;                         // 对照路径：直接给对象
      if (caller) node.caller = caller;
      return [
        { id: 'start', type: 'trigger' },
        { id: 'build', type: 'tool', tool: 'test.buildAgent1Input', label: '构造 Agent1 输入', output: 'agent1Input' },
        node,
        { id: 'done', type: 'end', label: '完成' },
        { id: 'blocked', type: 'end', label: '校验失败转人工', result: 'blocked' }
      ];
    };
    var stepById = function (rec, id) {
      for (var i = 0; i < (rec.steps || []).length; i++) if (rec.steps[i].id === id) return rec.steps[i];
      return null;
    };
    step(function () {
      FlowEngine.clearRuns();
      FlowEngine.define({ id: 'test-agent-gate-ok', stepTimeoutMs: 3000, steps: gateSteps(null, true) });
      return FlowEngine.run('test-agent-gate-ok', {}).then(function (rec) {
        var ids = (rec.steps || []).map(function (s) { return s.id + ':' + s.status; });
        var a1 = stepById(rec, 'analysis');
        check('联调·成功路径（flows.js 写法：agentNo + ${模板}）：agent 步骤 success',
          !!a1 && a1.status === 'success', 'analysis:success', ids.join(' '));
        check('联调·成功路径：流程推进到 end 且 status=success',
          rec.status === 'success' && ids.indexOf('done:success') !== -1,
          'success 且执行 done', rec.status + ' / ' + ids.join(' '));
        check('联调·成功路径：agent 步骤输出未被阻断且携带已校验的 agent1 输出',
          !!(a1 && a1.output) && a1.output.ok === true &&
          !!(a1.output.output) && a1.output.output.case_id === 'CASE-1001' && typeof a1.output.output.recommendation === 'string',
          'ctx[step.output] 为 Agents.run 记录，其 .output 含 case_id=CASE-1001 与 recommendation',
          a1 ? S({ ok: a1.output && a1.output.ok, status: a1.output && a1.output.status, out: a1.output && a1.output.output }) : 'N/A');
      });
    });
    step(function () {
      // 对照路径：input 直接给对象（不经 ${模板} 与 buildAgentNInput），定位问题出在解析还是 mock
      FlowEngine.define({ id: 'test-agent-gate-manual', stepTimeoutMs: 3000, steps: gateSteps(null, false) });
      return FlowEngine.run('test-agent-gate-manual', {}).then(function (rec) {
        var ids = (rec.steps || []).map(function (s) { return s.id + ':' + s.status; });
        var a1 = stepById(rec, 'analysis');
        check('联调·对照路径（input 直接给对象）：流程推进到 end 且 status=success',
          rec.status === 'success' && ids.indexOf('done:success') !== -1,
          'success 且执行 done', rec.status + ' / ' + ids.join(' '));
        if (!(a1 && a1.status === 'success')) info('联调·对照路径失败详情', a1 ? ('error=' + (a1.error || '') + ' output=' + S(a1.output)) : 'analysis 步骤缺失');
      });
    });
    step(function () {
      // 真实可达场景：学生没有任何证据（evidence: []），Agent1 应诚实给"证据不足"并让流程继续，
      // 不能因为缺字段让整条流程 failed（文档：缺失信息必须标记，不得补造；T1：缺字段不报错）。
      FlowEngine.registerTool('test.buildEmptyEvidence', function () {
        var t = clone(agent1Input);
        t.evidence = [];
        return t;
      });
      FlowEngine.define({
        id: 'test-agent-gate-noev', stepTimeoutMs: 3000,
        steps: [
          { id: 'start', type: 'trigger' },
          { id: 'build', type: 'tool', tool: 'test.buildEmptyEvidence', label: '构造空证据输入', output: 'agent1Input' },
          { id: 'analysis', type: 'agent', agent: 'agent1', agentNo: 1, label: 'Agent1', input: '${agent1Input}', output: 'agent1', reject: 'blocked' },
          { id: 'done', type: 'end', label: '完成' },
          { id: 'blocked', type: 'end', label: '转人工', result: 'blocked' }
        ]
      });
      return FlowEngine.run('test-agent-gate-noev', {}).then(function (rec) {
        var ids = (rec.steps || []).map(function (s) { return s.id + ':' + s.status; });
        var a1 = stepById(rec, 'analysis');
        check('联调·无证据学生（evidence:[]）：agent 步骤不因缺字段 failed',
          !!a1 && a1.status !== 'failed', 'analysis:success|blocked',
          a1 ? (a1.status + ' ' + (a1.error || '')) : ids.join(' '));
        check('联调·无证据学生：Agent1 诚实输出"证据不足"并推进到 end',
          rec.status === 'success' && ids.indexOf('done:success') !== -1 &&
          !!(a1 && a1.output && a1.output.output) && a1.output.output.recommendation === '证据不足',
          'success 且 agent1.recommendation=证据不足', rec.status + ' / ' + ids.join(' ') + ' / ' + S(a1 && a1.output && a1.output.output && a1.output.output.recommendation));
      });
    });
    step(function () {
      FlowEngine.define({
        id: 'test-agent-gate-bad', stepTimeoutMs: 3000,
        steps: gateSteps(function () { return '抱歉，这不是 JSON。'; }, true)
      });
      return FlowEngine.run('test-agent-gate-bad', {}).then(function (rec) {
        var ids = (rec.steps || []).map(function (s) { return s.id + ':' + s.status; });
        var a1 = stepById(rec, 'analysis');
        check('联调·校验失败路径：agent 步骤被标记 blocked（而非 success）',
          !!a1 && a1.status === 'blocked', 'analysis:blocked', a1 ? (a1.status + ' ' + (a1.error || '')) : 'N/A');
        check('联调·校验失败路径：未推进到成功分支',
          ids.indexOf('done:success') === -1, '未执行 done', ids.join(' '));
        check('联调·校验失败路径：进入 reject 分支（交给辅导员人工兜底）',
          ids.indexOf('blocked:success') !== -1, '执行 blocked', ids.join(' '));
      });
    });
  }

  /* ---------- 第 13b 节：flows.js 静态核对文档"流程引擎的决策规则"表 ---------- */
  section('第 13b 节 · flows.js 与文档"决策规则"表对照');
  step(function () {
    if (!FlowEngine || typeof FlowEngine.define !== 'function') {
      check('flowEngine.js 可加载', false, 'FlowEngine.define 可用', S(FlowEngine));
      return;
    }
    var loadErr = null;
    try { require(path.join(__dirname, 'flows.js')); } catch (e) { loadErr = e; }
    check('flows.js 可在 Node 下加载（不依赖 app.js 全局）', !loadErr, '无异常', loadErr ? ('异常:' + loadErr.message) : '无异常');
    if (loadErr) return;
    var warning = FlowEngine.get('flow-warning');
    var review = FlowEngine.get('flow-review');
    check('已注册 flow-warning 与 flow-review 两条流程', !!warning && !!review,
      '两条流程都存在', 'flow-warning=' + !!warning + ' flow-review=' + !!review);
    if (!warning || !review) return;

    var idxOf = function (flow, pred) {
      for (var i = 0; i < flow.steps.length; i++) if (pred(flow.steps[i])) return i;
      return -1;
    };
    var a1 = idxOf(warning, function (s) { return s.type === 'agent' && s.agent === 'agent1'; });
    var a2 = idxOf(warning, function (s) { return s.type === 'agent' && s.agent === 'agent2'; });
    var a3w = idxOf(warning, function (s) { return s.type === 'agent' && s.agent === 'agent3'; });
    var a3 = idxOf(review, function (s) { return s.type === 'agent' && s.agent === 'agent3'; });
    var humanIdx = idxOf(warning, function (s) { return s.type === 'human'; });

    check('决策规则·Agent1：flow-warning 含 agent1 节点', a1 >= 0, '存在', 'index=' + a1);
    check('决策规则·Agent1 后：输出校验通过后由辅导员确认（human 节点在 agent1 之后）',
      a1 >= 0 && humanIdx > a1, 'human 节点位于 agent1 之后', 'agent1=' + a1 + ' human=' + humanIdx);
    check('决策规则·Agent2：flow-warning 含 agent2 节点且在 agent1 之后', a1 >= 0 && a2 > a1,
      'agent2 位于 agent1 之后', 'agent1=' + a1 + ' agent2=' + a2);
    var approval = null;
    for (var i = a2 + 1; a2 >= 0 && i < warning.steps.length; i++) {
      var s = warning.steps[i];
      if (s.type === 'human') { approval = 'human 节点 ' + s.id; break; }
      if (/等待辅导员审批|人工审批/.test(String(s.label || ''))) { approval = '流程外交接（' + s.id + '：' + s.label + '）'; }
    }
    check('决策规则·Agent2 后：存在辅导员审批环节（human 节点或等待审批的终点）', !!approval,
      'human 节点或等待审批终点', approval || '未找到');
    if (approval && approval.indexOf('流程外交接') === 0) {
      info('决策规则·Agent2 审批位置', approval + '（文档要求"辅导员审批"，实现把审批放在流程外的工单环节，属合理设计，供对照表记录）');
    }

    var badReject = [];
    [{ f: warning, n: 'flow-warning' }, { f: review, n: 'flow-review' }].forEach(function (item) {
      var byId = {};
      item.f.steps.forEach(function (x) { byId[x.id] = x; });
      item.f.steps.forEach(function (s) {
        if (s.type !== 'agent') return;
        if (!s.reject) { badReject.push(item.n + '.' + s.id + '(无 reject)'); return; }
        var cur = byId[s.reject];
        if (!cur) { badReject.push(item.n + '.' + s.id + '(reject 目标不存在)'); return; }
        var hops = 0;
        while (cur && cur.type !== 'end' && hops++ < 20) cur = cur.next ? byId[cur.next] : null;
        if (!cur || cur.type !== 'end') badReject.push(item.n + '.' + s.id + '(失败分支走不到 end)');
        else if (cur.result !== 'blocked') badReject.push(item.n + '.' + s.id + '(失败分支 end 未标记 blocked)');
      });
    });
    check('决策规则·校验失败不推进：3 个 agent 节点的 reject 分支都收敛到 end(result=blocked)',
      badReject.length === 0, '3 个节点全部合规', badReject.length ? badReject.join('; ') : '3 个节点全部合规');

    check('决策规则·Agent3 不能紧接 Agent2 立即运行：flow-warning 内不含 agent3 节点', a3w === -1,
      'flow-warning 无 agent3', 'agent3Index=' + a3w);
    check('决策规则·Agent3 由复核事件触发：flow-review 独立流程，首步 trigger 说明触发条件',
      a3 > 0 && review.steps[0].type === 'trigger' && /复核|执行期/.test(String(review.steps[0].label || '')),
      'trigger 标签含"执行期/复核"', 'trigger=' + S(review.steps[0].label) + ' agent3Index=' + a3);
    check('agent 节点均声明 input 模板与 output 上下文键',
      [a1 >= 0 ? warning.steps[a1] : null, a2 >= 0 ? warning.steps[a2] : null, a3 >= 0 ? review.steps[a3] : null].every(function (s) {
        return !!s && typeof s.input === 'string' && !!s.output;
      }),
      '3 个节点都有 input/output', '已核对 3 个节点');
  });

  /* ---------- 第 14 节：静态规约与向后兼容 ---------- */
  section('第 14 节 · 源码规约与向后兼容');
  step(function () {
    var src = null;
    try { src = fs.readFileSync(path.join(__dirname, 'agents.js'), 'utf8'); } catch (e) { src = null; }
    if (src === null) { check('agents.js 源码可读', false, '可读', '读取失败'); return; }
    var stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    var evalHit = stripped.match(/\beval\s*\(/);
    var fnHit = stripped.match(/new\s+Function\s*\(/);
    check('源码禁止 eval / new Function', !evalHit && !fnHit,
      '两者都不出现', 'eval=' + (evalHit ? evalHit[0] : '无') + ' newFunction=' + (fnHit ? fnHit[0] : '无'));
    var styleHits = [];
    var lines = stripped.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (/\blet\s+[A-Za-z_$]/.test(lines[i]) || /\bconst\s+[A-Za-z_$]/.test(lines[i]) || /=>/.test(lines[i]) || /`/.test(lines[i])) {
        styleHits.push((i + 1) + ':' + lines[i].replace(/^\s+/, '').slice(0, 60));
      }
    }
    if (styleHits.length) warn('源码疑似非 ES5 写法（let/const/箭头/模板串）', styleHits.slice(0, 5).join(' | ') + (styleHits.length > 5 ? ' …共' + styleHits.length + ' 行' : ''));
    else check('源码为 ES5 写法（无 let/const/箭头/模板串）', true, '无命中', '无命中');
  });
  step(function () {
    // 旧格式 agentConfigs（无 systemPrompt）不得导致加载/运行报错
    memStore['agentConfigs'] = JSON.stringify({
      agent1: { role: '旧版分析师', temperature: 0.5, maxTokens: 512 },
      agent3: { role: '旧版监督员' }
    });
    var fresh = null;
    var err = null;
    try {
      var resolved = require.resolve(path.join(__dirname, 'agents.js'));
      delete require.cache[resolved];
      fresh = require(path.join(__dirname, 'agents.js'));
    } catch (e) { err = e; }
    check('向后兼容：旧格式 agentConfigs（无 systemPrompt）加载不抛异常', !err,
      '无异常', err ? ('异常:' + ((err && err.message) || String(err))) : '无异常');
    if (fresh && !err) {
      var sp1 = String((fresh.DEFAULT_CONFIGS && fresh.DEFAULT_CONFIGS.agent1 && fresh.DEFAULT_CONFIGS.agent1.systemPrompt) || '');
      check('向后兼容：旧配置下 systemPrompt 回落文档默认值',
        sp1.indexOf(norm(docPrompts.agent1 && docPrompts.agent1.text)) !== -1,
        '含文档 agent1 提示词', sp1 ? ('长度=' + sp1.length) : '空');
      return asPromise(safeCall(fresh.run, [{ agentId: 'agent1', input: agent1Input }])).then(function (r) {
        check('向后兼容：旧配置下 mock 运行仍 status=ok 且输出 valid',
          !!r && r.status === 'ok' && !!r.validation && r.validation.valid === true,
          'status=ok valid=true', 'status=' + (r && r.status) + ' valid=' + (r && r.validation && r.validation.valid));
      }).then(function () {
        delete memStore['agentConfigs'];
        try {
          var r2 = require.resolve(path.join(__dirname, 'agents.js'));
          delete require.cache[r2];
          require(path.join(__dirname, 'agents.js'));
        } catch (e2) { /* 恢复失败不影响结论 */ }
      });
    }
    delete memStore['agentConfigs'];
  });

  return runQueue();
}

Promise.resolve()
  .then(main)
  .then(null, function (e) {
    failed++;
    failures.push('主流程未捕获异常 | ' + ((e && e.stack) || String(e)));
    console.log('  FAIL | 主流程未捕获异常 | ' + ((e && e.message) || String(e)));
  })
  .then(finishSuite);
