import axios from "axios";
import * as cheerio from "cheerio";
import type { RawTopic } from "@/types";
import { fetchSerpViaFirecrawl } from "./serp-firecrawl-fallback";

// 抓搜狗"网页"搜索（sogou.com/web），不是微信公众号搜索。
// 微信公众号对 "Claude Opus 4.8" 这种新长尾词覆盖差，全网搜索能拿到
// 腾讯新闻、博客等及时内容。
//
// 分层抓取：
//   1) 直连 axios + cheerio（默认，0 成本、<1s）
//   2) 反爬触发 → Firecrawl HTML 模式兜底（~$0.002/次）
const SOGOU_HOST = "https://www.sogou.com";

const UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

function ua(): string {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

function isAntiSpider(html: string): boolean {
  return (
    html.includes("antispider") ||
    html.includes("VerifyCode") ||
    html.includes("验证码")
  );
}

// "2026-05-29" / "2026年5月29日" / "3天前" 等多种格式 → Date | null
function parsePubDate(text: string): Date | null {
  const m1 = text.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (m1) {
    const d = new Date(
      parseInt(m1[1], 10),
      parseInt(m1[2], 10) - 1,
      parseInt(m1[3], 10),
    );
    if (!isNaN(d.getTime())) return d;
  }
  const m2 = text.match(/(\d+)\s*(分钟|小时|天)前/);
  if (m2) {
    const n = parseInt(m2[1], 10);
    const unit = m2[2];
    const ms =
      unit === "分钟" ? n * 60_000 : unit === "小时" ? n * 3_600_000 : n * 86_400_000;
    return new Date(Date.now() - ms);
  }
  return null;
}

function parseHtml(html: string): RawTopic[] {
  const $ = cheerio.load(html);
  const results: RawTopic[] = [];

  $(".results .vrwrap, .results .rb").slice(0, 15).each((_: number, el) => {
    const $el = $(el);
    const $a = $el.find("h3 a, .vr-title a, .vrTitle a").first();
    const title = $a.text().trim();
    let href = ($a.attr("href") ?? "").trim();
    if (!title || !href) return;
    if (title.includes("大家还在搜")) return;
    if (href.startsWith("/")) href = `${SOGOU_HOST}${href}`;
    if (href.includes("sogou-ad")) return;

    const snippet =
      $el
        .find(".space-txt, .str-text-info, .str_info, .text-layout")
        .first()
        .text()
        .trim() || $el.find("p").first().text().trim();

    const metaText = $el.find(".citeurl, .fb").text().trim() || $el.text();
    const publishedAt = parsePubDate(metaText) ?? new Date();

    results.push({
      title,
      summary: snippet || undefined,
      url: href,
      source: "sogou",
      publishedAt,
    });
  });

  return results;
}

export async function collectSogou(keyword: string): Promise<RawTopic[]> {
  const targetUrl = `${SOGOU_HOST}/web?query=${encodeURIComponent(keyword)}&ie=utf8`;

  // 第一层：直连
  try {
    const res = await axios.get(`${SOGOU_HOST}/web`, {
      params: { query: keyword, ie: "utf8" },
      headers: {
        "User-Agent": ua(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const text = typeof res.data === "string" ? res.data : "";
    if (!isAntiSpider(text)) return parseHtml(text);

    console.warn("[Sogou] 直连触发反爬，退到 Firecrawl");
  } catch (err) {
    console.error(
      "[Sogou] 直连失败，退到 Firecrawl:",
      err instanceof Error ? err.message : err,
    );
  }

  // 第二层：Firecrawl 兜底
  const html = await fetchSerpViaFirecrawl({
    url: targetUrl,
    isAntiSpider,
    sourceName: "Sogou",
  });
  return html ? parseHtml(html) : [];
}
