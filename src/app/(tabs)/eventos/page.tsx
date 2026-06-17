import { MobileEventsScreen } from "@/components/mobile/mobile-events-screen";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  await requireMobileViewerOrRedirect();
  return <MobileEventsScreen />;
}
