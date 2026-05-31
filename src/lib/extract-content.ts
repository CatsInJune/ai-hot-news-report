import Firecrawl from "@mendable/firecrawl-js";
import { getOpenRouter, DEFAULT_MODEL } from "./openrouter";

// URL 指向真实可读文章的源（视频源不抓取，没有正文）
export const SCRAPABLE_SOURCES = new Set([
  "bing",
  "google",
  "hackernews",
  "sogou",
  "baidu",
  "ai_blog",
  "ai_news_zh",
]);
export const MAX_LENGTH = 8000;
const MIN_VALID_LENGTH = 200;
// LLM 清洗：默认开。CLEAN_RAW_WITH_LLM=false 关闭后回退到 Firecrawl 原始 markdown
const LLM_CLEAN_ENABLED = process.env.CLEAN_RAW_WITH_LLM !== "false";
const LLM_CLEAN_TIMEOUT_MS = 25_000;

let _firecrawl: Firecrawl | null = null;
function getClient(): Firecrawl | null {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  if (!_firecrawl) _firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
  return _firecrawl;
}

const LLM_CLEAN_SYSTEM = `你是一个文章正文抽取器。任务：从网页抓取的 Markdown 中，**只保留这篇文章的正文**。

## 什么是"文章正文"

正文是**作者为传达这篇文章的内容而写下的连续叙事**——读者来到这个页面想读的东西。

包含：
- 作者撰写的段落、句子、对话
- 文章自身的小标题、引用、列表、表格、代码块
- 文章自身嵌入的、与内容相关的图片及其原图说明
- 文章自身的署名信息（作者名、记者署名、采编署名）。例如 "Reporting by X; Editing by Y"、"记者 X／综合报导"、"By Jane Doe"、文章开头/结尾作者一栏

## 什么不是正文

任何**不属于这篇文章本身叙事**的内容都不是正文，必须剔除。

判断时连用两道筛子，命中**任何一道**就剔除：

1. **位移测试**：把这段文字搬到该网站的另一篇文章下面，它**仍然成立或更合适**？→ 不是正文（站点级模板内容）
2. **作者意图测试**：作者交稿给编辑时**会自己写这段吗**？还是这段是网站系统/CMS/翻译机/平台后期自动添加的？→ 后者剔除

典型例子（**不是穷举**，遇到类似情形按上述两道筛子判断）：
- 站点 chrome：导航、侧边栏、页脚、面包屑、登录注册、搜索框
- 互动/社交：评论列表、点赞分享按钮、"扫一扫"、"打开 App 看更多"
- 推荐/导流：相关阅读、热门推荐、"你可能感兴趣"、"作者其他文章"
- 广告/商业：赞助商区块、广告位、订阅邀请、打赏按钮、付费墙提示
- 平台元数据：法务/备案/版权声明、ICP 备案、隐私政策、使用条款链接
- 自动添加的免责声明：**"本文由 AI 翻译"、"内容由用户上传"、"观点仅代表作者本人不代表平台"、"参閱我們的使用條款"** ——这些是**平台自动盖章的免责文字，不是作者写的**
- 组件残留：视频播放器 UI（"Tap to unmute" / "Play"）、图片授权链接（"Purchase Licensing Rights"）、地图 widget 提示
- 站点反馈/社区入口：**"Was this page helpful?"、"Rate this article"、"Join the [X] Community"、"加入社群讨论"、"分享你的反馈"** ——这些是站点级 CTA，每个页面都有

不确定时回到两道筛子。
**特别提醒**：免责声明 / 翻译声明 / 社区邀请 / 反馈链接，往往出现在正文**最后一段之后**，文字往往是斜体或独立小段——容易被误认为是文章一部分。它们都不是。

## 输出规则

1. 严格保留原文文字，不改写、不总结、不翻译。
2. 保留段落顺序与 Markdown 结构（标题级别、列表、链接、图片）。
3. 直接输出清洗后的 Markdown，不要任何解释、前后缀、代码块包裹。
4. 如果整段输入都不是文章正文（如纯导航页/404），输出空字符串。`;

/**
 * 用 LLM 抽取正文：剥离导航/评论/版权/推荐等噪音，保留原文段落。
 * 失败/超时/未配置返回 null。
 */
export async function cleanWithLLM(markdown: string, title?: string): Promise<string | null> {
  const ai = getOpenRouter();
  if (!ai) return null;

  const userPrompt = title
    ? `文章标题：${title}\n\n以下是抓取到的 Markdown，请提取正文：\n\n${markdown}`
    : `以下是抓取到的 Markdown，请提取正文：\n\n${markdown}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_CLEAN_TIMEOUT_MS);
    const completion = await ai.chat.completions.create(
      {
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: LLM_CLEAN_SYSTEM },
          { role: "user", content: userPrompt },
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
      "[extract-content] LLM 清洗失败:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * 用 Firecrawl 抓取正文（Markdown 格式，仅主内容），再用 LLM 抽取正文。
 * 流程：Firecrawl → LLM 抽取（可关闭/失败时回退到 Firecrawl 原始 markdown）。
 * 未配置 FIRECRAWL_API_KEY 或抓取失败时返回 null。
 */
export async function extractContent(url: string, title?: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const result = await client.scrape(url, {
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000,
    });
    const raw = (result as { markdown?: string })?.markdown?.trim() ?? "";
    if (raw.length < MIN_VALID_LENGTH) return null;

    if (LLM_CLEAN_ENABLED) {
      const cleaned = await cleanWithLLM(raw, title);
      // LLM 输出过短视为不可信，回退到 Firecrawl 原始结果
      if (cleaned && cleaned.length >= MIN_VALID_LENGTH) {
        return cleaned.slice(0, MAX_LENGTH);
      }
    }

    return raw.slice(0, MAX_LENGTH);
  } catch (err) {
    console.warn(
      "[extract-content] Firecrawl 失败:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export interface ExtractItem {
  url: string;
  title?: string;
}

/**
 * 并发抓取多个 URL 的正文，concurrency 限流防过载。
 * 入参兼容：传 string[] 或 { url, title }[]。
 * 返回与输入对齐的结果数组。
 */
export async function extractContentBatch(
  items: ReadonlyArray<string | ExtractItem>,
  concurrency = 5,
): Promise<(string | null)[]> {
  const normalized: ExtractItem[] = items.map((it) =>
    typeof it === "string" ? { url: it } : it,
  );
  const results: (string | null)[] = new Array(normalized.length).fill(null);

  for (let i = 0; i < normalized.length; i += concurrency) {
    const batch = normalized.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((it) => extractContent(it.url, it.title)),
    );
    batchResults.forEach((r, j) => (results[i + j] = r));
  }

  return results;
}
