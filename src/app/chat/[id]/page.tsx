import { MobileConversationScreen } from "@/components/mobile/mobile-conversation-screen";
import { getMobileConversationDetail } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const viewerId = await requireMobileViewerOrRedirect();
  const { id } = await params;
  const conversation = await getMobileConversationDetail(viewerId, id);
  return <MobileConversationScreen initialConversation={conversation} />;
}
