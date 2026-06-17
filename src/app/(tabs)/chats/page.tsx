import { MobileChatsScreen } from "@/components/mobile/mobile-chats-screen";
import { listMobileConversationSummaries } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function ChatsPage() {
  const viewerId = await requireMobileViewerOrRedirect();
  const chats = await listMobileConversationSummaries(viewerId);
  return <MobileChatsScreen initialChats={chats} />;
}
