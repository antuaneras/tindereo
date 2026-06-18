import { MobileChatsScreen } from "@/components/mobile/mobile-chats-screen";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  await requireMobileViewerOrRedirect();
  return <MobileChatsScreen initialChats={null} />;
}
