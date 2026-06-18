import { MobileHomeScreen } from "@/components/mobile/mobile-home-screen";
import { getMobileBootstrap } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewerId = await requireMobileViewerOrRedirect();
  const initialData = await getMobileBootstrap(viewerId);
  return <MobileHomeScreen initialData={initialData} />;
}
