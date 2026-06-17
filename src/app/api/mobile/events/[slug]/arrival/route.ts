import { getMobileEventDetail, requireMobileViewerId, setMobileArrivalStatus } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { slug } = await context.params;
    const body = (await request.json().catch(() => null)) as { arrivalStatus?: string } | null;
    if (!body || typeof body.arrivalStatus !== "string") {
      throw new Error("El estado de llegada no es valido.");
    }
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    await setMobileArrivalStatus(viewerId, eventDetail.event.id, body.arrivalStatus as never);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
