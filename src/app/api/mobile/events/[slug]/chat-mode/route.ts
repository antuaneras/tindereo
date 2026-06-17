import { getMobileEventDetail, requireMobileViewerId, setEventChatMode } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const body = (await request.json().catch(() => null)) as { mode?: "open" | "announcements" } | null;
    if (!body || (body.mode !== "open" && body.mode !== "announcements")) {
      throw new Error("El modo del chat no es valido.");
    }
    const { slug } = await context.params;
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    await setEventChatMode(viewerId, eventDetail.event.id, body.mode);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
