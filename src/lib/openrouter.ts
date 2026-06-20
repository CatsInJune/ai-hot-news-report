import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * 返回 OpenAI-compatible AI 客户端。
 *
 * 优先级：
 * 1. OPENROUTER_API_KEY → 走 OpenRouter（主力，模型丰富、自动故障转移）
 * 2. DEEPSEEK_API_KEY → 直连 DeepSeek 官方 API（免费额度兜底）
 */
export function getOpenRouter(): OpenAI | null {
  if (_client) return _client;

  // GitHub Actions 把未设的 secret 注入成 ""，所以用 truthy 判断而不是 != null
  const orKey = process.env.OPENROUTER_API_KEY;
  if (orKey) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: orKey,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "AI Hot News Monitor",
      },
    });
    return _client;
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    _client = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: deepseekKey,
    });
    return _client;
  }

  return null;
}

/**
 * 默认模型（与 getOpenRouter 优先级一致）。
 *
 * - 走 OpenRouter：用 OpenRouter 格式 (provider/model)，通过 OPENROUTER_MODEL 覆盖
 * - 直连 DeepSeek：用 DeepSeek 官方模型名（deepseek-chat / deepseek-reasoner），通过 DEEPSEEK_MODEL 覆盖
 */
// 用 || 而不是 ??：GitHub Actions 会把未设的 secret 注入成 ""，
// ?? 只对 null/undefined 兜底，空字符串会原样穿透导致 model 名为空
export const DEFAULT_MODEL = process.env.OPENROUTER_API_KEY
  ? (process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash")
  : (process.env.DEEPSEEK_MODEL || "deepseek-chat");
