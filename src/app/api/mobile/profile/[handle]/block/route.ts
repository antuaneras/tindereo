import { blockProfile, requireMobileViewerId, unblockProfile } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { handle } = await context.params;
    await blockProfile(viewerId, handle);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { handle } = await context.params;
    await unblockProfile(viewerId, handle);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
