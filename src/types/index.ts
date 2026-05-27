// 全局类型定义

export type SourceType =
  | "twitter"
  | "bing"
  | "google"
  | "duckduckgo"
  | "hackernews"
  | "sogou"
  | "bilibili"
  | "weibo";

export const SOURCE_LABELS: Record<SourceType, string> = {
  twitter: "Twitter",
  bing: "Bing",
  google: "Google",
  duckduckgo: "DuckDuckGo",
  hackernews: "Hacker News",
  sogou: "搜狗微信",
  bilibili: "B站",
  weibo: "微博",
};

export const SOURCE_COLORS: Record<SourceType, string> = {
  twitter: "#1DA1F2",
  bing: "#008373",
  google: "#4285F4",
  duckduckgo: "#DE5833",
  hackernews: "#FF6600",
  sogou: "#FF6900",
  bilibili: "#00A1D6",
  weibo: "#E6162D",
};

// 采集器统一返回数据格式
export interface RawTopic {
  title: string;
  summary?: string;
  url: string;
  source: SourceType;
  author?: string;
  publishedAt: Date;
  likes?: number;
  reposts?: number;
  comments?: number;
  views?: number;
}

// AI 分析结果
export interface AnalysisResult {
  realScore: number;
  relevScore: number;
  hotScore: number;
  summary: string;
  isSpam: boolean;
  reason: string;
}

// SSE 事件类型
export type SSEEvent =
  | { type: "ping" }
  | { type: "new-topic"; topic: TopicPayload }
  | { type: "alert"; topic: TopicPayload; keyword: string };

export interface TopicPayload {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  hotScore: number;
  realScore: number;
  publishedAt: string;
  author: string | null;
}
