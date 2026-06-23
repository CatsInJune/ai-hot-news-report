import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 拦截 OpenAI 构造器，让两个实例的 chat.completions.create 各自可控。
// vi.mock 工厂里禁止引用外部变量，所以把 spy 挂到 globalThis 上，测试里通过 globalThis 取。
vi.mock("openai", () => {
  return {
    default: class FakeOpenAI {
      chat: { completions: { create: ReturnType<typeof vi.fn> } };
      constructor(opts: { baseURL?: string }) {
        const g = globalThis as unknown as {
          __orCreate: ReturnType<typeof vi.fn>;
          __dsCreate: ReturnType<typeof vi.fn>;
        };
        const create = opts.baseURL?.includes("openrouter") ? g.__orCreate : g.__dsCreate;
        this.chat = { completions: { create } };
      }
    },
  };
});

// 必须在 vi.mock 之后 import
import { getOpenRouter, __resetForTest } from "./openrouter";

const orCreate = vi.fn();
const dsCreate = vi.fn();
(globalThis as unknown as { __orCreate: typeof orCreate; __dsCreate: typeof dsCreate }).__orCreate = orCreate;
(globalThis as unknown as { __orCreate: typeof orCreate; __dsCreate: typeof dsCreate }).__dsCreate = dsCreate;

const ok = (tag: string) => ({ choices: [{ message: { content: `from-${tag}` } }] });

beforeEach(() => {
  orCreate.mockReset();
  dsCreate.mockReset();
  __resetForTest();
  process.env.OPENROUTER_API_KEY = "or-key";
  process.env.OPENROUTER_MODEL = "or/model";
  process.env.DEEPSEEK_API_KEY = "ds-key";
  process.env.DEEPSEEK_MODEL = "ds-model";
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_MODEL;
});

describe("getOpenRouter() — fallback wrapper", () => {
  it("primary 正常 → 不调用 fallback", async () => {
    orCreate.mockResolvedValueOnce(ok("or"));
    const client = getOpenRouter()!;
    const r = (await client.chat.completions.create({ model: "or/model", messages: [] })) as {
      choices: { message: { content: string } }[];
    };
    expect(r.choices[0].message.content).toBe("from-or");
    expect(dsCreate).not.toHaveBeenCalled();
  });

  it("primary 400 invalid model → 切 fallback 并用 fallback model", async () => {
    const err = Object.assign(new Error("invalid model"), { status: 400 });
    orCreate.mockRejectedValueOnce(err);
    dsCreate.mockResolvedValueOnce(ok("ds"));

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = getOpenRouter()!;
    const r = (await client.chat.completions.create({ model: "or/model", messages: [] })) as {
      choices: { message: { content: string } }[];
    };
    expect(r.choices[0].message.content).toBe("from-ds");
    expect(dsCreate).toHaveBeenCalledTimes(1);
    // fallback 把 model 字段覆盖成 DEEPSEEK_MODEL
    expect(dsCreate.mock.calls[0][0].model).toBe("ds-model");
    warn.mockRestore();
  });

  it("primary 402 余额不足 → 切 fallback", async () => {
    const err = Object.assign(new Error("insufficient credits"), { status: 402 });
    orCreate.mockRejectedValueOnce(err);
    dsCreate.mockResolvedValueOnce(ok("ds"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = getOpenRouter()!;
    const r = (await client.chat.completions.create({ model: "or/model", messages: [] })) as {
      choices: { message: { content: string } }[];
    };
    expect(r.choices[0].message.content).toBe("from-ds");
  });

  it("primary 5xx → 切 fallback", async () => {
    const err = Object.assign(new Error("upstream down"), { status: 503 });
    orCreate.mockRejectedValueOnce(err);
    dsCreate.mockResolvedValueOnce(ok("ds"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = getOpenRouter()!;
    const r = (await client.chat.completions.create({ model: "or/model", messages: [] })) as {
      choices: { message: { content: string } }[];
    };
    expect(r.choices[0].message.content).toBe("from-ds");
  });

  it("连续 3 次 primary 失败后熔断，第 4 次直接走 fallback（不再打 primary）", async () => {
    const err = Object.assign(new Error("bad"), { status: 400 });
    orCreate.mockRejectedValue(err);
    dsCreate.mockResolvedValue(ok("ds"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = getOpenRouter()!;
    // 前 3 次：primary 失败 → fallback 接住
    await client.chat.completions.create({ model: "or/model", messages: [] });
    await client.chat.completions.create({ model: "or/model", messages: [] });
    await client.chat.completions.create({ model: "or/model", messages: [] });
    expect(orCreate).toHaveBeenCalledTimes(3);
    // 第 4 次：直接 fallback，primary 不再被调用
    await client.chat.completions.create({ model: "or/model", messages: [] });
    expect(orCreate).toHaveBeenCalledTimes(3);
    expect(dsCreate).toHaveBeenCalledTimes(4);
  });

  it("primary 成功后重置熔断计数", async () => {
    const err = Object.assign(new Error("bad"), { status: 400 });
    orCreate.mockRejectedValueOnce(err).mockResolvedValueOnce(ok("or")).mockRejectedValue(err);
    dsCreate.mockResolvedValue(ok("ds"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = getOpenRouter()!;
    await client.chat.completions.create({ model: "or/model", messages: [] }); // fail #1
    await client.chat.completions.create({ model: "or/model", messages: [] }); // success → reset
    // 应该还能再失败 3 次才熔断
    await client.chat.completions.create({ model: "or/model", messages: [] });
    await client.chat.completions.create({ model: "or/model", messages: [] });
    await client.chat.completions.create({ model: "or/model", messages: [] });
    expect(orCreate).toHaveBeenCalledTimes(5);
  });

  it("非可重试错误（网络超时之类、无 status）→ 直接抛，不切 fallback", async () => {
    const err = new Error("ECONNRESET");
    orCreate.mockRejectedValueOnce(err);
    const client = getOpenRouter()!;
    await expect(
      client.chat.completions.create({ model: "or/model", messages: [] }),
    ).rejects.toThrow("ECONNRESET");
    expect(dsCreate).not.toHaveBeenCalled();
  });

  it("只配了 DeepSeek（无 OPENROUTER_API_KEY）→ 直接走 fallback", async () => {
    delete process.env.OPENROUTER_API_KEY;
    __resetForTest();
    dsCreate.mockResolvedValueOnce(ok("ds"));
    const client = getOpenRouter()!;
    const r = (await client.chat.completions.create({ model: "ignored", messages: [] })) as {
      choices: { message: { content: string } }[];
    };
    expect(r.choices[0].message.content).toBe("from-ds");
    expect(orCreate).not.toHaveBeenCalled();
  });

  it("两边都没配 → 返回 null", () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    __resetForTest();
    expect(getOpenRouter()).toBeNull();
  });
});
