import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server/tindereo-auth";
import { readAppDataset, replaceAppDataset } from "@/lib/server/tindereo-store";
import {
  removePushSubscription,
  upsertPushSubscription
} from "@/lib/server/tindereo-web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

function isPushSubscriptionPayload(value: unknown): value is PushSubscriptionPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { endpoint?: unknown }).endpoint === "string" &&
      typeof (value as { keys?: { auth?: unknown } }).keys?.auth === "string" &&
      typeof (value as { keys?: { p256dh?: unknown } }).keys?.p256dh === "string"
  );
}

export async function POST(request: Request) {
  try {
    const currentUserId = getAuthenticatedUserId(await cookies());
    if (!currentUserId) {
      return NextResponse.json(
        { error: "Necesitas iniciar sesion para activar las notificaciones." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as unknown;
    if (!isPushSubscriptionPayload(body)) {
      return NextResponse.json(
        { error: "La suscripcion push no es valida." },
        { status: 400 }
      );
    }

    const nextData = upsertPushSubscription(
      await readAppDataset(),
      currentUserId,
      body,
      request.headers.get("user-agent")
    );
    await replaceAppDataset(nextData);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar la suscripcion push."
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUserId = getAuthenticatedUserId(await cookies());
    if (!currentUserId) {
      return NextResponse.json({ ok: true });
    }

    const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
    const nextData = removePushSubscription(await readAppDataset(), currentUserId, endpoint);
    await replaceAppDataset(nextData);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo desactivar la suscripcion push."
      },
      { status: 500 }
    );
  }
}
