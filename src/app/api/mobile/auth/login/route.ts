import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authenticateUser, setAuthenticatedUserCookie } from "@/lib/server/tindereo-auth";
import { getMobileBootstrap } from "@/lib/server/mobile-service";
import { mobileError } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { password?: string; username?: string }
      | null;

    if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
      return NextResponse.json({ error: "Las credenciales no son validas." }, { status: 400 });
    }

    const { token, userId } = await authenticateUser(body.username, body.password);
    setAuthenticatedUserCookie(await cookies(), token);
    return NextResponse.json(await getMobileBootstrap(userId));
  } catch (error) {
    return mobileError(error);
  }
}
