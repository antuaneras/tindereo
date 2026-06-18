import { listMobileNotifications, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viewerId = await requireMobileViewerId();
    return mobileOk({ notifications: await listMobileNotifications(viewerId) });
  } catch (error) {
    return mobileError(error);
  }
}
