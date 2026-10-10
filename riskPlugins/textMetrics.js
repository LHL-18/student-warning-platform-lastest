/** 风险规则共用的文本数值解析。显式区分比率、计数和缺失，避免把 0 当成缺省值。 */
(function (global) {
  'use strict';

  function clampRate(n) {
    if (!isFinite(n)) return null;
    return Math.min(100, Math.max(0, n));
  }

  function parseRate(text, dflt) {
    if (text === undefined || text === null || String(text).trim() === '') return dflt;
    var source = String(text);
    if (source.indexOf('%') === -1 && source.indexOf('率') === -1) return dflt;
    var match = source.match(/-?\d+(?:\.\d+)?/);
    if (!match) return dflt;
    var value = clampRate(parseFloat(match[0]));
    return value === null ? dflt : value;
  }

  function parseCount(text) {
    if (text === undefined || text === null) return null;
    var source = String(text);
    if (!/(?:次|回|缺交|未交|旷课|迟到|请假)/.test(source)) return null;
    var match = source.match(/\d+(?:\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  }

  function asRate(text, dflt) {
    var source = text === undefined || text === null ? '' : String(text).trim();
    if (!source) return { kind: 'missing', value: dflt, raw: '' };
    if (source.indexOf('%') !== -1 || source.indexOf('率') !== -1) {
      return { kind: 'rate', value: parseRate(source, dflt), raw: source };
    }
    var count = parseCount(source);
    if (count !== null) return { kind: 'count', value: dflt, count: count, raw: source };
    return { kind: 'missing', value: dflt, raw: source };
  }

  global.TextMetrics = { parseRate: parseRate, parseCount: parseCount, asRate: asRate };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.TextMetrics;
})(typeof window !== 'undefined' ? window : this);
