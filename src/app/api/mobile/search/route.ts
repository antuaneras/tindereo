import { getMobileSearch, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const viewerId = await requireMobileViewerId();
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return mobileOk(await getMobileSearch(viewerId, query));
  } catch (error) {
    return mobileError(error);
  }
}
