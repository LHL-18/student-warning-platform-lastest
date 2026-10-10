/**
 * config.example.js — 配置模板
 *
 * 使用方式：
 *   1. 复制此文件为 config.local.js，并把变量名改为 CONFIG_LOCAL
 *   2. 按需填写 agentApi.apiKey；不要提交包含真实密钥的本地配置
 */

var CONFIG = {
  apiMode: 'mock',

  mock: {
    delayMin: 1000,
    delayMax: 2500
  },

  real: {
    apiBaseUrl: 'https://your-kingdee-server.com',
    tokenUrl: 'https://your-kingdee-server.com/ierp/kapi/oauth2/getToken',
    chatUrl: 'https://your-kingdee-server.com/kpai/URL/v2/gai/chat',
    appKey: 'YOUR_APP_KEY',
    appSecret: 'YOUR_APP_SECRET',
    skillId: 'YOUR_SKILL_ID',
    knowledgeBaseId: 'YOUR_KNOWLEDGE_BASE_ID',

    // 多模态大模型（DashScope OpenAI 兼容模式）— OCR / ASR / 拍照答疑共用
    apiKey: 'YOUR_DASHSCOPE_API_KEY'
  },

  // 三 Agent 独立大模型配置；不影响 OCR / ASR 的模型设置。
  agentApi: {
    chatUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-flash',
    apiKey: 'YOUR_DEEPSEEK_API_KEY'
  },

  // 多模态能力：OCR / ASR / 拍照答疑
  multimodal: {
    ocrEngine: 'auto',           // auto | tesseract | vlm | mock
    asrEngine: 'auto',           // auto | webspeech | vlm | mock
    vlmEngine: 'auto',           // auto | real | mock
    vlmModel: 'qwen-vl-plus',
    asrModel: 'qwen3-asr-flash',
    tesseractLang: 'chi_sim+eng',
    minOcrConfidence: 55,
    minOcrChars: 4,
    enableMockFallback: true,
    maxImageSide: 1280
  },

  ui: {
    maxHistorySize: 50,
    resultAnimationDuration: 400
  }
};
