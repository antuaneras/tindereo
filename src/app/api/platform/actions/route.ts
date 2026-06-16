import { NextResponse } from "next/server";
import { runPlatformAction } from "../../../../lib/server/tindereo-service";
import type { PlatformAction } from "../../../../lib/tindereo-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPlatformAction(value: unknown): value is PlatformAction {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!isPlatformAction(body)) {
      return NextResponse.json({ error: "La accion enviada no es valida." }, { status: 400 });
    }

    return NextResponse.json(runPlatformAction(body));
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo completar la accion."
      },
      { status: 500 }
    );
  }
}
