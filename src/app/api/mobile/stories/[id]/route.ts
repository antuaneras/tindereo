import { deleteMobileStory, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { id } = await context.params;
    await deleteMobileStory(viewerId, id);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
