/**
 * test-risk.js — 风险评分回归测试（零依赖，直接 node test-risk.js）
 * ---------------------------------------------------------------
 * 背景：这个文件此前是坏的——
 *   1. 读的是写死的绝对路径 D:/金蝶/student-warning-app/app.js，换目录就 ENOENT；
 *   2. 用字符串替换把 `globalThis._fn = analyzeRiskLevel;` 塞进函数体内部，
 *      函数没被调用前根本取不到引用，于是 6 条用例永远是 "function not captured"；
 *   3. DOM 桩只有 getElementById，app.js 顶层用到 querySelectorAll 会直接抛错。
 * 现在改为：从本文件所在目录读 app.js，在 IIFE 收尾前统一导出被测函数，
 * 并补齐最小 DOM 桩。
 *
 * 用法：node test-risk.js     （全绿退出码 0）
 */
var fs = require('fs');
var vm = require('vm');
var path = require('path');

var APP = path.join(__dirname, 'app.js');
var code = fs.readFileSync(APP, 'utf-8');

// 在 IIFE 最开头（'use strict' 之后）就导出被测函数的包装器。
// 函数声明会被提升，所以此刻引用它们、等调用时再求值是完全安全的；
// 放在最前面还能避免 app.js 顶层任何 DOM 访问抛错导致导出丢失。
var patched = code.replace(/'use strict';/, [
  "'use strict';",
  'globalThis.__RISK_TEST__ = {',
  '  analyzeRiskLevel: function () { return analyzeRiskLevel.apply(null, arguments); },',
  '  analyzeRiskLevelNumeric: function () { return analyzeRiskLevelNumeric.apply(null, arguments); },',
  '  buildMockResult: function () { return buildMockResult.apply(null, arguments); },',
  '  scoreField: function () { return scoreField.apply(null, arguments); },',
  '  isNegated: function () { return isNegated.apply(null, arguments); }',
  '};'
].join('\n'));

function stubEl() {
  return {
    style: {},
    classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
    addEventListener: function () {}, removeEventListener: function () {},
    appendChild: function () {}, removeChild: function () {}, remove: function () {},
    setAttribute: function () {}, getAttribute: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return { forEach: function () {}, length: 0 }; },
    closest: function () { return null; },
    focus: function () {}, click: function () {}, reset: function () {},
    innerHTML: '', textContent: '', value: '', className: '', checked: false,
    getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  };
}

var sandbox = {
  // warn/error 静音：app.js 在无 DOM 的桩环境里必然有一条 init 噪音，与评分逻辑无关
  console: { log: console.log, warn: function () {}, error: function () {}, info: function () {} },
  document: {
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return { forEach: function () {}, length: 0 }; },
    createElement: stubEl,
    addEventListener: function () {}, removeEventListener: function () {},
    body: stubEl(), documentElement: stubEl()
  },
  localStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {}, clear: function () {} },
  navigator: { clipboard: { writeText: function () { return Promise.resolve(); } } },
  location: { href: '', pathname: 'index.html', origin: 'file://' },
  setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval,
  AbortController: AbortController, Promise: Promise, JSON: JSON, Math: Math, Date: Date,
  Object: Object, Array: Array, String: String, Number: Number, RegExp: RegExp, Error: Error,
  parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN,
  CONFIG: {
    apiMode: 'mock',
    mock: { delayMin: 1, delayMax: 2 },
    real: { tokenUrl: '', chatUrl: '', appKey: '', appSecret: '', skillId: '', apiKey: '', tokenRefreshMargin: 0 },
    multimodal: { vlmModel: 'qwen-vl-plus' },
    ui: { maxHistorySize: 50, resultAnimationDelay: 0 }
  },
  confirm: function () { return true; }, prompt: function () { return ''; }, alert: function () {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = function () {};
sandbox.removeEventListener = function () {};
sandbox.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
// 花名册：测试只关心评分函数，空花名册即可（避免依赖 students.js 的加载顺序）
sandbox.ROSTER_SEED = [];

vm.createContext(sandbox);

// 风险插件（app.js 会用到 RiskPluginManager.score）
['riskPlugins/pluginManager.js', 'riskPlugins/textMetrics.js', 'riskPlugins/rules/basic.js', 'riskPlugins/rules/weighted.js', 'riskPlugins/rules/strict.js']
  .forEach(function (f) {
    try { vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf-8'), sandbox, { filename: f }); }
    catch (e) { console.log('插件加载失败 ' + f + '：' + e.message); }
  });

try {
  vm.runInContext(patched, sandbox, { filename: 'app.js' });
} catch (e) {
  console.log('app.js 执行异常（不影响评分函数测试）：' + e.message);
}

var T = sandbox.__RISK_TEST__ || {};
var fn = T.analyzeRiskLevel;

var passed = 0, failed = 0;
function test(name, grades, homework, attendance, expectedLevel, minScore) {
  if (typeof fn !== 'function') { console.log('FAIL - analyzeRiskLevel 未被导出'); failed++; return; }
  var result = fn(grades, homework, attendance);
  var pass = result.level === expectedLevel;
  var scoreOk = (minScore === undefined) || result.score >= minScore;
  var status = (pass && scoreOk) ? 'PASS' : 'FAIL';
  if (status === 'PASS') passed++; else failed++;
  console.log(
    status + ' | ' + name +
    ' | Lv=' + result.level + ' Sc=' + result.score +
    ' (want Lv=' + expectedLevel + (minScore ? ' Sc>=' + minScore : '') + ')'
  );
  if (status === 'FAIL' && result.factors && result.factors.length) {
    console.log('  factors: ' + result.factors.join(', '));
  }
}

function assert(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail === undefined ? '' : ' | ' + detail));
}

console.log('=== Risk Analysis Tests ===');
test('张三-低风险1', '高数85分，英语78分，编程90分', '全部按时提交，质量良好', '全勤，无迟到旷课', '低', 80);
test('张三-低风险2', '成绩优秀，班级前列', '按时提交', '全勤', '低', 80);
test('李四-中风险', '高数60分，英语72分，偏科严重', '偶尔迟交', '偶尔迟到', '中', 40);
test('王五-高风险', '高数不及格，英语挂科', '不交作业，未提交', '多次旷课', '高');
test('赵六-无旷课', '成绩优秀，进步明显', '按时提交，认真', '全勤，无旷课，无迟到', '低', 80);
test('孙七-单科不及格', '英语不及格，其他良好', '按时提交', '全勤', '中', 40);

console.log('\n=== Risk Plugin Tests ===');
var strict = sandbox.RiskPluginManager.plugins.strict;
var weighted = sandbox.RiskPluginManager.plugins.weighted;
var allZero = { grades: '高数 90，英语 90，编程 90，计算机基础 90', attendance: '出勤率 0%', homework: '作业提交率 0%', labReport: '实验完成率 0%' };
var zeroResult = strict.score(allZero);
assert('strict 三率 0% 为高风险', zeroResult.level === '高' && zeroResult.score === 25, JSON.stringify(zeroResult));
assert('strict 三率 0% 命中三项', zeroResult.factors.length === 3, zeroResult.factors.join('；'));
var oneZero = strict.score({ grades: allZero.grades, attendance: '0%', homework: '100%', labReport: '100%' });
assert('strict 单项 0% 命中异常', oneZero.level === '中' && oneZero.factors.join('').indexOf('出勤率') !== -1, JSON.stringify(oneZero));
var half = strict.score({ grades: allZero.grades, attendance: '50%', homework: '50%', labReport: '50%' });
assert('strict 三率 50% 保持高风险', half.level === '高' && half.score === 25, JSON.stringify(half));
var countDetail = strict.detail({ grades: allZero.grades, attendance: '迟到2次', homework: '3次作业未交', labReport: '' });
var countRaw = countDetail.factors.map(function (f) { return f.rawValue; }).join('|');
assert('次数文本不伪装成百分比', countRaw.indexOf('2%') === -1 && countRaw.indexOf('3%') === -1 && countRaw.indexOf('缺') !== -1, countRaw);
var missing = strict.score({ grades: allZero.grades, attendance: '', homework: null });
assert('缺字段按 100 处理', missing.level === '低' && missing.score === 100, JSON.stringify(missing));
var decimalZero = sandbox.TextMetrics.parseRate('出勤率 0.5%', 100);
assert('小数比率可解析', decimalZero === 0.5, decimalZero);
var weightedZero = weighted.score(allZero);
assert('weighted 不吞 0%', weightedZero.score < 100 && weightedZero.level !== '低', JSON.stringify(weightedZero));
var custom = strict.score({ grades: allZero.grades, attendance: '79%', homework: '100%', labReport: '100%' }, { attLine: 79 });
assert('阈值 options 仍生效', custom.level === '低', JSON.stringify(custom));
var detailSum = zeroResult.score;
var detailed = strict.detail(allZero);
var sum = detailed.factors.reduce(function (n, f) { return n + f.contribution; }, 0);
assert('detail 分项与 score 对账', sum === detailSum && detailed.score === detailSum, sum + '/' + detailSum);
var importedZero = T.analyzeRiskLevelNumeric({ '高数': '60', '出勤率': '0', '作业提交率': '0', '上机实验完成率': '0' });
assert('CSV 导入保留真实 0%', importedZero.score === 24 && importedZero.level === '高', JSON.stringify(importedZero));
var mockAnalysis = { level: '中', score: 56, factors: ['测试因素'] };
var mockA = T.buildMockResult({ name: '测试学生', studentId: 'T001' }, mockAnalysis);
var mockB = T.buildMockResult({ name: '测试学生', studentId: 'T001' }, mockAnalysis);
assert('Mock 风险评分可复现', mockA.riskAnalysis.score === mockB.riskAnalysis.score && mockA.riskAnalysis.score === 56, mockA.riskAnalysis.score + '/' + mockB.riskAnalysis.score);

console.log('\n=== ' + passed + ' passed, ' + failed + ' failed ===');
process.exitCode = failed ? 1 : 0;
