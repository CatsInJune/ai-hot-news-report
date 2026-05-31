import Firecrawl from "@mendable/firecrawl-js";

// 直连搜索引擎 SERP 被反爬时的统一兜底：用 Firecrawl HTML 模式重抓。
// 选 HTML 而非 markdown：SERP 卡片 markdown 化丢卡边界，作者/时间会错位；
// HTML 模式保留 DOM，让调用方继续用 cheerio 选择器。

let _firecrawl: Firecrawl | null = null;
function getFirecrawl(): Firecrawl | null {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  if (!_firecrawl)
    _firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
  return _firecrawl;
}

export interface FirecrawlFallbackOpts {
  url: string;
  isAntiSpider: (html: string) => boolean;
  sourceName: string; // 仅用于日志
  timeout?: number;
}

/**
 * 用 Firecrawl 抓 SERP 并返回 HTML。
 * - 未配置 FIRECRAWL_API_KEY → null
 * - Firecrawl 仍命中反爬 → null
 * - 失败 → null
 */
export async function fetchSerpViaFirecrawl(
  opts: FirecrawlFallbackOpts,
): Promise<string | null> {
  const { url, isAntiSpider, sourceName, timeout = 30000 } = opts;
  const client = getFirecrawl();
  if (!client) {
    console.warn(`[${sourceName}] 反爬触发但 FIRECRAWL_API_KEY 未配置，放弃`);
    return null;
  }
  try {
    const result = await client.scrape(url, {
      formats: ["html"],
      onlyMainContent: false,
      timeout,
    });
    const html = (result as { html?: string })?.html ?? "";
    if (!html) return null;
    if (isAntiSpider(html)) {
      console.warn(`[${sourceName}] Firecrawl 仍命中反爬，放弃`);
      return null;
    }
    console.log(`[${sourceName}] Firecrawl 兜底成功`);
    return html;
  } catch (err) {
    console.warn(
      `[${sourceName}] Firecrawl 兜底失败:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
