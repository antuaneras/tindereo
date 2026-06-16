import {
  DEFAULT_STATE,
  EVENT_CATEGORY_META,
  EVENT_COVER_BY_CATEGORY
} from "@/lib/tindereo-data";
import type {
  CreateEventInput,
  EventConnectionState,
  EventDetailTab,
  EventGroupMessage,
  EventItem,
  EventMembership,
  OrganizerLead,
  OrganizerLeadInput,
  PersistedState,
  PlatformUser,
  PrivateChat,
  PrivateChatRequest,
  PrivateMessage
} from "@/lib/tindereo-types";

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortByDateAsc<T extends { createdAt: string }>(items: T[]) {
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
  return (
    typeof candidate.session?.currentUserId === "string" &&
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.memberships) &&
    Array.isArray(candidate.groupMessages) &&
    Array.isArray(candidate.privateChatRequests) &&
    Array.isArray(candidate.privateChats) &&
    Array.isArray(candidate.privateMessages) &&
    Array.isArray(candidate.organizerLeads)
  );
}

function findPairChat(state: PersistedState, userAId: string, userBId: string) {
  return (
    state.privateChats.find((chat) => {
      return chat.participantIds.includes(userAId) && chat.participantIds.includes(userBId);
    }) ?? null
  );
}

function findLatestRequest(
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

  return state.events.find((event) => event.id === eventId) ?? sortEventsByStart(state.events)[0] ?? null;
}

export function getDiscoverFeedEvents(state: PersistedState) {
  return sortEventsByStart(state.events);
}

export function getMembership(state: PersistedState, eventId: string, userId: string) {
  return (
    state.memberships.find((membership) => membership.eventId === eventId && membership.userId === userId) ??
    null
  );
}

export function hasJoinedEvent(state: PersistedState, eventId: string, userId: string) {
  return Boolean(getMembership(state, eventId, userId));
}

export function getJoinedEvents(state: PersistedState, userId: string) {
  const joinedIds = new Set(
    state.memberships
      .filter((membership) => membership.userId === userId)
      .map((membership) => membership.eventId)
  );

  return sortEventsByStart(state.events.filter((event) => joinedIds.has(event.id)));
}

export function getHostedEvents(state: PersistedState, organizerId: string) {
  return sortEventsByStart(state.events.filter((event) => event.hostId === organizerId));
}

export function getEventGuestCount(state: PersistedState, eventId: string) {
  const event = getEventById(state, eventId);
  if (!event) {
    return 0;
  }

  const joinedVisible = state.memberships.filter((membership) => membership.eventId === eventId).length;
  return event.baseGuestCount + joinedVisible;
}

export function getEventAttendanceRatio(state: PersistedState, eventId: string) {
  const event = getEventById(state, eventId);
  if (!event) {
    return 0;
  }

  return Math.min(1, getEventGuestCount(state, eventId) / event.capacity);
}

export function getEventMembers(state: PersistedState, eventId: string) {
  const event = getEventById(state, eventId);
  if (!event) {
    return [];
  }

  const map = new Map<string, PlatformUser>();
  const host = getUserById(state, event.hostId);
  map.set(host.id, host);

  for (const membership of state.memberships.filter((item) => item.eventId === eventId)) {
    const user = getUserById(state, membership.userId);
    map.set(user.id, user);
  }

  return [...map.values()].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "organizer" ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getEventMessages(state: PersistedState, eventId: string) {
  return sortByDateAsc(state.groupMessages.filter((message) => message.eventId === eventId));
}

export function getPrivateMessages(state: PersistedState, chatId: string) {
  return sortByDateAsc(state.privateMessages.filter((message) => message.chatId === chatId));
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

export function getOutgoingPendingRequests(state: PersistedState, userId: string) {
  return getPrivateRequestsForUser(state, userId).filter(
    (request) => request.fromUserId === userId && request.status === "pending"
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

  const chat = findPairChat(state, currentUserId, targetUserId);
  if (chat) {
    return { kind: "chat", chat };
  }

  const request = findLatestRequest(state, eventId, currentUserId, targetUserId);
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

export function getOrganizerMetrics(state: PersistedState, organizerId: string) {
  const events = getHostedEvents(state, organizerId);
  const totalGuests = events.reduce((total, event) => total + getEventGuestCount(state, event.id), 0);
  const totalMessages = events.reduce((total, event) => total + getEventMessages(state, event.id).length, 0);
  const openLeads = state.organizerLeads.filter((lead) => lead.status === "pending").length;
  const privateConnections = state.privateChats.filter((chat) =>
    events.some((event) => event.id === chat.originEventId)
  ).length;

  return {
    publishedEvents: events.length,
    totalGuests,
    totalMessages,
    openLeads,
    privateConnections
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

export function getChatPartner(state: PersistedState, chat: PrivateChat, userId: string) {
  const partnerId = chat.participantIds.find((participantId) => participantId !== userId) ?? userId;
  return getUserById(state, partnerId);
}

export function joinEvent(state: PersistedState, eventId: string, userId: string) {
  if (hasJoinedEvent(state, eventId, userId)) {
    return state;
  }

  const event = getEventById(state, eventId);
  if (!event) {
    return state;
  }

  if (getEventGuestCount(state, eventId) >= event.capacity) {
    return state;
  }

  const user = getUserById(state, userId);
  const createdAt = new Date().toISOString();
  const membership: EventMembership = {
    id: buildId("membership"),
    eventId,
    userId,
    joinedAt: createdAt
  };
  const systemMessage: EventGroupMessage = {
    id: buildId("group"),
    eventId,
    authorId: "system",
    text: `${user.name} se ha unido al chat general del evento.`,
    kind: "system",
    createdAt
  };

  return {
    ...state,
    memberships: [...state.memberships, membership],
    groupMessages: [...state.groupMessages, systemMessage]
  };
}

export function leaveEvent(state: PersistedState, eventId: string, userId: string) {
  const membership = getMembership(state, eventId, userId);
  if (!membership) {
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

export function postEventMessage(
  state: PersistedState,
  eventId: string,
  authorId: string,
  text: string
) {
  const trimmed = text.trim();
  if (!trimmed || !hasJoinedEvent(state, eventId, authorId)) {
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

export function sendPrivateChatRequest(
  state: PersistedState,
  eventId: string,
  fromUserId: string,
  toUserId: string,
  message: string
) {
  const trimmed = message.trim();
  if (!trimmed || fromUserId === toUserId) {
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
    text: "Solicitud aceptada. Ya podemos hablar por privado por aqui.",
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

export function createEvent(state: PersistedState, organizerId: string, input: CreateEventInput) {
  const organizer = getUserById(state, organizerId);
  if (organizer.role !== "organizer") {
    return state;
  }

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
  const id = `event-${slug}`;

  const nextEvent: EventItem = {
    id,
    slug,
    title,
    category: input.category,
    city: input.city.trim() || organizer.city,
    venue: input.venue.trim() || "Venue pendiente",
    coverImage: input.coverImage?.trim() || EVENT_COVER_BY_CATEGORY[input.category],
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    priceLabel: input.priceLabel.trim() || "Precio por confirmar",
    capacity: Number(input.capacity) || 80,
    baseGuestCount: 0,
    waitlistCount: 0,
    hostId: organizerId,
    summary,
    description,
    highlights: input.highlights.filter(Boolean).slice(0, 3),
    tags: input.tags.filter(Boolean).slice(0, 5),
    dressCode: input.dressCode.trim() || "Casual",
    conversationPrompt:
      "Presentate en el chat general y cuenta con quien te gustaria conectar antes del evento."
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

export function submitOrganizerLead(
  state: PersistedState,
  userId: string,
  input: OrganizerLeadInput
) {
  const existingLead = state.organizerLeads.find(
    (lead) => lead.fromUserId === userId && lead.status === "pending"
  );
  if (existingLead) {
    return state;
  }

  const companyName = input.companyName.trim();
  const concept = input.concept.trim();
  const message = input.message.trim();
  if (!companyName || !concept || !message) {
    return state;
  }

  const nextLead: OrganizerLead = {
    id: buildId("lead"),
    fromUserId: userId,
    companyName,
    concept,
    message,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  return {
    ...state,
    organizerLeads: [...state.organizerLeads, nextLead]
  };
}
