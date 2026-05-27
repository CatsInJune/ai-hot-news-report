import { sseManager } from "@/lib/sse-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      sseManager.add(controller);

      // 连接建立时发送一条 hello
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "hello", time: Date.now() })}\n\n`)
      );

      // 心跳（每 25 秒）
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "ping" })}\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
          sseManager.remove(controller);
        }
      }, 25_000);

      // 当连接关闭时清理（通过 controller close 触发）
      (controller as ReadableStreamDefaultController & { _cleanup?: () => void })._cleanup = () => {
        clearInterval(heartbeat);
        sseManager.remove(controller);
      };
    },
    cancel(controller) {
      const c = controller as ReadableStreamDefaultController & { _cleanup?: () => void };
      c._cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
