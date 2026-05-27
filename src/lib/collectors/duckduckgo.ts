import axios from "axios";
import * as cheerio from "cheerio";
import type { RawTopic } from "@/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
};

export async function collectDuckDuckGo(keyword: string): Promise<RawTopic[]> {
  try {
    const res = await axios.post(
      "https://html.duckduckgo.com/html/",
      new URLSearchParams({ q: keyword, kl: "cn-zh" }).toString(),
      {
        headers: { ...HEADERS, "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      }
    );

    const $ = cheerio.load(res.data);
    const results: RawTopic[] = [];

    $(".result__body, .web-result, .result").slice(0, 10).each((_: number, el) => {
      const $el = $(el);
      const title = $el.find(".result__title, .result__a, h2 a").first().text().trim();
      const link = $el.find(".result__title a, .result__a").first().attr("href") ?? "";
      const snippet = $el.find(".result__snippet").first().text().trim();

      // DDG 链接形如: //duckduckgo.com/l/?uddg=ENCODED_URL
      let realUrl = link;
      if (link.includes("uddg=")) {
        try {
          const u = new URL(link.startsWith("//") ? `https:${link}` : link);
          realUrl = decodeURIComponent(u.searchParams.get("uddg") ?? link);
        } catch {
          realUrl = link;
        }
      }

      if (title && realUrl) {
        results.push({
          title,
          summary: snippet,
          url: realUrl,
          source: "duckduckgo",
          publishedAt: new Date(),
        });
      }
    });

    return results;
  } catch (err) {
    console.error("[DuckDuckGo] 采集失败:", err);
    return [];
  }
}
