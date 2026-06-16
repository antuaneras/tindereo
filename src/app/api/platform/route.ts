import { NextResponse } from "next/server";
import { getPlatformData } from "@/lib/server/tindereo-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    return NextResponse.json({
      data: getPlatformData()
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
