import { markAllMobileNotificationsRead, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const viewerId = await requireMobileViewerId();
    await markAllMobileNotificationsRead(viewerId);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
