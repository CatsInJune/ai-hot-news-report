import { getOpenRouter, DEFAULT_MODEL } from "./openrouter";
import { prisma } from "./prisma";
import type { PreMatchResult } from "@/types";

const EXPAND_PROMPT = `你是一个搜索关键词扩展专家。给定一个用户监控的关键词，输出该关键词的所有合理变体，用于在采集到的原文中做字面命中检测。

规则：
1. 包含原始关键词的不同写法（中英、大小写、空格、连字符、缩写）
2. 包含该对象的别称、昵称、英文名、社交账号 handle（带 @）
3. 不要包含太通用的词（例如关键词是"程序员鱼皮"，"程序员"就太泛了不要加）
4. 不要包含同字面但完全不同含义的（例如"鱼皮"不要包含食材鱼皮的写法）
5. 总数 3-12 个，第一个必须是原始关键词本身

只输出 JSON 数组字符串，无其他说明。例：
输入："程序员鱼皮"
输出：["程序员鱼皮","鱼皮","yupi","@yupi996","李鱼皮"]
输入："Claude Sonnet 4.6"
输出：["Claude Sonnet 4.6","Sonnet 4.6","claude-sonnet-4.6","Claude 4.6"]`;

// 从关键词中拆出基础变体，不依赖 AI，作为兜底
function extractBasic(keyword: string): string[] {
  const out = new Set<string>([keyword]);
  // 按非字母数字字符切分
  const parts = keyword.split(/[\s\-_\/\\·]+/).filter((p) => p.length >= 2);
  if (parts.length > 1) parts.forEach((p) => out.add(p));
  return Array.from(out);
}

/**
 * 把关键词扩展为变体列表，结果缓存在 Keyword.aliases JSON 字段。
 * 同一关键词第二次调用不会再请求 AI。
 */
export async function expandKeyword(keywordRow: {
  id: string;
  name: string;
  aliases: string | null;
}): Promise<string[]> {
  // 缓存命中
  if (keywordRow.aliases) {
    try {
      const parsed = JSON.parse(keywordRow.aliases);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as string[];
    } catch {
      // JSON 解析失败，重新生成
    }
  }

  const fallback = extractBasic(keywordRow.name);
  const client = getOpenRouter();
  if (!client) {
    await persist(keywordRow.id, fallback);
    return fallback;
  }

  try {
    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: EXPAND_PROMPT },
        { role: "user", content: keywordRow.name },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    const content = res.choices[0]?.message?.content ?? "";
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]) as unknown;
      if (Array.isArray(parsed)) {
        const variants = Array.from(
          new Set([
            keywordRow.name,
            ...fallback,
            ...(parsed as string[]).map((s) => String(s).trim()).filter(Boolean),
          ])
        );
        await persist(keywordRow.id, variants);
        console.log(`[Expand] "${keywordRow.name}" → ${variants.length} 个变体: ${variants.slice(0, 5).join(", ")}${variants.length > 5 ? "..." : ""}`);
        return variants;
      }
    }
  } catch (err) {
    console.error("[Expand] AI 扩展失败:", err instanceof Error ? err.message : err);
  }

  await persist(keywordRow.id, fallback);
  return fallback;
}

async function persist(keywordId: string, aliases: string[]): Promise<void> {
  try {
    await prisma.keyword.update({
      where: { id: keywordId },
      data: { aliases: JSON.stringify(aliases) },
    });
  } catch (err) {
    console.error("[Expand] 写入 aliases 失败:", err instanceof Error ? err.message : err);
  }
}

/**
 * 在文本中做 literal substring 检测，返回命中的变体列表。
 * 不区分大小写。
 */
export function preMatchKeyword(text: string, aliases: string[]): PreMatchResult {
  if (!text || aliases.length === 0) return { matched: false, matchedTerms: [] };
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const alias of aliases) {
    if (!alias) continue;
    if (lower.includes(alias.toLowerCase())) matched.push(alias);
  }
  return { matched: matched.length > 0, matchedTerms: matched };
}
