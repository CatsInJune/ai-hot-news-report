import { getOpenRouter, DEFAULT_MODEL } from "./openrouter";

export interface SupportedLang {
  code: string;
  label: string; // 中文显示名
  prompt: string; // 给 LLM 的目标语言描述
}

export const SUPPORTED_LANGS: readonly SupportedLang[] = [
  { code: "zh-CN", label: "简体中文", prompt: "简体中文（Simplified Chinese）" },
  { code: "zh-TW", label: "繁体中文", prompt: "繁體中文（Traditional Chinese）" },
  { code: "en", label: "English", prompt: "English" },
  { code: "ja", label: "日本語", prompt: "日本語（Japanese）" },
  { code: "ko", label: "한국어", prompt: "한국어（Korean）" },
] as const;

export const DEFAULT_TARGET_LANG = "zh-CN";

const TRANSLATE_TIMEOUT_MS = 25_000;

export function isSupportedLang(code: string): boolean {
  return SUPPORTED_LANGS.some((l) => l.code === code);
}

function getLangPrompt(code: string): string {
  return SUPPORTED_LANGS.find((l) => l.code === code)?.prompt ?? code;
}

const SYSTEM_PROMPT = (targetLangPrompt: string) =>
  `你是专业翻译。把用户提供的 Markdown 文本翻译为 ${targetLangPrompt}。

规则：
1. 严格保留 Markdown 结构（标题级别、列表、链接 URL、图片地址、代码块原样不译）。
2. 专有名词（人名、产品名、公司名、技术缩写如 LLM/RAG/API）保留原文不译。
3. 直接输出译文本身，不要任何解释、前后缀、代码块包裹。
4. 如果输入已经是 ${targetLangPrompt}，原样返回输入文本。`;

/**
 * 用 DeepSeek 把 markdown 翻译为目标语言。
 * 失败/超时/未配置返回 null。
 */
export async function translateMarkdown(
  text: string,
  targetLang: string,
): Promise<string | null> {
  const ai = getOpenRouter();
  if (!ai) return null;
  if (!isSupportedLang(targetLang)) return null;

  const langPrompt = getLangPrompt(targetLang);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS);
    const completion = await ai.chat.completions.create(
      {
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT(langPrompt) },
          { role: "user", content: text },
        ],
        temperature: 0,
      },
      { signal: controller.signal },
    );
    clearTimeout(timer);
    const out = completion.choices[0]?.message?.content?.trim() ?? "";
    return out || null;
  } catch (err) {
    console.warn(
      "[translator] 翻译失败:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * 安全 parse Topic.translations JSON，损坏时返回空对象。
 */
export function parseTranslations(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, string>;
    }
  } catch {
    /* 损坏数据当空 map 处理 */
  }
  return {};
}
