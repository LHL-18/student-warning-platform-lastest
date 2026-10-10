// 加权综合版：高数/编程权重1.2，英语/计算机基础1.0，出勤/作业/实验按比例
RiskPluginManager.register('weighted', {
  description: '高数/编程权重1.2倍，英语/计算机基础权重1.0倍。出勤率、作业提交率、实验完成率按百分比折算计入总分。缺失项按0分计入。可在「系统设置」切换三套规则；插件的兜底默认值见 pluginManager.js。',
  name: '加权综合版',
  score: function(data, options) {
    // 可选阈值覆盖（政策沙盒影子模式使用）。不传 options 时行为与之前完全一致。
    // 注意：本规则的等级由总分区间（>=80 低 / >=40 中 / 其余 高）决定，
    // 阈值只影响 factors 文案与命中标注，不改变分数。
    var failLine = (options && options.failLine !== undefined) ? options.failLine : 60;
    var attLine = (options && options.attLine !== undefined) ? options.attLine : 70;
    var hwLine = (options && options.hwLine !== undefined) ? options.hwLine : 70;
    var labLine = (options && options.labLine !== undefined) ? options.labLine : 70;
    var g = data.grades || '';
    var fields = [{name:'高数',w:1.2},{name:'英语',w:1.0},{name:'编程',w:1.2},{name:'计算机基础',w:1.0}];
    var wTotal = 0, wSum = 0, details = [];
    var factors = [];
    for (var i = 0; i < fields.length; i++) {
      var re = new RegExp(fields[i].name + '[^0-9]*(\\d+)');
      var m = g.match(re);
      var sc = m ? parseInt(m[1], 10) : 0;
      wTotal += fields[i].w;
      wSum += sc * fields[i].w;
      details.push({ field: fields[i].name, score: sc, weight: fields[i].w, weighted: Math.round(sc * fields[i].w) });
      if (m && sc < failLine) factors.push('【' + fields[i].name + '】不及格(' + sc + '分)');
    }
    var cAvg = wTotal > 0 ? Math.round(wSum / wTotal) : 60;
    // Extract numeric attendance/homework/lab from text
    var attText = data.attendance || '';
    var hwText = data.homework || '';
    var labText = data.labReport || '';
    var attMetric = TextMetrics.asRate(attText, 100);
    var hwMetric = TextMetrics.asRate(hwText, 100);
    var labMetric = TextMetrics.asRate(labText, 100);
    var attNum = attMetric.value;
    var hwNum = hwMetric.value;
    var labNum = labMetric.value;
    attNum = Math.min(100, Math.max(0, attNum));
    hwNum = Math.min(100, Math.max(0, hwNum));
    labNum = Math.min(100, Math.max(0, labNum));
    if (attNum < attLine) factors.push('【出勤率】低于' + attLine + '%(' + attNum + '%)');
    if (hwNum < hwLine) factors.push('【作业提交率】低于' + hwLine + '%(' + hwNum + '%)');
    if (labNum < labLine) factors.push('【实验完成率】低于' + labLine + '%(' + labNum + '%)');
    if (attMetric.kind === 'count') factors.push('【出勤】' + attMetric.raw + '（缺出勤率数据，需人工核实）');
    if (hwMetric.kind === 'count') factors.push('【作业】' + hwMetric.raw + '（缺提交率数据，需人工核实）');
    if (labMetric.kind === 'count') factors.push('【实验】' + labMetric.raw + '（缺完成率数据，需人工核实）');
    details.push({ field: '出勤率', score: attNum, weight: 0.25 });
    details.push({ field: '作业提交率', score: hwNum, weight: 0.15 });
    details.push({ field: '实验完成率', score: labNum, weight: 0.1 });
    var ts = Math.round(cAvg * 0.5 + attNum * 0.25 + hwNum * 0.15 + labNum * 0.1);
    var level = ts >= 80 ? '低' : ts >= 40 ? '中' : '高';
    return {
      score: ts, level: level,
      color: level === '高' ? '#d93025' : level === '中' ? '#e37400' : '#0d904f',
      details: details, factors: factors
    };
  },

  /**
   * 可选的维度明细（PROMPT-02 预警解释卡使用）。
   * 契约：factors 各项 contribution 之和 === score，且 score === score(data).score。
   * 权重即 0.5/0.25/0.15/0.1，所以"课程均分×0.5 + 出勤×0.25 + 作业×0.15 + 实验×0.1"
   * 这四段就是各项贡献，四舍五入差额回补到第一项，保证求和精确。
   */
  detail: function (data, options) {
    var failLine = (options && options.failLine !== undefined) ? options.failLine : 60;
    var attLine = (options && options.attLine !== undefined) ? options.attLine : 70;
    var hwLine = (options && options.hwLine !== undefined) ? options.hwLine : 70;
    var labLine = (options && options.labLine !== undefined) ? options.labLine : 70;
    var g = data.grades || '';
    var fields = [{ name: '高数', w: 1.2 }, { name: '英语', w: 1.0 }, { name: '编程', w: 1.2 }, { name: '计算机基础', w: 1.0 }];
    var wTotal = 0, wSum = 0, lowSubjects = [];
    for (var i = 0; i < fields.length; i++) {
      var m = g.match(new RegExp(fields[i].name + '[^0-9]*(\\d+)'));
      var sc = m ? parseInt(m[1], 10) : 0;
      wTotal += fields[i].w;
      wSum += sc * fields[i].w;
      if (m && sc < failLine) lowSubjects.push(fields[i].name + ' ' + sc + ' 分');
    }
    var cAvg = wTotal > 0 ? Math.round(wSum / wTotal) : 60;
    var attMetric = TextMetrics.asRate(data.attendance, 100);
    var hwMetric = TextMetrics.asRate(data.homework, 100);
    var labMetric = TextMetrics.asRate(data.labReport, 100);
    var attNum = attMetric.value;
    var hwNum = hwMetric.value;
    var labNum = labMetric.value;
    var ts = Math.round(cAvg * 0.5 + attNum * 0.25 + hwNum * 0.15 + labNum * 0.1);

    var factors = [
      { dim: 'grade', label: '课程加权均分', rawValue: cAvg + ' 分', weight: 0.5, contribution: Math.round(cAvg * 0.5 * 10) / 10, hit: cAvg < 60, note: lowSubjects.join('、') },
      { dim: 'attendance', label: '出勤率', rawValue: attMetric.kind === 'count' ? attMetric.raw + '（缺出勤率数据）' : attNum + '%', weight: 0.25, contribution: Math.round(attNum * 0.25 * 10) / 10, hit: attNum < attLine },
      { dim: 'homework', label: '作业提交率', rawValue: hwMetric.kind === 'count' ? hwMetric.raw + '（缺提交率数据）' : hwNum + '%', weight: 0.15, contribution: Math.round(hwNum * 0.15 * 10) / 10, hit: hwNum < hwLine },
      { dim: 'experiment', label: '实验完成率', rawValue: labMetric.kind === 'count' ? labMetric.raw + '（缺完成率数据）' : labNum + '%', weight: 0.1, contribution: Math.round(labNum * 0.1 * 10) / 10, hit: labNum < labLine }
    ];
    var sum = 0;
    for (var k = 0; k < factors.length; k++) sum += factors[k].contribution;
    factors[0].contribution = Math.round((factors[0].contribution + (ts - sum)) * 10) / 10;  // 补齐取整差额

    return { score: ts, factors: factors };
  }
});
