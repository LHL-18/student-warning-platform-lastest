/**
 * flowEngine.js — 轻量任务流引擎（JSON DSL）
 * ---------------------------------------------------------------
 * 把原先写死在业务代码里的多步流程抽出来，变成可编排、可追踪、可复用的
 * 任务流定义。零依赖，向前兼容现有页面。
 *
 * 支持节点类型：
 *   trigger   触发（仅作为流程起点标记，不执行逻辑）
 *   tool      确定性工具节点，如 OCR / 知识库检索 / 写库
 *   llm       大模型节点
 *   agent     Agent 节点（三 Agent 契约层），输出必须通过结构校验才允许推进
 *   human     人工节点（确认 / 审批，可挂起）
 *   condition 条件分支（then / else 跳转）
 *   notify    通知节点
 *   end       结束节点
 *
 * 一个步骤的通用字段：
 *   id       必填，流程内唯一
 *   type     必填
 *   label    展示名
 *   input    输入映射，支持 ${path} 取值
 *   output   把结果写入上下文的键名
 *   next     下一步 id（默认顺序执行）
 *   then/else condition 分支目标
 *   reject   human 被拒绝时（以及 agent 校验失败时）跳转的目标
 *
 * 用法：
 *   FlowEngine.define(def);
 *   FlowEngine.registerTool('ocr', fn);
 *   FlowEngine.registerRunner('human', fn);
 *   FlowEngine.run('flow-wrongbook', { image: file });
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'flowRuns';
  var MAX_RUNS = 50;

  var flows = {};
  var tools = {};
  var runners = {};
  var listeners = [];
  var latestRun = null;

  /* ---------------- 工具函数 ---------------- */

  function nowStr() { return new Date().toISOString(); }

  function getPath(ctx, path) {
    var parts = String(path).split('.');
    var cur = ctx;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /** 把 ${a.b} 占位符替换为上下文中的值 */
  function resolve(value, ctx) {
    if (typeof value === 'string') {
      var exact = value.match(/^\$\{([^}]+)\}$/);
      if (exact) return getPath(ctx, exact[1]);
      return value.replace(/\$\{([^}]+)\}/g, function (_, p) {
        var v = getPath(ctx, p);
        if (v === null || v === undefined) return '';
        return typeof v === 'object' ? JSON.stringify(v) : String(v);
      });
    }
    if (Array.isArray(value)) return value.map(function (v) { return resolve(v, ctx); });
    if (value && typeof value === 'object') {
      var out = {};
      for (var k in value) { if (value.hasOwnProperty(k)) out[k] = resolve(value[k], ctx); }
      return out;
    }
    return value;
  }

  /** 极简条件求值：支持 ${x} OP y，兜底按真值判断，不使用 eval */
  function evaluate(expr, ctx) {
    if (typeof expr !== 'string') return !!expr;
    var s = expr.replace(/\$\{([^}]+)\}/g, function (_, p) {
      var v = getPath(ctx, p);
      if (v === undefined) return 'null';
      return typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v);
    });
    var m = s.match(/^\s*(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$/);
    if (m) {
      var a = safeParse(m[1]), b = safeParse(m[3]);
      switch (m[2]) {
        case '>': return a > b;
        case '<': return a < b;
        case '>=': return a >= b;
        case '<=': return a <= b;
        case '==': return a === b;
        case '!=': return a !== b;
      }
    }
    var t = safeParse(s);
    return !!t;
  }

  function safeParse(s) {
    try { return JSON.parse(s); } catch (e) {
      var n = parseFloat(s);
      return isNaN(n) ? String(s).replace(/^["']|["']$/g, '') : n;
    }
  }

  /* ---------------- 注册 ---------------- */

  function define(def) {
    if (!def || !def.id) throw new Error('任务流必须包含 id');
    if (!Array.isArray(def.steps) || !def.steps.length) throw new Error('任务流 ' + def.id + ' 缺少 steps');
    var seen = {};
    def.steps.forEach(function (s) {
      if (!s.id) throw new Error('任务流 ' + def.id + ' 存在缺少 id 的步骤');
      if (seen[s.id]) throw new Error('任务流 ' + def.id + ' 步骤 id 重复：' + s.id);
      seen[s.id] = true;
    });
    def.steps.forEach(function (s) {
      var links = ['then', 'else', 'reject', 'next'];
      for (var li = 0; li < links.length; li++) {
        var target = s[links[li]];
        if (target !== undefined && target !== null && target !== '' && !seen[target]) {
          throw new Error('任务流 ' + def.id + ' 步骤 ' + s.id + ' 的 ' + links[li] + ' 目标不存在：' + target);
        }
      }
    });
    flows[def.id] = def;
    return def;
  }

  function list() {
    return Object.keys(flows).map(function (k) { return flows[k]; });
  }

  function get(id) { return flows[id]; }

  function registerTool(name, fn) { tools[name] = fn; }
  function registerRunner(type, fn) { runners[type] = fn; }
  function onUpdate(cb) { listeners.push(cb); }
  function emit(runRec) { var current = runRec || latestRun; for (var i = 0; i < listeners.length; i++) { try { listeners[i](current, current && current.runId); } catch (e) {} } }

  /* ---------------- 运行记录持久化 ---------------- */

  function loadRuns() {
    try { return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  }

  function saveRun(rec) {
    try {
      var runs = loadRuns();
      var idx = -1;
      for (var i = 0; i < runs.length; i++) { if (runs[i].runId === rec.runId) { idx = i; break; } }
      if (idx >= 0) runs[idx] = rec; else runs.unshift(rec);
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
    } catch (e) {}
  }

  function runs(flowId) {
    var all = loadRuns();
    if (!flowId) return all;
    return all.filter(function (r) { return r.flowId === flowId; });
  }

  function clearRuns() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  /* ---------------- 默认执行器 ---------------- */

  var defaultRunners = {
    human: function (step, ctx) {
      var msg = resolve(step.prompt, ctx) || step.label || '确认继续？';
      var approved = global.confirm ? global.confirm(msg) : true;
      var answer = null;
      if (approved && step.ask && global.prompt) answer = global.prompt(resolve(step.ask, ctx) || '');
      return Promise.resolve({ approved: approved, answer: answer });
    },
    notify: function (step, ctx) {
      var msg = resolve(step.message, ctx) || step.label || '';
      if (typeof global.__flowNotify === 'function') global.__flowNotify(msg);
      return Promise.resolve({ notified: true, message: msg });
    },
    llm: function (step, ctx) {
      return Promise.resolve({ text: step.mockText || '（未接入大模型，返回模拟结果）', mock: true });
    }
  };

  function runnerFor(type) {
    return runners[type] || defaultRunners[type];
  }

  /* ---------------- 执行 ---------------- */

  function makeRunRec(def, input) {
    return {
      runId: 'run-' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      flowId: def.id,
      flowName: def.name,
      icon: def.icon || '',
      startedAt: nowStr(),
      finishedAt: null,
      status: 'running',
      input: {},
      steps: []
    };
  }

  /**
   * 运行一条任务流
   * @param {string} flowId
   * @param {object} input 触发参数，例如 { image: File, studentId: '2024100103' }
   * @param {object} [opts] { onUpdate: fn }
   * @returns {Promise<object>} 运行记录（含 steps 时间线）
   */
  function run(flowId, input, opts) {
    var def = flows[flowId];
    if (!def) return Promise.reject(new Error('未注册的任务流：' + flowId));
    opts = opts || {};

    var rec = makeRunRec(def, input);
    // input 里可能是 File，无法序列化，落库时只保留可读摘要
    rec.input = summarize(input);
    latestRun = rec;
    emit(rec);

    var ctx = { input: input || {} };
    var indexById = {};
    def.steps.forEach(function (s, i) { indexById[s.id] = i; });

    var executedSteps = 0;
    var maxSteps = Math.max(1, parseInt(def.maxSteps, 10) || 500);
    var stepTimeoutMs = Math.max(100, parseInt(def.stepTimeoutMs, 10) || 30000);

    function finish(status) {
      rec.status = status;
      rec.finishedAt = nowStr();
      saveRun(rec);
      emit(rec);
    }

    function addStepRec(step) {
      var s = {
        id: step.id, type: step.type, label: step.label || step.id,
        status: 'running', startedAt: nowStr(), finishedAt: null, output: null, error: null
      };
      rec.steps.push(s);
      emit(rec);
      return s;
    }

    function loop(i) {
      if (i >= def.steps.length) { finish('success'); return Promise.resolve(rec); }
      var step = def.steps[i];
      executedSteps++;
      if (executedSteps > maxSteps) {
        rec.failedAt = step.id;
        rec.error = '步骤数超过上限 ' + maxSteps + '，疑似存在循环跳转（最后一步：' + step.id + '）';
        finish('failed');
        return Promise.resolve(rec);
      }

      if (executedSteps % 20 === 0) {
        return new Promise(function (resolveYield) { setTimeout(resolveYield, 0); }).then(function () { return loop(i); });
      }

      if (step.type === 'end') {
        rec.steps.push({ id: step.id, type: 'end', label: step.label || '结束', status: 'success', startedAt: nowStr(), finishedAt: nowStr(), output: null, error: null });
        finish(step.result || 'success');
        return Promise.resolve(rec);
      }

      var sr = addStepRec(step);

      return Promise.resolve().then(function () {
        if (step.type === 'trigger') {
          sr.output = { triggered: true };
          sr.status = 'success'; sr.finishedAt = nowStr(); emit(rec);
          return loop(step.next && indexById[step.next] !== undefined ? indexById[step.next] : i + 1);
        }

        if (step.type === 'condition') {
          var ok = evaluate(step.expr, ctx);
          sr.output = { result: ok, expr: step.expr };
          sr.status = 'success'; sr.finishedAt = nowStr(); emit(rec);
          var target = ok ? step.then : step.else;
          if (target === undefined || target === null || target === '') return loop(i + 1);
          if (indexById[target] === undefined) throw new Error('条件节点 ' + step.id + ' 的分支目标不存在：' + target);
          return loop(indexById[target]);
        }

        // Agent 节点：由契约层负责构造输入、调用、结构校验与重试；
        // 校验不通过时既不抛异常也不推进，而是交给 reject 分支（人工兜底）。
        if (step.type === 'agent') {
          var agentId = step.agent || step.agentId || 'agent1';
          var workAgent = Promise.resolve(runAgentStep(step, ctx, agentId));
          var timeoutAgent = new Promise(function (resolveTimeout, rejectTimeout) {
            setTimeout(function () { rejectTimeout(new Error('Agent 步骤执行超时（' + stepTimeoutMs + 'ms）：' + step.id)); }, stepTimeoutMs);
          });
          return Promise.race([workAgent, timeoutAgent]).then(function (out) {
            var blocked = guardFailure(out);
            sr.output = summarize(out);
            if (step.output) ctx[step.output] = out;
            if (blocked) {
              sr.status = 'blocked';
              sr.error = blocked;
              sr.finishedAt = nowStr();
              emit(rec);
              if (step.reject && indexById[step.reject] !== undefined) return loop(indexById[step.reject]);
              rec.blockedAt = step.id;
              rec.error = 'Agent 节点 ' + step.id + ' 未通过结构校验：' + blocked;
              finish('blocked');
              return rec;
            }
            sr.status = 'success';
            sr.finishedAt = nowStr();
            emit(rec);
            if (out && out.__goto && indexById[out.__goto] !== undefined) return loop(indexById[out.__goto]);
            return loop(step.next && indexById[step.next] !== undefined ? indexById[step.next] : i + 1);
          }).catch(function (err) {
            sr.status = 'failed';
            sr.error = (err && err.message) || String(err);
            rec.failedAt = step.id;
            rec.error = sr.error;
            sr.finishedAt = nowStr();
            finish('failed');
            return rec;
          });
        }

        var runner;
        if (step.type === 'tool') {
          runner = tools[step.tool];
          if (!runner) throw new Error('未注册的工具：' + step.tool);
        } else {
          runner = runnerFor(step.type);
          if (!runner) throw new Error('未注册的节点类型：' + step.type);
        }

        var arg = step.type === 'tool' ? resolve(step.input, ctx) : step;
        var work = Promise.resolve(runner(arg, ctx, step));
        var timeout = new Promise(function (resolveTimeout, rejectTimeout) {
          setTimeout(function () { rejectTimeout(new Error('步骤执行超时（' + stepTimeoutMs + 'ms）：' + step.id)); }, stepTimeoutMs);
        });
        return Promise.race([work, timeout]).then(function (out) {
          sr.output = summarize(out);
          sr.status = 'success';
          sr.finishedAt = nowStr();
          if (step.output) ctx[step.output] = out;
          emit(rec);

          if (out && out.__goto && indexById[out.__goto] !== undefined) return loop(indexById[out.__goto]);
          if (step.type === 'human' && out && out.approved === false) {
            if (!step.reject || indexById[step.reject] === undefined) {
              throw new Error('人工节点 ' + step.id + ' 被拒绝，但 reject 目标不存在：' + step.reject);
            }
            return loop(indexById[step.reject]);
          }
          return loop(step.next && indexById[step.next] !== undefined ? indexById[step.next] : i + 1);
        });
      }).catch(function (err) {
        sr.status = 'failed';
        sr.error = (err && err.message) || String(err);
        rec.failedAt = step.id;
        rec.error = sr.error;
        sr.finishedAt = nowStr();
        finish('failed');
        return rec;
      });
    }

    return loop(0);
  }

  /** 把任意输出压缩成可存入 localStorage 的摘要 */
  function summarize(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') return v.length > 600 ? v.slice(0, 600) + '…' : v;
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof File !== 'undefined' && v instanceof File) return { file: v.name, size: v.size };
    if (typeof Blob !== 'undefined' && v instanceof Blob) return { blob: v.size };
    if (Array.isArray(v)) return v.slice(0, 8).map(summarize);
    if (typeof v === 'object') {
      if (v.__keep) { var keep = {}; for (var kk in v) { if (v.hasOwnProperty(kk) && kk !== '__keep') keep[kk] = v[kk]; } return keep; }
      var out = {};
      var n = 0;
      for (var k in v) {
        if (!v.hasOwnProperty(k)) continue;
        if (n++ > 20) { out.__truncated = true; break; }
        var val = v[k];
        if (typeof val === 'function') continue;
        if (typeof val === 'string' && val.length > 400) out[k] = val.slice(0, 400) + '…';
        else if (val && typeof val === 'object') out[k] = summarize(val);
        else out[k] = val;
      }
      return out;
    }
    return String(v);
  }

  /**
   * 判定一次输出是否被判定为"不得推进"。
   * Agent 节点把"校验失败"编码为结构化结果而不是抛异常，因为流程需要
   * 按文档"决策规则"转到人工，而不是整条流程失败。
   *   { __block:true, reason, detail }  → 阻断
   *   { ok:false, status:'invalid' }    → Agents.run() 的约定返回
   */
  function guardFailure(out) {
    if (!out || typeof out !== 'object') return null;
    if (out.__block) return out.reason || '输出未通过校验';
    if (out.ok === false && out.validation && out.validation.valid === false) {
      var first = out.validation.errors && out.validation.errors[0];
      return '结构校验未通过：' + ((first && (first.code + '@' + first.path)) || '未知错误');
    }
    return null;
  }

  /* ---------------- 契约层薄封装（可选依赖 Agents，缺失时给出可读错误） ---------------- */

  function agentValidator() {
    return (typeof global.Agents !== 'undefined' && global.Agents) ? global.Agents : null;
  }

  /**
   * 取 agent 节点的契约输入。
   * 节点上的 `${...}` 通常已经指向一个**构造好的输入**（由 tool 节点产出），
   * 这里只做"是不是契约输入"的判断：是就直接用，不是才尝试用 build*Input 组装。
   * 之前这里无条件再组装一次，会把完整契约输入覆盖成半成品。
   */
  function buildAgentPayload(step, ctx) {
    var A = agentValidator();
    var raw = typeof step.input === 'object' && step.input !== null ? resolve(step.input, ctx)
      : (step.input !== undefined ? resolve(step.input, ctx) : null);

    // 契约输入的标志字段：Agent1 有 case_id，Agent2 有 approved_findings，Agent3 有 approved_plan
    var looksBuilt = raw && typeof raw === 'object' &&
      (A ? (!!A['buildAgent' + step.agentNo + 'Input'] ? isContractPayload(step.agentNo, raw) : false) : false);
    if (looksBuilt || (raw && typeof raw === 'object' && raw.__skipBuild)) return raw;

    if (A && typeof A['buildAgent' + step.agentNo + 'Input'] === 'function') {
      return A['buildAgent' + step.agentNo + 'Input'](raw || {});
    }
    return raw || {};
  }

  function isContractPayload(agentNo, raw) {
    if (agentNo === 1) return !!raw.case_id && Object.prototype.toString.call(raw.evidence) === '[object Array]';
    if (agentNo === 2) return !!raw.case_id && Object.prototype.toString.call(raw.approved_findings) === '[object Array]';
    if (agentNo === 3) return !!raw.case_id && !!raw.approved_plan;
    return !!raw.case_id;
  }

  /** agent 节点的执行：调 Agents.run → 校验 → 通过才写入上下文 */
  function runAgentStep(step, ctx, agentId) {
    var A = agentValidator();
    if (!A || typeof A.run !== 'function') {
      throw new Error('Agent 契约层未加载（agents.js），无法执行节点：' + step.id);
    }
    var input = buildAgentPayload(step, ctx);
    var caller = (typeof step.caller === 'function') ? step.caller : (typeof global.__agentCaller === 'function' ? global.__agentCaller : null);
    return A.run({
      agentId: agentId,
      input: input,
      caller: caller,
      config: step.config,
      model: step.model,
      maxAttempts: step.maxAttempts
    });
  }

  var API = {
    define: define,
    list: list,
    get: get,
    registerTool: registerTool,
    registerRunner: registerRunner,
    onUpdate: onUpdate,
    run: run,
    runs: runs,
    clearRuns: clearRuns,
    current: function () { return latestRun; },
    resolve: resolve,
    evaluate: evaluate,
    summarize: summarize,
    guardFailure: guardFailure
  };

  global.FlowEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
