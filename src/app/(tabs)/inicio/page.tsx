import { MobileHomeScreen } from "@/components/mobile/mobile-home-screen";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewerId = await requireMobileViewerOrRedirect();
  return <MobileHomeScreen initialData={null} viewerId={viewerId} />;
}
