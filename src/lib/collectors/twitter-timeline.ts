import type { RawTopic } from "@/types";
import { twitterLimiter } from "@/lib/rate-limiter";

const TWITTER_API_BASE = "https://api.twitterapi.io";

interface TweetAuthor {
  userName?: string;
  name?: string;
  followers?: number;
  isBlueVerified?: boolean;
}

interface Tweet {
  id: string;
  url?: string;
  text: string;
  retweetCount?: number;
  replyCount?: number;
  likeCount?: number;
  viewCount?: number;
  createdAt?: string;
  author?: TweetAuthor;
}

/**
 * 拉取指定 Twitter 用户的最新推文（账号订阅模式）。
 * 用 advanced_search 的 from: 限定符——twitterapi.io 的 last_tweets endpoint 不一定可用，
 * 而 from:handle 是 Twitter Search 原生支持的语法，更通用。
 */
export async function collectTwitterTimeline(handle: string): Promise<RawTopic[]> {
  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) return [];

  try {
    const tweets = await twitterLimiter.schedule<Tweet[]>(async () => {
      const query = `from:${handle} -filter:replies -filter:retweets`;
      const params = new URLSearchParams({ query, queryType: "Latest" });
      const res = await fetch(
        `${TWITTER_API_BASE}/twitter/tweet/advanced_search?${params}`,
        {
          headers: { "X-API-Key": apiKey },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!res.ok) {
        console.error(`[TwitterTimeline] API ${res.status} for @${handle}`);
        return [];
      }
      const data = await res.json();
      return data.tweets ?? [];
    });

    return tweets
      .slice(0, 20)
      .map((t) => ({
        title: t.text.slice(0, 120),
        summary: t.text,
        // 推文全文是真正的原文
        rawContent: t.text,
        url: t.url ?? `https://twitter.com/${handle}/status/${t.id}`,
        source: "twitter" as const,
        author: t.author?.name ?? handle,
        authorVerified: t.author?.isBlueVerified,
        authorFollowers: t.author?.followers,
        publishedAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        likes: t.likeCount ?? 0,
        reposts: t.retweetCount ?? 0,
        comments: t.replyCount ?? 0,
        views: t.viewCount ?? 0,
        subscribed: true,
      }))
      .filter((t) => t.title);
  } catch (err) {
    console.error("[TwitterTimeline] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}
