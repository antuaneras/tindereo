import { NextResponse } from "next/server";
import { resetPlatformData } from "../../../../lib/server/tindereo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return NextResponse.json(await resetPlatformData());
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron vaciar los datos."
      },
      { status: 500 }
    );
  }
}
