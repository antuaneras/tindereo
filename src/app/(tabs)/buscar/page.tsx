import { MobileSearchScreen } from "@/components/mobile/mobile-search-screen";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  await requireMobileViewerOrRedirect();
  return <MobileSearchScreen />;
}
