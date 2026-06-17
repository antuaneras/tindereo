import { getEventAccessTicket, getMobileEventDetail, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { slug } = await context.params;
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    return mobileOk(await getEventAccessTicket(viewerId, eventDetail.event.id));
  } catch (error) {
    return mobileError(error);
  }
}
