import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createAuthAccount,
  createSessionAfterRegistration,
  setAuthenticatedUserCookie
} from "@/lib/server/tindereo-auth";
import { sanitizePlatformDataForViewer } from "@/lib/server/tindereo-privacy";
import { publishPlatformUpdate } from "@/lib/server/tindereo-realtime";
import {
  getDatasetRevision,
  readAppDataset,
  replaceAppDataset
} from "@/lib/server/tindereo-store";
import { hydratePersistedState, stripSession } from "@/lib/tindereo-session";
import type { RegisterAccountInput } from "@/lib/tindereo-types";
import { registerUser } from "@/lib/tindereo-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRegisterAccountInput(value: unknown): value is RegisterAccountInput {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { name?: unknown }).name === "string" &&
      typeof (value as { handle?: unknown }).handle === "string" &&
      typeof (value as { city?: unknown }).city === "string" &&
      typeof (value as { bio?: unknown }).bio === "string" &&
      typeof (value as { password?: unknown }).password === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!isRegisterAccountInput(body)) {
      return NextResponse.json({ error: "Los datos del registro no son validos." }, { status: 400 });
    }

    const currentData = await readAppDataset();
    const nextState = registerUser(hydratePersistedState(currentData), body);
    const createdUser = nextState.users[0];

    if (!createdUser) {
      throw new Error("No se pudo crear la cuenta.");
    }

    createAuthAccount(createdUser.id, createdUser.handle, body.password);

    const nextData = stripSession(nextState);
    await replaceAppDataset(nextData);
    const revision = await getDatasetRevision();
    publishPlatformUpdate({
      data: nextData,
      meta: {
        revision
      }
    });

    const token = createSessionAfterRegistration(createdUser.id);
    setAuthenticatedUserCookie(await cookies(), token);

    return NextResponse.json({
      data: sanitizePlatformDataForViewer(nextData, createdUser.id),
      meta: {
        currentUserId: createdUser.id,
        revision
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo crear la cuenta."
      },
      { status: 400 }
    );
  }
}
