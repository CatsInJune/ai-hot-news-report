import { getOpenRouter, DEFAULT_MODEL } from "./openrouter";
import type { AnalysisResult, PreMatchResult } from "@/types";

interface AnalyzeInput {
  title: string;
  text: string;
  keyword: string;
  source: string;
  preMatch: PreMatchResult;
  // true 表示内容来自监控对象的账号 timeline，评分换用"是否值得看"的标准
  subscribed?: boolean;
}

const SYSTEM_PROMPT = `你是一个热点内容精准匹配评估助手。给定一个用户监控的关键词【K】和一段采集到的内容，你要对内容做 6 个维度的评估。

## 评估维度

1. **真实性 realScore (0-100)**：内容是否真实可信。广告/营销软文/标题党/虚假信息/纯口水回复打低分。

2. **关键词字面提及 keywordMentioned (boolean)**：内容里是否字面出现了关键词或其等价表达（昵称、英文名、@账号等）。仅看字面，不做语义推断。

3. **相关性 relevScore (0-100)**：内容是否真的在讲【K】所指的那个对象。判分细则：
   - 90-100：内容核心主题就是【K】本身（讨论 ta 的动态、作品、观点等）
   - 60-89：与【K】强相关（合作项目、对 ta 的评论、ta 直接参与的事件）
   - 30-59：仅顺带提及，主体不是【K】（列表里出现名字、引用过一句话）
   - 0-29：与【K】无实质关联（同名不同人、字面巧合、机翻误匹配、回复中偶然提到）
   **必须执行的硬约束**：
   - 如果 keywordMentioned=false 且没有任何等价指代，relevScore ≤ 25。
   - 如果是字面巧合（关键词含"鱼皮"但内容讲的是食材鱼皮/医疗鱼皮等），relevScore ≤ 10。
   - 如果是同名不同人/不同领域产品，relevScore ≤ 20。

4. **热度 hotScore (0-100)**：内容客观传播潜力，看互动数据和话题性。

5. **重要性 importance (low/medium/high/urgent)**：对**关注【K】的人**来说，这条内容有多重要？
   - urgent：重大事件、突发动态、必看（如 ta 发布新产品、出大事）
   - high：重要更新、值得马上看（如新作品、关键观点）
   - medium：日常动态、有用但不紧急（如普通文章、采访）
   - low：边缘相关、可看可不看（如别人提到 ta、间接关联）

6. **垃圾标识 isSpam (boolean)**：是否为广告/营销软文/低质灌水。注意"与关键词不相关"≠ isSpam，那是 relevScore 的事。

7. **摘要 summary**：50 字以内中文，提炼内容核心或与【K】的关联点。

8. **理由 reason**：20 字以内，说明 relevScore 的关键依据。

## 输出格式

只输出一个 JSON 对象（不要 Markdown 代码块、不要任何额外文字），结构如下：

{
  "realScore": <number 0-100>,
  "keywordMentioned": <boolean>,
  "relevScore": <number 0-100>,
  "hotScore": <number 0-100>,
  "importance": "low" | "medium" | "high" | "urgent",
  "isSpam": <boolean>,
  "summary": "<50 字以内中文摘要>",
  "reason": "<20 字以内 relevScore 依据>"
}`;

function buildUserPrompt(input: AnalyzeInput): string {
  const { keyword, title, text, source, preMatch, subscribed } = input;

  if (subscribed) {
    // 订阅模式：内容来自监控对象的账号，评分换用"对追踪者而言这条值不值得看"的标准
    return `【特殊模式：订阅内容】
本条内容来自【${keyword}】**本人发布的账号 timeline**（来源平台：${source}）。
内容的"相关性"已经天然确定（就是这个人发的），所以：
- keywordMentioned 直接判 true
- relevScore 改用"对关注【${keyword}】的人来说值不值得看"评估：
  - 90-100：重磅动态（新产品发布、重大公告、转型、行业表态）
  - 70-89：有价值的观点 / 教程 / 技术分享
  - 50-69：日常更新、转发、对话（仍有意义但不紧急）
  - 30-49：寒暄、闲聊、零碎吐槽
  - 0-29：纯 emoji/纯链接/无信息内容
- importance 同步按此尺度评级（urgent/high/medium/low）
- isSpam 仅当是明显推广/营销时为 true，鱼皮本人发的内容默认不算 spam

【待评估内容】
标题：${title}
正文：${text.slice(0, 1500)}`;
  }

  const matchHint = preMatch.matched
    ? `Pre-match 结果：在文本中字面命中了关键词变体【${preMatch.matchedTerms.join("、")}】。这是 keywordMentioned=true 的依据。`
    : `Pre-match 结果：文本中**没有**任何关键词变体的字面出现。这强烈暗示内容与【${keyword}】无关，请严格审核并倾向给低分（除非内容里有等价的语义指代）。`;

  return `【监控关键词 K】${keyword}

${matchHint}

【待评估内容】
标题：${title}
正文：${text.slice(0, 1500)}
来源平台：${source}`;
}

export async function analyzeContent(input: AnalyzeInput): Promise<AnalysisResult | null> {
  const client = getOpenRouter();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      // DeepSeek / OpenAI / OpenRouter 都支持 json_object（比 json_schema 兼容性更好）
      // Schema 已写进 system prompt，AI 会按格式输出
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as AnalysisResult;
    // 安全兜底：搜索模式下 AI 偶尔会忽略 hint，这里强制约束
    if (!input.subscribed && !input.preMatch.matched && parsed.relevScore > 25 && !parsed.keywordMentioned) {
      parsed.relevScore = Math.min(parsed.relevScore, 25);
    }
    // 订阅模式：keywordMentioned 强制 true（来自该人本人的内容）
    if (input.subscribed) parsed.keywordMentioned = true;
    return parsed;
  } catch (err) {
    console.error("[Analyzer] AI 分析失败:", err instanceof Error ? err.message : err);
    return null;
  }
}

// 批量分析（并发限制 5）
export async function analyzeBatch(
  items: Array<{ id: string; input: AnalyzeInput }>
): Promise<Map<string, AnalysisResult>> {
  const results = new Map<string, AnalysisResult>();
  const concurrency = 5;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async ({ id, input }) => {
        const r = await analyzeContent(input);
        if (r) results.set(id, r);
      })
    );
  }

  return results;
}
