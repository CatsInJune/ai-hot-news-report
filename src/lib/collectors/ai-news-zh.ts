import { collectAggregatedRss, type RssFeedConfig } from "./rss-aggregator";
import type { RawTopic } from "@/types";

// 中文 AI 媒体 RSS。机器之心 RSS 空，暂不收。
const FEEDS: RssFeedConfig[] = [
  { name: "量子位", url: "https://www.qbitai.com/feed" },
  { name: "36氪", url: "https://www.36kr.com/feed" },
];

export async function collectAiNewsZh(keyword: string): Promise<RawTopic[]> {
  return collectAggregatedRss(keyword, FEEDS, "ai_news_zh", 40);
}
