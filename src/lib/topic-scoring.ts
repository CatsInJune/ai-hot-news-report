// 综合分计算 + Topic 排序工具

const IMPORTANCE_WEIGHT: Record<string, number> = {
  urgent: 30,
  high: 15,
  medium: 0,
  low: -15,
};

const IMPORTANCE_RANK: Record<string, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

// 半衰期常量：48 小时
const HALF_LIFE_HOURS = 48;

export interface ScorableTopic {
  hotScore: number;
  relevScore: number;
  importance: string;
  publishedAt: Date | string;
}

/**
 * 综合分：score = hotScore × exp(-hoursSincePublished / HALF_LIFE_HOURS) + importanceWeight
 * - 时间越久 hotScore 部分越小（半衰期 48h）
 * - importance 作为绝对加分项，避免低 importance 被时间衰减直接压死
 */
export function compositeScore(t: ScorableTopic, now: Date = new Date()): number {
  const pub = typeof t.publishedAt === "string" ? new Date(t.publishedAt) : t.publishedAt;
  const hours = Math.max(0, (now.getTime() - pub.getTime()) / (3600 * 1000));
  const decay = Math.exp(-hours / HALF_LIFE_HOURS);
  return t.hotScore * decay + (IMPORTANCE_WEIGHT[t.importance] ?? 0);
}

export type SortKey = "composite" | "latest" | "importance" | "relevance" | "hot";

/**
 * 对 Topic 列表做应用层排序。
 * 综合分排序需要 JS 端算（依赖时间衰减）；其他可直接用 ORDER BY，但为了一致性都走这里。
 */
export function sortTopics<T extends ScorableTopic & { publishedAt: Date | string }>(
  topics: T[],
  sortKey: SortKey,
  now: Date = new Date()
): T[] {
  switch (sortKey) {
    case "composite":
      return [...topics].sort((a, b) => compositeScore(b, now) - compositeScore(a, now));
    case "latest":
      return [...topics].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    case "importance":
      return [...topics].sort((a, b) => {
        const diff = (IMPORTANCE_RANK[b.importance] ?? -1) - (IMPORTANCE_RANK[a.importance] ?? -1);
        if (diff !== 0) return diff;
        // tie-break：最新发布优先
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
    case "relevance":
      return [...topics].sort((a, b) => {
        const diff = b.relevScore - a.relevScore;
        if (diff !== 0) return diff;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
    case "hot":
      return [...topics].sort((a, b) => {
        const diff = b.hotScore - a.hotScore;
        if (diff !== 0) return diff;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }
}
