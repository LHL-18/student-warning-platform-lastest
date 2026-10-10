/** 流程引擎护栏回归。 */
var fs = require('fs');
var vm = require('vm');
var path = require('path');
var store = {};
var sandbox = {
  console: console, Promise: Promise, JSON: JSON, Date: Date, Math: Math,
  setTimeout: setTimeout, clearTimeout: clearTimeout,
  localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } },
  confirm: function () { return true; }, prompt: function () { return ''; }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'flowEngine.js'), 'utf8'), sandbox, { filename: 'flowEngine.js' });
var FE = sandbox.FlowEngine;
var passed = 0, failed = 0;
function check(name, ok, detail) { if (ok) passed++; else failed++; console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : '')); }

try {
  FE.define({ id: 'bad-target', steps: [{ id: 'a', type: 'condition', expr: 'true', then: 'missing' }] });
  check('define 拒绝无效跳转', false);
} catch (e) { check('define 拒绝无效跳转', e.message.indexOf('目标不存在') !== -1, e.message); }

FE.define({ id: 'loop', maxSteps: 25, steps: [
  { id: 'start', type: 'trigger' },
  { id: 'again', type: 'condition', expr: 'true', then: 'start' }
] });
var started = Date.now();
FE.run('loop', {}).then(function (run) {
  check('循环在 3 秒内失败', run.status === 'failed' && Date.now() - started < 3000, run.status + '/' + (Date.now() - started) + 'ms');
  check('失败原因可解释', String(run.error).indexOf('步骤数超过上限') !== -1, run.error);
  check('记录失败节点', !!run.failedAt, run.failedAt);
  console.log('\n=== ' + passed + ' passed, ' + failed + ' failed ===');
  process.exitCode = failed ? 1 : 0;
});
