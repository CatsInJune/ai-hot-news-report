import Firecrawl from "@mendable/firecrawl-js";

// URL 指向真实可读文章的源（视频源不抓取，没有正文）
export const SCRAPABLE_SOURCES = new Set(["bing", "google", "hackernews", "sogou"]);
export const MAX_LENGTH = 8000;
const MIN_VALID_LENGTH = 200;

let _firecrawl: Firecrawl | null = null;
function getClient(): Firecrawl | null {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  if (!_firecrawl) _firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
  return _firecrawl;
}

/**
 * 提取 markdown 行的"显示文本"，剥离 list 标记、链接语法、图片，
 * 用于判断这行是 nav 还是正文。
 */
function getDisplayText(line: string): string {
  return line
    .replace(/^[-*+]\s+/, "") // 列表项前缀
    .replace(/^\s*\d+\.\s+/, "") // 有序列表前缀
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 图片
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // 链接 → 内文
    .replace(/^#+\s*/, "") // 标题符号
    .trim();
}

/** 一行是否"全是链接 + 列表标记"，没有任何裸文本 → 极可能是 nav */
function isPureLinkLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // 把所有 markdown 链接、列表标记、空白扣掉，看是否还剩字符
  const stripped = trimmed
    .replace(/^[-*+]\s+/, "")
    .replace(/^\s*\d+\.\s+/, "")
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\s+/g, "");
  return stripped.length === 0;
}

/** 判断（剥语法后的）文本像正文：足够长或含中文/英文句末标点 */
function looksLikeProse(displayText: string): boolean {
  if (!displayText) return false;
  if (displayText.length >= 25) return true;
  return /[。！？，：；,.!?:;]/.test(displayText);
}

/**
 * 砍掉门户站 nav 噪音：
 * 1. 全文范围内删除"纯链接行"（典型 nav 菜单项，正文段落不会整行都是链接）
 * 2. 再剥离开头的非正文行作为兜底
 */
function stripNavNoise(md: string): string {
  const lines = md.split("\n");

  // Step 1: 全文丢掉纯链接行
  const kept = lines.filter((line) => !isPureLinkLine(line));

  // Step 2: 剥前缀——找到第一个"正文样"行，前面非正文行全砍
  let startIdx = 0;
  for (let i = 0; i < kept.length; i++) {
    const text = getDisplayText(kept[i]);
    if (!text) continue;
    if (!looksLikeProse(text)) continue;

    // 后续 3 行内至少 2 行也像正文，避免被广告单句误判
    let proseCount = 1;
    for (let j = i + 1; j < Math.min(i + 4, kept.length); j++) {
      const next = getDisplayText(kept[j]);
      if (!next) continue;
      if (looksLikeProse(next)) proseCount++;
    }
    if (proseCount >= 2) {
      startIdx = i;
      break;
    }
  }

  // 折叠多余空行
  const result: string[] = [];
  for (const line of kept.slice(startIdx)) {
    if (line.trim() === "") {
      if (result.length && result[result.length - 1] !== "") result.push("");
    } else {
      result.push(line);
    }
  }
  while (result.length && result[result.length - 1] === "") result.pop();

  return result.join("\n").trim();
}

/**
 * 用 Firecrawl 抓取正文（Markdown 格式，仅主内容）。
 * 未配置 FIRECRAWL_API_KEY 或抓取失败时返回 null。
 */
export async function extractContent(url: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const result = await client.scrape(url, {
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000,
    });
    const raw = (result as { markdown?: string })?.markdown?.trim() ?? "";
    if (!raw) return null;
    const md = stripNavNoise(raw);
    if (md.length < MIN_VALID_LENGTH) return null;
    return md.slice(0, MAX_LENGTH);
  } catch (err) {
    console.warn(
      "[extract-content] Firecrawl 失败:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * 并发抓取多个 URL 的正文，concurrency 限流防过载。
 * 返回与输入对齐的结果数组。
 */
export async function extractContentBatch(
  urls: string[],
  concurrency = 5,
): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(urls.length).fill(null);

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((url) => extractContent(url)));
    batchResults.forEach((r, j) => (results[i + j] = r));
  }

  return results;
}
