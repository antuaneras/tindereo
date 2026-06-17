import { MobileCreateScreen } from "@/components/mobile/mobile-create-screen";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  await requireMobileViewerOrRedirect();
  return <MobileCreateScreen />;
}
