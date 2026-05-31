import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { keywordMock } = vi.hoisted(() => ({
  keywordMock: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { keyword: keywordMock },
}));

import { GET, POST } from "./route";

function jsonReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  keywordMock.findMany.mockReset();
  keywordMock.create.mockReset();
});

describe("GET /api/keywords", () => {
  it("返回按创建时间倒序的列表 + _count", async () => {
    keywordMock.findMany.mockResolvedValue([
      { id: "1", name: "Claude", _count: { topics: 10 } },
    ]);
    const res = await GET();
    const json = await res.json();
    expect(json.keywords).toHaveLength(1);
    expect(keywordMock.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { topics: true } } },
    });
  });
});

describe("POST /api/keywords", () => {
  const baseUrl = "http://localhost/api/keywords";

  it("空 name → 400", async () => {
    const res = await POST(jsonReq(baseUrl, { name: "" }));
    expect(res.status).toBe(400);
    expect(keywordMock.create).not.toHaveBeenCalled();
  });

  it("纯空格 name → 400（防只输空格）", async () => {
    const res = await POST(jsonReq(baseUrl, { name: "   " }));
    expect(res.status).toBe(400);
  });

  it("缺 name 字段 → 400", async () => {
    const res = await POST(jsonReq(baseUrl, {}));
    expect(res.status).toBe(400);
  });

  it("name 不是字符串（如 number）→ 400", async () => {
    const res = await POST(jsonReq(baseUrl, { name: 123 }));
    expect(res.status).toBe(400);
  });

  it("正常创建：name trim、默认 domain/priority/active", async () => {
    keywordMock.create.mockResolvedValue({ id: "abc", name: "Claude" });
    await POST(jsonReq(baseUrl, { name: "  Claude  " }));

    expect(keywordMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Claude", // trimmed
        domain: "通用", // 默认
        priority: "medium", // 默认
        notifyBrowser: true, // 默认开
        notifyEmail: false, // 默认关
        notifyWechat: false, // 默认关
        active: true, // 默认 active
      }),
    });
  });

  it("非法 priority → 落回 medium（防数据脏）", async () => {
    keywordMock.create.mockResolvedValue({ id: "x", name: "t" });
    await POST(
      jsonReq(baseUrl, { name: "t", priority: "URGENT" /* 非法 */ }),
    );
    const data = keywordMock.create.mock.calls[0][0].data;
    expect(data.priority).toBe("medium");
  });

  it("合法 priority 透传", async () => {
    keywordMock.create.mockResolvedValue({ id: "x", name: "t" });
    await POST(jsonReq(baseUrl, { name: "t", priority: "high" }));
    const data = keywordMock.create.mock.calls[0][0].data;
    expect(data.priority).toBe("high");
  });

  it("显式 notifyEmail=true 与 notifyBrowser=false 被尊重", async () => {
    keywordMock.create.mockResolvedValue({ id: "x", name: "t" });
    await POST(
      jsonReq(baseUrl, {
        name: "t",
        notifyEmail: true,
        notifyBrowser: false,
      }),
    );
    const data = keywordMock.create.mock.calls[0][0].data;
    expect(data.notifyEmail).toBe(true);
    expect(data.notifyBrowser).toBe(false);
  });
});
