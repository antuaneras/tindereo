import { getMobileEventDetail, moderateEventMember, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const body = (await request.json().catch(() => null)) as { action?: string; targetUserId?: string } | null;
    if (!body || typeof body.targetUserId !== "string" || typeof body.action !== "string") {
      throw new Error("La accion de moderacion no es valida.");
    }
    const { slug } = await context.params;
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    await moderateEventMember(viewerId, eventDetail.event.id, body.targetUserId, body.action as never);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
