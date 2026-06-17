import { cookies } from "next/headers";
import { clearAuthenticatedUserCookie, revokeSession } from "@/lib/server/tindereo-auth";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("tindereo_session")?.value ?? null;
    await revokeSession(token);
    clearAuthenticatedUserCookie(cookieStore);
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
