import OpenAI from "openai";
import type { ChatCompletion, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

// 只支持 non-streaming 形态——本项目所有 AI 调用都是一次性 completion，不用 stream。
// 这样返回类型就是确定的 ChatCompletion，避免 SDK 重载 union 导致的 `choices` 不可访问。
type ChatParams = ChatCompletionCreateParamsNonStreaming;
type ChatResponse = ChatCompletion;
// 第二参数：OpenAI v6 的 RequestOptions 没稳定公共导出路径，从 create 方法签名推导
type ChatRequestOptions = Parameters<OpenAI["chat"]["completions"]["create"]>[1];

let _primary: { client: OpenAI; model: string } | null = null;
let _fallback: { client: OpenAI; model: string } | null = null;

// 进程级熔断：primary 连续失败到阈值后，本进程内剩余请求直接走 fallback，
// 不再每条都先白打一次 OpenRouter（GitHub Actions 上 collect 是一次性进程，
// 跑完就退出，所以这个状态不会跨 run 残留）。
let _primaryFailStreak = 0;
const PRIMARY_CIRCUIT_THRESHOLD = 3;

function buildPrimary(): { client: OpenAI; model: string } | null {
  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) return null;
  return {
    client: new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: orKey,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "AI Hot News Monitor",
      },
    }),
    model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
  };
}

function buildFallback(): { client: OpenAI; model: string } | null {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) return null;
  return {
    client: new OpenAI({ baseURL: "https://api.deepseek.com", apiKey: deepseekKey }),
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  };
}

function getPrimary() {
  if (_primary === null) _primary = buildPrimary();
  return _primary;
}

function getFallback() {
  if (_fallback === null) _fallback = buildFallback();
  return _fallback;
}

// 识别哪些错误属于"换 provider 重试有意义"——余额、配额、模型名、鉴权、
// 服务端 5xx。JSON 解析错、网络超时由调用方自己处理。
function shouldFailover(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; code?: string };
  if (typeof e.status === "number") {
    return e.status === 400 || e.status === 401 || e.status === 402 ||
      e.status === 403 || e.status === 404 || e.status === 429 || e.status >= 500;
  }
  return false;
}

/**
 * 返回一个兼容 `client.chat.completions.create` 调用形态的包装客户端。
 *
 * 行为：
 * - 默认用 primary（OpenRouter）。
 * - primary 失败且错误属于"换家可能有救"那类（4xx/5xx/超额）→ 自动用 fallback
 *   （DeepSeek 官方）重跑同一条请求；fallback 内部会把 `model` 字段替换为
 *   `DEEPSEEK_MODEL`，调用方无需关心。
 * - primary 连续失败到熔断阈值后，剩余请求直接走 fallback，省掉每条都先白打
 *   OpenRouter 的开销。
 * - 两边都没配 → 返回 null（保持旧契约）。
 */
export function getOpenRouter(): {
  chat: { completions: { create: (p: ChatParams, opts?: ChatRequestOptions) => Promise<ChatResponse> } };
} | null {
  const primary = getPrimary();
  const fallback = getFallback();
  if (!primary && !fallback) return null;

  return {
    chat: {
      completions: {
        create: async (params: ChatParams, opts?: ChatRequestOptions): Promise<ChatResponse> => {
          const tryFallback = async (originErr?: unknown): Promise<ChatResponse> => {
            if (!fallback) throw originErr ?? new Error("no fallback configured");
            return fallback.client.chat.completions.create(
              { ...params, model: fallback.model },
              opts,
            ) as Promise<ChatResponse>;
          };

          if (!primary) return tryFallback();

          if (_primaryFailStreak >= PRIMARY_CIRCUIT_THRESHOLD && fallback) {
            return tryFallback();
          }

          try {
            const res = (await primary.client.chat.completions.create(params, opts)) as ChatResponse;
            _primaryFailStreak = 0;
            return res;
          } catch (err) {
            _primaryFailStreak += 1;
            if (shouldFailover(err) && fallback) {
              console.warn(
                `[OpenRouter] primary 失败，切换 DeepSeek 兜底:`,
                err instanceof Error ? err.message : err,
              );
              return tryFallback(err);
            }
            throw err;
          }
        },
      },
    },
  };
}

/**
 * 默认模型。
 *
 * 注意：包装客户端在走 fallback 时会**用 fallback 自己的 model 覆盖这个值**，
 * 调用方传 DEFAULT_MODEL 即可，不需要关心当前实际走哪家。
 */
// 用 || 而不是 ??：GitHub Actions 会把未设的 secret 注入成 ""，
// ?? 只对 null/undefined 兜底，空字符串会原样穿透导致 model 名为空
export const DEFAULT_MODEL = process.env.OPENROUTER_API_KEY
  ? (process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash")
  : (process.env.DEEPSEEK_MODEL || "deepseek-chat");

// 仅供测试用：重置熔断和缓存
export function __resetForTest() {
  _primary = null;
  _fallback = null;
  _primaryFailStreak = 0;
}
