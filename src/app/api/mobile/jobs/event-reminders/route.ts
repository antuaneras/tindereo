import { runEventReminderDispatch } from "@/lib/server/mobile-service";
import { mobileError, mobileOk } from "@/lib/server/mobile-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-cron-secret");
    if ((process.env.CRON_SECRET ?? "").trim() && secret !== process.env.CRON_SECRET) {
      throw new Error("Cron no autorizado.");
    }

    await runEventReminderDispatch();
    return mobileOk({ ok: true });
  } catch (error) {
    return mobileError(error);
  }
}
