import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock OpenRouter client。在 module-level 创建一个可控 spy。
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
  keywordMentioned: true,
  relevScore: 70,
  hotScore: 90,
  importance: "medium",
  isSpam: false,
  summary: "测试摘要",
  reason: "看起来真实",
});

const baseInput = (overrides?: Partial<Parameters<typeof analyzeContent>[0]>) => ({
  title: "t",
  text: "x",
  source: "twitter",
  keyword: "Claude",
  preMatch: { matched: true, matchedTerms: ["Claude"] },
  ...overrides,
});

beforeEach(() => {
  createCompletion.mockReset();
});

describe("analyzeContent()", () => {
  it("正常返回结构化结果", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    const r = await analyzeContent(baseInput());
    expect(r).toEqual({
      realScore: 80,
      keywordMentioned: true,
      relevScore: 70,
      hotScore: 90,
      importance: "medium",
      isSpam: false,
      summary: "测试摘要",
      reason: "看起来真实",
    });
  });

  /**
   * Bug #1 回归保护：调用必须显式传 max_tokens，且必须 <= 4096。
   * 否则 OpenRouter 会按模型默认 32768/65536 预扣额度，免费账户直接 402 失败。
   */
  it("[regression] 必须显式传 max_tokens 且 <= 4096", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent(baseInput());

    const callArg = createCompletion.mock.calls[0][0];
    expect(callArg.max_tokens).toBeDefined();
    expect(typeof callArg.max_tokens).toBe("number");
    expect(callArg.max_tokens).toBeGreaterThan(0);
    expect(callArg.max_tokens).toBeLessThanOrEqual(4096);
  });

  it("用 json_object 格式（DeepSeek/OpenAI/OpenRouter 通用）+ system prompt 列出所有必填字段", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent(baseInput());
    const arg = createCompletion.mock.calls[0][0];
    expect(arg.response_format?.type).toBe("json_object");
    // schema 字段定义在 system prompt 文本里
    const sysMsg = arg.messages.find((m: { role: string }) => m.role === "system");
    for (const f of [
      "realScore",
      "keywordMentioned",
      "relevScore",
      "hotScore",
      "importance",
      "isSpam",
      "summary",
      "reason",
    ]) {
      expect(sysMsg.content).toContain(f);
    }
  });

  it("正文超长截断到 1500 字（控制 token 用量）", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    const longText = "啊".repeat(3000);
    await analyzeContent(baseInput({ text: longText }));
    const userMsg = createCompletion.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    // 期望正文部分 <= 1500 字（前后还有标题/来源/hint，总长 < 2000）
    expect(userMsg.content.length).toBeLessThan(2000);
  });

  it("temperature 设置 ≤ 0.3（评分要稳定）", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent(baseInput());
    const t = createCompletion.mock.calls[0][0].temperature;
    expect(t).toBeLessThanOrEqual(0.3);
  });

  it("API 抛错 → 返回 null（降级，不冒泡）", async () => {
    createCompletion.mockRejectedValueOnce(new Error("402 credits"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await analyzeContent(baseInput());
    expect(r).toBeNull();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("响应 content 为空 → 返回 null", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });
    const r = await analyzeContent(baseInput());
    expect(r).toBeNull();
  });

  it("响应 JSON 解析失败 → 返回 null（不冒泡）", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: "not json" } }],
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await analyzeContent(baseInput());
    expect(r).toBeNull();
    errSpy.mockRestore();
  });

  it("user prompt 包含关键词", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent(baseInput({ keyword: "Claude Code" }));
    const userMsg = createCompletion.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMsg.content).toContain("Claude Code");
  });

  it("preMatch.matched=true 时 prompt 应该列出命中的变体", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent(
      baseInput({ preMatch: { matched: true, matchedTerms: ["yupi", "@yupi996"] } }),
    );
    const userMsg = createCompletion.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMsg.content).toContain("yupi");
    expect(userMsg.content).toContain("@yupi996");
  });

  it("preMatch.matched=false 时 prompt 应该提示严格审核", async () => {
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: VALID_JSON } }],
    });
    await analyzeContent(baseInput({ preMatch: { matched: false, matchedTerms: [] } }));
    const userMsg = createCompletion.mock.calls[0][0].messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMsg.content).toMatch(/没有|严格/);
  });

  it("[强约束] preMatch.matched=false 且 keywordMentioned=false 时，relevScore 强制 ≤25", async () => {
    // AI 不老实给了 80，但因为 preMatch 没命中且 keywordMentioned=false，应被强制压回 ≤25
    const looseJson = JSON.stringify({
      realScore: 80,
      keywordMentioned: false,
      relevScore: 80,
      hotScore: 50,
      importance: "low",
      isSpam: false,
      summary: "x",
      reason: "y",
    });
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: looseJson } }],
    });
    const r = await analyzeContent(baseInput({ preMatch: { matched: false, matchedTerms: [] } }));
    expect(r?.relevScore).toBeLessThanOrEqual(25);
  });
});

describe("analyzeBatch()", () => {
  it("批量分析 N 条都成功", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: VALID_JSON } }],
    });
    const items = Array.from({ length: 12 }, (_, i) => ({
      id: `t${i}`,
      input: baseInput({ title: `T${i}` }),
    }));
    const m = await analyzeBatch(items);
    expect(m.size).toBe(12);
    expect(m.get("t0")?.hotScore).toBe(90);
  });

  it("部分失败的条目不进 result map（不污染数据库）", async () => {
    createCompletion
      .mockResolvedValueOnce({ choices: [{ message: { content: VALID_JSON } }] })
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ choices: [{ message: { content: VALID_JSON } }] });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await analyzeBatch([
      { id: "a", input: baseInput() },
      { id: "b", input: baseInput() },
      { id: "c", input: baseInput() },
    ]);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
    expect(m.has("c")).toBe(true);
    errSpy.mockRestore();
  });

  it("空输入返回空 map", async () => {
    const m = await analyzeBatch([]);
    expect(m.size).toBe(0);
  });
});
