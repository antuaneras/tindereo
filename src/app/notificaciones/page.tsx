import { MobileNotificationsScreen } from "@/components/mobile/mobile-notifications-screen";
import { listMobileNotifications } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const viewerId = await requireMobileViewerOrRedirect();
  const notifications = await listMobileNotifications(viewerId);
  return <MobileNotificationsScreen initialNotifications={notifications} />;
}
