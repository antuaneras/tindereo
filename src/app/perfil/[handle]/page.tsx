import { MobileProfileScreen } from "@/components/mobile/mobile-profile-screen";
import { getMobileProfileDetail } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({
  params
}: {
  params: Promise<{ handle: string }>;
}) {
  const viewerId = await requireMobileViewerOrRedirect();
  const { handle } = await params;
  const detail = await getMobileProfileDetail(viewerId, handle);

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-[480px] px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))]">
      <MobileProfileScreen initialProfile={detail} backHref="/buscar" />
    </main>
  );
}
