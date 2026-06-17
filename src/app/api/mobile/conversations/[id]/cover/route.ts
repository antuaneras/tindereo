import { requireMobileViewerId, updateConversationCover } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { coverImage?: string | null } | null;

    return mobileOk(
      await updateConversationCover(
        viewerId,
        id,
        typeof body?.coverImage === "string" || body?.coverImage === null ? body.coverImage : null
      )
    );
  } catch (error) {
    return mobileError(error);
  }
}
