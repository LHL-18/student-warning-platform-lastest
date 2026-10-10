/** 权限底座回归测试，使用原文件与内存 localStorage。 */
var fs = require('fs');
var vm = require('vm');
var path = require('path');
var store = {};
var current = { role: 'student', id: 'S1', name: '学生一' };
var sandbox = {
  console: console,
  JSON: JSON,
  Date: Date,
  Object: Object,
  String: String,
  Array: Array,
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  Session: { current: function () { return current; } },
  location: { pathname: 'student.html' }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
['permissions.js', 'tickets.js', 'evidence.js'].forEach(function (file) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), sandbox, { filename: file });
});

var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else failed++;
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

check('学生不能声明教师权限', sandbox.Perm.can('teacher', 'export:data', false) === false);
check('学生不能访问他人数据', sandbox.Perm.guardData('student', 'S2').ok === false);
var filtered = sandbox.Perm.filter('student', { id: 'S2', name: '他人', grades: '100' }, true);
check('外部 isSelf 不能伪造本人', Object.keys(filtered).length === 0, JSON.stringify(filtered));
current = null;
check('未登录不能创建工单', sandbox.Tickets.create({ studentId: 'S1', desc: '这是一段足够长的困难描述文本' }).ok === false);
check('未登录看不到审计', sandbox.Perm.log().length === 0);
current = { role: 'student', id: 'S1', name: '学生一' };
store.supportTickets = JSON.stringify([{ id: 'T2', studentId: 'S2', desc: '他人的私密描述', status: 'pending' }]);
var resolved = sandbox.Evidence.resolve({ type: 'ticket', ref: 'T2' });
check('学生不能解析他人工单', resolved.ok === false, JSON.stringify(resolved));
current = { role: 'teacher', id: 'T1', name: '教师' };
var update = sandbox.Tickets.update('T2', { id: 'HACK', studentId: 'S1', status: 'closed' });
var stored = JSON.parse(store.supportTickets)[0];
check('工单不可改写 id/studentId', update.ok && stored.id === 'T2' && stored.studentId === 'S2' && stored.status === 'closed', JSON.stringify(stored));

console.log('\n=== ' + passed + ' passed, ' + failed + ' failed ===');
process.exitCode = failed ? 1 : 0;
