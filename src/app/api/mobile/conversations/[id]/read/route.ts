import { markConversationRead, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { id } = await context.params;
    await markConversationRead(viewerId, id);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
