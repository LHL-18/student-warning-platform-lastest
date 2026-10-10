// 风险评分插件调度器
var savedRiskPlugin = localStorage.getItem('riskPluginActive');
var RiskPluginManager = {
  plugins: {},
  activePlugin: savedRiskPlugin || 'strict',

  register: function(name, plugin) {
    if (!name || !plugin || typeof plugin.score !== 'function') return false;
    this.plugins[name] = plugin;
    return true;
  },
  setActive: function(name) {
    if (!Object.prototype.hasOwnProperty.call(this.plugins, name)) return false;
    this.activePlugin = name;
    localStorage.setItem('riskPluginActive', name);
    return true;
  },
  getActive: function() {
    if (!Object.prototype.hasOwnProperty.call(this.plugins, this.activePlugin)) {
      this.activePlugin = Object.prototype.hasOwnProperty.call(this.plugins, 'strict') ? 'strict' :
        (Object.prototype.hasOwnProperty.call(this.plugins, 'weighted') ? 'weighted' : '');
    }
    return this.activePlugin;
  },
  score: function(data, options) {
    var active = this.getActive();
    var plugin = active && Object.prototype.hasOwnProperty.call(this.plugins, active) ? this.plugins[active] : null;
    if (!plugin || typeof plugin.score !== 'function') throw new Error('没有可用的风险评分插件，请检查脚本加载顺序');
    return plugin.score(data, options);
  },
  getNames: function() {
    var names = [];
    for (var k in this.plugins) {
      if (this.plugins.hasOwnProperty(k)) names.push({id: k, name: this.plugins[k].name});
    }
    return names;
  }
};
