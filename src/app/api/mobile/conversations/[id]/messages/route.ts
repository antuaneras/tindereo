import { requireMobileViewerId, sendMobileMessage } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      throw new Error("El mensaje no es valido.");
    }
    return mobileOk({
      messageId: await sendMobileMessage(viewerId, {
        conversationId: id,
        body: typeof body.body === "string" ? body.body : "",
        threadRootId: typeof body.threadRootId === "string" ? body.threadRootId : null,
        ephemeralExpiresAt: typeof body.ephemeralExpiresAt === "string" ? body.ephemeralExpiresAt : null,
        media:
          body.media && typeof body.media === "object"
            ? {
                assetRef: String((body.media as { assetRef?: unknown }).assetRef ?? ""),
                previewUrl:
                  typeof (body.media as { previewUrl?: unknown }).previewUrl === "string"
                    ? String((body.media as { previewUrl?: unknown }).previewUrl)
                    : null,
                mimeType: String((body.media as { mimeType?: unknown }).mimeType ?? "image/jpeg")
              }
            : null
      })
    }, { status: 201 });
  } catch (error) {
    return mobileError(error);
  }
}
