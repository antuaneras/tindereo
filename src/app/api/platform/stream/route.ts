import { getPlatformEnvelope } from "../../../../lib/server/tindereo-service";
import { subscribeToPlatformUpdates } from "../../../../lib/server/tindereo-realtime";
import type { PlatformDataEnvelope } from "../../../../lib/tindereo-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeSseMessage(payload: PlatformDataEnvelope) {
  const lines = [
    "event: platform",
    `data: ${JSON.stringify(payload)}`
  ];

  if (typeof payload.meta?.revision === "number") {
    lines.splice(1, 0, `id: ${payload.meta.revision}`);
  }

  return `${lines.join("\n")}\n\n`;
}

export function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: PlatformDataEnvelope) => {
        controller.enqueue(encoder.encode(serializeSseMessage(payload)));
      };

      const heartbeat = globalThis.setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 15000);

      send(getPlatformEnvelope());

      const unsubscribe = subscribeToPlatformUpdates((payload) => {
        send(payload);
      });

      const cleanup = () => {
        globalThis.clearInterval(heartbeat);
        unsubscribe();

        try {
          controller.close();
        } catch {
          // Stream may already be closed by the runtime.
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}
