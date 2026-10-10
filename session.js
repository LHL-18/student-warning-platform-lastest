/**
 * session.js — 会话与身份（角色）层
 * ---------------------------------------------------------------
 * 职责：
 *   1. 保存当前登录身份（教师 / 学生）到 localStorage，带过期时间；
 *   2. 提供路由守卫：页面与角色不匹配时跳回登录页；
 *   3. 预留统一认证接口：可通过 Session.setAuthProvider() 换成
 *      学校 CAS / 金蝶苍穹 OAuth 等实现，UI 无需改动；
 *   4. 记录身份切换日志（authLog），便于留痕。
 *
 * 默认实现是「演示模式」：本地选择身份，不做任何密码校验。
 * 这是刻意的——没有后端时前端比对密码只是安全剧场。
 */
(function (global) {
  'use strict';

  var KEY = 'appSession.v1';
  var LOG_KEY = 'authLog';
  var TTL_MS = 8 * 60 * 60 * 1000;   // 8 小时
  var LOGIN_PAGE = 'login.html';

  function now() { return Date.now(); }

  function read() {
    try { return JSON.parse(global.localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  function write(s) {
    try { global.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function drop() {
    try { global.localStorage.removeItem(KEY); } catch (e) {}
  }

  function appendLog(entry) {
    try {
      var list = [];
      try { list = JSON.parse(global.localStorage.getItem(LOG_KEY) || '[]'); } catch (e) { list = []; }
      list.unshift(entry);
      global.localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (e) {}
  }

  /* ---------------- 认证提供方（可替换） ---------------- */

  var demoProvider = {
    id: 'demo',
    label: '演示模式（本地身份选择）',
    authenticate: function (req) {
      return new Promise(function (resolve) {
        req = req || {};
        if (req.role === 'teacher') {
          var page = String(global.location && global.location.pathname || '').split('/').pop();
          if (page === 'student.html') return resolve({ ok: false, error: '学生端不能发起教师登录' });
          var tname = String(req.name || '').trim() || '辅导员';
          return resolve({
            ok: true,
            user: { role: 'teacher', id: 'T-' + tname, name: tname, title: String(req.title || '辅导员').trim() || '辅导员' }
          });
        }
        if (req.role === 'student') {
          if (!global.RosterUtil) return resolve({ ok: false, error: '花名册未加载（students.js 缺失）' });
          var checked = global.RosterUtil.verify(String(req.id || '').trim(), String(req.name || '').trim());
          if (!checked.ok) return resolve({ ok: false, error: checked.error });
          var stu = checked.student;
          return resolve({
            ok: true,
            user: { role: 'student', id: stu.id, name: stu.name, className: stu.className || '未分班' }
          });
        }
        resolve({ ok: false, error: '未知的身份类型' });
      });
    }
  };

  var provider = demoProvider;

  /* ---------------- 对外接口 ---------------- */

  var Session = {
    KEY: KEY,
    LOG_KEY: LOG_KEY,
    TTL: TTL_MS,
    LOGIN_PAGE: LOGIN_PAGE,

    /** 换成真实认证实现：{ id, label, authenticate(req) -> Promise<{ok,user|error}> } */
    setAuthProvider: function (p) {
      if (p && typeof p.authenticate === 'function') provider = p;
      return provider;
    },
    getProvider: function () { return provider; },

    login: function (req) {
      return provider.authenticate(req || {}).then(function (res) {
        if (res && res.ok && res.user) {
          var u = res.user;
          u.provider = provider.id;
          u.loginAt = now();
          u.expiresAt = now() + TTL_MS;
          write(u);
          appendLog({ at: new Date().toISOString(), event: 'login', role: u.role, id: u.id, name: u.name, provider: provider.id });
        }
        return res;
      });
    },

    current: function () {
      var s = read();
      if (!s || !s.role) return null;
      if (s.expiresAt && s.expiresAt < now()) { drop(); return null; }
      return s;
    },

    logout: function () {
      var s = read();
      if (s) appendLog({ at: new Date().toISOString(), event: 'logout', role: s.role, id: s.id, name: s.name });
      drop();
    },

    /** 切换身份：清会话并回登录页 */
    switchRole: function () {
      var s = read();
      if (s) appendLog({ at: new Date().toISOString(), event: 'switch', role: s.role, id: s.id, name: s.name });
      drop();
      global.location.href = LOGIN_PAGE;
    },

    /**
     * 路由守卫：角色不匹配/未登录/已过期时跳回登录页。
     * @returns {object|null} 当前会话；为 null 时页面应立即停止初始化
     */
    guard: function (expectedRole) {
      var s = Session.current();
      if (!s || (expectedRole && s.role !== expectedRole)) {
        var page = String(global.location.pathname || '').split('/').pop() || 'index.html';
        var url = LOGIN_PAGE + '?next=' + encodeURIComponent(page) +
          (expectedRole ? '&need=' + encodeURIComponent(expectedRole) : '') +
          (s ? '&why=role' : '&why=none');
        global.location.replace(url);
        return null;
      }
      return s;
    },

    /** 把身份标签渲染到页面顶部容器里（含"切换身份"） */
    mountChip: function (container) {
      var s = Session.current();
      if (!container || !s) return;
      var who = s.role === 'teacher'
        ? (s.name + ' · ' + (s.title || '辅导员'))
        : (s.name + ' · ' + s.id);
      container.innerHTML =
        '<span class="identity-chip" title="当前身份">' +
        '<span class="identity-dot identity-dot-' + (s.role === 'teacher' ? 'teacher' : 'student') + '"></span>' +
        '<span class="identity-who">' + (s.role === 'teacher' ? '教师端' : '学生端') + ' · ' + who + '</span>' +
        '</span>' +
        '<a class="identity-switch" href="javascript:void(0)" id="identitySwitchBtn">切换身份</a>';
      var btn = container.querySelector('#identitySwitchBtn');
      if (btn) btn.addEventListener('click', function () {
        if (global.confirm('确定要退出当前身份并返回登录页吗？')) Session.switchRole();
      });
    },

    log: appendLog
  };

  global.Session = Session;
  if (typeof module !== 'undefined' && module.exports) module.exports = Session;
})(typeof window !== 'undefined' ? window : this);
