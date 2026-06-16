import {
  DEFAULT_STATE,
  EVENT_CATEGORY_META,
  EVENT_COVER_BY_CATEGORY
} from "@/lib/tindereo-data";
import type {
  CreateEventInput,
  EventAccessState,
  EventInvite,
  EventInviteStatus,
  EventConnectionState,
  EventDetailTab,
  EventGroupMessage,
  EventHealthStatus,
  EventItem,
  EventMembership,
  Friendship,
  PersistedState,
  PlatformUser,
  RegisterUserInput,
  PrivateChat,
  PrivateChatRequest,
  PrivateMessage,
  SocialPost,
  StoryItem
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

function hashString(value: string) {
  return value.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
}

function buildSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function ensureUniqueValue(baseValue: string, existingValues: string[]) {
  if (!existingValues.includes(baseValue)) {
    return baseValue;
  }

  let attempt = 2;
  let nextValue = `${baseValue}-${attempt}`;

  while (existingValues.includes(nextValue)) {
    attempt += 1;
    nextValue = `${baseValue}-${attempt}`;
  }

  return nextValue;
}

function createProfilePalette(seed: string) {
  const palettes = [
    {
      avatarFrom: "#FF6B57",
      avatarTo: "#F08A24",
      coverFrom: "#1D160F",
      coverTo: "#FF8D66",
      accent: "#FFD4C5"
    },
    {
      avatarFrom: "#2AA876",
      avatarTo: "#7DD3A6",
      coverFrom: "#10261F",
      coverTo: "#2AA876",
      accent: "#D8F7E8"
    },
    {
      avatarFrom: "#8A5CF6",
      avatarTo: "#C18BFF",
      coverFrom: "#1F1736",
      coverTo: "#8A5CF6",
      accent: "#E6D9FF"
    },
    {
      avatarFrom: "#C7702E",
      avatarTo: "#F3B16B",
      coverFrom: "#2D1708",
      coverTo: "#C7702E",
      accent: "#FFE0C1"
    }
  ] as const;

  return palettes[hashString(seed) % palettes.length];
}

function buildAvatarDataUrl(name: string, from: string, to: string) {
  const initials = getInitials(name);
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="72" fill="url(#avatarGradient)" />
      <circle cx="58" cy="56" r="34" fill="rgba(255,255,255,0.16)" />
      <circle cx="190" cy="186" r="42" fill="rgba(255,255,255,0.1)" />
      <text
        x="120"
        y="136"
        text-anchor="middle"
        font-size="84"
        font-family="Arial, sans-serif"
        font-weight="700"
        fill="#FFFFFF"
      >
        ${initials}
      </text>
    </svg>
  `);
}

function buildCoverDataUrl(name: string, city: string, colors: ReturnType<typeof createProfilePalette>) {
  return buildSvgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520">
      <defs>
        <linearGradient id="coverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.coverFrom}" />
          <stop offset="100%" stop-color="${colors.coverTo}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="520" fill="url(#coverGradient)" />
      <circle cx="180" cy="110" r="110" fill="rgba(255,255,255,0.09)" />
      <circle cx="980" cy="420" r="180" fill="rgba(255,255,255,0.08)" />
      <circle cx="760" cy="80" r="70" fill="${colors.accent}" fill-opacity="0.36" />
      <text
        x="72"
        y="336"
        font-size="88"
        font-family="Arial, sans-serif"
        font-weight="700"
        fill="#FFFFFF"
      >
        ${name}
      </text>
      <text
        x="76"
        y="396"
        font-size="30"
        font-family="Arial, sans-serif"
        letter-spacing="7"
        fill="rgba(255,255,255,0.72)"
      >
        ${city.toUpperCase()} · EVENTOS · COMUNIDAD
      </text>
    </svg>
  `);
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
    Array.isArray(candidate.friendships) &&
    Array.isArray(candidate.eventInvites) &&
    Array.isArray(candidate.socialPosts) &&
    Array.isArray(candidate.stories) &&
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
    ...DEFAULT_STATE,
    ...state,
    session: {
      ...DEFAULT_STATE.session,
      ...state.session,
      currentUserId,
      isAuthenticated: Boolean(state.session.isAuthenticated && currentUserId)
    },
    friendships: state.friendships ?? DEFAULT_STATE.friendships,
    eventInvites: state.eventInvites ?? DEFAULT_STATE.eventInvites,
    socialPosts: state.socialPosts ?? DEFAULT_STATE.socialPosts,
    stories: state.stories ?? DEFAULT_STATE.stories
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
  const currentUser =
    state.users.find((user) => user.id === state.session.currentUserId) ?? state.users[0] ?? null;

  if (!currentUser) {
    throw new Error("No hay un usuario activo todavia.");
  }

  return currentUser;
}

export function getUserById(state: PersistedState, userId: string) {
  const user = state.users.find((candidate) => candidate.id === userId);
  if (user) {
    return user;
  }

  return getCurrentUser(state);
}

export function areFriends(state: PersistedState, userAId: string, userBId: string) {
  return state.friendships.some(
    (friendship) =>
      friendship.userIds.includes(userAId) && friendship.userIds.includes(userBId)
  );
}

export function getFriends(state: PersistedState, userId: string) {
  return state.friendships
    .filter((friendship) => friendship.userIds.includes(userId))
    .map((friendship) => {
      const friendId = friendship.userIds.find((candidate) => candidate !== userId) ?? userId;
      return getUserById(state, friendId);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getFriendSuggestions(state: PersistedState, userId: string) {
  return state.users
    .filter((user) => user.id !== userId && !areFriends(state, userId, user.id))
    .sort((left, right) => left.name.localeCompare(right.name));
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
        getEventRequest(state, event.id, userId)?.status === "approved" ||
        state.eventInvites.some(
          (invite) =>
            invite.eventId === event.id &&
            invite.toUserId === userId &&
            (invite.status === "pending" || invite.status === "accepted")
        )
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

export function getEventFriendMembers(state: PersistedState, eventId: string, userId: string) {
  const friendIds = new Set(getFriends(state, userId).map((friend) => friend.id));
  return getEventMembers(state, eventId).filter((member) => friendIds.has(member.id));
}

export function canRevealEventMembers(state: PersistedState, eventId: string, userId: string) {
  return hasEventAccess(state, eventId, userId);
}

export function getEventInvitesForUser(state: PersistedState, userId: string) {
  return state.eventInvites
    .filter((invite) => invite.toUserId === userId || invite.fromUserId === userId)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getPendingEventInvitesForUser(state: PersistedState, userId: string) {
  return getEventInvitesForUser(state, userId).filter(
    (invite) => invite.toUserId === userId && invite.status === "pending"
  );
}

export function getEventInvitableFriends(state: PersistedState, eventId: string, userId: string) {
  const friendIds = new Set(getFriends(state, userId).map((friend) => friend.id));
  const invitedIds = new Set(
    state.eventInvites
      .filter((invite) => invite.eventId === eventId && invite.status === "pending")
      .map((invite) => invite.toUserId)
  );
  const attendeeIds = new Set(getEventMembers(state, eventId).map((member) => member.id));

  return state.users
    .filter(
      (user) =>
        friendIds.has(user.id) &&
        !invitedIds.has(user.id) &&
        !attendeeIds.has(user.id) &&
        user.id !== userId
    )
    .sort((left, right) => left.name.localeCompare(right.name));
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

export function toggleFriendship(state: PersistedState, actorId: string, targetUserId: string) {
  if (actorId === targetUserId) {
    return state;
  }

  const existing = state.friendships.find(
    (friendship) =>
      friendship.userIds.includes(actorId) && friendship.userIds.includes(targetUserId)
  );

  if (existing) {
    return {
      ...state,
      friendships: state.friendships.filter((friendship) => friendship.id !== existing.id)
    };
  }

  const nextFriendship: Friendship = {
    id: buildId("friend"),
    userIds: [actorId, targetUserId],
    createdAt: new Date().toISOString()
  };

  return {
    ...state,
    friendships: [...state.friendships, nextFriendship]
  };
}

export function sendEventInvite(
  state: PersistedState,
  actorId: string,
  eventId: string,
  targetUserId: string
) {
  const event = getEventById(state, eventId);
  if (!event || event.hostId !== actorId || targetUserId === actorId) {
    return state;
  }

  if (!areFriends(state, actorId, targetUserId)) {
    return state;
  }

  if (getEventMembers(state, eventId).some((member) => member.id === targetUserId)) {
    return state;
  }

  const existingPending = state.eventInvites.find(
    (invite) =>
      invite.eventId === eventId &&
      invite.toUserId === targetUserId &&
      invite.status === "pending"
  );

  if (existingPending) {
    return state;
  }

  const nextInvite: EventInvite = {
    id: buildId("invite"),
    eventId,
    fromUserId: actorId,
    toUserId: targetUserId,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  return {
    ...state,
    eventInvites: [nextInvite, ...state.eventInvites]
  };
}

export function respondToEventInvite(
  state: PersistedState,
  inviteId: string,
  actorId: string,
  accept: boolean
) {
  const invite = state.eventInvites.find((item) => item.id === inviteId);
  if (!invite || invite.toUserId !== actorId || invite.status !== "pending") {
    return state;
  }

  const respondedAt = new Date().toISOString();
  const nextInvites: EventInvite[] = state.eventInvites.map((item) =>
    item.id === inviteId
      ? {
          ...item,
          status: (accept ? "accepted" : "declined") as EventInviteStatus,
          respondedAt
        }
      : item
  );

  if (!accept) {
    return {
      ...state,
      eventInvites: nextInvites
    };
  }

  const event = getEventById(state, invite.eventId);
  if (!event) {
    return {
      ...state,
      eventInvites: nextInvites
    };
  }

  const existingMembership = getEventRequest(state, invite.eventId, actorId);
  if (existingMembership) {
    const memberships = state.memberships.map((membership) =>
      membership.id === existingMembership.id
        ? {
            ...membership,
            status: "approved" as const,
            respondedAt
          }
        : membership
    );

    return {
      ...state,
      eventInvites: nextInvites,
      memberships
    };
  }

  const nextMembership: EventMembership = {
    id: buildId("membership"),
    eventId: invite.eventId,
    userId: actorId,
    status: "approved",
    requestedAt: respondedAt,
    respondedAt
  };

  const user = getUserById(state, actorId);
  const systemMessage: EventGroupMessage = {
    id: buildId("group"),
    eventId: invite.eventId,
    authorId: "system",
    text: `${user.name} ha entrado al evento desde una invitacion directa.`,
    kind: "system",
    createdAt: respondedAt
  };

  return {
    ...state,
    eventInvites: nextInvites,
    memberships: [...state.memberships, nextMembership],
    groupMessages: [...state.groupMessages, systemMessage]
  };
}

function createMediaPost(
  state: PersistedState,
  authorType: SocialPost["authorType"],
  authorId: string,
  imageUrl: string,
  caption: string
) {
  const trimmedImageUrl = imageUrl.trim();
  const trimmedCaption = caption.trim();
  if (!trimmedImageUrl) {
    return state;
  }

  const nextPost: SocialPost = {
    id: buildId("post"),
    authorType,
    authorId,
    imageUrl: trimmedImageUrl,
    caption: trimmedCaption,
    createdAt: new Date().toISOString()
  };

  return {
    ...state,
    socialPosts: [nextPost, ...state.socialPosts]
  };
}

function createStoryEntry(
  state: PersistedState,
  authorType: StoryItem["authorType"],
  authorId: string,
  imageUrl: string,
  caption: string
) {
  const trimmedImageUrl = imageUrl.trim();
  const trimmedCaption = caption.trim();
  if (!trimmedImageUrl) {
    return state;
  }

  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const nextStory: StoryItem = {
    id: buildId("story"),
    authorType,
    authorId,
    imageUrl: trimmedImageUrl,
    caption: trimmedCaption,
    createdAt,
    expiresAt
  };

  return {
    ...state,
    stories: [nextStory, ...state.stories]
  };
}

export function createUserPost(
  state: PersistedState,
  actorId: string,
  imageUrl: string,
  caption: string
) {
  return createMediaPost(state, "user", actorId, imageUrl, caption);
}

export function createUserStory(
  state: PersistedState,
  actorId: string,
  imageUrl: string,
  caption: string
) {
  return createStoryEntry(state, "user", actorId, imageUrl, caption);
}

export function createEventPost(
  state: PersistedState,
  actorId: string,
  eventId: string,
  imageUrl: string,
  caption: string
) {
  const event = getEventById(state, eventId);
  if (!event || event.hostId !== actorId) {
    return state;
  }

  return createMediaPost(state, "event", eventId, imageUrl, caption);
}

export function createEventStory(
  state: PersistedState,
  actorId: string,
  eventId: string,
  imageUrl: string,
  caption: string
) {
  const event = getEventById(state, eventId);
  if (!event || event.hostId !== actorId) {
    return state;
  }

  return createStoryEntry(state, "event", eventId, imageUrl, caption);
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

export function isStoryActive(story: StoryItem) {
  return new Date(story.expiresAt).getTime() > Date.now();
}

function canSeeEventMedia(state: PersistedState, eventId: string, userId: string) {
  const event = getEventById(state, eventId);
  if (!event) {
    return false;
  }

  return event.visibility === "public" || hasEventAccess(state, eventId, userId);
}

export function getFeedPosts(state: PersistedState, userId: string) {
  const friendIds = new Set(getFriends(state, userId).map((friend) => friend.id));

  return state.socialPosts
    .filter((post) => {
      if (post.authorType === "user") {
        return post.authorId === userId || friendIds.has(post.authorId);
      }

      return canSeeEventMedia(state, post.authorId, userId);
    })
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getProfilePosts(state: PersistedState, userId: string) {
  return state.socialPosts
    .filter((post) => post.authorType === "user" && post.authorId === userId)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getEventPosts(state: PersistedState, eventId: string) {
  return state.socialPosts
    .filter((post) => post.authorType === "event" && post.authorId === eventId)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getActiveStories(state: PersistedState, userId: string) {
  const friendIds = new Set(getFriends(state, userId).map((friend) => friend.id));

  return state.stories
    .filter((story) => {
      if (!isStoryActive(story)) {
        return false;
      }

      if (story.authorType === "user") {
        return story.authorId === userId || friendIds.has(story.authorId);
      }

      return canSeeEventMedia(state, story.authorId, userId);
    })
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getProfileStories(state: PersistedState, userId: string) {
  return state.stories
    .filter(
      (story) => story.authorType === "user" && story.authorId === userId && isStoryActive(story)
    )
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getEventStories(state: PersistedState, eventId: string) {
  return state.stories
    .filter(
      (story) => story.authorType === "event" && story.authorId === eventId && isStoryActive(story)
    )
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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

export function registerUser(state: PersistedState, input: RegisterUserInput) {
  const name = input.name.trim();
  const city = input.city.trim() || "Madrid";
  const bio = input.bio.trim();

  if (!name || !bio) {
    throw new Error("Completa al menos nombre y bio para crear tu perfil.");
  }

  const requestedHandle = input.handle.trim().replace(/^@+/, "");
  const baseHandle = slugify(requestedHandle || name) || buildId("user");
  const normalizedHandles = state.users.map((user) => user.handle.replace(/^@+/, "").toLowerCase());
  const normalizedIds = state.users.map((user) => user.id.toLowerCase());
  const uniqueHandle = ensureUniqueValue(baseHandle, normalizedHandles);
  const uniqueId = ensureUniqueValue(baseHandle, normalizedIds);
  const palette = createProfilePalette(`${name}-${city}-${uniqueHandle}`);
  const firstName = name.split(" ")[0] || name;

  const nextUser: PlatformUser = {
    id: uniqueId,
    name,
    handle: `@${uniqueHandle}`,
    city,
    title: "Miembro de la comunidad",
    bio,
    tagline: `${firstName} ya esta montando su circulo para los proximos planes en ${city}.`,
    avatar: buildAvatarDataUrl(name, palette.avatarFrom, palette.avatarTo),
    coverImage: buildCoverDataUrl(name, city, palette),
    interests: ["Eventos", "Comunidad", "Planes", "Social", city],
    verified: false
  };

  return {
    ...state,
    users: [nextUser, ...state.users]
  };
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
