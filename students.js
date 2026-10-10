/**
 * students.js — 花名册种子数据（单一数据源）
 * ---------------------------------------------------------------
 * 教师端、学生端、登录页都从这里取学生基础信息，避免"教师端有名单、
 * 学生端读不到"的问题。
 *
 * 说明：
 *  - 教师端启动时会把种子深拷贝到内存中的 mockStudents，运行期的增删改
 *    只影响内存与 localStorage['studentWarningStates']，不会回写本文件。
 *  - RosterUtil.all() 会合并「种子数据」与「教师端已保存的状态」（含教师
 *    端新增的学生），所以登录页能看到运行时新增的学生。
 */
(function (global) {
  'use strict';

  var ROSTER_SEED = [
    { id: '2024100101', name: '张三', className: '软件工程2101', grades: '高数 85 分，英语 72 分，编程 90 分', homework: '本学期作业按时提交，完成质量中等', attendance: '全勤' },
    { id: '2024100102', name: '李四', className: '软件工程2101', grades: '高数 58 分，英语 65 分，编程 70 分', homework: '本学期有3次作业未交', attendance: '迟到2次' },
    { id: '2024100103', name: '王五', className: '软件工程2101', grades: '高数 92 分，英语 88 分，编程 95 分', homework: '作业全部按时提交，质量优秀', attendance: '全勤' },
    { id: '2024100201', name: '赵六', className: '软件工程2102', grades: '高数 45 分，英语 50 分，编程 55 分', homework: '多次未交作业，缺交率超过40%', attendance: '旷课5次' },
    { id: '2024100202', name: '孙七', className: '软件工程2102', grades: '高数 78 分，英语 80 分，编程 75 分', homework: '按时提交，质量良好', attendance: '全勤' },
    { id: '2024100301', name: '周八', className: '数据科学2101', grades: '高数 60 分，英语 70 分，编程 65 分', homework: '偶尔迟交，完成质量中等', attendance: '请假2次' },
    { id: '2024100302', name: '吴九', className: '数据科学2101', grades: '高数 88 分，英语 90 分，编程 92 分', homework: '优秀', attendance: '全勤' },
    { id: '2024100303', name: '郑十', className: '数据科学2101', grades: '高数 40 分，英语 55 分，编程 60 分', homework: '作业质量差，经常不交', attendance: '旷课8次，迟到多次' }
  ];

  var STATES_KEY = 'studentWarningStates';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function readStates() {
    try {
      var raw = global.localStorage.getItem(STATES_KEY);
      var s = raw ? JSON.parse(raw) : {};
      return (s && typeof s === 'object') ? s : {};
    } catch (e) { return {}; }
  }

  var STATUS_LABEL = { pending: '待干预', supporting: '帮扶中', reviewing: '核查中', resolved: '已解除' };
  var RISK_LABEL = { '高': '高风险', '中': '中风险', '低': '低风险' };

  var RosterUtil = {
    seed: ROSTER_SEED,

    /** 按学号从种子数据取学生（深拷贝，避免被页面改脏） */
    find: function (id) {
      if (!id) return null;
      for (var i = 0; i < ROSTER_SEED.length; i++) {
        if (ROSTER_SEED[i].id === String(id)) return clone(ROSTER_SEED[i]);
      }
      return null;
    },

    /**
     * 花名册全量：种子数据 + 教师端运行期新增的学生，并叠加教师端保存的状态
     * （riskLevel / riskScore / status），供登录页与学生端使用。
     */
    all: function () {
      var states = readStates();
      var out = [], seen = {};

      function apply(stu) {
        var st = states[stu.id] || {};
        if (st.riskLevel) stu._riskLevel = st.riskLevel;
        if (st.riskScore !== undefined && st.riskScore !== '') stu._riskScore = st.riskScore;
        if (st.status) stu.status = st.status;
        if (st.ticketId) stu.ticketId = st.ticketId;
        return stu;
      }

      ROSTER_SEED.forEach(function (s) {
        out.push(apply(clone(s)));
        seen[s.id] = true;
      });

      Object.keys(states).forEach(function (id) {
        if (seen[id]) return;
        var st = states[id] || {};
        out.push(apply({ id: id, name: st.name || ('学生' + id), className: st.className || '未分班', grades: '', homework: '', attendance: '', status: 'pending' }));
      });

      return out;
    },

    /** 学号/姓名模糊搜索，供登录页选择 */
    search: function (keyword) {
      var k = String(keyword || '').toLowerCase().trim();
      var all = RosterUtil.all();
      if (!k) return all;
      return all.filter(function (s) {
        return String(s.id).toLowerCase().indexOf(k) !== -1 || String(s.name).toLowerCase().indexOf(k) !== -1;
      });
    },

    /** 按学号+姓名校验（演示模式登录用，两项都必须提供并匹配） */
    verify: function (id, name) {
      var stu = null;
      var all = RosterUtil.all();
      for (var i = 0; i < all.length; i++) {
        if (String(all[i].id) === String(id)) { stu = all[i]; break; }
      }
      if (!stu) return { ok: false, error: '未在花名册中找到该学号，请联系辅导员' };
      if (!String(name || '').trim()) return { ok: false, error: '请输入姓名' };
      if (String(stu.name) !== String(name).trim()) {
        return { ok: false, error: '学号与姓名不匹配' };
      }
      return { ok: true, student: stu };
    },

    statusLabel: function (s) { return STATUS_LABEL[s] || '待干预'; },
    riskLabel: function (r) { return RISK_LABEL[r] || '低风险'; },
    statesKey: STATES_KEY
  };

  global.ROSTER_SEED = ROSTER_SEED;
  global.RosterUtil = RosterUtil;
  if (typeof module !== 'undefined' && module.exports) module.exports = { seed: ROSTER_SEED, util: RosterUtil };
})(typeof window !== 'undefined' ? window : this);
