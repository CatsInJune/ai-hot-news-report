import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock OpenRouter client。
 * 在 module-level 创建一个可控 spy，注入到 `getOpenRouter()`。
 */
const createCompletion = vi.fn();

vi.mock("./openrouter", () => ({
  getOpenRouter: () => ({
    chat: { completions: { create: createCompletion } },
  }),
  DEFAULT_MODEL: "test/model",
}));

import { analyzeContent, analyzeBatch } from "./analyzer";

const VALID_JSON = JSON.stringify({
  realScore: 80,
  relevScore: 70,
  hotScore: 90,
  summary: "测试摘要",
  isSpam: false,
  reason: "看起来真实",
});

beforeEach(() => {
  createCompletion.mockReset();
});

describe("analyzeContent()", () => {
  it("正常返回结构化结果", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    const r = await analyzeContent({
      title: "t",
      text: "x",
      source: "twitter",
      keyword: "Claude",
    });
    expect(r).toEqual({
      realScore: 80,
      relevScore: 70,
      hotScore: 90,
      summary: "测试摘要",
      isSpam: false,
      reason: "看起来真实",
    });
  });

  /**
   * Bug #1 回归保护：调用必须显式传 max_tokens，且必须 <= 4096。
   * 否则 OpenRouter 会按模型默认 32768/65536 预扣额度，
   * 免费账户直接 402 失败，导致全部 topic 无 AI 评分。
   */
  it("[regression] 必须显式传 max_tokens 且 <= 4096", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent({ title: "t", text: "x", source: "bing" });

    const callArg = createCompletion.mock.calls[0][0];
    expect(callArg.max_tokens).toBeDefined();
    expect(typeof callArg.max_tokens).toBe("number");
    expect(callArg.max_tokens).toBeGreaterThan(0);
    expect(callArg.max_tokens).toBeLessThanOrEqual(4096);
  });

  it("用了 json_schema 严格模式", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent({ title: "t", text: "x", source: "google" });
    const arg = createCompletion.mock.calls[0][0];
    expect(arg.response_format?.type).toBe("json_schema");
    expect(arg.response_format?.json_schema?.strict).toBe(true);
    expect(arg.response_format?.json_schema?.schema?.required).toEqual(
      expect.arrayContaining([
        "realScore",
        "relevScore",
        "hotScore",
        "summary",
        "isSpam",
        "reason",
      ]),
    );
  });

  it("正文超长截断到 600 字（控制 token 用量）", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    const longText = "啊".repeat(2000);
    await analyzeContent({ title: "t", text: longText, source: "weibo" });
    const userMsg = createCompletion.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    // 期望正文部分 <= 600 字（前后还有标题/来源等元数据，总长 < 1200）
    expect(userMsg.content.length).toBeLessThan(1200);
  });

  it("temperature 设置 ≤ 0.3（评分要稳定）", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent({ title: "t", text: "x", source: "bing" });
    const t = createCompletion.mock.calls[0][0].temperature;
    expect(t).toBeLessThanOrEqual(0.3);
  });

  it("API 抛错 → 返回 null（降级，不冒泡）", async () => {
    createCompletion.mockRejectedValueOnce(new Error("402 credits"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await analyzeContent({ title: "t", text: "x", source: "bing" });
    expect(r).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("响应 content 为空 → 返回 null", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });
    const r = await analyzeContent({ title: "t", text: "x", source: "bing" });
    expect(r).toBeNull();
  });

  it("响应 JSON 解析失败 → 返回 null（不冒泡）", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await analyzeContent({ title: "t", text: "x", source: "bing" });
    expect(r).toBeNull();
    errSpy.mockRestore();
  });

  it("传入 keyword 时 user prompt 包含该关键词", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent({
      title: "t",
      text: "x",
      source: "bing",
      keyword: "Claude Code",
    });
    const userMsg = createCompletion.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMsg.content).toContain("Claude Code");
  });

  it("不传 keyword 时 user prompt 标记无关键词", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent({ title: "t", text: "x", source: "bing" });
    const userMsg = createCompletion.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMsg.content).toContain("无关键词");
  });
});

describe("analyzeBatch()", () => {
  it("批量分析 N 条都成功", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: VALID_JSON } }],
    });
    const items = Array.from({ length: 12 }, (_, i) => ({
      id: `t${i}`,
      input: { title: `T${i}`, text: "x", source: "bing" },
    }));
    const m = await analyzeBatch(items);
    expect(m.size).toBe(12);
    expect(m.get("t0")?.hotScore).toBe(90);
  });

  it("部分失败的条目不进 result map（不污染数据库）", async () => {
    createCompletion
      .mockResolvedValueOnce({
        choices: [{ message: { content: VALID_JSON } }],
      })
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({
        choices: [{ message: { content: VALID_JSON } }],
      });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await analyzeBatch([
      { id: "a", input: { title: "T", text: "x", source: "bing" } },
      { id: "b", input: { title: "T", text: "x", source: "bing" } },
      { id: "c", input: { title: "T", text: "x", source: "bing" } },
    ]);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false); // 失败的不入
    expect(m.has("c")).toBe(true);
    errSpy.mockRestore();
  });

  it("空输入返回空 map", async () => {
    const m = await analyzeBatch([]);
    expect(m.size).toBe(0);
  });
});
