// 简单的请求间隔限速器：保证两次请求之间至少间隔 minIntervalMs。
// 用于 twitterapi.io 这类有 QPS 限制的外部 API。
class RateLimiter {
  private chain: Promise<void> = Promise.resolve();

  constructor(private minIntervalMs: number) {}

  /** 把任务串行化，确保两次执行之间至少间隔 minIntervalMs */
  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      const result = await fn();
      await new Promise((r) => setTimeout(r, this.minIntervalMs));
      return result;
    });
    // 链尾只关心顺序，不传递结果，错误也吞掉避免破坏链
    this.chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }
}

// twitterapi.io 免费版限制：5 秒 1 个请求
export const twitterLimiter = new RateLimiter(5100);

// B 站 API 防 -799：搜索/空间接口 ≥ 2 秒间隔
export const bilibiliLimiter = new RateLimiter(2000);
