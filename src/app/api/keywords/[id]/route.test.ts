import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { keywordMock } = vi.hoisted(() => ({
  keywordMock: {
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { keyword: keywordMock },
}));

import { PATCH, DELETE } from "./route";

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/keywords/abc", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  keywordMock.update.mockReset();
  keywordMock.delete.mockReset();
});

describe("PATCH /api/keywords/[id]", () => {
  it("仅更新提供的字段（部分更新）", async () => {
    keywordMock.update.mockResolvedValue({ id: "abc", active: false });
    await PATCH(patchReq({ active: false }), ctx("abc"));

    expect(keywordMock.update).toHaveBeenCalledWith({
      where: { id: "abc" },
      data: { active: false },
    });
  });

  it("trim name", async () => {
    keywordMock.update.mockResolvedValue({});
    await PATCH(patchReq({ name: "  X  " }), ctx("abc"));
    expect(keywordMock.update.mock.calls[0][0].data.name).toBe("X");
  });

  it("非法 priority 不写入（不污染数据）", async () => {
    keywordMock.update.mockResolvedValue({});
    await PATCH(patchReq({ priority: "INVALID" }), ctx("abc"));
    const data = keywordMock.update.mock.calls[0][0].data;
    expect(data.priority).toBeUndefined();
  });

  it("非 boolean 的 active 不写入", async () => {
    keywordMock.update.mockResolvedValue({});
    await PATCH(patchReq({ active: "yes" /* 字符串 */ }), ctx("abc"));
    const data = keywordMock.update.mock.calls[0][0].data;
    expect(data.active).toBeUndefined();
  });

  it("DB throw（记录不存在）→ 404", async () => {
    keywordMock.update.mockRejectedValue(new Error("Record not found"));
    const res = await PATCH(patchReq({ active: true }), ctx("nope"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/keywords/[id]", () => {
  it("正常删除", async () => {
    keywordMock.delete.mockResolvedValue({ id: "abc" });
    const res = await DELETE(
      new NextRequest("http://localhost/api/keywords/abc", {
        method: "DELETE",
      }),
      ctx("abc"),
    );
    expect(keywordMock.delete).toHaveBeenCalledWith({ where: { id: "abc" } });
    expect(await res.json()).toEqual({ ok: true });
  });

  it("不存在 → 404", async () => {
    keywordMock.delete.mockRejectedValue(new Error("Record not found"));
    const res = await DELETE(
      new NextRequest("http://localhost/api/keywords/x", { method: "DELETE" }),
      ctx("x"),
    );
    expect(res.status).toBe(404);
  });
});
