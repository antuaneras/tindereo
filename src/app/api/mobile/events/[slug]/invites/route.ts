import { createMobileEventInvite, getMobileEventDetail, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const body = (await request.json().catch(() => null)) as { targetUserId?: string } | null;
    if (!body?.targetUserId) {
      throw new Error("Falta la persona a la que quieres invitar.");
    }

    const { slug } = await context.params;
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    return mobileOk({
      invite: await createMobileEventInvite(viewerId, eventDetail.event.id, body.targetUserId)
    });
  } catch (error) {
    return mobileError(error);
  }
}
