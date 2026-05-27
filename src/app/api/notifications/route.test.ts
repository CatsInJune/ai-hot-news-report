import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { notificationMock } = vi.hoisted(() => ({
  notificationMock: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { notification: notificationMock },
}));

import { GET, PATCH } from "./route";

function req(url: string, init: RequestInit = {}) {
  return new NextRequest(url, init);
}

beforeEach(() => {
  notificationMock.findMany.mockReset();
  notificationMock.count.mockReset();
  notificationMock.updateMany.mockReset();
});

describe("GET /api/notifications", () => {
  it("默认返回 notifications 数组（前 100）", async () => {
    notificationMock.findMany.mockResolvedValue([
      { id: "n1", title: "a", content: "x", read: false },
      { id: "n2", title: "b", content: "y", read: true },
    ]);
    const res = await GET(req("http://localhost/api/notifications"));
    const json = await res.json();
    expect(json).toHaveProperty("notifications");
    expect(json.notifications).toHaveLength(2);
    expect(notificationMock.findMany).toHaveBeenCalledWith({
      orderBy: { sentAt: "desc" },
      take: 100,
    });
  });

  /**
   * Bug #2 回归保护：?unread=1 必须只返回未读 count。
   * 早期版本忽略 query，整页返回 100 条记录，
   * TopBar badge 永远无法显示。
   */
  it("[regression] ?unread=1 仅返回 { unread: count }", async () => {
    notificationMock.count.mockResolvedValue(7);
    const res = await GET(req("http://localhost/api/notifications?unread=1"));
    const json = await res.json();
    expect(json).toEqual({ unread: 7 });
    expect(notificationMock.count).toHaveBeenCalledWith({
      where: { read: false },
    });
    expect(notificationMock.findMany).not.toHaveBeenCalled();
  });

  it("?unread=1 时不返回完整 notifications（防带宽浪费）", async () => {
    notificationMock.count.mockResolvedValue(0);
    const res = await GET(req("http://localhost/api/notifications?unread=1"));
    const json = await res.json();
    expect(json.notifications).toBeUndefined();
  });

  it("?unread=0 / 其他值 → 走默认分支", async () => {
    notificationMock.findMany.mockResolvedValue([]);
    await GET(req("http://localhost/api/notifications?unread=0"));
    expect(notificationMock.findMany).toHaveBeenCalled();
    expect(notificationMock.count).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/notifications", () => {
  it("markAllRead: true → 调用 updateMany", async () => {
    notificationMock.updateMany.mockResolvedValue({ count: 4 });
    const res = await PATCH(
      req("http://localhost/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAllRead: true }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(notificationMock.updateMany).toHaveBeenCalledWith({
      where: { read: false },
      data: { read: true },
    });
    expect(await res.json()).toEqual({ ok: true });
  });

  it("未知 action → 400", async () => {
    const res = await PATCH(
      req("http://localhost/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ foo: "bar" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(400);
    expect(notificationMock.updateMany).not.toHaveBeenCalled();
  });
});
