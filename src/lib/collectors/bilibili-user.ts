import axios from "axios";
import type { RawTopic } from "@/types";
import { bilibiliLimiter } from "@/lib/rate-limiter";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  Referer: "https://www.bilibili.com/",
  Cookie: "buvid3=; b_nut=; _uuid=;",
};

interface UserSearchItem {
  mid?: number;
  uname?: string;
  fans?: number;
}

interface UserVideo {
  bvid: string;
  title: string;
  description?: string;
  author?: string;
  play?: number;
  video_review?: number;
  created?: number;
}

/**
 * 通过用户名搜索 B站 mid（uid）。当 detectAccount 只给了用户名时用。
 */
export async function findBilibiliUid(username: string): Promise<string | null> {
  try {
    const res = await bilibiliLimiter.schedule(() =>
      axios.get("https://api.bilibili.com/x/web-interface/search/type", {
        params: { search_type: "bili_user", keyword: username, page: 1 },
        headers: HEADERS,
        timeout: 10000,
      })
    );
    if (res.data?.code !== 0) return null;
    const list: UserSearchItem[] = res.data?.data?.result ?? [];
    // 取粉丝最多的（最有可能是本人）
    const sorted = list.filter((u) => u.mid).sort((a, b) => (b.fans ?? 0) - (a.fans ?? 0));
    return sorted[0]?.mid ? String(sorted[0].mid) : null;
  } catch (err) {
    console.error("[BilibiliUser] uid 查询失败:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 拉取指定 B站用户的最新视频（账号订阅模式）。
 * 使用旧的 space/arc/search 接口，避免新接口的 wbi 签名复杂度。
 */
export async function collectBilibiliUser(uid: string): Promise<RawTopic[]> {
  try {
    const res = await bilibiliLimiter.schedule(() =>
      axios.get("https://api.bilibili.com/x/space/arc/search", {
        params: { mid: uid, pn: 1, ps: 10, order: "pubdate" },
        headers: HEADERS,
        timeout: 12000,
      })
    );
    if (res.data?.code !== 0) {
      console.warn(`[BilibiliUser] mid=${uid} API code=${res.data?.code}`);
      return [];
    }
    const list: UserVideo[] = res.data?.data?.list?.vlist ?? [];

    return list
      .map((v) => ({
        title: (v.title ?? "").replace(/<[^>]+>/g, ""),
        summary: v.description ?? "",
        url: `https://www.bilibili.com/video/${v.bvid}`,
        source: "bilibili" as const,
        author: v.author,
        publishedAt: new Date((v.created ?? Date.now() / 1000) * 1000),
        views: v.play ?? 0,
        comments: v.video_review ?? 0,
        subscribed: true,
      }))
      .filter((t) => t.title);
  } catch (err) {
    console.error("[BilibiliUser] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}
