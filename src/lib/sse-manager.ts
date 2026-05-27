// SSE 连接管理（全局单例，维护所有客户端连接）

type SSEController = ReadableStreamDefaultController<Uint8Array>;

class SSEManager {
  private clients = new Set<SSEController>();
  private encoder = new TextEncoder();

  add(controller: SSEController) {
    this.clients.add(controller);
  }

  remove(controller: SSEController) {
    this.clients.delete(controller);
  }

  count() {
    return this.clients.size;
  }

  broadcast(event: object) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    const bytes = this.encoder.encode(payload);

    for (const ctrl of this.clients) {
      try {
        ctrl.enqueue(bytes);
      } catch {
        this.clients.delete(ctrl);
      }
    }
  }
}

// 全局单例（开发模式 HMR 友好）
const globalForSSE = globalThis as unknown as { sseManager?: SSEManager };
export const sseManager = globalForSSE.sseManager ?? new SSEManager();
if (process.env.NODE_ENV !== "production") globalForSSE.sseManager = sseManager;
