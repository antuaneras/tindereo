import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  authenticateUser,
  setAuthenticatedUserCookie
} from "@/lib/server/tindereo-auth";
import { sanitizePlatformDataForViewer } from "@/lib/server/tindereo-privacy";
import {
  getDatasetRevision,
  readAppDataset
} from "@/lib/server/tindereo-store";
import type { LoginInput } from "@/lib/tindereo-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLoginInput(value: unknown): value is LoginInput {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { username?: unknown }).username === "string" &&
      typeof (value as { password?: unknown }).password === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!isLoginInput(body)) {
      return NextResponse.json({ error: "Las credenciales no son validas." }, { status: 400 });
    }

    const { token, userId } = authenticateUser(body.username, body.password);
    setAuthenticatedUserCookie(await cookies(), token);
    const data = await readAppDataset();

    return NextResponse.json({
      data: sanitizePlatformDataForViewer(data, userId),
      meta: {
        currentUserId: userId,
        revision: await getDatasetRevision()
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo iniciar sesion."
      },
      { status: 401 }
    );
  }
}
