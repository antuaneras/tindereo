import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "../../../../lib/server/tindereo-auth";
import { resolveDatasetMediaUrls } from "../../../../lib/server/tindereo-media";
import { sanitizePlatformDataForViewer } from "../../../../lib/server/tindereo-privacy";
import { runPlatformAction } from "../../../../lib/server/tindereo-service";
import type { PlatformAction } from "../../../../lib/tindereo-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPlatformAction(value: unknown): value is PlatformAction {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

function bindActorToAuthenticatedUser(action: PlatformAction, currentUserId: string | null) {
  if (action.type === "register-user") {
    return action;
  }

  if (!currentUserId) {
    throw new Error("Necesitas iniciar sesion para hacer esta accion.");
  }

  return "actorId" in action ? { ...action, actorId: currentUserId } : action;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const currentUserId = await getAuthenticatedUserId(cookieStore);
    const body = (await request.json().catch(() => null)) as unknown;
    if (!isPlatformAction(body)) {
      return NextResponse.json({ error: "La accion enviada no es valida." }, { status: 400 });
    }

    const payload = await runPlatformAction(bindActorToAuthenticatedUser(body, currentUserId));

    return NextResponse.json({
      ...payload,
      data: resolveDatasetMediaUrls(sanitizePlatformDataForViewer(payload.data, currentUserId)),
      meta: {
        ...payload.meta,
        currentUserId
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo completar la accion."
      },
      {
        status:
          error instanceof Error && error.message === "Necesitas iniciar sesion para hacer esta accion."
            ? 401
            : 500
      }
    );
  }
}
