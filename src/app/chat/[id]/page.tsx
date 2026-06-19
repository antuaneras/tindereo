import { MobileConversationScreen } from "@/components/mobile/mobile-conversation-screen";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const viewerId = await requireMobileViewerOrRedirect();
  const { id } = await params;
  return <MobileConversationScreen conversationId={id} viewerId={viewerId} />;
}
