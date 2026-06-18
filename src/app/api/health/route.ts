import { mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return mobileOk({
    ok: true,
    now: new Date().toISOString(),
    service: "tindereo-mobile"
  });
}
