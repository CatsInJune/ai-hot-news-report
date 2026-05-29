import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * 返回 OpenAI-compatible AI 客户端。
 *
 * 优先级：
 * 1. 若设置 DEEPSEEK_API_KEY → 直连 DeepSeek 官方 API（更便宜、不需要 OpenRouter 路由费）
 * 2. 否则 → 走 OpenRouter
 */
export function getOpenRouter(): OpenAI | null {
  if (_client) return _client;

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    _client = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: deepseekKey,
    });
    return _client;
  }

  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) return null;

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

/**
 * 默认模型。
 *
 * - 直连 DeepSeek：用 DeepSeek 官方模型名（deepseek-chat / deepseek-reasoner），通过 DEEPSEEK_MODEL 覆盖
 * - 走 OpenRouter：用 OpenRouter 格式 (provider/model)，通过 OPENROUTER_MODEL 覆盖
 */
export const DEFAULT_MODEL = process.env.DEEPSEEK_API_KEY
  ? (process.env.DEEPSEEK_MODEL ?? "deepseek-chat")
  : (process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash");
