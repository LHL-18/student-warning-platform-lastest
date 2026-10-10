// 严格预警版：任一科目不及格/出勤<80%/作业<70% → 中风险；两项以上 → 高风险
RiskPluginManager.register('strict', {
  description: '任一科目不及格/出勤率<80%/作业提交率<70%即判定中风险；两项及以上异常直接判定高风险。适合严格管控场景。',
  name: '严格预警版',
  score: function(data, options) {
    // 可选阈值覆盖（政策沙盒影子模式使用）。不传 options 时行为与之前完全一致。
    var failLine = (options && options.failLine !== undefined) ? options.failLine : 60;
    var attLine = (options && options.attLine !== undefined) ? options.attLine : 80;
    var hwLine = (options && options.hwLine !== undefined) ? options.hwLine : 70;
    var labLine = (options && options.labLine !== undefined) ? options.labLine : 70;
    var g = data.grades || '';
    var fields = ['高数','英语','编程','计算机基础'];
    var anomalyCount = 0, details = [], factors = [];
    for (var i = 0; i < fields.length; i++) {
      var re = new RegExp(fields[i] + '[^0-9]*(\\d+)');
      var m = g.match(re);
      if (!m) continue; // 花名册缺少该科目时不计为不及格（与 basic 规则一致）
      var sc = parseInt(m[1], 10);
      details.push({ field: fields[i], score: sc });
      if (sc < failLine) { anomalyCount++; factors.push('【' + fields[i] + '】不及格(' + sc + '分)'); }
    }
    var attMetric = TextMetrics.asRate(data.attendance, 100);
    var hwMetric = TextMetrics.asRate(data.homework, 100);
    var labMetric = TextMetrics.asRate(data.labReport, 100);
    var attNum = attMetric.value;
    var hwNum = hwMetric.value;
    var labNum = labMetric.value;
    if (attNum < attLine) { anomalyCount++; factors.push('【出勤率】低于' + attLine + '%'); }
    if (hwNum < hwLine) { anomalyCount++; factors.push('【作业提交率】低于' + hwLine + '%'); }
    if (labNum < labLine) { anomalyCount++; factors.push('【实验完成率】低于' + labLine + '%'); }
    if (attMetric.kind === 'count') factors.push('【出勤】' + attMetric.raw + '（缺出勤率数据，需人工核实）');
    if (hwMetric.kind === 'count') factors.push('【作业】' + hwMetric.raw + '（缺提交率数据，需人工核实）');
    if (labMetric.kind === 'count') factors.push('【实验】' + labMetric.raw + '（缺完成率数据，需人工核实）');
    details.push({ field: '出勤率', score: attNum });
    details.push({ field: '作业提交率', score: hwNum });
    details.push({ field: '实验完成率', score: labNum });
    var level = anomalyCount >= 2 ? '高' : anomalyCount >= 1 ? '中' : '低';
    return {
      score: Math.max(0, 100 - anomalyCount * 25), level: level,
      color: level === '高' ? '#d93025' : level === '中' ? '#e37400' : '#0d904f',
      details: details, factors: factors
    };
  },

  /**
   * 可选的维度明细（PROMPT-02 预警解释卡使用）。
   * 契约：factors 各项 contribution 之和 === score，且 score === score(data).score。
   * 这里用「100 分基准 + 每项异常扣分」的方式表达：
   * 扣分总额 = 100 - score，均摊到各异常项（最后一项吸收取整差额），所以求和精确。
   */
  detail: function (data, options) {
    var failLine = (options && options.failLine !== undefined) ? options.failLine : 60;
    var attLine = (options && options.attLine !== undefined) ? options.attLine : 80;
    var hwLine = (options && options.hwLine !== undefined) ? options.hwLine : 70;
    var labLine = (options && options.labLine !== undefined) ? options.labLine : 70;
    var g = data.grades || '';
    var fields = ['高数', '英语', '编程', '计算机基础'];
    var anomalies = [];
    for (var i = 0; i < fields.length; i++) {
      var m = g.match(new RegExp(fields[i] + '[^0-9]*(\\d+)'));
      if (!m) continue;
      var sc = parseInt(m[1], 10);
      if (sc < failLine) anomalies.push({ dim: 'grade', label: fields[i] + '不及格', rawValue: sc + ' 分', hit: true });
    }
    var attMetric = TextMetrics.asRate(data.attendance, 100);
    var hwMetric = TextMetrics.asRate(data.homework, 100);
    var labMetric = TextMetrics.asRate(data.labReport, 100);
    var attNum = attMetric.value;
    var hwNum = hwMetric.value;
    var labNum = labMetric.value;
    if (attNum < attLine) anomalies.push({ dim: 'attendance', label: '出勤率低于' + attLine + '%', rawValue: attNum + '%', hit: true });
    if (hwNum < hwLine) anomalies.push({ dim: 'homework', label: '作业提交率低于' + hwLine + '%', rawValue: hwNum + '%', hit: true });
    if (labNum < labLine) anomalies.push({ dim: 'experiment', label: '实验完成率低于' + labLine + '%', rawValue: labNum + '%', hit: true });

    var manualChecks = [];
    if (attMetric.kind === 'count') manualChecks.push({ dim: 'attendance', label: '出勤率需人工核实', rawValue: attMetric.raw + '（缺出勤率数据）', hit: false });
    if (hwMetric.kind === 'count') manualChecks.push({ dim: 'homework', label: '作业提交率需人工核实', rawValue: hwMetric.raw + '（缺提交率数据）', hit: false });
    if (labMetric.kind === 'count') manualChecks.push({ dim: 'experiment', label: '实验完成率需人工核实', rawValue: labMetric.raw + '（缺完成率数据）', hit: false });

    var score = Math.max(0, 100 - anomalies.length * 25);
    var out = [];
    if (!anomalies.length) {
      out.push({ dim: 'base', label: '四项考核均达标', rawValue: '—', weight: 1, contribution: 100, hit: false });
      for (var mc0 = 0; mc0 < manualChecks.length; mc0++) {
        manualChecks[mc0].weight = 0; manualChecks[mc0].contribution = 0; out.push(manualChecks[mc0]);
      }
      return { score: score, factors: out };
    }
    var deductTotal = Math.round((100 - score) * 10) / 10;
    var per = Math.round((deductTotal / anomalies.length) * 10) / 10;
    var used = 0;
    out.push({ dim: 'base', label: '基准分', rawValue: '100', weight: 0, contribution: 100, hit: false });
    for (var j = 0; j < anomalies.length; j++) {
      var d = (j === anomalies.length - 1) ? Math.round((deductTotal - used) * 10) / 10 : per;
      used += d;
      out.push({ dim: anomalies[j].dim, label: anomalies[j].label, rawValue: anomalies[j].rawValue, weight: 0.25, contribution: -d, hit: true });
    }
    for (var mc = 0; mc < manualChecks.length; mc++) {
      manualChecks[mc].weight = 0; manualChecks[mc].contribution = 0; out.push(manualChecks[mc]);
    }
    return { score: score, factors: out };
  }
});
