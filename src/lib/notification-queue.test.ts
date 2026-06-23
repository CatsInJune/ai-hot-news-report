/**
 * Regression: GitHub Actions 把未设的 secret 注入成 ""，原代码 `??` 不接管空串，
 * parseInt("") = NaN 让 setTimeout(NaN) ≈ setTimeout(0)，每条命中立刻 flush，
 * 微信被刷屏 N 次。这里覆盖空串 / undefined / 非法值都正确兜底。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendWechatDigest = vi.fn();
const sendKeywordDigest = vi.fn();
const getWechatWebhookUrls = vi.fn(() => ["https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=k"]);

vi.mock("./wechat", () => ({
  sendWechatDigest,
  getWechatWebhookUrls,
}));
vi.mock("./mailer", () => ({
  sendKeywordDigest,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { create: vi.fn().mockResolvedValue({}) } },
}));

async function freshImport() {
  vi.resetModules();
  return import("./notification-queue");
}

const item = (k: string) => ({
  keyword: k,
  title: `t-${k}`,
  summary: "s",
  url: `https://x/${k}`,
  source: "twitter",
  hotScore: 80,
  importance: "high",
});

beforeEach(() => {
  sendWechatDigest.mockReset().mockResolvedValue({ ok: true, sent: 1, errors: [] });
  sendKeywordDigest.mockReset().mockResolvedValue(true);
  process.env.NOTIFICATION_EMAIL = "to@x.com";
});

describe("notification-queue env 兜底", () => {
  it("[regression] EMAIL_DIGEST_WINDOW_MS='' (GitHub Actions 未设) → 不会立即 flush", async () => {
    process.env.EMAIL_DIGEST_WINDOW_MS = "";
    process.env.EMAIL_DIGEST_MAX_ITEMS = "";
    const { enqueueAlert } = await freshImport();

    enqueueAlert(item("a"), { emailOptIn: true, wechatOptIn: true });
    enqueueAlert(item("b"), { emailOptIn: true, wechatOptIn: true });
    enqueueAlert(item("c"), { emailOptIn: true, wechatOptIn: true });

    // 给事件循环一拍：如果 window=0 / NaN 的 bug 还在，此时已 flush 多次
    await new Promise((r) => setTimeout(r, 50));

    // 期望：3 条都还在队列里，一次都没发
    expect(sendWechatDigest).not.toHaveBeenCalled();
    expect(sendKeywordDigest).not.toHaveBeenCalled();
  });

  it("flushAllDigests() 把 3 条聚合成 1 次推送（不是 3 次单发）", async () => {
    process.env.EMAIL_DIGEST_WINDOW_MS = "";
    process.env.EMAIL_DIGEST_MAX_ITEMS = "";
    const { enqueueAlert, flushAllDigests } = await freshImport();

    enqueueAlert(item("a"), { emailOptIn: true, wechatOptIn: true });
    enqueueAlert(item("b"), { emailOptIn: true, wechatOptIn: true });
    enqueueAlert(item("c"), { emailOptIn: true, wechatOptIn: true });

    await flushAllDigests();

    expect(sendWechatDigest).toHaveBeenCalledTimes(1);
    expect(sendWechatDigest.mock.calls[0][0].items).toHaveLength(3);
    expect(sendKeywordDigest).toHaveBeenCalledTimes(1);
    expect(sendKeywordDigest.mock.calls[0][0].items).toHaveLength(3);
  });

  it("非法值（abc）→ 走默认值，不立即 flush", async () => {
    process.env.EMAIL_DIGEST_WINDOW_MS = "abc";
    process.env.EMAIL_DIGEST_MAX_ITEMS = "abc";
    const { enqueueAlert } = await freshImport();
    enqueueAlert(item("a"), { emailOptIn: true, wechatOptIn: true });
    await new Promise((r) => setTimeout(r, 30));
    expect(sendWechatDigest).not.toHaveBeenCalled();
  });

  it("达到 MAX_ITEMS 立刻 flush（max=2 时第 2 条触发）", async () => {
    process.env.EMAIL_DIGEST_WINDOW_MS = "300000";
    process.env.EMAIL_DIGEST_MAX_ITEMS = "2";
    const { enqueueAlert } = await freshImport();
    enqueueAlert(item("a"), { emailOptIn: true, wechatOptIn: true });
    expect(sendWechatDigest).not.toHaveBeenCalled();
    enqueueAlert(item("b"), { emailOptIn: true, wechatOptIn: true });
    await new Promise((r) => setTimeout(r, 10));
    expect(sendWechatDigest).toHaveBeenCalledTimes(1);
    expect(sendWechatDigest.mock.calls[0][0].items).toHaveLength(2);
  });
});
