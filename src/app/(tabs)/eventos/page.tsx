import { MobileEventsScreen } from "@/components/mobile/mobile-events-screen";
import { loadVisibleEventsForViewer } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const viewerId = await requireMobileViewerOrRedirect();
  const events = await loadVisibleEventsForViewer(viewerId);
  return <MobileEventsScreen initialEvents={events} />;
}
