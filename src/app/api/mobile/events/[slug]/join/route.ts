import { getMobileEventDetail, joinMobileEvent, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { slug } = await context.params;
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    const membership = await joinMobileEvent(viewerId, eventDetail.event.id);
    return mobileOk({ membership });
  } catch (error) {
    return mobileError(error);
  }
}
