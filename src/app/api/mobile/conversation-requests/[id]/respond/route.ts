import { mobileError, mobileOk } from "@/lib/server/mobile-http";
import { requireMobileViewerId, respondToConversationRequest } from "@/lib/server/mobile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { accept?: boolean } | null;
    if (!body || typeof body.accept !== "boolean") {
      throw new Error("Falta indicar si aceptas o rechazas.");
    }

    return mobileOk(await respondToConversationRequest(viewerId, id, body.accept));
  } catch (error) {
    return mobileError(error);
  }
}
