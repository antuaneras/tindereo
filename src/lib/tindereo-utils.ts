import {
  ADMIN_SNAPSHOT,
  AUTO_REPLIES,
  BASE_ATTENDEES,
  DEMO_USER,
  EVENT_ZONES
} from "@/lib/tindereo-data";
import type {
  ChatMessage,
  EventZone,
  MatchItem,
  RegistrationDraft,
  SwipeDirection,
  UserProfile
} from "@/lib/tindereo-types";

export function getZoneById(zoneId: string): EventZone {
  return EVENT_ZONES.find((zone) => zone.id === zoneId) ?? EVENT_ZONES[0];
}

export function getCommonInterests(currentUser: UserProfile, otherUser: UserProfile) {
  return currentUser.interests.filter((interest) => otherUser.interests.includes(interest));
}

export function getCompatibilityScore(currentUser: UserProfile, otherUser: UserProfile) {
  const commonInterests = getCommonInterests(currentUser, otherUser).length;
  const goalBonus =
    currentUser.goal === otherUser.goal ||
    currentUser.goal === "Lo que surja" ||
    otherUser.goal === "Lo que surja";
  const cityBonus = currentUser.city === otherUser.city ? 4 : 0;
  const rawScore = 48 + commonInterests * 11 + (goalBonus ? 12 : 0) + cityBonus;
  return Math.max(58, Math.min(97, rawScore));
}

export function shouldCreateMatch(
  currentUser: UserProfile,
  otherUser: UserProfile,
  direction: SwipeDirection
) {
  const commonInterests = getCommonInterests(currentUser, otherUser);
  const compatibility = getCompatibilityScore(currentUser, otherUser);
  if (direction === "super") {
    return commonInterests.length >= 1 || compatibility >= 66;
  }

  return compatibility >= 76 || commonInterests.length >= 2;
}

export function createProfileFromDraft(draft: RegistrationDraft): UserProfile {
  return {
    id: `guest-${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "nuevo"}`,
    name: draft.name || "Invitado/a",
    age: Number(draft.age) || 26,
    city: draft.city || "Madrid",
    occupation: draft.occupation || "Invitado/a",
    instagram: draft.instagram || "@sininstagram",
    relationship: draft.relationship,
    goal: draft.goal || "Lo que surja",
    bio:
      draft.bio ||
      "Vengo con ganas de descubrir gente nueva, bailar un rato y dejar que la noche haga lo suyo.",
    interests: draft.interests.length > 0 ? draft.interests : ["Techno", "Viajes"],
    photo: draft.photo,
    coverPhoto: draft.coverPhoto,
    zoneId: "dj",
    points: 180,
    matches: 0,
    superLikes: 0,
    gender: "Mujer",
    joinedAt: new Date().toISOString(),
    status: "online",
    headline: "Acabo de entrar y ya estoy explorando el ambiente."
  };
}

export function buildCommunityUsers(currentUser: UserProfile | null) {
  if (!currentUser) {
    return [DEMO_USER, ...BASE_ATTENDEES];
  }

  if (currentUser.id === DEMO_USER.id) {
    return [DEMO_USER, ...BASE_ATTENDEES];
  }

  return [currentUser, ...BASE_ATTENDEES];
}

export function getUserById(currentUser: UserProfile | null, userId: string) {
  return buildCommunityUsers(currentUser).find((user) => user.id === userId) ?? DEMO_USER;
}

export function getMatchPartner(match: MatchItem, currentUserId: string, currentUser: UserProfile | null) {
  const partnerId = match.userIds.find((userId) => userId !== currentUserId) ?? currentUserId;
  return getUserById(currentUser, partnerId);
}

export function formatClock(dateIso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateIso));
}

export function formatTimeAgo(dateIso: string) {
  const diffMinutes = Math.max(1, Math.round((Date.now() - new Date(dateIso).getTime()) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.round(hours / 24)}d`;
}

export function buildMatchMessagePreview(messages: ChatMessage[]) {
  const lastMessage = messages[messages.length - 1];
  return lastMessage?.text ?? "Empieza la conversacion";
}

export function buildTopInterests(currentUser: UserProfile | null) {
  const counts = new Map<string, number>();
  for (const user of buildCommunityUsers(currentUser)) {
    for (const interest of user.interests) {
      counts.set(interest, (counts.get(interest) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value: Math.round((value / buildCommunityUsers(currentUser).length) * 100) }));
}

export function buildGenderDistribution(currentUser: UserProfile | null) {
  const users = buildCommunityUsers(currentUser);
  const buckets = [
    { name: "Hombres", key: "Hombre" as const, color: "#FF8C42" },
    { name: "Mujeres", key: "Mujer" as const, color: "#FF5A5F" },
    { name: "No binario", key: "No binario" as const, color: "#FFB347" }
  ];

  return buckets.map((bucket) => ({
    name: bucket.name,
    value: Math.round((users.filter((user) => user.gender === bucket.key).length / users.length) * 100),
    color: bucket.color
  }));
}

export function buildLeaderboard(currentUser: UserProfile | null) {
  return buildCommunityUsers(currentUser)
    .slice()
    .sort((left, right) => right.points - left.points)
    .map((user, index) => ({
      rank: index + 1,
      user
    }));
}

export function getMyRank(currentUser: UserProfile | null) {
  if (!currentUser) {
    return { rank: 14, points: 620, progress: 68, nextMilestone: 750 };
  }

  const leaderboard = buildLeaderboard(currentUser);
  const rank = leaderboard.find((entry) => entry.user.id === currentUser.id)?.rank ?? leaderboard.length;
  const nextMilestone = Math.ceil(currentUser.points / 250) * 250 + 250;
  const previousMilestone = nextMilestone - 250;
  const progress = Math.round(((currentUser.points - previousMilestone) / 250) * 100);

  return {
    rank,
    points: currentUser.points,
    progress: Math.max(12, Math.min(100, progress)),
    nextMilestone
  };
}

export function buildDashboardMetrics(currentUser: UserProfile | null, matches: MatchItem[], messages: Record<string, ChatMessage[]>) {
  const extraGuest = currentUser && currentUser.id !== DEMO_USER.id ? 1 : 0;
  const extraMatches = Math.max(0, matches.length - 2);
  const totalMessages = Object.values(messages).reduce((count, thread) => count + thread.length, 0);

  return {
    registeredUsers: ADMIN_SNAPSHOT.registeredUsers + extraGuest,
    activeUsers: ADMIN_SNAPSHOT.activeUsers + extraGuest,
    matchesGenerated: ADMIN_SNAPSHOT.matchesGenerated + extraMatches,
    chatsStarted: ADMIN_SNAPSHOT.chatsStarted + Math.max(0, Math.ceil(totalMessages / 6) - 1)
  };
}

export function getAutoReply(currentUser: UserProfile, otherUser: UserProfile, messageCount: number) {
  const baseReply = AUTO_REPLIES[messageCount % AUTO_REPLIES.length];
  if (otherUser.zoneId === currentUser.zoneId) {
    return `${baseReply} Creo que estamos bastante cerca.`;
  }

  return baseReply;
}

export function getSwipeReward(direction: SwipeDirection) {
  if (direction === "super") return 40;
  if (direction === "right") return 25;
  return 0;
}
