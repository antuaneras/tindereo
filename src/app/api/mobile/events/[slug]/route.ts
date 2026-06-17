import { getMobileEventDetail, requireMobileViewerId } from "@/lib/server/mobile-service";
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
    return mobileOk(await getMobileEventDetail(viewerId, slug));
  } catch (error) {
    return mobileError(error);
  }
}
