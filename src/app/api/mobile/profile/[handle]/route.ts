import { getMobileProfileDetail, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { handle } = await context.params;
    return mobileOk(await getMobileProfileDetail(viewerId, handle));
  } catch (error) {
    return mobileError(error);
  }
}
