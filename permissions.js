/**
 * permissions.js — 字段级权限底座 + 数据访问审计
 * ---------------------------------------------------------------
 * 为什么需要它：
 *   session.js 的 guard() 只做「页面级」守卫——身份不符就跳回登录页。
 *   但教师端与学生端跑在同一个 Electron 会话里、共享同一个 localStorage，
 *   学生只要在学生端页面打开控制台，就能直接读写教师端的键
 *   （studentWarningStates / studentWarningHistory / agentConfigs ...）。
 *   也就是说"双端区分"在数据层原本是不设防的。
 *
 * 本模块提供四件事：
 *   1. 字段级可见性矩阵（谁能读/写哪些字段，区分「本人 vs 他人」）
 *   2. 统一 API：fields / can / filter / guardData / audit
 *   3. 数据访问审计（localStorage:dataAccessLog，最多 500 条，5 秒内同源去重）
 *   4. 会话联动：未登录一律拒绝
 *
 * 依赖：session.js（必须先加载）。本模块不反向依赖任何业务脚本。
 * 约束：ES5 风格、零依赖、不用 eval / new Function。
 */
(function (global) {
  'use strict';

  var LOG_KEY = 'dataAccessLog';
  var LOG_MAX = 500;
  var DEDUPE_MS = 5000;      // 同一 actor+subject+action 5 秒内只记一条

  var ROLE = { TEACHER: 'teacher', STUDENT: 'student' };

  /* ================================================================
   *  1. 字段级可见性矩阵
   *  - read/write 里存的是「字段名」，不存值
   *  - 学生侧刻意不含 riskScore / supportPlan / ticketReason：
   *    这些是教师端的研判过程数据，不是学生自己的原始材料
   * ================================================================ */

  var MATRIX = {
    teacher: {
      read: ['name', 'className', 'grades', 'homework', 'attendance', 'lab', 'labReport', 'codeQuality',
        'riskLevel', 'riskScore', 'status', 'ticketId', 'ticketTime', 'ticketReason',
        'supportPlan', 'operationLog'],
      // 教师可写的是「研判与治理」类字段；成绩/作业/出勤等原始材料也允许更正
      write: ['name', 'className', 'grades', 'homework', 'attendance',
        'riskLevel', 'riskScore', 'status', 'ticketId', 'ticketTime', 'ticketReason', 'supportPlan'],
      snapshotRead: ['at', 'pluginId', 'pluginName', 'riskLevel', 'riskScore', 'factors', 'evidenceRefs']
    },
    student: {
      // 学生只能读自己的基础数据与结论，不含教师端内部研判字段
      read: ['name', 'className', 'grades', 'homework', 'attendance', 'riskLevel', 'status'],
      // 学生只能写自己的申报/申诉（写入的是独立存储键，不是 studentWarningStates）
      write: ['ticketType', 'ticketDesc', 'ticketContact', 'ticketUrgency',
        'appealType', 'appealReason', 'appealSnapshot'],
      // 「判定依据快照」是另一个字段域：可解释性要求学生有权知道自己为什么被判定，
      // 所以这里包含 riskScore / factors / evidenceRefs；但学生档案本身（read）仍然不含这些内部研判字段。
      // 注意：证据链在 UI 侧还会用 Evidence.forStudent 再过滤一次，不展示教师端的研判过程。
      snapshotRead: ['at', 'pluginId', 'pluginName', 'riskLevel', 'riskScore', 'factors', 'evidenceRefs']
    }
  };

  /* 动作矩阵：selfOnly 表示「只有 isSelf 为真时才允许」 */
  var ACTIONS = {
    'warning:read': { teacher: true, student: true, selfOnly: true },
    'warning:adjust': { teacher: true, student: false },
    'student:read': { teacher: true, student: true, selfOnly: true },
    'student:write': { teacher: true, student: false },
    'ticket:submit': { teacher: false, student: true, selfOnly: true },
    'ticket:handle': { teacher: true, student: false },
    'appeal:submit': { teacher: false, student: true, selfOnly: true },
    'appeal:review': { teacher: true, student: false },
    'evidence:read': { teacher: true, student: true, selfOnly: true },
    'export:data': { teacher: true, student: false },
    'export:self': { teacher: false, student: true, selfOnly: true },
    'privacy:read': { teacher: false, student: true, selfOnly: true },
    'sandbox:run': { teacher: true, student: false },
    'case:read': { teacher: true, student: false }
  };

  /* ================================================================
   *  2. 会话与日志底座
   * ================================================================ */

  function actor() {
    if (!global.Session || typeof global.Session.current !== 'function') return null;
    try { return global.Session.current(); } catch (e) { return null; }
  }

  function currentPage() {
    try {
      var p = String(global.location && global.location.pathname || '');
      return p.split('/').pop() || '';
    } catch (e) { return ''; }
  }

  function readLog() {
    try {
      var raw = global.localStorage.getItem(LOG_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(list) === '[object Array]' ? list : [];
    } catch (e) { return []; }
  }

  function writeLog(list) {
    try { global.localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, LOG_MAX))); } catch (e) { /* 配额满等异常不能影响主流程 */ }
  }

  /* ================================================================
   *  3. 对外 API
   * ================================================================ */

  var Perm = {
    ROLE: ROLE,
    LOG_KEY: LOG_KEY,
    LOG_MAX: LOG_MAX,
    DEDUPE_MS: DEDUPE_MS,

    /** 当前访问者（未登录返回 null） */
    actor: actor,

    /**
     * 取某角色的字段清单（返回副本，外部改不动矩阵）
     * @param {string} role teacher | student
     * @param {boolean} isSelf 是否操作本人数据
     */
    fields: function (role, isSelf) {
      var m = MATRIX[role];
      if (!m) return { read: [], write: [], isSelf: !!isSelf };
      return {
        read: m.read.slice(),
        write: m.write.slice(),
        isSelf: !!isSelf,
        // 他人数据的可读字段：学生读他人一律为空（由 guardData 拒绝），教师不受限
        effectiveRead: (role === ROLE.STUDENT && !isSelf) ? [] : m.read.slice()
      };
    },

    /** 是否允许某动作 */
    can: function (role, action, isSelf) {
      var who = actor();
      if (!who) return false;
      if (role !== who.role) return false;
      var rule = ACTIONS[action];
      if (!rule) return false;
      if (!rule[role]) return false;
      if (rule.selfOnly && !isSelf) return false;
      return true;
    },

    /**
     * 按权限裁剪记录：只保留可读字段，返回新对象（不修改入参）
     * 老数据缺字段时「缺失即跳过」，不抛错
     */
    filter: function (role, record, isSelf) {
      var out = {};
      if (!record || typeof record !== 'object') return out;
      var who = actor();
      if (!who) return out;                        // 未登录不返回任何数据
      if (who.role !== role) return out;           // 会话角色与请求角色不符
      var subjectId = record.studentId !== undefined ? record.studentId : record.id;
      var computedSelf = subjectId !== undefined && String(subjectId) === String(who.id);
      var allowed = Perm.fields(role, role === ROLE.TEACHER || computedSelf).effectiveRead;
      if (!allowed.length) return out;
      for (var i = 0; i < allowed.length; i++) {
        var k = allowed[i];
        if (Object.prototype.hasOwnProperty.call(record, k)) out[k] = record[k];
      }
      return out;
    },

    /**
     * 按权限裁剪「判定依据快照」（与档案字段域分开）：
     * 学生可看自己那一条的等级/评分/分维度依据（可解释性），看不到他人快照。
     */
    filterSnapshot: function (role, snapshot, isSelf) {
      var out = {};
      if (!snapshot || typeof snapshot !== 'object') return out;
      var who = actor();
      if (!who) return out;
      if (who.role !== role) return out;
      var subjectId = snapshot.studentId !== undefined ? snapshot.studentId : snapshot.id;
      var computedSelf = subjectId !== undefined && String(subjectId) === String(who.id);
      if (role === ROLE.STUDENT && !computedSelf) return out;
      var m = MATRIX[role];
      var allowed = (m && m.snapshotRead) ? m.snapshotRead : [];
      for (var i = 0; i < allowed.length; i++) {
        var k = allowed[i];
        if (Object.prototype.hasOwnProperty.call(snapshot, k)) out[k] = snapshot[k];
      }
      return out;
    },

    /**
     * 学生访问非本人数据时的硬闸门
     * @returns {{ok:boolean, isSelf:boolean, error?:string}}
     */
    guardData: function (role, targetStudentId) {
      var who = actor();
      if (!who) return { ok: false, isSelf: false, error: '未登录，拒绝访问' };
      if (role !== ROLE.TEACHER && role !== ROLE.STUDENT) {
        targetStudentId = role;
        role = who.role;
      }
      if (role !== who.role) return { ok: false, isSelf: false, error: '会话角色不匹配' };
      if (who.role === ROLE.TEACHER) {
        return { ok: true, isSelf: String(targetStudentId) === String(who.id) };
      }
      if (who.role === ROLE.STUDENT) {
        var mine = String(who.id);
        var want = String(targetStudentId);
        if (want !== mine) {
          try { console.warn('[Perm] 拒绝越权访问：' + mine + ' -> ' + want); } catch (e) {}
          return { ok: false, isSelf: false, error: '只能访问本人的数据' };
        }
        return { ok: true, isSelf: true };
      }
      return { ok: false, isSelf: false, error: '未知角色' };
    },

    /**
     * 写数据访问审计
     * @param {{action:string, subjectId?:string, subjectName?:string, fields?:Array<string>, page?:string, denied?:boolean}} entry
     * 只记字段「名」，不记字段值（避免审计日志本身泄露敏感数据）
     */
    audit: function (entry) {
      try {
        var who = actor();
        if (!who) return false;                     // 未登录不产生审计
        entry = entry || {};
        var action = entry.action || 'view';
        var subjectId = entry.subjectId === undefined ? who.id : String(entry.subjectId);
        var list = readLog();

        // 节流：最近 5 秒内同一 actor/subject/action/fields 组合只记一条。
        var now = Date.now();
        var fieldsKey = JSON.stringify((entry.fields || []).slice().sort());
        for (var di = 0; di < list.length; di++) {
          var recent = list[di];
          var recentTs = recent && recent.at ? new Date(recent.at).getTime() : 0;
          if (!recentTs || (now - recentTs) >= DEDUPE_MS) break;
          if (recent.actorRole === who.role && recent.actorId === who.id && String(recent.subjectId) === subjectId &&
            recent.action === action && JSON.stringify((recent.fields || []).slice().sort()) === fieldsKey) return false;
        }

        var rec = {
          at: new Date().toISOString(),
          actorRole: who.role,
          actorId: who.id || '',
          actorName: who.name || '',
          subjectId: subjectId,
          subjectName: entry.subjectName || '',
          action: action,
          fields: (entry.fields || []).slice(0, 30),
          page: entry.page || currentPage()
        };
        if (entry.denied) rec.denied = true;
        list.unshift(rec);
        writeLog(list);
        return true;
      } catch (e) {
        return false;                                 // 审计失败不能影响主流程
      }
    },

    /** 读取审计日志（教师端只看汇总，学生端只看自己的 —— 由调用方传 filter） */
    log: function (filter) {
      var who = actor();
      if (!who) return [];
      var list = readLog();
      if (who.role === ROLE.STUDENT) {
        list = list.filter(function (r) { return String(r.subjectId) === String(who.id); });
      } else if (who.role !== ROLE.TEACHER) return [];
      if (!filter) return list;
      return list.filter(function (r) {
        if (filter.subjectId && String(r.subjectId) !== String(filter.subjectId)) return false;
        if (filter.actorRole && r.actorRole !== filter.actorRole) return false;
        if (filter.action && r.action !== filter.action) return false;
        return true;
      });
    },

    /** 只返回 subjectId 为当前学生本人的日志（隐私中心用） */
    myLog: function () {
      var who = actor();
      if (!who || who.role !== ROLE.STUDENT) return [];
      return Perm.log({ subjectId: who.id });
    }
  };

  global.Perm = Perm;
  if (typeof module !== 'undefined' && module.exports) module.exports = Perm;
})(typeof window !== 'undefined' ? window : this);
