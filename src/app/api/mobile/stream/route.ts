import { cookies } from "next/headers";
import { getAuthenticatedUserId } from "@/lib/server/tindereo-auth";
import { subscribeToMobileRealtimeEvents } from "@/lib/server/mobile-realtime";
import type { MobileStreamEvent } from "@/lib/mobile-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeEvent(event: MobileStreamEvent) {
  return `event: mobile\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(request: Request) {
  const viewerId = await getAuthenticatedUserId(await cookies());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: MobileStreamEvent) => {
        if (event.viewerId && viewerId && event.viewerId !== viewerId) {
          return;
        }
        controller.enqueue(encoder.encode(serializeEvent(event)));
      };

      const heartbeat = globalThis.setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: ${Date.now()}\n\n`));
      }, 15000);

      const unsubscribe = subscribeToMobileRealtimeEvents(send);
      request.signal.addEventListener(
        "abort",
        () => {
          globalThis.clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Ignore close races from the runtime.
          }
        },
        { once: true }
      );

      send({
        type: "bootstrap",
        viewerId,
        at: new Date().toISOString()
      });
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
