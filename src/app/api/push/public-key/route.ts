import { NextResponse } from "next/server";
import { getWebPushPublicKey } from "@/lib/server/tindereo-web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      publicKey: getWebPushPublicKey()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo cargar la clave push."
      },
      { status: 500 }
    );
  }
}
