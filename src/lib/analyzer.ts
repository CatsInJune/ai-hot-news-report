import { getOpenRouter, DEFAULT_MODEL } from "./openrouter";
import type { AnalysisResult } from "@/types";

interface AnalyzeInput {
  title: string;
  text: string;
  keyword?: string;
  source: string;
}

const SYSTEM_PROMPT = `你是一个专业的资讯内容评估助手，负责对采集到的内容做四个维度的评估：
1. 真实性（realScore 0-100）：内容是否真实可信，分数越高越真实；广告/营销/标题党/虚假信息打低分
2. 相关性（relevScore 0-100）：内容与"监控关键词"的语义相关程度，按以下严格标准打分：
   - 90-100：内容核心主题就是该关键词所指的对象/事件
   - 60-89：内容与关键词主题强相关，是其相关讨论、动态、作品或周边
   - 30-59：仅在文本中出现关键词但不是核心主题，或仅是同名/谐音的弱关联
   - 0-29：与关键词无实质语义关联（包括：仅字面出现、不同领域同名、机翻误匹配、回复/转发里偶然提到等）
   注意："关键词"是用户监控目标，必须严格匹配语义而非字面，宁可低分不要宽松。
3. 热度（hotScore 0-100）：内容的重要性、新闻价值、传播潜力
4. 摘要（summary）：中文摘要，50 字以内，提炼核心信息
5. 垃圾标识（isSpam）：是否为广告、营销软文、低质内容、纯口水回复
6. 理由（reason）：简短判断依据，20 字以内

请严格按 JSON Schema 返回，不要额外解释。`;

export async function analyzeContent(input: AnalyzeInput): Promise<AnalysisResult | null> {
  const client = getOpenRouter();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `【监控关键词】${input.keyword ?? "（无关键词，按通用热点评估，相关性给 30 以下）"}\n\n【待评估内容】\n标题：${input.title}\n正文：${input.text.slice(0, 600)}\n来源平台：${input.source}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "content_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              realScore: { type: "number", description: "真实性 0-100" },
              relevScore: { type: "number", description: "相关性 0-100" },
              hotScore: { type: "number", description: "热度 0-100" },
              summary: { type: "string", description: "中文摘要，50字以内" },
              isSpam: { type: "boolean", description: "是否为垃圾内容" },
              reason: { type: "string", description: "判断理由，20字以内" },
            },
            required: ["realScore", "relevScore", "hotScore", "summary", "isSpam", "reason"],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.1,
      // 输出仅一个小 JSON（6 个字段），1024 token 足够。
      // 不显式设置时，部分模型默认 32768/65536，会导致免费账户额度不足 (402)。
      max_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content) as AnalysisResult;
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
