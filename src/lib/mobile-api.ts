import type {
  CreateConversationInput,
  CreateMobileEventInput,
  MobileBootstrapPayload,
  MobileConversationDetail,
  MobileConversationSummary,
  MobileEventDetail,
  MobilePostComment,
  MobileProfile,
  MobileProfileDetail,
  MobileSearchPayload,
  PublishMobilePostInput,
  PublishMobileStoryInput,
  SendMobileMessageInput
} from "@/lib/mobile-types";

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : "No se pudo completar la operacion."
    );
  }

  return payload as T;
}

export async function mobileLogin(input: { username: string; password: string }) {
  return readJson<MobileBootstrapPayload>(
    await fetch("/api/mobile/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function mobileRegister(input: {
  name: string;
  handle: string;
  city: string;
  bio: string;
  password: string;
}) {
  return readJson<MobileBootstrapPayload>(
    await fetch("/api/mobile/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function mobileLogout() {
  return readJson<{ ok: boolean }>(
    await fetch("/api/mobile/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    })
  );
}

export async function fetchMobileBootstrap() {
  return readJson<MobileBootstrapPayload>(
    await fetch("/api/mobile/bootstrap", { cache: "no-store" })
  );
}

export async function fetchViewerSummary() {
  return readJson<{ profile: MobileProfile; pendingChatCount: number; unreadNotificationCount: number; pendingStoryCount: number }>(
    await fetch("/api/mobile/viewer/summary", { cache: "no-store" })
  );
}

export async function searchMobile(query: string) {
  return readJson<MobileSearchPayload>(
    await fetch(`/api/mobile/search?q=${encodeURIComponent(query)}`, { cache: "no-store" })
  );
}

export async function fetchEventDetail(slug: string) {
  return readJson<MobileEventDetail>(
    await fetch(`/api/mobile/events/${slug}`, { cache: "no-store" })
  );
}

export async function fetchEvents() {
  return readJson<MobileEventDetail["event"][]>(
    await fetch("/api/mobile/events", { cache: "no-store" })
  );
}

export async function createEvent(input: CreateMobileEventInput) {
  return readJson<{ eventId: string; slug: string; conversationId: string }>(
    await fetch("/api/mobile/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function joinEvent(slug: string) {
  return readJson<{ membership: MobileEventDetail["myMembership"] }>(
    await fetch(`/api/mobile/events/${slug}/join`, { method: "POST" })
  );
}

export async function setArrivalStatus(slug: string, arrivalStatus: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/events/${slug}/arrival`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arrivalStatus })
    })
  );
}

export async function fetchCheckInToken(slug: string) {
  return readJson<{ token: string; expiresAt: string; url: string; qrImageUrl: string }>(
    await fetch(`/api/mobile/events/${slug}/checkin-token`, { cache: "no-store" })
  );
}

export async function submitCheckInToken(token: string) {
  return readJson<{ eventId: string }>(
    await fetch("/api/mobile/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
  );
}

export async function setEventChatMode(slug: string, mode: "open" | "announcements") {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/events/${slug}/chat-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    })
  );
}

export async function addEventCohost(slug: string, targetUserId: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/events/${slug}/cohosts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId })
    })
  );
}

export async function moderateEventMember(slug: string, targetUserId: string, action: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/events/${slug}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, action })
    })
  );
}

export async function fetchConversations() {
  return readJson<MobileConversationSummary[]>(
    await fetch("/api/mobile/conversations", { cache: "no-store" })
  );
}

export async function createConversation(input: CreateConversationInput) {
  return readJson<{ conversationId: string }>(
    await fetch("/api/mobile/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function fetchConversation(id: string) {
  return readJson<MobileConversationDetail>(
    await fetch(`/api/mobile/conversations/${id}`, { cache: "no-store" })
  );
}

export async function sendConversationMessage(id: string, input: Omit<SendMobileMessageInput, "conversationId">) {
  return readJson<{ messageId: string }>(
    await fetch(`/api/mobile/conversations/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function markConversationAsRead(id: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/conversations/${id}/read`, { method: "POST" })
  );
}

export async function publishPost(input: PublishMobilePostInput) {
  return readJson<unknown>(
    await fetch("/api/mobile/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function deletePost(postId: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/posts/${postId}`, { method: "DELETE" })
  );
}

export async function likePost(postId: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/posts/${postId}/like`, { method: "POST" })
  );
}

export async function createPostComment(postId: string, body: string) {
  return readJson<MobilePostComment>(
    await fetch(`/api/mobile/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    })
  );
}

export async function publishStory(input: PublishMobileStoryInput) {
  return readJson<{ ok: boolean }>(
    await fetch("/api/mobile/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export async function deleteStory(storyId: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/stories/${storyId}`, { method: "DELETE" })
  );
}

export async function markStoryAsViewed(storyId: string) {
  return readJson<{ ok: boolean }>(
    await fetch(`/api/mobile/stories/${storyId}/view`, { method: "POST" })
  );
}

export async function fetchProfileDetail(handle: string) {
  return readJson<MobileProfileDetail>(
    await fetch(`/api/mobile/profile/${handle}`, { cache: "no-store" })
  );
}

export async function updateViewerProfile(input: {
  displayName: string;
  city: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
}) {
  return readJson<MobileProfile>(
    await fetch("/api/mobile/viewer/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    })
  );
}

export function subscribeToMobileStream(listener: (payload: { type: string; conversationId?: string | null; eventId?: string | null; profileId?: string | null; viewerId?: string | null; at: string }) => void) {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }

  const source = new EventSource("/api/mobile/stream");
  const handle = (event: MessageEvent<string>) => {
    try {
      listener(JSON.parse(event.data) as never);
    } catch {
      // Ignore malformed payloads and keep stream alive.
    }
  };

  source.addEventListener("mobile", handle as EventListener);
  return () => {
    source.removeEventListener("mobile", handle as EventListener);
    source.close();
  };
}
