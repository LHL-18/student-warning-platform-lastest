/**
 * onboarding.js — 首轮使用引导引擎
 * ---------------------------------------------------------------
 * 零依赖。步骤由各页面自己注册（因为步骤需要用的 switchTab / 渲染函数都在
 * 页面 IIFE 内部），引擎只负责：高亮目标、定位气泡、步骤流转、进度持久化。
 *
 *   Onboarding.defineSteps('teacher', [{ target:'#studentForm', title, body,
 *                                          before:function(){...} }, ...]);
 *   Onboarding.maybeAutoStart('teacher');   // 首次进入自动播放
 *   Onboarding.start('teacher', {force:true}); // 重新播放
 *
 * 进度保存在 localStorage['onboarding.v1.<role>']，版本升级只提示新增步骤。
 */
(function (global) {
  'use strict';

  var VERSION = 1;
  var KEY_PREFIX = 'onboarding.v1.';

  var registry = {};
  var state = null;      // { role, steps, index, force }
  var nodes = null;      // DOM 节点

  function key(role) { return KEY_PREFIX + role; }

  function readProgress(role) {
    try {
      var value = JSON.parse(global.localStorage.getItem(key(role)) || 'null');
      if (!value || Object.prototype.toString.call(value) !== '[object Object]') return {};
      return value;
    } catch (e) { return {}; }
  }
  function writeProgress(role, patch) {
    try {
      var previous = readProgress(role);
      var cur = {};
      for (var oldKey in previous) { if (Object.prototype.hasOwnProperty.call(previous, oldKey)) cur[oldKey] = previous[oldKey]; }
      for (var k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k]; }
      cur.version = VERSION;
      cur.updatedAt = new Date().toISOString();
      global.localStorage.setItem(key(role), JSON.stringify(cur));
      return true;
    } catch (e) {
      try { console.warn('[Onboarding] 进度写入失败：' + e.message); } catch (ignore) {}
      return false;
    }
  }

  /* ---------------- 步骤注册 ---------------- */

  function defineSteps(role, steps) {
    registry[role] = (steps || []).filter(function (s) { return s && s.title; });
  }

  function isDone(role) {
    var p = readProgress(role);
    return !!p.done && p.version === VERSION;
  }

  function maybeAutoStart(role) {
    if (isDone(role)) return false;
    if (!registry[role] || !registry[role].length) return false;
    setTimeout(function () { start(role); }, 700);
    return true;
  }

  function reset(role) {
    try { global.localStorage.removeItem(key(role)); } catch (e) {}
  }

  /* ---------------- DOM ---------------- */

  function ensureDom() {
    if (nodes) return nodes;
    var wrap = document.createElement('div');
    wrap.id = 'onboardingRoot';
    wrap.innerHTML =
      '<div class="ob-mask ob-mask-t"></div><div class="ob-mask ob-mask-b"></div>' +
      '<div class="ob-mask ob-mask-l"></div><div class="ob-mask ob-mask-r"></div>' +
      '<div class="ob-spot" id="obSpot"></div>' +
      '<div class="ob-card" id="obCard">' +
      '  <div class="ob-head"><span class="ob-step" id="obStep"></span>' +
      '    <button type="button" class="ob-skip" id="obSkip">跳过引导</button></div>' +
      '  <h3 class="ob-title" id="obTitle"></h3>' +
      '  <div class="ob-body" id="obBody"></div>' +
      '  <div class="ob-foot">' +
      '    <button type="button" class="btn btn-sm btn-outline" id="obPrev">上一步</button>' +
      '    <button type="button" class="btn btn-sm btn-primary" id="obNext">下一步</button>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(wrap);
    nodes = {
      wrap: wrap,
      masks: [wrap.querySelector('.ob-mask-t'), wrap.querySelector('.ob-mask-b'), wrap.querySelector('.ob-mask-l'), wrap.querySelector('.ob-mask-r')],
      spot: wrap.querySelector('#obSpot'),
      card: wrap.querySelector('#obCard'),
      step: wrap.querySelector('#obStep'),
      title: wrap.querySelector('#obTitle'),
      body: wrap.querySelector('#obBody'),
      prev: wrap.querySelector('#obPrev'),
      next: wrap.querySelector('#obNext'),
      skip: wrap.querySelector('#obSkip')
    };
    nodes.next.addEventListener('click', function () { go(1); });
    nodes.prev.addEventListener('click', function () { go(-1); });
    nodes.skip.addEventListener('click', function () { finish(true); });
    document.addEventListener('keydown', function (e) {
      if (!state) return;
      if (e.key === 'Escape') finish(true);
      else if (e.key === 'Enter') go(1);
    });
    global.addEventListener('resize', function () { if (state) place(); });
    global.addEventListener('scroll', function () { if (state) place(); }, true);
    return nodes;
  }

  function resolveTarget(step) {
    try {
      if (typeof step.target === 'function') return step.target();
      if (typeof step.target === 'string' && step.target) return document.querySelector(step.target);
    } catch (e) {}
    return null;
  }

  function place() {
    if (!state || !nodes) return;
    var step = state.steps[state.index];
    var el = resolveTarget(step);
    var vw = global.innerWidth, vh = global.innerHeight;
    var pad = 8;

    if (el && el.getBoundingClientRect) {
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        var top = Math.max(0, r.top - pad), left = Math.max(0, r.left - pad);
        var right = Math.min(vw, r.right + pad), bottom = Math.min(vh, r.bottom + pad);
        nodes.masks[0].style.cssText = 'left:0;top:0;width:100%;height:' + top + 'px;display:block;';
        nodes.masks[1].style.cssText = 'left:0;top:' + bottom + 'px;width:100%;height:' + Math.max(0, vh - bottom) + 'px;display:block;';
        nodes.masks[2].style.cssText = 'left:0;top:' + top + 'px;width:' + left + 'px;height:' + Math.max(0, bottom - top) + 'px;display:block;';
        nodes.masks[3].style.cssText = 'left:' + right + 'px;top:' + top + 'px;width:' + Math.max(0, vw - right) + 'px;height:' + Math.max(0, bottom - top) + 'px;display:block;';
        nodes.spot.style.cssText = 'display:block;left:' + left + 'px;top:' + top + 'px;width:' + (right - left) + 'px;height:' + (bottom - top) + 'px;';
        // 气泡：优先放在目标下方，空间不足则放到上方，再不够就居中
        var cw = 380, ch = nodes.card.offsetHeight || 200;
        var cx = Math.min(Math.max(12, left), Math.max(12, vw - cw - 12));
        var cy;
        if (bottom + ch + 16 < vh) cy = bottom + 12;
        else if (top - ch - 16 > 0) cy = top - ch - 12;
        else cy = Math.max(12, (vh - ch) / 2);
        nodes.card.style.cssText = 'width:' + cw + 'px;left:' + cx + 'px;top:' + cy + 'px;';
        return;
      }
    }
    // 没有可高亮目标：全屏遮罩 + 居中气泡
    nodes.masks.forEach(function (m) { m.style.display = 'none'; });
    nodes.spot.style.display = 'none';
    nodes.card.style.cssText = 'width:420px;left:50%;top:50%;transform:translate(-50%,-50%);';
  }

  function render() {
    if (!state || !nodes) return;
    var step = state.steps[state.index];
    if (!step) return finish(false);
    nodes.step.textContent = '第 ' + (state.index + 1) + ' / ' + state.steps.length + ' 步 · ' + (state.role === 'teacher' ? '教师端' : '学生端');
    nodes.title.textContent = step.title;
    nodes.body.innerHTML = step.body || '';
    nodes.prev.disabled = state.index === 0;
    nodes.next.textContent = (state.index === state.steps.length - 1) ? '完成' : '下一步';
    writeProgress(state.role, { lastStep: state.index, done: false });

    var el = resolveTarget(step);
    if (el && el.scrollIntoView) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
    }
    place();
    setTimeout(place, 320);   // 等滚动/动画结束再校正一次
  }

  function go(delta) {
    if (!state) return;
    var step = state.steps[state.index];
    var next = state.index + delta;
    if (next < 0) return;
    if (next >= state.steps.length) return finish(false);
    state.index = next;
    var ns = state.steps[state.index];
    var after = function () { render(); };
    if (ns && typeof ns.before === 'function') {
      try {
        var r = ns.before();
        if (r && typeof r.then === 'function') { r.then(function () { setTimeout(after, 120); }); return; }
      } catch (e) {}
      setTimeout(after, 260);
      return;
    }
    after();
  }

  function start(role, opts) {
    opts = opts || {};
    if (!opts.force && isDone(role)) return false;
    var steps = (registry[role] || []).slice();
    if (!steps.length) return false;
    if (state) finish(true);
    ensureDom();
    state = { role: role, steps: steps, index: Math.min(opts.from || 0, steps.length - 1) };
    document.body.classList.add('ob-open');
    // 先不显示，等卡片内容渲染好再出现，避免出现"只有遮罩、卡片空白"的闪动
    nodes.wrap.style.display = 'none';
    var first = steps[state.index];
    var show = function () { nodes.wrap.style.display = 'block'; render(); };
    if (first && typeof first.before === 'function') {
      try {
        var r = first.before();
        if (r && typeof r.then === 'function') { r.then(function () { setTimeout(show, 150); }); return true; }
      } catch (e) {}
      setTimeout(show, 260);
      return true;
    }
    show();
    return true;
  }

  function finish(skipped) {
    if (!state) return;
    writeProgress(state.role, { done: true, skipped: !!skipped, finishedAt: new Date().toISOString() });
    if (nodes && nodes.wrap) nodes.wrap.style.display = 'none';
    document.body.classList.remove('ob-open');
    state = null;
    if (typeof global.__onboardingDone === 'function') { try { global.__onboardingDone(skipped); } catch (e) {} }
  }

  global.Onboarding = {
    VERSION: VERSION,
    defineSteps: defineSteps,
    maybeAutoStart: maybeAutoStart,
    start: start,
    finish: finish,
    reset: reset,
    isDone: isDone,
    isRunning: function () { return !!state; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Onboarding;
})(typeof window !== 'undefined' ? window : this);
