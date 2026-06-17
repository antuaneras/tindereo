import { redirect } from "next/navigation";
import { getOptionalMobileViewerId } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const viewerId = await getOptionalMobileViewerId();
  redirect(viewerId ? "/inicio" : "/login");
}
