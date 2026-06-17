import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "../../../lib/server/tindereo-auth";
import { sanitizePlatformDataForViewer } from "../../../lib/server/tindereo-privacy";
import { getPlatformEnvelope } from "../../../lib/server/tindereo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const currentUserId = getAuthenticatedUserId(cookieStore);
    const payload = await getPlatformEnvelope();

    return NextResponse.json({
      ...payload,
      data: sanitizePlatformDataForViewer(payload.data, currentUserId),
      meta: {
        ...payload.meta,
        currentUserId
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo cargar la plataforma."
      },
      { status: 500 }
    );
  }
}
