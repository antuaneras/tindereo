import { publishMobilePost, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const viewerId = await requireMobileViewerId();
    return mobileOk(await publishMobilePost(viewerId, await request.json()), { status: 201 });
  } catch (error) {
    return mobileError(error);
  }
}
