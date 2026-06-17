import { getMobileConversationDetail, getMobileEventDetail } from "@/lib/server/mobile-service";
import { requireMobileViewerOrRedirect } from "@/lib/server/mobile-session";
import { MobileConversationScreen } from "@/components/mobile/mobile-conversation-screen";
import { MobileEventAccessGate } from "@/components/mobile/mobile-event-access-gate";

export const dynamic = "force-dynamic";

export default async function EventPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const viewerId = await requireMobileViewerOrRedirect();
  const { slug } = await params;
  const detail = await getMobileEventDetail(viewerId, slug);

  if (!detail.myConversationId) {
    return <MobileEventAccessGate initialDetail={detail} />;
  }

  const conversation = await getMobileConversationDetail(viewerId, detail.myConversationId);
  return <MobileConversationScreen initialConversation={conversation} initialEvent={detail} />;
}
