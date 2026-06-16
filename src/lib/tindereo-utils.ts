import {
  DEFAULT_STATE,
  EVENT_CATEGORY_META,
  EVENT_COVER_BY_CATEGORY
} from "@/lib/tindereo-data";
import type {
  CreateEventInput,
  EventAccessState,
  EventConnectionState,
  EventDetailTab,
  EventGroupMessage,
  EventHealthStatus,
  EventItem,
  EventMembership,
  PersistedState,
  PlatformUser,
  PrivateChat,
  PrivateChatRequest,
  PrivateMessage
} from "@/lib/tindereo-types";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortByCreatedAtAsc<T extends { createdAt: string }>(items: T[]) {
  return items.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function sortEventsByStart(events: EventItem[]) {
  return events
    .slice()
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
}

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPersistedState(value: unknown): value is PersistedState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as PersistedState;
  const firstEvent = candidate.events?.[0];
  const firstMembership = candidate.memberships?.[0];

  return (
    typeof candidate.session?.currentUserId === "string" &&
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.memberships) &&
    Array.isArray(candidate.groupMessages) &&
    Array.isArray(candidate.privateChatRequests) &&
    Array.isArray(candidate.privateChats) &&
    Array.isArray(candidate.privateMessages) &&
    (!firstEvent ||
      (typeof firstEvent.visibility === "string" &&
        typeof firstEvent.createdAt === "string" &&
        typeof firstEvent.minimumGuestsRequired === "number")) &&
    (!firstMembership ||
      (typeof firstMembership.status === "string" &&
        typeof firstMembership.requestedAt === "string"))
  );
}

function findPairChat(state: PersistedState, userAId: string, userBId: string) {
  return (
    state.privateChats.find(
      (chat) => chat.participantIds.includes(userAId) && chat.participantIds.includes(userBId)
    ) ?? null
  );
}

function findLatestPrivateRequest(
  state: PersistedState,
  eventId: string,
  userAId: string,
  userBId: string
) {
  return (
    state.privateChatRequests
      .filter((request) => {
        const samePair =
          (request.fromUserId === userAId && request.toUserId === userBId) ||
          (request.fromUserId === userBId && request.toUserId === userAId);

        return samePair && request.eventId === eventId;
      })
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
  );
}

export function createInitialState() {
  return cloneState(DEFAULT_STATE);
}

export function readPersistedState(raw: string | null) {
  if (!raw) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isPersistedState(parsed) ? parsed : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function normalizeState(state: PersistedState) {
  const currentUserId = state.users.some((user) => user.id === state.session.currentUserId)
    ? state.session.currentUserId
    : (state.users[0]?.id ?? DEFAULT_STATE.session.currentUserId);

  const provisionalState: PersistedState = {
    ...state,
    session: {
      ...DEFAULT_STATE.session,
      ...state.session,
      currentUserId
    }
  };

  const joinedEvents = getJoinedEvents(provisionalState, currentUserId);
  const discoverEvents = getDiscoverFeedEvents(provisionalState, currentUserId);
  const selectedEventId = provisionalState.events.some(
    (event) => event.id === provisionalState.session.selectedEventId
  )
    ? provisionalState.session.selectedEventId
    : (joinedEvents[0]?.id ?? discoverEvents[0]?.id ?? provisionalState.events[0]?.id ?? null);
  const privateChats = getPrivateChatsForUser(provisionalState, currentUserId);
  const selectedPrivateChatId = privateChats.some(
    (chat) => chat.id === provisionalState.session.selectedPrivateChatId
  )
    ? provisionalState.session.selectedPrivateChatId
    : (privateChats[0]?.id ?? null);

  return {
    ...provisionalState,
    session: {
      ...provisionalState.session,
      selectedEventId,
      selectedPrivateChatId
    }
  };
}

export function getCurrentUser(state: PersistedState) {
  return (
    state.users.find((user) => user.id === state.session.currentUserId) ??
    state.users[0] ??
    DEFAULT_STATE.users[0]
  );
}

export function getUserById(state: PersistedState, userId: string) {
  return state.users.find((user) => user.id === userId) ?? getCurrentUser(state);
}

export function getEventById(state: PersistedState, eventId: string | null) {
  if (!eventId) {
    return sortEventsByStart(state.events)[0] ?? null;
  }

  return (
    state.events.find((event) => event.id === eventId) ?? sortEventsByStart(state.events)[0] ?? null
  );
}

export function isEventHost(state: PersistedState, eventId: string, userId: string) {
  return getEventById(state, eventId)?.hostId === userId;
}

export function getEventRequest(state: PersistedState, eventId: string, userId: string) {
  return (
    state.memberships.find(
      (membership) => membership.eventId === eventId && membership.userId === userId
    ) ?? null
  );
}

export function getDiscoverFeedEvents(state: PersistedState, userId: string) {
  return sortEventsByStart(
    state.events.filter(
      (event) =>
        event.visibility === "public" ||
        event.hostId === userId ||
        getEventRequest(state, event.id, userId)?.status === "approved"
    )
  );
}

export function getHostedEvents(state: PersistedState, userId: string) {
  return sortEventsByStart(state.events.filter((event) => event.hostId === userId));
}

export function getJoinedEvents(state: PersistedState, userId: string) {
  return sortEventsByStart(
    state.events.filter((event) => {
      if (event.hostId === userId) {
        return true;
      }

      return getEventRequest(state, event.id, userId)?.status === "approved";
    })
  );
}

export function getEventAccessState(
  state: PersistedState,
  eventId: string,
  userId: string
): EventAccessState {
  if (isEventHost(state, eventId, userId)) {
    return { kind: "host" };
  }

  const membership = getEventRequest(state, eventId, userId);
  if (!membership) {
    return { kind: "available" };
  }

  if (membership.status === "approved") {
    return { kind: "approved", membership };
  }

  if (membership.status === "pending") {
    return { kind: "pending", membership };
  }

  return { kind: "rejected", membership };
}

export function hasEventAccess(state: PersistedState, eventId: string, userId: string) {
  const access = getEventAccessState(state, eventId, userId);
  return access.kind === "host" || access.kind === "approved";
}

export function getEventMembers(state: PersistedState, eventId: string) {
  const event = getEventById(state, eventId);
  if (!event) {
    return [];
  }

  const map = new Map<string, PlatformUser>();
  const host = getUserById(state, event.hostId);
  map.set(host.id, host);

  for (const membership of state.memberships.filter(
    (item) => item.eventId === eventId && item.status === "approved"
  )) {
    const user = getUserById(state, membership.userId);
    map.set(user.id, user);
  }

  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function getEventPendingRequests(state: PersistedState, eventId: string) {
  return state.memberships
    .filter((membership) => membership.eventId === eventId && membership.status === "pending")
    .slice()
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
}

export function getHostPendingRequests(state: PersistedState, userId: string) {
  const hostedIds = new Set(getHostedEvents(state, userId).map((event) => event.id));
  return state.memberships
    .filter((membership) => hostedIds.has(membership.eventId) && membership.status === "pending")
    .slice()
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
}

export function getEventGuestCount(state: PersistedState, eventId: string) {
  const event = getEventById(state, eventId);
  if (!event) {
    return 0;
  }

  const approvedCount = state.memberships.filter(
    (membership) => membership.eventId === eventId && membership.status === "approved"
  ).length;

  return event.baseGuestCount + approvedCount;
}

export function getEventPendingCount(state: PersistedState, eventId: string) {
  return getEventPendingRequests(state, eventId).length;
}

export function getEventAttendanceRatio(state: PersistedState, eventId: string) {
  const event = getEventById(state, eventId);
  if (!event) {
    return 0;
  }

  return Math.min(1, getEventGuestCount(state, eventId) / event.capacity);
}

export function getEventHealth(state: PersistedState, eventId: string): EventHealthStatus {
  const event = getEventById(state, eventId);
  if (!event) {
    return "building";
  }

  if (getEventGuestCount(state, eventId) >= event.minimumGuestsRequired) {
    return "confirmed";
  }

  const deadline = new Date(event.createdAt).getTime() + event.validationWindowDays * 24 * 60 * 60 * 1000;
  return Date.now() <= deadline ? "building" : "at-risk";
}

export function getEventDeadlineLabel(event: EventItem) {
  const deadline = new Date(
    new Date(event.createdAt).getTime() + event.validationWindowDays * 24 * 60 * 60 * 1000
  );

  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short"
  }).format(deadline);
}

export function getEventRequirementSummary(state: PersistedState, eventId: string) {
  const event = getEventById(state, eventId);
  if (!event) {
    return {
      confirmedCount: 0,
      remainingCount: 0,
      health: "building" as EventHealthStatus
    };
  }

  const confirmedCount = getEventGuestCount(state, eventId);
  return {
    confirmedCount,
    remainingCount: Math.max(0, event.minimumGuestsRequired - confirmedCount),
    health: getEventHealth(state, eventId)
  };
}

export function getEventMessages(state: PersistedState, eventId: string) {
  return sortByCreatedAtAsc(state.groupMessages.filter((message) => message.eventId === eventId));
}

export function postEventMessage(
  state: PersistedState,
  eventId: string,
  authorId: string,
  text: string
) {
  const trimmed = text.trim();
  if (!trimmed || !hasEventAccess(state, eventId, authorId)) {
    return state;
  }

  const nextMessage: EventGroupMessage = {
    id: buildId("group"),
    eventId,
    authorId,
    text: trimmed,
    kind: "text",
    createdAt: new Date().toISOString()
  };

  return {
    ...state,
    groupMessages: [...state.groupMessages, nextMessage]
  };
}

export function requestEventAccess(state: PersistedState, eventId: string, userId: string) {
  const event = getEventById(state, eventId);
  if (!event || event.hostId === userId || getEventRequest(state, eventId, userId)) {
    return state;
  }

  const guestCount = getEventGuestCount(state, eventId);
  if (guestCount >= event.capacity) {
    return state;
  }

  const nextMembership: EventMembership = {
    id: buildId("membership"),
    eventId,
    userId,
    status: "pending",
    requestedAt: new Date().toISOString()
  };

  return {
    ...state,
    memberships: [...state.memberships, nextMembership]
  };
}

export function respondToEventAccess(
  state: PersistedState,
  membershipId: string,
  hostId: string,
  accept: boolean
) {
  const membership = state.memberships.find((item) => item.id === membershipId);
  if (!membership || membership.status !== "pending") {
    return state;
  }

  const event = getEventById(state, membership.eventId);
  if (!event || event.hostId !== hostId) {
    return state;
  }

  if (accept && getEventGuestCount(state, membership.eventId) >= event.capacity) {
    return state;
  }

  const respondedAt = new Date().toISOString();
  const updatedMemberships: EventMembership[] = state.memberships.map((item) => {
    if (item.id !== membershipId) {
      return item;
    }

    return {
      ...item,
      status: accept ? "approved" : "rejected",
      respondedAt
    };
  });

  if (!accept) {
    return {
      ...state,
      memberships: updatedMemberships
    };
  }

  const approvedUser = getUserById(state, membership.userId);
  const systemMessage: EventGroupMessage = {
    id: buildId("group"),
    eventId: membership.eventId,
    authorId: "system",
    text: `${approvedUser.name} ha sido aprobado y ya puede entrar al chat general.`,
    kind: "system",
    createdAt: respondedAt
  };

  return {
    ...state,
    memberships: updatedMemberships,
    groupMessages: [...state.groupMessages, systemMessage]
  };
}

export function leaveEvent(state: PersistedState, eventId: string, userId: string) {
  const event = getEventById(state, eventId);
  if (!event || event.hostId === userId) {
    return state;
  }

  const membership = getEventRequest(state, eventId, userId);
  if (!membership || membership.status !== "approved") {
    return state;
  }

  const user = getUserById(state, userId);
  const createdAt = new Date().toISOString();
  const systemMessage: EventGroupMessage = {
    id: buildId("group"),
    eventId,
    authorId: "system",
    text: `${user.name} ha salido del evento.`,
    kind: "system",
    createdAt
  };

  return {
    ...state,
    memberships: state.memberships.filter((item) => item.id !== membership.id),
    groupMessages: [...state.groupMessages, systemMessage]
  };
}

export function getCategoryMeta(category: EventItem["category"]) {
  return EVENT_CATEGORY_META[category];
}

export function formatEventDate(event: EventItem) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(event.startsAt));
}

export function formatEventDateRange(event: EventItem) {
  const startDate = new Date(event.startsAt);
  const endDate = new Date(event.endsAt);
  const dayLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(startDate);
  const startTime = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(startDate);
  const endTime = new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(endDate);

  return `${dayLabel} · ${startTime} a ${endTime}`;
}

export function formatTime(dateIso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateIso));
}

export function formatRelativeTime(dateIso: string) {
  const diffMinutes = Math.max(
    1,
    Math.round((Date.now() - new Date(dateIso).getTime()) / 60000)
  );

  if (diffMinutes < 60) {
    return `hace ${diffMinutes} min`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `hace ${diffHours} h`;
  }

  return `hace ${Math.round(diffHours / 24)} d`;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getPrivateMessages(state: PersistedState, chatId: string) {
  return sortByCreatedAtAsc(state.privateMessages.filter((message) => message.chatId === chatId));
}

export function getLatestPrivateMessage(state: PersistedState, chatId: string) {
  return getPrivateMessages(state, chatId).slice(-1)[0] ?? null;
}

export function getPrivateChatsForUser(state: PersistedState, userId: string) {
  return state.privateChats
    .filter((chat) => chat.participantIds.includes(userId))
    .slice()
    .sort((left, right) => {
      const leftLast = getLatestPrivateMessage(state, left.id)?.createdAt ?? left.createdAt;
      const rightLast = getLatestPrivateMessage(state, right.id)?.createdAt ?? right.createdAt;
      return rightLast.localeCompare(leftLast);
    });
}

export function getPrivateRequestsForUser(state: PersistedState, userId: string) {
  return state.privateChatRequests
    .filter((request) => request.fromUserId === userId || request.toUserId === userId)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getIncomingPendingRequests(state: PersistedState, userId: string) {
  return getPrivateRequestsForUser(state, userId).filter(
    (request) => request.toUserId === userId && request.status === "pending"
  );
}

export function getEventConnectionState(
  state: PersistedState,
  eventId: string,
  currentUserId: string,
  targetUserId: string
): EventConnectionState {
  if (currentUserId === targetUserId) {
    return { kind: "self" };
  }

  if (!hasEventAccess(state, eventId, currentUserId) || !hasEventAccess(state, eventId, targetUserId)) {
    return { kind: "available" };
  }

  const chat = findPairChat(state, currentUserId, targetUserId);
  if (chat) {
    return { kind: "chat", chat };
  }

  const request = findLatestPrivateRequest(state, eventId, currentUserId, targetUserId);
  if (!request) {
    return { kind: "available" };
  }

  if (request.status === "pending") {
    if (request.toUserId === currentUserId) {
      return { kind: "incoming-request", request };
    }

    return { kind: "outgoing-request", request };
  }

  if (request.status === "rejected") {
    return {
      kind: "rejected",
      request,
      by: request.toUserId === currentUserId ? "me" : "them"
    };
  }

  return { kind: "available" };
}

export function sendPrivateChatRequest(
  state: PersistedState,
  eventId: string,
  fromUserId: string,
  toUserId: string,
  message: string
) {
  const trimmed = message.trim();
  if (
    !trimmed ||
    fromUserId === toUserId ||
    !hasEventAccess(state, eventId, fromUserId) ||
    !hasEventAccess(state, eventId, toUserId)
  ) {
    return state;
  }

  const connectionState = getEventConnectionState(state, eventId, fromUserId, toUserId);
  if (connectionState.kind !== "available") {
    return state;
  }

  const nextRequest: PrivateChatRequest = {
    id: buildId("request"),
    eventId,
    fromUserId,
    toUserId,
    message: trimmed,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  return {
    ...state,
    privateChatRequests: [...state.privateChatRequests, nextRequest]
  };
}

export function respondToPrivateChatRequest(
  state: PersistedState,
  requestId: string,
  responderId: string,
  accept: boolean
) {
  const request = state.privateChatRequests.find((item) => item.id === requestId);
  if (!request || request.toUserId !== responderId || request.status !== "pending") {
    return state;
  }

  const respondedAt = new Date().toISOString();
  const updatedRequests: PrivateChatRequest[] = state.privateChatRequests.map((item) => {
    if (item.id !== requestId) {
      return item;
    }

    return {
      ...item,
      status: accept ? "accepted" : "rejected",
      respondedAt
    };
  });

  if (!accept) {
    return {
      ...state,
      privateChatRequests: updatedRequests
    };
  }

  const existingChat = findPairChat(state, request.fromUserId, request.toUserId);
  if (existingChat) {
    return {
      ...state,
      privateChatRequests: updatedRequests
    };
  }

  const chatId = buildId("chat");
  const nextChat: PrivateChat = {
    id: chatId,
    participantIds: [request.fromUserId, request.toUserId],
    originEventId: request.eventId,
    requestId: request.id,
    createdAt: respondedAt
  };
  const welcomeMessage: PrivateMessage = {
    id: buildId("private"),
    chatId,
    authorId: responderId,
    text: "Solicitud aceptada. Ya podeis hablar por privado por aqui.",
    createdAt: respondedAt
  };

  return {
    ...state,
    privateChatRequests: updatedRequests,
    privateChats: [...state.privateChats, nextChat],
    privateMessages: [...state.privateMessages, welcomeMessage]
  };
}

export function sendPrivateMessage(
  state: PersistedState,
  chatId: string,
  authorId: string,
  text: string
) {
  const trimmed = text.trim();
  const chat = state.privateChats.find((item) => item.id === chatId);
  if (!trimmed || !chat || !chat.participantIds.includes(authorId)) {
    return state;
  }

  return {
    ...state,
    privateMessages: [
      ...state.privateMessages,
      {
        id: buildId("private"),
        chatId,
        authorId,
        text: trimmed,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function getChatPartner(state: PersistedState, chat: PrivateChat, userId: string) {
  const partnerId = chat.participantIds.find((participantId) => participantId !== userId) ?? userId;
  return getUserById(state, partnerId);
}

export function createEvent(state: PersistedState, userId: string, input: CreateEventInput) {
  const creator = getUserById(state, userId);
  const title = input.title.trim();
  const summary = input.summary.trim();
  const description = input.description.trim();
  if (!title || !summary || !description) {
    return state;
  }

  const baseSlug = slugify(title) || buildId("event");
  const slug = state.events.some((event) => event.slug === baseSlug)
    ? `${baseSlug}-${Date.now().toString(36)}`
    : baseSlug;
  const nextEvent: EventItem = {
    id: `event-${slug}`,
    slug,
    title,
    category: input.category,
    visibility: input.visibility,
    city: input.city.trim() || creator.city,
    venue: input.venue.trim() || "Venue pendiente",
    coverImage: input.coverImage?.trim() || EVENT_COVER_BY_CATEGORY[input.category],
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    createdAt: new Date().toISOString(),
    priceLabel: input.priceLabel.trim() || "Precio por confirmar",
    capacity: Number(input.capacity) || 40,
    baseGuestCount: 0,
    hostId: userId,
    summary,
    description,
    highlights: input.highlights.filter(Boolean).slice(0, 3),
    tags: input.tags.filter(Boolean).slice(0, 5),
    dressCode: input.dressCode.trim() || "Casual",
    conversationPrompt:
      "Presentate y cuenta que clase de gente te gustaria tener cerca antes de que empiece el evento.",
    minimumGuestsRequired: 4,
    validationWindowDays: 7
  };

  return {
    ...state,
    events: [nextEvent, ...state.events],
    session: {
      ...state.session,
      selectedEventId: nextEvent.id,
      selectedEventView: "overview" as EventDetailTab
    }
  };
}

export function getHostMetrics(state: PersistedState, userId: string) {
  const hostedEvents = getHostedEvents(state, userId);
  const confirmedGuests = hostedEvents.reduce(
    (total, event) => total + getEventGuestCount(state, event.id),
    0
  );
  const pendingApprovals = hostedEvents.reduce(
    (total, event) => total + getEventPendingCount(state, event.id),
    0
  );
  const confirmedEvents = hostedEvents.filter(
    (event) => getEventHealth(state, event.id) === "confirmed"
  ).length;
  const atRiskEvents = hostedEvents.filter(
    (event) => getEventHealth(state, event.id) === "at-risk"
  ).length;

  return {
    publishedEvents: hostedEvents.length,
    confirmedGuests,
    pendingApprovals,
    confirmedEvents,
    atRiskEvents
  };
}
