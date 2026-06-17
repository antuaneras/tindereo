import { createMobilePostComment, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const viewerId = await requireMobileViewerId();
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as { body?: string } | null;

    if (!body || typeof body.body !== "string") {
      return mobileError(new Error("El comentario no es valido."));
    }

    return mobileOk(await createMobilePostComment(viewerId, id, body.body), { status: 201 });
  } catch (error) {
    return mobileError(error);
  }
}
