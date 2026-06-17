import { MobileProfileScreen } from "@/components/mobile/mobile-profile-screen";
import { getMobileProfileDetail, getMobileViewerSummary } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const viewerId = await requireMobileViewerOrRedirect();
  const summary = await getMobileViewerSummary(viewerId);
  const detail = await getMobileProfileDetail(viewerId, summary.profile.handle);
  return <MobileProfileScreen initialProfile={detail} />;
}
