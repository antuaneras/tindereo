import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearAuthenticatedUserCookie,
  revokeSession
} from "@/lib/server/tindereo-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("tindereo_session")?.value ?? null;
    revokeSession(token);
    clearAuthenticatedUserCookie(cookieStore);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo cerrar sesion."
      },
      { status: 500 }
    );
  }
}
