/**
 * config.js — 无敏感信息的安全默认配置。
 *
 * 【切换真实 API】
 *   1. apiMode 改为 'real'
 *   2. 填入 appKey / appSecret / skillId / apiKey
 *   3. 重新启动应用即可
 *
 * 【多模态能力】见 multimodal 段：
 *   ocrEngine: 'auto'     本地 Tesseract 优先，置信度低时自动升级多模态大模型
 *            | 'tesseract' 只用本地（离线免费）
 *            | 'vlm'       只用多模态大模型（识别质量最好，需联网）
 *            | 'mock'      纯模拟（答辩兜底）
 *   asrEngine: 'auto' | 'webspeech' | 'vlm' | 'mock'
 */

var CONFIG = {
  // ================================================================
  //  ⚙  API 模式：'mock' | 'real'
  // ================================================================
  apiMode: 'mock',

  // ================================================================
  //  📡  Mock 模拟配置
  // ================================================================
  mock: {
    delayMin: 1000,
    delayMax: 2500
  },

  // ================================================================
  //  🔑  金蝶真实 API 配置
  // ================================================================
  real: {
    apiBaseUrl: 'https://your-kingdee-server.com',
    tokenUrl: 'https://your-kingdee-server.com/ierp/kapi/oauth2/getToken',
    // 多模态大模型（DashScope OpenAI 兼容模式）— 同时用于 OCR / ASR / 拍照答疑
    chatUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    appKey: 'YOUR_APP_KEY',
    apiKey: 'YOUR_DASHSCOPE_API_KEY',
    appSecret: 'YOUR_APP_SECRET',
    // 任务流 skillId（三 Agent 流程：预警分析师→学业帮扶智能体→执行监督员）
    skillId: 'YOUR_SKILL_ID',
    knowledgeBaseId: 'YOUR_KNOWLEDGE_BASE_ID'
  },

  // ================================================================
  //  🧠  多模态能力配置（OCR / ASR / 拍照答疑）
  // ================================================================
  multimodal: {
    ocrEngine: 'auto',          // auto | tesseract | vlm | mock
    asrEngine: 'auto',          // auto | webspeech | vlm | mock
    vlmEngine: 'auto',          // auto | real | mock
    vlmModel: 'qwen-vl-plus',   // 视觉理解 / OCR / 解题
    asrModel: 'qwen3-asr-flash',// 语音转文字
    tesseractLang: 'chi_sim+eng',// 本地 OCR 语言（首次使用会下载并缓存）
    minOcrConfidence: 55,       // 本地 OCR 置信度低于该值 → 升级到 VLM
    minOcrChars: 4,             // 本地 OCR 结果过短 → 升级到 VLM
    enableMockFallback: true,   // 真实能力失败时回落 Mock，保证演示不断
    maxImageSide: 1280          // 上传图片压缩后的最长边
  },

  // ================================================================
  //  🎨  界面配置
  // ================================================================
  ui: {
    maxHistorySize: 50,
    resultAnimationDuration: 400
  }
};

if (typeof CONFIG_LOCAL !== 'undefined' && CONFIG_LOCAL) {
  for (var configKey in CONFIG_LOCAL) {
    if (!Object.prototype.hasOwnProperty.call(CONFIG_LOCAL, configKey)) continue;
    if (CONFIG[configKey] && typeof CONFIG[configKey] === 'object' && typeof CONFIG_LOCAL[configKey] === 'object') {
      for (var nestedKey in CONFIG_LOCAL[configKey]) {
        if (Object.prototype.hasOwnProperty.call(CONFIG_LOCAL[configKey], nestedKey)) CONFIG[configKey][nestedKey] = CONFIG_LOCAL[configKey][nestedKey];
      }
    } else {
      CONFIG[configKey] = CONFIG_LOCAL[configKey];
    }
  }
}
