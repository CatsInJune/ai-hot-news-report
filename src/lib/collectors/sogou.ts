import axios from "axios";
import * as cheerio from "cheerio";
import type { RawTopic } from "@/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  Referer: "https://weixin.sogou.com/",
  "Accept-Language": "zh-CN,zh;q=0.9",
  Accept: "text/html,application/xhtml+xml",
};

export async function collectSogou(keyword: string): Promise<RawTopic[]> {
  try {
    const res = await axios.get("https://weixin.sogou.com/weixin", {
      params: { type: 2, query: keyword, ie: "utf8" },
      headers: HEADERS,
      timeout: 15000,
      maxRedirects: 3,
    });

    // 反爬检测
    if (
      typeof res.data === "string" &&
      (res.data.includes("antispider") ||
        res.data.includes("VerifyCode") ||
        res.data.includes("验证码"))
    ) {
      console.warn("[Sogou] 触发反爬，跳过");
      return [];
    }

    const $ = cheerio.load(res.data);
    const results: RawTopic[] = [];

    $(".news-list li, .news-box li").slice(0, 10).each((_: number, el) => {
      const $el = $(el);
      const title = $el.find("h3 a, h4 a").first().text().trim();
      const raw = $el.find("h3 a, h4 a").first().attr("href") ?? "";
      const snippet = $el.find("p.txt-info, .txt-info").first().text().trim();
      const account = $el.find(".account, .s-p a").first().text().trim();

      // 真实发布时间藏在 <script>timeConvert('1629444955')</script> 里
      // 没有就跳过这一条——宁可漏不要把陈年文章当新内容
      const itemHtml = $el.html() ?? "";
      const tsMatch = itemHtml.match(/timeConvert\(['"](\d{9,11})['"]\)/);
      if (!tsMatch) return;
      const publishedAt = new Date(parseInt(tsMatch[1], 10) * 1000);

      if (title && raw) {
        const url = raw.startsWith("//")
          ? `https:${raw}`
          : raw.startsWith("/")
            ? `https://weixin.sogou.com${raw}`
            : raw;
        results.push({
          title,
          summary: snippet,
          // 搜狗微信 snippet 是公众号文章开头数句，有信息量，作为原文展示
          rawContent: snippet || undefined,
          url,
          source: "sogou",
          author: account || undefined,
          publishedAt,
        });
      }
    });

    return results;
  } catch (err) {
    console.error("[Sogou] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}
