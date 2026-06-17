import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearAuthenticatedUserCookie,
  resetAuthState
} from "../../../../lib/server/tindereo-auth";
import { resetPlatformData } from "../../../../lib/server/tindereo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    resetAuthState();
    clearAuthenticatedUserCookie(await cookies());
    const payload = await resetPlatformData();

    return NextResponse.json({
      ...payload,
      meta: {
        ...payload.meta,
        currentUserId: null,
        selectedEventId: null
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron vaciar los datos."
      },
      { status: 500 }
    );
  }
}
