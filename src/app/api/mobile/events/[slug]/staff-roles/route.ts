import { getMobileEventDetail, requireMobileViewerId, setEventMemberStaffRoles } from "@/lib/server/mobile-service";
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
    const eventDetail = await getMobileEventDetail(viewerId, slug);
    const body = (await request.json().catch(() => null)) as {
      targetUserId?: string;
      roles?: string[];
    } | null;

    if (!body?.targetUserId) {
      throw new Error("Falta la persona a la que quieres cambiar roles.");
    }

    const roles = Array.isArray(body.roles) ? body.roles : [];
    await setEventMemberStaffRoles(
      viewerId,
      eventDetail.event.id,
      body.targetUserId,
      roles.filter((role): role is "moderator" | "scanner" => role === "moderator" || role === "scanner")
    );
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
