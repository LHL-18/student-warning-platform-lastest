/**
 * login.js — 身份选择页逻辑
 * 依赖：session.js（会话/认证）、students.js（花名册）
 */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  var nextPage = qs.get('next') || '';
  var needRole = qs.get('need') || '';
  var why = qs.get('why') || '';

  var el = {
    notice: document.getElementById('loginNotice'),
    roles: document.getElementById('loginRoles'),
    session: document.getElementById('loginSession'),
    sessionText: document.getElementById('loginSessionText'),
    resume: document.getElementById('loginResume'),
    rechoose: document.getElementById('loginRechoose'),
    teacherForm: document.getElementById('teacherForm'),
    studentForm: document.getElementById('studentForm'),
    teacherName: document.getElementById('teacherName'),
    teacherTitle: document.getElementById('teacherTitle'),
    studentId: document.getElementById('studentId'),
    studentName: document.getElementById('studentName'),
    studentMatched: document.getElementById('studentMatched'),
    rosterHint: document.getElementById('rosterHint'),
    rosterList: document.getElementById('rosterList'),
    provider: document.getElementById('loginProvider')
  };

  function showNotice(msg, kind) {
    if (!msg) { el.notice.style.display = 'none'; return; }
    el.notice.textContent = msg;
    el.notice.className = 'login-notice login-notice-' + (kind || 'info');
    el.notice.style.display = '';
  }

  function targetFor(role) {
    if (nextPage && nextPage !== 'login.html') return nextPage;
    return role === 'student' ? 'student.html' : 'index.html';
  }

  function enter(user) {
    location.href = targetFor(user.role);
  }

  /* ---------------- 已有会话 ---------------- */
  (function initExistingSession() {
    var s = window.Session.current();
    if (!s) return;
    var who = s.role === 'teacher' ? (s.name + '（教师端）') : (s.name + ' · ' + s.id + '（学生端）');
    var t = new Date(s.expiresAt || 0);
    el.sessionText.textContent = '检测到未结束的会话：' + who + '，有效期至 ' +
      (t.getHours() < 10 ? '0' : '') + t.getHours() + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes();
    el.session.style.display = '';
    el.resume.addEventListener('click', function () { enter(s); });
    el.rechoose.addEventListener('click', function () {
      window.Session.logout();
      el.session.style.display = 'none';
      if (needRole) pick(needRole);
    });
  })();

  /* ---------------- 提示信息 ---------------- */
  if (why === 'none' && needRole) {
    showNotice('请先选择身份后进入' + (needRole === 'teacher' ? '教师端' : '学生端') + '。', 'info');
  } else if (why === 'role') {
    showNotice('当前身份无权访问该页面，请重新选择身份。', 'warn');
  }

  /* ---------------- 角色切换 ---------------- */
  function pick(role) {
    el.roles.style.display = 'none';
    el.teacherForm.style.display = role === 'teacher' ? '' : 'none';
    el.studentForm.style.display = role === 'student' ? '' : 'none';
    showNotice('', null);
    setTimeout(function () {
      if (role === 'teacher') el.teacherName.focus();
      else el.studentId.focus();
    }, 30);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.login-role'), function (btn) {
    btn.addEventListener('click', function () { pick(this.getAttribute('data-role')); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function (btn) {
    btn.addEventListener('click', function () {
      el.teacherForm.style.display = 'none';
      el.studentForm.style.display = 'none';
      el.roles.style.display = '';
    });
  });

  /* ---------------- 花名册 ---------------- */
  (function initRoster() {
    if (!window.RosterUtil) { el.rosterHint.textContent = '花名册未加载（students.js 缺失）'; return; }
    var all = window.RosterUtil.all();
    el.rosterHint.textContent = '当前花名册共 ' + all.length + ' 名学生（可在教师端导入名单后新增）。';
    var opts = all.slice(0, 50).map(function (s) {
      return '<option value="' + s.id + '">' + s.name + ' · ' + (s.className || '') + '</option>';
    }).join('');
    el.rosterList.innerHTML = opts;
  })();

  function lookup() {
    var id = (el.studentId.value || '').trim();
    if (!window.RosterUtil || !id) { el.studentMatched.textContent = ''; return null; }
    var stu = null;
    var all = window.RosterUtil.all();
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) { stu = all[i]; break; } }
    if (!stu) {
      el.studentMatched.textContent = '未在花名册中找到该学号';
      el.studentMatched.className = 'login-hint login-hint-error';
      return null;
    }
    var bits = [stu.name, stu.className || '未分班'];
    if (stu._riskLevel) bits.push(window.RosterUtil.riskLabel(stu._riskLevel));
    bits.push('工单：' + window.RosterUtil.statusLabel(stu.status));
    el.studentMatched.textContent = '已匹配：' + bits.join(' · ');
    el.studentMatched.className = 'login-hint login-hint-ok';
    if (!el.studentName.value) el.studentName.value = stu.name;
    return stu;
  }
  el.studentId.addEventListener('input', lookup);
  el.studentId.addEventListener('change', lookup);

  /* ---------------- 登录 ---------------- */
  function busy(form, on) {
    Array.prototype.forEach.call(form.querySelectorAll('button'), function (b) { b.disabled = !!on; });
  }

  el.teacherForm.addEventListener('submit', function (e) {
    e.preventDefault();
    busy(el.teacherForm, true);
    window.Session.login({
      role: 'teacher',
      name: el.teacherName.value,
      title: el.teacherTitle.value
    }).then(function (res) {
      busy(el.teacherForm, false);
      if (!res.ok) return showNotice(res.error || '登录失败', 'warn');
      enter(res.user);
    }).catch(function (err) {
      busy(el.teacherForm, false);
      showNotice('登录异常：' + (err && err.message ? err.message : err), 'warn');
    });
  });

  el.studentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var stu = lookup();
    if (!stu) { showNotice('请先填写花名册中存在的学号', 'warn'); el.studentId.focus(); return; }
    busy(el.studentForm, true);
    window.Session.login({
      role: 'student',
      id: el.studentId.value,
      name: el.studentName.value
    }).then(function (res) {
      busy(el.studentForm, false);
      if (!res.ok) return showNotice(res.error || '登录失败', 'warn');
      enter(res.user);
    }).catch(function (err) {
      busy(el.studentForm, false);
      showNotice('登录异常：' + (err && err.message ? err.message : err), 'warn');
    });
  });

  if (el.provider && window.Session.getProvider) {
    var p = window.Session.getProvider();
    el.provider.textContent = p.label || p.id;
  }

  // 被守卫拦回时，直接定位到对应表单
  if (needRole) pick(needRole);
})();
