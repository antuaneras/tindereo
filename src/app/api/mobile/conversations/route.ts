import { createMobileConversation, listMobileConversationSummaries, requireMobileViewerId } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return mobileOk(await listMobileConversationSummaries(await requireMobileViewerId()));
  } catch (error) {
    return mobileError(error);
  }
}

export async function POST(request: Request) {
  try {
    const viewerId = await requireMobileViewerId();
    const body = await request.json();
    return mobileOk(await createMobileConversation(viewerId, body), { status: 201 });
  } catch (error) {
    return mobileError(error);
  }
}
