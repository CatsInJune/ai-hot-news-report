import axios from "axios";
import type { RawTopic } from "@/types";
import { bilibiliLimiter } from "@/lib/rate-limiter";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  Referer: "https://www.bilibili.com/",
  Cookie: "buvid3=; b_nut=; _uuid=;",
};

interface BiliVideo {
  bvid: string;
  title: string;
  description?: string;
  author?: string;
  play?: number;
  video_review?: number;
  pubdate?: number;
}

export async function collectBilibili(keyword: string): Promise<RawTopic[]> {
  try {
    const res = await bilibiliLimiter.schedule(() =>
      axios.get("https://api.bilibili.com/x/web-interface/search/type", {
        params: { search_type: "video", keyword, order: "pubdate", page: 1 },
        headers: HEADERS,
        timeout: 12000,
      })
    );

    if (res.data?.code !== 0) {
      console.warn("[Bilibili] API 返回非 0:", res.data?.code);
      return [];
    }

    const list: BiliVideo[] = res.data?.data?.result ?? [];
    return list.slice(0, 10).map((v) => ({
      title: (v.title ?? "").replace(/<[^>]+>/g, ""),
      summary: v.description ?? "",
      url: `https://www.bilibili.com/video/${v.bvid}`,
      source: "bilibili" as const,
      author: v.author,
      publishedAt: new Date((v.pubdate ?? Date.now() / 1000) * 1000),
      views: v.play ?? 0,
      comments: v.video_review ?? 0,
    })).filter((t) => t.title);
  } catch (err) {
    console.error("[Bilibili] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}
