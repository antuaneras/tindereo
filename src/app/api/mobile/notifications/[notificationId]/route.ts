import { mobileError, mobileOk } from "@/lib/server/mobile-http";
import { deleteMobileNotification, requireMobileViewerId } from "@/lib/server/mobile-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { notificationId } = await context.params;
    await deleteMobileNotification(viewerId, notificationId);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
