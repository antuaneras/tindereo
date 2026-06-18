import { updateMobileProfile, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const viewerId = await requireMobileViewerId();
    const body = (await request.json().catch(() => null)) as
      | { avatarUrl?: string | null; bio?: string; city?: string; coverUrl?: string | null; displayName?: string; isPrivate?: boolean }
      | null;
    if (
      !body ||
      typeof body.displayName !== "string" ||
      typeof body.city !== "string" ||
      typeof body.bio !== "string"
    ) {
      throw new Error("Los datos del perfil no son validos.");
    }

    return mobileOk(
      await updateMobileProfile(viewerId, {
        displayName: body.displayName,
        city: body.city,
        bio: body.bio,
        avatarUrl: typeof body.avatarUrl === "string" || body.avatarUrl === null ? body.avatarUrl : null,
        coverUrl: typeof body.coverUrl === "string" || body.coverUrl === null ? body.coverUrl : null,
        isPrivate: typeof body.isPrivate === "boolean" ? body.isPrivate : undefined
      })
    );
  } catch (error) {
    return mobileError(error);
  }
}
