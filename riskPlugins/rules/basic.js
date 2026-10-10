// 基础宽松版：仅对不及格科目扣分，缺失数据不扣分
RiskPluginManager.register('basic', {
  description: '仅对不及格科目（<60分）扣分，缺失数据项不扣分。适合快速筛查严重学业问题的学生。',
  name: '基础宽松版',
  score: function(data, options) {
    // 可选阈值覆盖（政策沙盒影子模式使用）。不传 options 时行为与之前完全一致。
    var failLine = (options && options.failLine !== undefined) ? options.failLine : 60;
    var g = data.grades || '';
    var fields = ['高数','英语','编程','计算机基础'];
    var total = 0, count = 0, details = [];
    var riskCount = 0;
    for (var i = 0; i < fields.length; i++) {
      var re = new RegExp(fields[i] + '[^0-9]*(\\d+)');
      var m = g.match(re);
      var sc = m ? parseInt(m[1], 10) : -1;
      if (sc >= 0) {
        total += sc; count++;
        details.push({ field: fields[i], score: sc, penalty: sc < failLine ? (failLine - sc) : 0 });
        if (sc < failLine) riskCount++;
      }
    }
    var avg = count > 0 ? Math.round(total / count) : 100;
    var level;
    if (riskCount >= 2) level = '高';
    else if (riskCount >= 1) level = '中';
    else level = '低';
    return {
      score: avg, level: level,
      color: level === '高' ? '#d93025' : level === '中' ? '#e37400' : '#0d904f',
      details: details,
      factors: riskCount > 0 ? ['基础宽松版检测到 ' + riskCount + ' 门不及格科目'] : []
    };
  },

  /**
   * 可选的维度明细（PROMPT-02 预警解释卡使用）。
   * 契约：返回 { score, factors[] }，factors 各项 contribution 之和 === score，
   * 且 score 必须与 score(data).score 完全一致（有自动化一致性检查）。
   * 本方法不参与打分，纯展示用，因此不改变原有评分行为。
   */
  detail: function (data, options) {
    var failLine = (options && options.failLine !== undefined) ? options.failLine : 60;
    var g = data.grades || '';
    var fields = ['高数', '英语', '编程', '计算机基础'];
    var found = [];
    for (var i = 0; i < fields.length; i++) {
      var m = g.match(new RegExp(fields[i] + '[^0-9]*(\\d+)'));
      if (m) found.push({ field: fields[i], sc: parseInt(m[1], 10) });
    }
    var out = [];
    if (!found.length) {
      out.push({ dim: 'grade', label: '成绩数据缺失', rawValue: '—', weight: 1, contribution: 100, hit: false });
      return { score: 100, factors: out };
    }
    var total = 0;
    for (var t = 0; t < found.length; t++) total += found[t].sc;
    var score = Math.round(total / found.length);
    var used = 0;
    for (var j = 0; j < found.length; j++) {
      var share = (j === found.length - 1) ? Math.round((score - used) * 10) / 10 : Math.round((found[j].sc / found.length) * 10) / 10;
      used += share;
      out.push({
        dim: 'grade', label: found[j].field, rawValue: found[j].sc + ' 分',
        weight: Math.round((1 / found.length) * 100) / 100,
        contribution: share, hit: found[j].sc < failLine
      });
    }
    return { score: score, factors: out };
  }
});
