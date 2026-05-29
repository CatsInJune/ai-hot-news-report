// 全局类型定义

export type SourceType =
  | "twitter"
  | "bing"
  | "google"
  | "hackernews"
  | "sogou"
  | "bilibili"
  | "weibo";

export const SOURCE_LABELS: Record<SourceType, string> = {
  twitter: "Twitter",
  bing: "Bing",
  google: "Google",
  hackernews: "Hacker News",
  sogou: "搜狗微信",
  bilibili: "B站",
  weibo: "微博",
};

export const SOURCE_COLORS: Record<SourceType, string> = {
  twitter: "#1DA1F2",
  bing: "#008373",
  google: "#4285F4",
  hackernews: "#FF6600",
  sogou: "#FF6900",
  bilibili: "#00A1D6",
  weibo: "#E6162D",
};

// 采集器统一返回数据格式
export interface RawTopic {
  title: string;
  // 短描述/摘要，给 AI 分析当素材用；可能是 RSS snippet / 视频简介等
  // 注意：不一定是有意义的"原文"，所以不直接展示到"查看原文"区
  summary?: string;
  // 真正有意义的"原文"内容（推文全文 / 公众号正文 / 新闻摘要等），
  // 仅当 collector 确认有可读原文时才设置。为空 → 前端不显示"查看原文"按钮
  rawContent?: string;
  url: string;
  source: SourceType;
  author?: string;
  authorVerified?: boolean;
  authorFollowers?: number;
  publishedAt: Date;
  likes?: number;
  reposts?: number;
  comments?: number;
  views?: number;
  // 账号订阅来源标记：true 表示该内容是从监控账号本身的 timeline 拉来的，
  // 内在相关性已确定，pipeline 应跳过 pre-match 严打逻辑
  subscribed?: boolean;
}

// AI 分析结果
export interface AnalysisResult {
  realScore: number;
  relevScore: number;
  hotScore: number;
  summary: string;
  isSpam: boolean;
  reason: string;
  // 内容是否字面提及关键词或其变体（pre-match 结果会作为输入，AI 也会复核）
  keywordMentioned: boolean;
  // 对关注此关键词的人的重要程度
  importance: "low" | "medium" | "high" | "urgent";
}

// Pre-match 结果：对原文做 literal substring 检测
export interface PreMatchResult {
  matched: boolean;
  matchedTerms: string[];
}

// 平台账号关联
export interface KeywordAccount {
  platform: "twitter" | "bilibili" | "weibo";
  handle?: string;
  uid?: string;
  name?: string;
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
