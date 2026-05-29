import { getOpenRouter, DEFAULT_MODEL } from "./openrouter";
import { prisma } from "./prisma";
import type { KeywordAccount } from "@/types";

const DETECT_PROMPT = `你是一个跨平台账号识别专家。给定一个用户监控的关键词（通常是某个人、品牌或 IP），你要判断它在以下平台上是否有公开账号，如果有则返回账号信息：
- twitter (Twitter/X)：返回 handle（不含 @）
- bilibili (B站)：返回 uid（数字）和用户名
- weibo (微博)：返回用户名

规则：
1. 只返回**确信存在**的账号，不要猜测。如果不知道就不返回该平台的条目。
2. 同一平台可能有多个候选账号，全部返回（最多 3 个）。
3. 不要返回明显是粉丝群、第三方账号等。

输出格式（严格 JSON 数组，无其他文字）：
[
  {"platform":"twitter","handle":"yupi996","name":"程序员鱼皮"},
  {"platform":"bilibili","uid":"12476705","name":"程序员鱼皮"}
]

如果完全没有可识别的账号，输出 []。`;

async function callAI(keyword: string): Promise<KeywordAccount[]> {
  const client = getOpenRouter();
  if (!client) return [];

  try {
    const res = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: DETECT_PROMPT },
        { role: "user", content: `关键词：${keyword}` },
      ],
      temperature: 0.1,
      max_tokens: 400,
    });

    const content = res.choices[0]?.message?.content ?? "";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(parsed)) return [];

    return (parsed as Array<Record<string, unknown>>)
      .filter((x) => x && typeof x.platform === "string")
      .map((x) => ({
        platform: x.platform as KeywordAccount["platform"],
        handle: typeof x.handle === "string" ? x.handle : undefined,
        uid: typeof x.uid === "string" ? x.uid : typeof x.uid === "number" ? String(x.uid) : undefined,
        name: typeof x.name === "string" ? x.name : undefined,
      }))
      .filter((x) => ["twitter", "bilibili", "weibo"].includes(x.platform));
  } catch (err) {
    console.error("[AccountDetector] AI 检测失败:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * 检测关键词对应的平台账号，结果缓存在 Keyword.accounts JSON。
 * 缓存命中即跳过 AI 调用。
 */
export async function detectAccounts(keywordRow: {
  id: string;
  name: string;
  accounts: string | null;
}): Promise<KeywordAccount[]> {
  // 缓存命中
  if (keywordRow.accounts) {
    try {
      const parsed = JSON.parse(keywordRow.accounts);
      if (Array.isArray(parsed)) return parsed as KeywordAccount[];
    } catch {
      // 解析失败重新生成
    }
  }

  const detected = await callAI(keywordRow.name);
  try {
    await prisma.keyword.update({
      where: { id: keywordRow.id },
      data: { accounts: JSON.stringify(detected) },
    });
  } catch (err) {
    console.error("[AccountDetector] 写入 accounts 失败:", err instanceof Error ? err.message : err);
  }

  if (detected.length > 0) {
    console.log(
      `[AccountDetector] "${keywordRow.name}" → ${detected.length} 个账号: ` +
        detected.map((a) => `${a.platform}:${a.handle ?? a.uid ?? a.name}`).join(", ")
    );
  } else {
    console.log(`[AccountDetector] "${keywordRow.name}" → 未识别到任何账号`);
  }

  return detected;
}
