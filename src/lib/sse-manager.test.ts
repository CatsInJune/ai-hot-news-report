import { describe, it, expect, beforeEach, vi } from "vitest";
import { sseManager } from "./sse-manager";

// 构造一个最小可控的 controller 替身
function mockController(opts: { fail?: boolean } = {}) {
  return {
    enqueue: vi.fn((_bytes: Uint8Array) => {
      if (opts.fail) throw new Error("client gone");
    }),
  } as unknown as ReadableStreamDefaultController<Uint8Array> & {
    enqueue: ReturnType<typeof vi.fn>;
  };
}

describe("SSEManager", () => {
  beforeEach(() => {
    // 清理上一个测试残留连接
    // @ts-expect-error 直接访问 private 字段（仅测试用）
    sseManager["clients"].clear();
  });

  it("add / remove / count 工作正常", () => {
    const a = mockController();
    const b = mockController();
    sseManager.add(a);
    sseManager.add(b);
    expect(sseManager.count()).toBe(2);
    sseManager.remove(a);
    expect(sseManager.count()).toBe(1);
  });

  it("broadcast 给所有 client 推送同一份 JSON payload", () => {
    const a = mockController();
    const b = mockController();
    sseManager.add(a);
    sseManager.add(b);

    sseManager.broadcast({ type: "new-topic", id: "abc" });

    expect(a.enqueue).toHaveBeenCalledTimes(1);
    expect(b.enqueue).toHaveBeenCalledTimes(1);

    // 验证 SSE 格式 `data: <json>\n\n`
    const payload = new TextDecoder().decode(
      a.enqueue.mock.calls[0][0] as Uint8Array,
    );
    expect(payload.startsWith("data: ")).toBe(true);
    expect(payload.endsWith("\n\n")).toBe(true);
    const parsed = JSON.parse(payload.slice(6).trim());
    expect(parsed).toEqual({ type: "new-topic", id: "abc" });
  });

  it("某 client enqueue 抛错时自动从池中移除（防泄漏）", () => {
    const good = mockController();
    const bad = mockController({ fail: true });
    sseManager.add(good);
    sseManager.add(bad);
    expect(sseManager.count()).toBe(2);

    sseManager.broadcast({ tick: 1 });

    expect(sseManager.count()).toBe(1);
    expect(good.enqueue).toHaveBeenCalled();
  });

  it("无 client 时 broadcast 不应抛错", () => {
    expect(() => sseManager.broadcast({ x: 1 })).not.toThrow();
  });
});
