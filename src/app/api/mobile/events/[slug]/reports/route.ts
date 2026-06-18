import { getMobileEventDetail, reportEventMember, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const body = (await request.json().catch(() => null)) as { reason?: string; targetUserId?: string } | null;
    if (!body?.targetUserId || !body.reason) {
      throw new Error("Falta completar el reporte.");
    }

    const { slug } = await context.params;
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    await reportEventMember(viewerId, eventDetail.event.id, body.targetUserId, body.reason);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
