import { getMobileViewerSummary, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return mobileOk(await getMobileViewerSummary(await requireMobileViewerId()));
  } catch (error) {
    return mobileError(error);
  }
}
