import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildMobileId } from "@/lib/mobile-shared";
import { createAuthAccount, createSessionAfterRegistration, deleteAuthAccountByUsername, setAuthenticatedUserCookie } from "@/lib/server/tindereo-auth";
import { getMobileBootstrap, registerMobileProfile } from "@/lib/server/mobile-service";
import { mobileError } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          bio?: string;
          city?: string;
          handle?: string;
          name?: string;
          password?: string;
        }
      | null;

    if (
      !body ||
      typeof body.name !== "string" ||
      typeof body.handle !== "string" ||
      typeof body.city !== "string" ||
      typeof body.bio !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json({ error: "Los datos del registro no son validos." }, { status: 400 });
    }

    const userId = buildMobileId("user");
    await createAuthAccount(userId, body.handle, body.password);

    try {
      await registerMobileProfile(userId, {
        handle: body.handle,
        name: body.name,
        city: body.city,
        bio: body.bio
      });
    } catch (error) {
      await deleteAuthAccountByUsername(body.handle).catch(() => undefined);
      throw error;
    }

    const token = await createSessionAfterRegistration(userId);
    setAuthenticatedUserCookie(await cookies(), token);
    return NextResponse.json(await getMobileBootstrap(userId));
  } catch (error) {
    return mobileError(error);
  }
}
