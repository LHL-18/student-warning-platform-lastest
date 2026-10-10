/**
 * flows.js — 任务流定义（JSON DSL）
 * ---------------------------------------------------------------
 * 由 flowEngine.js 加载执行，节点实现（工具）在 app.js / student.js 中注册。
 * 每个流程都可以单独运行，运行过程会留下一份可回放的时间线。
 */
(function (global) {
  'use strict';
  if (!global.FlowEngine) { console.warn('[flows] FlowEngine 未加载'); return; }

  /* ================================================================
   *  流程 1 · 拍照错题闭环流
   *  拍照 → OCR → 知识点匹配 → 大模型解题 → 入库 → 薄弱点回流预警
   * ================================================================ */
  global.FlowEngine.define({
    id: 'flow-wrongbook',
    name: '拍照错题闭环流',
    icon: '📷',
    needsImage: true,
    description: '拍照 → 级联 OCR → 知识库匹配 → 大模型解题 → 存入错题本 → 薄弱知识点回流预警',
    steps: [
      { id: 'trigger', type: 'trigger', label: '学生上传错题照片' },
      { id: 'ocr', type: 'tool', tool: 'ocr', label: '级联 OCR 识别',
        input: { image: '${input.image}' }, output: 'ocr' },
      { id: 'match', type: 'tool', tool: 'knowledge.match', label: '知识库知识点匹配',
        input: { text: '${ocr.text}', limit: 3 }, output: 'kb' },
      { id: 'solve', type: 'tool', tool: 'solve', label: '多模态大模型解题',
        input: { image: '${input.image}', ocrText: '${ocr.text}' }, output: 'solution' },
      { id: 'confirm', type: 'human', label: '学生确认入库',
        prompt: '题目：${solution.title}\n\n是否将该错题存入错题本？', reject: 'done' },
      { id: 'save', type: 'tool', tool: 'wrongBook.save', label: '写入错题本',
        input: { studentId: '${input.studentId}', studentName: '${input.studentName}',
          image: '${input.image}', ocrText: '${ocr.text}', solution: '${solution.text}',
          title: '${solution.title}', matched: '${kb.matched}' }, output: 'saved' },
      { id: 'sync', type: 'tool', tool: 'warning.sync', label: '薄弱知识点回流预警',
        input: { studentId: '${input.studentId}', studentName: '${input.studentName}' }, output: 'warning' },
      { id: 'notify', type: 'notify', label: '结果通知',
        message: '错题已入库；错题回流候选新增 ${warning.created} 条' },
      { id: 'done', type: 'end', label: '流程结束' }
    ]
  });

  /* ================================================================
   *  流程 2 · 多模态学业数据录入流（教师端）
   * ================================================================ */
  global.FlowEngine.define({
    id: 'flow-intake',
    name: '多模态学业数据录入流',
    icon: '🗂',
    needsImage: true,
    description: '教师上传成绩单/作业照片 → OCR（低置信度自动升级大模型）→ 结构化抽取 → 人工确认 → 填入表单',
    steps: [
      { id: 'trigger', type: 'trigger', label: '教师上传成绩单照片' },
      { id: 'ocr', type: 'tool', tool: 'ocr', label: '级联 OCR 识别',
        input: { image: '${input.image}' }, output: 'ocr' },
      { id: 'check', type: 'condition', label: 'OCR 置信度判定',
        expr: '${ocr.confidence} < 55', then: 'vlm', else: 'parse' },
      { id: 'vlm', type: 'tool', tool: 'ocr.vlm', label: '升级多模态大模型识别',
        input: { image: '${input.image}' }, output: 'ocr' },
      { id: 'parse', type: 'tool', tool: 'parse.student', label: '结构化抽取',
        input: { text: '${ocr.text}' }, output: 'parsed' },
      { id: 'confirm', type: 'human', label: '教师确认抽取结果',
        prompt: '识别结果：\n${parsed.summary}\n\n是否填入表单？', reject: 'end' },
      { id: 'fill', type: 'tool', tool: 'form.fill', label: '写入学业数据',
        input: { parsed: '${parsed}' }, output: 'filled' },
      { id: 'notify', type: 'notify', label: '完成通知',
        message: '已填入字段：${filled.filled}' },
      { id: 'end', type: 'end', label: '结束' }
    ]
  });

  /* ================================================================
   *  流程 3 · 预警帮扶闭环流（教师端，三 Agent 第 1、2 步）
   *  与旧版的关键差别：
   *   - Agent1 / Agent2 用 type:'agent' 节点，输出必须过 JSON Schema 校验才允许推进
   *     （校验失败的路径见 `analysisBad`，由辅导员兜底，而不是让流程带着脏数据往下走）；
   *   - 步骤上只放"确定性工具"（读画像、跑规则、检索案例、建工单），
   *     模型只负责分析与建议 —— 对应文档"Agent 负责分析与建议，流程引擎负责状态流转"。
   *  Agent3 不在这里：文档明确要求它必须在执行期结束后、有真实执行证据时才触发。
   * ================================================================ */
  global.FlowEngine.define({
    id: 'flow-warning',
    name: '预警帮扶闭环流（Agent1→人工确认→Agent2）',
    icon: '⚠',
    needsStudent: true,
    description: '规则引擎评分 → Agent1 预警分析师（结构校验）→ 辅导员确认 → 检索相似案例 → Agent2 帮扶规划师（结构校验）→ 生成工单并留痕',
    steps: [
      { id: 'trigger', type: 'trigger', label: '规则命中 / 教师发起' },
      { id: 'profile', type: 'tool', tool: 'agent.profile.load', label: '读取学生画像与规则评分',
        input: { studentId: '${input.studentId}' }, output: 'profile' },
      { id: 'build1', type: 'tool', tool: 'agent1.buildInput', label: '构造 Agent1 输入（证据编号）',
        input: { studentId: '${input.studentId}', profile: '${profile}', ruleResult: '${profile.ruleResult}' },
        output: 'agent1Input' },
      { id: 'analysis', type: 'agent', agent: 'agent1', agentNo: 1, label: 'Agent1 · 预警分析师',
        input: '${agent1Input}', output: 'agent1', reject: 'analysisBad' },
      { id: 'confirm', type: 'human', label: '辅导员确认预警',
        prompt: 'Agent1 建议：${agent1.output.recommendation}\n理由：${agent1.output.recommendation_reason}\n\n是否确认该预警并生成帮扶方案？',
        reject: 'end' },
      { id: 'cases', type: 'tool', tool: 'case.retrieve', label: '检索相似历史案例（脱敏）',
        input: { studentId: '${input.studentId}' }, output: 'cases' },
      { id: 'build2', type: 'tool', tool: 'agent2.buildInput', label: '构造 Agent2 输入（辅导员确认的结论）',
        input: { studentId: '${input.studentId}', findings: '${agent1.output.findings}',
          cases: '${cases}', planPeriodDays: 30 }, output: 'agent2Input' },
      { id: 'plan', type: 'agent', agent: 'agent2', agentNo: 2, label: 'Agent2 · 帮扶规划师',
        input: '${agent2Input}', output: 'agent2', reject: 'planBad' },
      { id: 'ticket', type: 'tool', tool: 'warning.ticket', label: '生成预警工单（人工审批后）',
        input: { studentId: '${input.studentId}', level: '${agent1.output.rule_result_summary.risk_level}',
          reason: '${agent1.output.recommendation_reason}', plan: '${agent2.output.plan_title}',
          planOutput: '${agent2.output}' },
        output: 'ticket' },
      { id: 'notify', type: 'notify', label: '通知辅导员',
        message: '已生成预警工单 ${ticket.ticketId}；帮扶方案：${agent2.output.plan_title}（${agent2.output.actions.length} 项行动待审批）' },
      { id: 'end', type: 'end', label: '结束（等待辅导员审批方案）' },

      // 校验失败兜底：不允许"先推进、后补校验"，所以显式跳到结束节点，
      // 不依赖步骤顺序（以后往中间插节点也不会把失败路径接到成功路径上）。
      { id: 'analysisBad', type: 'notify', label: 'Agent1 校验未通过 → 转人工补充数据',
        message: 'Agent1 输出未通过结构校验，已转人工补充数据（不推进预警）。', next: 'analysisEnd' },
      { id: 'analysisEnd', type: 'end', result: 'blocked', label: '结束（Agent1 未通过）' },
      { id: 'planBad', type: 'notify', label: 'Agent2 校验未通过 → 要求重生成或人工编辑',
        message: 'Agent2 输出缺少可量化目标或结构不合规，已转人工编辑（不生成工单）。', next: 'planEnd' },
      { id: 'planEnd', type: 'end', result: 'blocked', label: '结束（Agent2 未通过）' }
    ]
  });

  /* ================================================================
   *  流程 4 · 帮扶执行复核流（教师端，三 Agent 第 3 步）
   *  只在执行期结束或约定复核日触发。没有执行记录时 Agent3 必须判"证据不足"，
   *  这一步的价值就是逼系统区分"学生没做"和"系统没数据"。
   * ================================================================ */
  global.FlowEngine.define({
    id: 'flow-review',
    name: '帮扶执行复核流（Agent3 执行监督员）',
    icon: '🔎',
    needsStudent: true,
    description: '读取已审批方案与执行证据 → Agent3 逐项核查（结构校验）→ 通过则建议提交结案、不通过转人工复核',
    steps: [
      { id: 'trigger', type: 'trigger', label: '执行期结束 / 约定复核日 / 人工发起' },
      { id: 'evidence', type: 'tool', tool: 'agent3.gatherEvidence', label: '汇总执行证据与已审批方案',
        input: { studentId: '${input.studentId}', reviewDays: '${input.reviewDays}',
          ctxPlan: '${input.approvedPlan}' }, output: 'review' },
      { id: 'build3', type: 'tool', tool: 'agent3.buildInput', label: '构造 Agent3 输入（逐条 success_criteria）',
        input: { studentId: '${input.studentId}', review: '${review}' }, output: 'agent3Input' },
      { id: 'audit', type: 'agent', agent: 'agent3', agentNo: 3, label: 'Agent3 · 执行监督员',
        input: '${agent3Input}', output: 'agent3', reject: 'auditBad' },
      { id: 'route', type: 'condition', label: '按核查结论分流',
        expr: '${agent3.output.overall_assessment} == "未达成"', then: 'needReview', else: 'report' },
      { id: 'needReview', type: 'notify', label: '存在未达标项 → 提示人工复核',
        message: 'Agent3 判定未达成：${agent3.output.recommendation_reason}' },
      { id: 'report', type: 'notify', label: '出具复核结论（由辅导员决定结案/调整/升级）',
        message: 'Agent3 复核结论：${agent3.output.overall_assessment}；建议：${agent3.output.recommendation}' },
      { id: 'end', type: 'end', label: '结束（结果交辅导员决策）' },
      { id: 'auditBad', type: 'notify', label: '复核输出未通过校验 → 要求人工核对数据',
        message: 'Agent3 输出未通过结构校验，请人工核对执行证据后重新复核。', next: 'auditEnd' },
      { id: 'auditEnd', type: 'end', result: 'blocked', label: '结束（复核未通过）' }
    ]
  });

})(typeof window !== 'undefined' ? window : this);
