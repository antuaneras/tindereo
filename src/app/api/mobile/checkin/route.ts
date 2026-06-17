import { checkInToEvent, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const viewerId = await requireMobileViewerId();
    const body = (await request.json().catch(() => null)) as { token?: string } | null;
    if (!body || typeof body.token !== "string") {
      throw new Error("Falta el token de check-in.");
    }
    return mobileOk({ eventId: await checkInToEvent(viewerId, body.token) });
  } catch (error) {
    return mobileError(error);
  }
}
