import { addEventCohost, getMobileEventDetail, requireMobileViewerId } from "@/lib/server/mobile-service";
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
    if (!body || typeof body.targetUserId !== "string") {
      throw new Error("Selecciona a alguien para coorganizar.");
    }
    const { slug } = await context.params;
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    await addEventCohost(viewerId, eventDetail.event.id, body.targetUserId);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
