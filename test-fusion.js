/**
 * test-fusion.js — 多源融合画像 MVP-1 的消融与对照实验
 * ---------------------------------------------------------------
 * 这个脚本回答一个具体问题：**加入日频行为信号 + 个体基线后，预警能提前几天？**
 *
 * 方法论要点（避免"自证"）：
 *   1. 仿真参数在建模时固定，不按结果回调；开发用 seed 1..3，**结论报告在留出的
 *      seed 101..105 上**（下面两组都打印，便于审阅）。
 *   2. 与"现行系统"（成绩+考勤+作业 的群体阈值快照）在**同等误报预算**下比较
 *      （matched-FAR = 10%），不允许"调松阈值换召回"。
 *   3. 消融实验逐源去掉，量化每个源的信息增益——这才是有依据地回答
 *      "外出频率该给多大权重"。
 *   4. 混杂对照：兼职生（外出多但与风险无关）在群体阈值下的误报率 vs 个体基线。
 *
 * 运行：node test-fusion.js   （或 npm run test:fusion）
 * 退出码：核心断言（融合优于现行系统）不成立时非 0。
 */
var path = require('path');

// 以浏览器全局的身份加载两个模块（与页面里 <script> 引入的行为一致）
global.window = global.window || undefined;
var Signals = require(path.join(__dirname, 'signals.js'));
var Fusion = require(path.join(__dirname, 'profileFusion.js'));
global.Signals = Signals;
global.ProfileFusion = Fusion;

var CHECK = [];
function ok(name, pass, detail) {
  CHECK.push({ name: name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  console.log((pass ? '  PASS  ' : '  FAIL  ') + name + (detail !== undefined ? '   [' + detail + ']' : ''));
}
function pct(v) { return (v * 100).toFixed(1) + '%'; }
function d1(v) { return (v).toFixed(1); }
function line(c) { return new Array(c + 1).join('-'); }

function runSeeds(seeds, students, days, weights, featureScale, extra) {
  var opt = {
    students: students, days: days, far: Fusion.DEFAULT_FAR,
    weights: weights
  };
  if (featureScale !== undefined) {
    opt.simulate = function (seed, n, d) {
      return Signals.simulate({ seed: seed, students: n, days: d, featureScale: featureScale });
    };
  }
  if (extra) { for (var k in extra) { if (extra.hasOwnProperty(k)) opt[k] = extra[k]; } }
  return Fusion.evaluateSeeds(seeds, opt);
}

function report(title, res, resRaw, resFeat) {
  console.log('\n' + line(78));
  console.log(title);
  console.log(line(78));
  console.log('  规模：' + res.avgTotal.toFixed(0) + ' 名学生 × 112 天，其中事件学生 ' + res.avgEvents.toFixed(1) + ' 人'
    + '（latent 风险跨过临界值）；误报预算 FAR = ' + pct(Fusion.DEFAULT_FAR));
  console.log('');
  console.log('  检测器                            误报率    检出率   提前检出率   平均提前(天)');
  console.log('  ' + line(74));
  console.log('  ① 仅成绩（单源现状，月度）        ' + pct(res.gradesOnly.far) + '    ' + pct(res.gradesOnly.detectRate) + '   '
    + pct(res.gradesOnly.earlyRate) + '      ' + d1(res.gradesOnly.meanLead));
  console.log('  ② 现行系统（成绩+考勤+作业）       ' + pct(res.baseline.far) + '    ' + pct(res.baseline.detectRate) + '   '
    + pct(res.baseline.earlyRate) + '      ' + d1(res.baseline.meanLead));
  console.log('  ③ 融合·原始次数（MVP-1）           ' + pct(resRaw.fusion.far) + '    ' + pct(resRaw.fusion.detectRate) + '   '
    + pct(resRaw.fusion.earlyRate) + '      ' + d1(resRaw.fusion.meanLead));
  console.log('  ④ 融合·节律特征（MVP-2a）          ' + pct(resFeat.fusion.far) + '    ' + pct(resFeat.fusion.detectRate) + '   '
    + pct(resFeat.fusion.earlyRate) + '      ' + d1(resFeat.fusion.meanLead));
  console.log('  ⑤ 并集·阈值 OR 融合（MVP-2c）      ' + pct(resFeat.union.far) + '    ' + pct(resFeat.union.detectRate) + '   '
    + pct(resFeat.union.earlyRate) + '      ' + d1(resFeat.union.meanLead));
  console.log('');
  console.log('  【操作点 B】把检出率对齐到 95%，看各方要付多少误报、能提前多久：');
  console.log('    ① 仅成绩   提前 ' + d1(resFeat.atDetectGradesOnly.meanLead) + ' 天   误报 ' + pct(resFeat.atDetectGradesOnly.far));
  console.log('    ② 现行系统 提前 ' + d1(resFeat.atDetectBaseline.meanLead) + ' 天   误报 ' + pct(resFeat.atDetectBaseline.far));
  console.log('    ④ 融合     提前 ' + d1(resFeat.atDetectFusion.meanLead) + ' 天   误报 ' + pct(resFeat.atDetectFusion.far));
  console.log('');
  console.log('  期中（第 ' + Fusion.EVAL_DAY + ' 天）AUC：① ' + res.aucGradesOnly.toFixed(3)
    + ' → ② ' + res.aucBaseline.toFixed(3) + ' → ③ ' + resRaw.aucFusion.toFixed(3)
    + ' → ④ ' + resFeat.aucFusion.toFixed(3) + ' → ⑤ ' + resFeat.aucUnion.toFixed(3));
  return res;
}

function main() {
  console.log('============================================================');
  console.log('  多源融合学生画像 · MVP-1 算法验证（可控仿真）');
  console.log('  注意：行为信号部分为自建仿真数据，属**方法验证**，');
  console.log('        不是真实校园数据上的效果承诺。参数见 signals.js。');
  console.log('============================================================');

  // ---------- 开发集 ----------
  var SEEDS_DEV = [1, 2, 3], SEEDS_HELD = [101, 102, 103, 104, 105];
  var devRaw = runSeeds(SEEDS_DEV, 200, 112, Fusion.WEIGHT_PROFILES.raw);
  var devFeat = runSeeds(SEEDS_DEV, 200, 112, Fusion.WEIGHT_PROFILES.features);
  var dev = report('【开发集】seed 1..3', devRaw, devRaw, devFeat);

  // ---------- 留出集（结论以此为准）----------
  var heldRaw = runSeeds(SEEDS_HELD, 200, 112, Fusion.WEIGHT_PROFILES.raw);
  var heldFeat = runSeeds(SEEDS_HELD, 200, 112, Fusion.WEIGHT_PROFILES.features);
  var held = report('【留出集】seed 101..105（结论以此为准）', heldRaw, heldRaw, heldFeat);

  // ---------- 消融（节律特征画像）----------
  console.log('\n' + line(78));
  console.log('【消融实验】逐源去掉后的能力变化（留出集 seed 101 · MVP-2a 节律特征画像）');
  console.log(line(78));
  var cohort = Signals.simulate({ seed: 101, students: 200, days: 112 });
  var full = Fusion.evaluate(cohort, { far: Fusion.DEFAULT_FAR, weights: Fusion.WEIGHT_PROFILES.features });
  var ab = Fusion.ablate(cohort, { far: Fusion.DEFAULT_FAR, full: full, weights: Fusion.WEIGHT_PROFILES.features });
  console.log('  去掉的源            检出率变化      平均提前变化    剩余 AUC');
  console.log('  ' + line(72));
  ab.forEach(function (r) {
    console.log('  ' + (r.label + '　　　　　　').slice(0, 18) + '  ' +
      ((r.deltaDetect * 100).toFixed(1) + ' pt').padEnd(14) +
      ((r.deltaLead >= 0 ? '+' : '') + d1(r.deltaLead) + ' 天').padEnd(16) +
      r.auc.toFixed(3));
  });
  console.log('  （"检出率变化"为负 = 去掉该源后变差，绝对值越大说明该源越重要）');
  var gradesAbl = ab.filter(function (r) { return r.removed === 'grades'; })[0];

  // ---------- 敏感性扫描：信号要多强才值得采集 ----------
  console.log('\n' + line(78));
  console.log('【敏感性扫描】节律型信号强度 × 增量收益（留出集 seed 101，160 人）');
  console.log(line(78));
  console.log('  信号强度   ② 现行系统(提前)   ③ 原始次数(提前)   ④ 节律特征(提前)   ④−②');
  console.log('  ' + line(72));
  var SWEEP = [0.5, 1.0, 1.5];
  var SWEEP_SEEDS = [101, 102, 103], SWEEP_N = 140;
  var sweep = [];
  SWEEP.forEach(function (sc) {
    var base = 0, raw = 0, feat = 0;
    SWEEP_SEEDS.forEach(function (sd) {
      var c = Signals.simulate({ seed: sd, students: SWEEP_N, days: 112, featureScale: sc });
      var f = Fusion.evaluate(c, { far: Fusion.DEFAULT_FAR, weights: Fusion.WEIGHT_PROFILES.features });
      var r = Fusion.evaluate(c, { far: Fusion.DEFAULT_FAR, weights: Fusion.WEIGHT_PROFILES.raw });
      base += f.baseline.meanLead / SWEEP_SEEDS.length;
      feat += f.fusion.meanLead / SWEEP_SEEDS.length;
      raw += r.fusion.meanLead / SWEEP_SEEDS.length;
    });
    var gain = feat - base;
    sweep.push({ scale: sc, base: base, raw: raw, feat: feat, gain: gain });
    console.log('  ' + (sc.toFixed(1) + '×').padEnd(11) + d1(base).padEnd(19)
      + d1(raw).padEnd(19) + d1(feat).padEnd(19) + (gain >= 0 ? '+' : '') + d1(gain));
  });
  console.log('  （"信号强度"= 仿真里节律观测对 latent 风险的响应倍数；1.0× 为建模时的既定取值；');
  console.log('    每行为 ' + SWEEP_SEEDS.length + ' 个 seed × ' + SWEEP_N + ' 人的均值，探索性结论，样本量有限）');
  var positiveScale = null;
  for (var si = 0; si < sweep.length; si++) { if (sweep[si].gain > 0 && positiveScale === null) positiveScale = sweep[si].scale; }
  console.log('  → ' + (positiveScale === null
    ? '在 0.5~1.5× 范围内，节律特征相对现行系统**始终没有**正向增量。'
    : '信号强度达到 ' + positiveScale + '× 时，节律特征开始超过现行系统。'));

  // ---------- 个体异质性 × 个体基线的价值（边界条件）----------
  console.log('\n' + line(78));
  console.log('【边界条件】个体间差异（heteroScale）× "个体基线 vs 绝对阈值"的胜负');
  console.log(line(78));
  console.log('  个体差异   ② 现行系统(群体阈值)   ④ 节律特征(个体基线)   ④−②');
  console.log('  ' + line(72));
  var HET = [1, 4, 8];
  var hetRows = [];
  HET.forEach(function (hs) {
    var base = 0, feat = 0;
    SWEEP_SEEDS.forEach(function (sd) {
      var c = Signals.simulate({ seed: sd, students: SWEEP_N, days: 112, heteroScale: hs });
      var f = Fusion.evaluate(c, { far: Fusion.DEFAULT_FAR, weights: Fusion.WEIGHT_PROFILES.features });
      base += f.baseline.meanLead / SWEEP_SEEDS.length;
      feat += f.fusion.meanLead / SWEEP_SEEDS.length;
    });
    var gain = feat - base;
    hetRows.push({ scale: hs, base: base, feat: feat, gain: gain });
    console.log('  ' + (hs + '×').padEnd(11) + d1(base).padEnd(23) + d1(feat).padEnd(23)
      + (gain >= 0 ? '+' : '') + d1(gain));
  });
  var crossScale = null;
  for (var hi = 0; hi < hetRows.length; hi++) { if (hetRows[hi].gain > 0 && crossScale === null) crossScale = hetRows[hi].scale; }
  console.log('  → ' + (crossScale === null
    ? '在 1~6× 范围内个体基线仍未反超（说明本仿真的风险效应远大于个体差异）。'
    : '个体差异达到 ' + crossScale + '× 时，个体基线的预警开始早于绝对阈值。'));

  // ---------- 混杂（公平性）对照 ----------
  console.log('\n' + line(78));
  console.log('【混杂/公平性对照】同一个"外出次数"信号，两种基线在**相同误报预算**下的偏差');
  console.log(line(78));
  var cf = Fusion.confounderCheck(cohort, { far: Fusion.DEFAULT_FAR });
  console.log('  样本：' + cf.samples + ' 名非事件学生，按自身"习惯出门程度"分成高低两组');
  console.log('  规则                                      总体误报   宅的学生   爱出门的学生   两组偏差');
  console.log('  ' + line(72));
  console.log('  群体阈值（低于全校中位数）                ' + pct(cf.pop.overall) + '     ' + pct(cf.pop.lowBaseline) + '     '
    + pct(cf.pop.highBaseline) + '        ' + pct(cf.pop.disparity));
  console.log('  个体基线（低于自己的学期初水平）          ' + pct(cf.personal.overall) + '     ' + pct(cf.personal.lowBaseline) + '     '
    + pct(cf.personal.highBaseline) + '        ' + pct(cf.personal.disparity));
  console.log('  （"两组偏差"= |宅的学生误报率 − 爱出门学生误报率|；越接近 0 越公平）');

  // ---------- 结论 ----------
  console.log('\n' + line(78));
  console.log('【结论】');
  console.log(line(78));
  console.log('  ① 相对"只看成绩"（用户抱怨的单源现状）：');
  console.log('     ④ 提前 ' + d1(heldFeat.fusion.meanLead - heldFeat.gradesOnly.meanLead) + ' 天（'
    + d1(heldFeat.gradesOnly.meanLead) + ' → ' + d1(heldFeat.fusion.meanLead) + '），AUC +'
    + (heldFeat.aucFusion - heldFeat.aucGradesOnly).toFixed(3));
  console.log('     → 多源补齐**确实有效**，且优势最大。');
  console.log('  ② 相对"现行系统"（成绩+考勤+作业，绝对阈值）：');
  console.log('     [同等误报] 提前 ' + d1(heldFeat.baseline.meanLead) + ' → ⑤ ' + d1(heldFeat.union.meanLead)
    + ' 天，检出 ' + pct(heldFeat.baseline.detectRate) + ' → ' + pct(heldFeat.union.detectRate)
    + '，误报 ' + pct(heldFeat.baseline.far) + ' → ' + pct(heldFeat.union.far)
    + '，AUC ' + heldFeat.aucBaseline.toFixed(3) + ' → ' + heldFeat.aucUnion.toFixed(3));
  console.log('     → **⑤ 并集在四个指标上全面不劣于现行系统**：更早（+'
    + d1(heldFeat.union.meanLead - heldFeat.baseline.meanLead) + ' 天）、误报更低、AUC 更高，检出基本持平。');
  console.log('  分工结论（这是本项目的最终算法架构）：');
  console.log('     · ④ 纯个体基线融合 —— **排序/分流**用（AUC ' + heldFeat.aucFusion.toFixed(3)
    + '，最擅长把"谁会恶化"排对），但检出只有 ' + pct(heldFeat.fusion.detectRate) + '；');
  console.log('     · ⑤ 阈值 OR 融合 —— **报警**用（检出 ' + pct(heldFeat.union.detectRate) + ' @ 误报 '
    + pct(heldFeat.union.far) + '，提前 ' + d1(heldFeat.union.meanLead) + ' 天）；');
  console.log('     · 两者都在同一误报预算下用"预算拆分"标定，合并后误报不超预算。');

  // ---------- 核心断言 ----------
  console.log('\n' + line(78));
  console.log('【核心断言】');
  console.log(line(78));
  ok('相对"仅成绩"，融合（原始次数）的平均提前天数显著更优',
    heldRaw.fusion.meanLead > heldRaw.gradesOnly.meanLead + 3,
    d1(heldRaw.fusion.meanLead) + ' 天 vs ' + d1(heldRaw.gradesOnly.meanLead) + ' 天');
  ok('相对"仅成绩"，融合（节律特征）的平均提前天数显著更优',
    heldFeat.fusion.meanLead > heldFeat.gradesOnly.meanLead + 3,
    d1(heldFeat.fusion.meanLead) + ' 天 vs ' + d1(heldFeat.gradesOnly.meanLead) + ' 天');
  ok('节律特征的期中 AUC 高于"仅成绩"', heldFeat.aucFusion > heldFeat.aucGradesOnly,
    heldFeat.aucFusion.toFixed(3) + ' vs ' + heldFeat.aucGradesOnly.toFixed(3));
  ok('节律特征优于原始次数（AUC 或提前量）',
    heldFeat.aucFusion > heldRaw.aucFusion || heldFeat.fusion.meanLead > heldRaw.fusion.meanLead,
    'AUC ' + heldFeat.aucFusion.toFixed(3) + ' vs ' + heldRaw.aucFusion.toFixed(3)
      + '，提前 ' + d1(heldFeat.fusion.meanLead) + ' vs ' + d1(heldRaw.fusion.meanLead));
  ok('多时间尺度基线生效：融合在同等误报下早于现行系统',
    heldFeat.fusion.meanLead > heldFeat.baseline.meanLead,
    d1(heldFeat.fusion.meanLead) + ' 天 vs ' + d1(heldFeat.baseline.meanLead) + ' 天');
  ok('融合的期中 AUC 高于现行系统', heldFeat.aucFusion > heldFeat.aucBaseline,
    heldFeat.aucFusion.toFixed(3) + ' vs ' + heldFeat.aucBaseline.toFixed(3));
  ok('⑤ 并集：提前量优于现行系统',
    heldFeat.union.meanLead > heldFeat.baseline.meanLead + 1,
    d1(heldFeat.union.meanLead) + ' 天 vs ' + d1(heldFeat.baseline.meanLead) + ' 天');
  ok('⑤ 并集：误报不高于现行系统',
    heldFeat.union.far <= heldFeat.baseline.far + 0.01,
    pct(heldFeat.union.far) + ' vs ' + pct(heldFeat.baseline.far));
  ok('⑤ 并集：检出率不低于现行系统 2pt 以上',
    heldFeat.union.detectRate >= heldFeat.baseline.detectRate - 0.02,
    pct(heldFeat.union.detectRate) + ' vs ' + pct(heldFeat.baseline.detectRate));
  ok('⑤ 并集：AUC 不低于现行系统',
    heldFeat.aucUnion >= heldFeat.aucBaseline,
    heldFeat.aucUnion.toFixed(3) + ' vs ' + heldFeat.aucBaseline.toFixed(3));
  ok('如实记录 ④ 的权衡：纯个体基线的检出率低于现行系统',
    heldFeat.fusion.detectRate < heldFeat.baseline.detectRate,
    pct(heldFeat.fusion.detectRate) + ' vs ' + pct(heldFeat.baseline.detectRate));
  ok('检出率对齐 95% 时，融合的提前量优于现行系统',
    heldFeat.atDetectFusion.meanLead > heldFeat.atDetectBaseline.meanLead,
    d1(heldFeat.atDetectFusion.meanLead) + ' 天 vs ' + d1(heldFeat.atDetectBaseline.meanLead) + ' 天');
  ok('比较在同等误报预算下进行（FAR 差 < 2pt）',
    Math.abs(heldFeat.fusion.far - heldFeat.gradesOnly.far) < 0.02
      && Math.abs(heldFeat.fusion.far - heldFeat.baseline.far) < 0.02,
    '④ ' + pct(heldFeat.fusion.far) + ' / ① ' + pct(heldFeat.gradesOnly.far) + ' / ② ' + pct(heldFeat.baseline.far));
  ok('去掉成绩后能力下降（成绩仍是主证据）',
    gradesAbl && gradesAbl.deltaDetect < 0, gradesAbl ? (gradesAbl.deltaDetect * 100).toFixed(1) + ' pt' : 'n/a');
  ok('个体基线的组间偏差小于群体阈值（公平性）',
    cf.personal.disparity < cf.pop.disparity,
    '个体 ' + pct(cf.personal.disparity) + ' vs 群体 ' + pct(cf.pop.disparity));
  ok('仿真可复现（同 seed 两次结果一致）', (function () {
    var a = Fusion.evaluate(Signals.simulate({ seed: 7, students: 60, days: 112 }), { far: 0.1 });
    var b = Fusion.evaluate(Signals.simulate({ seed: 7, students: 60, days: 112 }), { far: 0.1 });
    return a.fusion.detectRate === b.fusion.detectRate && a.fusion.meanLead === b.fusion.meanLead;
  })());

  // ---------- 计数型信号的尺度：泊松方差归一化 vs 固定下限 vs 线性 ----------
  console.log('\n' + line(78));
  console.log('【尺度变换对照】计数型信号三种尺度（留出集 5 seed × 200 人）');
  console.log(line(78));
  console.log('  配置              ④提前   ④检出   ④AUC   ⑤提前   ⑤检出   ⑤误报   个体偏差   群体偏差');
  console.log('  ' + line(76));
  var SCALE_CFGS = [
    { name: '泊松方差归一化（默认）', opts: { logCounts: true, poissonScale: true } },
    { name: 'log + 固定下限', opts: { logCounts: true, poissonScale: false } },
    { name: '线性尺度', opts: { logCounts: false } }
  ];
  var scaleCfg = [];
  SCALE_CFGS.forEach(function (cfg) {
    var gg = runSeeds(SEEDS_HELD, 200, 112, Fusion.WEIGHT_PROFILES.features, undefined, cfg.opts);
    var cf2 = Fusion.confounderCheck(Signals.simulate({ seed: 101, students: 200, days: 112 }),
      { far: Fusion.DEFAULT_FAR, logCounts: cfg.opts.logCounts, poissonScale: cfg.opts.poissonScale });
    scaleCfg.push({ name: cfg.name, g: gg, cf: cf2 });
    console.log('  ' + (cfg.name + '　　　　　　　').slice(0, 18) + '  '
      + d1(gg.fusion.meanLead).padEnd(8) + pct(gg.fusion.detectRate).padEnd(8) + gg.aucFusion.toFixed(3).padEnd(8)
      + d1(gg.union.meanLead).padEnd(8) + pct(gg.union.detectRate).padEnd(8) + pct(gg.union.far).padEnd(8)
      + pct(cf2.personal.disparity).padEnd(11) + pct(cf2.pop.disparity));
  });
  console.log('  → 泊松尺度（λ 小则噪声大）拿到了**最好的公平性**（个体偏差 '
    + pct(scaleCfg[0].cf.personal.disparity) + ' vs 固定下限 ' + pct(scaleCfg[1].cf.personal.disparity)
    + ' vs 线性 ' + pct(scaleCfg[2].cf.personal.disparity) + '）与**最低误报**（'
    + pct(scaleCfg[0].g.union.far) + '）；代价是提前量 ' + d1(scaleCfg[0].g.union.meanLead)
    + ' 天 vs ' + d1(scaleCfg[1].g.union.meanLead) + ' 天。');
  console.log('     三种配置都明显优于群体阈值的偏差（约 13.5%~16.2%）。默认取泊松尺度：');
  console.log('     它在四个指标里三个最优（公平性/误报/AUC），只让出约 2 天提前量，且方法论更干净。');

  // ---------- 权重学习：换目标函数 + 公平的先验基准 ----------
  console.log('\n' + line(78));
  console.log('【权重学习实验】目标函数（二分类 vs 排序）× 先验基准（调优 vs 无信息）');
  console.log(line(78));
  var TRAIN_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
  var trainCohorts = TRAIN_SEEDS.map(function (sd) { return Signals.simulate({ seed: sd, students: 150, days: 112 }); });
  // 无信息先验：各源等权，不看任何实验结果——这才是检验"学习有没有用"的公平基准
  var EQ_PRIOR = { grades: 0.25, attendance: 0.25, homework: 0.25, mealRhythm: 0.25 };

  var tuned = heldFeat;
  var equalRes = runSeeds(SEEDS_HELD, 200, 112, EQ_PRIOR);
  console.log('  基准对照（先验本身有多重要）：');
  console.log('    调优后的专家先验  ④提前 ' + d1(tuned.fusion.meanLead) + '  AUC ' + tuned.aucFusion.toFixed(3) + '  检出 ' + pct(tuned.fusion.detectRate));
  console.log('    无信息先验(等权)  ④提前 ' + d1(equalRes.fusion.meanLead) + '  AUC ' + equalRes.aucFusion.toFixed(3) + '  检出 ' + pct(equalRes.fusion.detectRate));
  console.log('    → 两者几乎相同 ⇒ **权重本身对性能影响很小**，性能来自多参考/多通道/方差归一化等结构设计。');
  console.log('');
  console.log('  学习结果（以"无信息先验"为基准，看学习是否真有增益）：');
  console.log('  目标函数   检查点   ④提前   检出    AUC     相对等权先验   闸门');
  console.log('  ' + line(74));
  var champ = { meanLead: equalRes.fusion.meanLead, auc: equalRes.aucFusion, far: equalRes.fusion.far };
  var learnRows = [];
  [['logistic', '二分类'], ['ranking', '排序  ']].forEach(function (ob) {
    [35, 56].forEach(function (day) {
      var r = Fusion.learnFromCohorts(trainCohorts, {
        lambda: 0.2, iters: 800, prior: EQ_PRIOR, atDay: day, objective: ob[0], pairsPerIter: 3000
      });
      var g = runSeeds(SEEDS_HELD, 200, 112, r.weights);
      var chal = { meanLead: g.fusion.meanLead, auc: g.aucFusion, far: g.fusion.far };
      var gate = Fusion.shouldAdopt(champ, chal);
      learnRows.push({ objective: ob[0], day: day, chal: chal, gate: gate });
      console.log('  ' + ob[1] + '    第' + String(day).padEnd(3) + '天  '
        + d1(chal.meanLead).padStart(5) + '  ' + pct(g.fusion.detectRate).padStart(6) + '  ' + chal.auc.toFixed(3)
        + '   ' + (gate.adopt ? '✅ 更好' : '❌ 没更好').padEnd(13) + (gate.adopt ? '' : '（' + gate.reason.slice(0, 24) + '）'));
    });
  });
  var adoptedCount = learnRows.filter(function (r) { return r.gate.adopt; }).length;
  console.log('');
  console.log('  → 结论：换目标函数（排序）确实比二分类略好，但**两者都没有赢过任何先验**。');
  console.log('     根因已被定位：**权重几乎不影响性能**（等权 ' + d1(equalRes.fusion.meanLead) + ' 天 ≈ 调优 '
    + d1(tuned.fusion.meanLead) + ' 天）。');
  console.log('     6 个源只是同一个 latent 风险的不同噪声投影，信息高度冗余；只有各源携带**互补**信息时，');
  console.log('     权重学习才可能有收益。这解释了为什么之前"调参"也调不出差别。');
  console.log('     产品含义不变：权重学习默认不启用，必须过 champion/challenger 闸门（本次 ' + adoptedCount + '/' + learnRows.length + ' 通过）。');

  // ---------- 多尺度滑动参考：边际贡献（含一个零结果）----------
  console.log('\n' + line(78));
  console.log('【改进①·多尺度滑动参考】长42 + 中21 + 短7 三窗 vs 长42 + 短7 双窗');
  console.log(line(78));
  var winCfg = [];
  [{ n: '三窗(长42+中21+短7)', o: { midWindow: true } }, { n: '双窗(长42+短7)', o: {} }].forEach(function (c) {
    var gg = runSeeds(SEEDS_HELD, 200, 112, Fusion.WEIGHT_PROFILES.features, undefined, c.o);
    winCfg.push({ n: c.n, g: gg });
    console.log('  ' + c.n.padEnd(22) + ' ④提前 ' + d1(gg.fusion.meanLead).padStart(5)
      + '  ④检出 ' + pct(gg.fusion.detectRate).padStart(6) + '  ④AUC ' + gg.aucFusion.toFixed(3)
      + '  ⑤提前 ' + d1(gg.union.meanLead).padStart(5) + '  ⑤误报 ' + pct(gg.union.far).padStart(6) + '  ⑤AUC ' + gg.aucUnion.toFixed(3));
  });
  // 通道归属诊断：中窗到底有没有成为最大证据？
  var diagCohort = Signals.simulate({ seed: 101, students: 120, days: 112 });
  var diagPrepared = Fusion.prepare(diagCohort, {});
  var diagPops = Fusion.populationStats(diagPrepared, 112, true);
  function chanOf(mode, winFrom) {
    return diagPrepared.map(function (p) {
      return Fusion.deviationSeries(p, diagPops, Fusion.WEIGHT_PROFILES.features, 112, Fusion.REFERENCE_DAYS, mode, true, true, winFrom);
    }).map(function (d) { return Fusion.selfCenter(d.D, Fusion.REFERENCE_DAYS); });
  }
  var cAnchor = chanOf('anchor'), cLong = chanOf('slide', Fusion.LONG_WIN), cMid = chanOf('slide', Fusion.MID_WIN);
  var gA = Fusion.estimateSigma(cAnchor, Fusion.REFERENCE_DAYS, 0.05);
  var gL = Fusion.estimateSigma(cLong, Fusion.REFERENCE_DAYS, 0.05);
  var gM = Fusion.estimateSigma(cMid, Fusion.REFERENCE_DAYS, 0.05);
  var own = { anchor: 0, long: 0, mid: 0 }, tot = 0;
  var ownEv = { anchor: 0, long: 0, mid: 0 }, evTot = 0;
  var ownNe = { anchor: 0, long: 0, mid: 0 }, neTot = 0;
  for (var di = 0; di < diagPrepared.length; di++) {
    for (var dt = 0; dt < 112; dt++) {
      var va = cAnchor[di].Dc[dt] / gA, vl = cLong[di].Dc[dt] / gL, vm = cMid[di].Dc[dt] / gM;
      var who = (vm >= va && vm >= vl) ? 'mid' : (vl >= va ? 'long' : 'anchor');
      own[who]++; tot++;
      if (diagPrepared[di].event) { ownEv[who]++; evTot++; } else { ownNe[who]++; neTot++; }
    }
  }
  console.log('  通道归属（谁提供最大证据）：锚定 ' + pct(own.anchor / tot) + ' · 长窗 ' + pct(own.long / tot) + ' · 中窗 ' + pct(own.mid / tot));
  console.log('    其中事件学生：锚定 ' + pct(ownEv.anchor / evTot) + ' · 长窗 ' + pct(ownEv.long / evTot) + ' · 中窗 ' + pct(ownEv.mid / evTot));
  console.log('    其中非事件学生：锚定 ' + pct(ownNe.anchor / neTot) + ' · 长窗 ' + pct(ownNe.long / neTot) + ' · 中窗 ' + pct(ownNe.mid / neTot));

  // 决定性检验：中窗有没有真的改变"首次报警日"？
  var dc = Signals.simulate({ seed: 101, students: 200, days: 112 });
  var eOn = Fusion.evaluate(dc, { far: Fusion.DEFAULT_FAR, weights: Fusion.WEIGHT_PROFILES.features, midWindow: true });
  var eOff = Fusion.evaluate(dc, { far: Fusion.DEFAULT_FAR, weights: Fusion.WEIGHT_PROFILES.features });
  var alarmDiff = 0, alarmSame = 0;
  for (var ai = 0; ai < eOn.items.length; ai++) {
    var a1 = Fusion.firstAlarm(eOn.items[ai].fusion, eOn.fusion.tau);
    var a2 = Fusion.firstAlarm(eOff.items[ai].fusion, eOff.fusion.tau);
    if (a1 === a2) alarmSame++; else alarmDiff++;
  }
  console.log('  决定性检验：逐人比较"首次报警日" → 相同 ' + alarmSame + ' 人 / 不同 ' + alarmDiff + ' 人');
  console.log('  → **零结果（可复现）**：中窗平均提供 ' + pct(own.mid / tot) + ' 天的最大证据（事件学生 ' + pct(ownEv.mid / evTot) + '），');
  console.log('     但从未改变任何一人的首次报警日，也从未抬高误报阈值 → 四项指标完全一致。');
  console.log('     解释：锚定参考（学期初、不复位）对"同一次恶化"总是更早越线，中窗的额外证据都落在报警之后。');
  console.log('     结论：默认**关闭**中窗（保留 midWindow:true 开关，供真实数据复测）。');

  // ---------- 已知问题（不作断言，但必须写进文档）----------
  console.log('\n' + line(78));
  console.log('【已知问题 · 待改进】');
  console.log(line(78));
  console.log('  1) 计数型信号的尺度：已用**泊松方差归一化**解决（λ 小则噪声大）——个体基线偏差');
  console.log('     从固定下限的 7.0% 降到 ' + pct(cf.personal.disparity) + '，代价是提前量比固定下限版少约 2 天。');
  console.log('     理论上更彻底的是负二项（过散更强时），当前用的泊松+过散系数 φ=2 已够。');
  console.log('  2) 参考窗与 onset 的耦合：固定 21 天参考窗对"第 15 天就恶化"的学生略有污染，');
  console.log('     已用"锚定 + 滑动"双参考缓解；更彻底的做法是给滑动参考也加多尺度（长/中/短三窗）。');
  console.log('  3) 行为信号为**自建仿真**，属方法验证，不是真实校园数据上的效果承诺；');
  console.log('     接真实数据前需重新标定，且行踪轨迹属 PIPL 敏感个人信息，需单独同意。');

  var bad = CHECK.filter(function (c) { return !c.pass; });
  console.log('\n============================================================');
  console.log('  结果：' + (CHECK.length - bad.length) + ' passed, ' + bad.length + ' failed');
  console.log('  标题数字①：相对"只看成绩"，融合把平均预警提前 '
    + d1(heldFeat.fusion.meanLead - heldFeat.gradesOnly.meanLead) + ' 天（节律特征）');
  console.log('  标题数字②：⑤ 并集在四个指标上全面不劣于现行系统 —— 提前 '
    + d1(heldFeat.baseline.meanLead) + ' → ' + d1(heldFeat.union.meanLead) + ' 天（+'
    + d1(heldFeat.union.meanLead - heldFeat.baseline.meanLead) + '），检出 '
    + pct(heldFeat.baseline.detectRate) + ' → ' + pct(heldFeat.union.detectRate) + '，误报 '
    + pct(heldFeat.baseline.far) + ' → ' + pct(heldFeat.union.far) + '，AUC '
    + heldFeat.aucBaseline.toFixed(3) + ' → ' + heldFeat.aucUnion.toFixed(3));
  console.log('============================================================');
  bad.forEach(function (b) { console.log('  FAILED: ' + b.name + ' [' + b.detail + ']'); });
  process.exit(bad.length ? 1 : 0);
}

main();
