import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import type {
  CreateMobileEventInput,
  CreateConversationInput,
  MobileConversationDetail,
  MobileConversationKind,
  MobileConversationSummary,
  MobileEvent,
  MobileEventCohost,
  MobileEventDetail,
  MobileEventInvite,
  MobileEventMember,
  MobileEventParticipant,
  MobileEventTicket,
  MobileFaqItem,
  MobileMediaAsset,
  MobileMessage,
  MobileMessageReceipt,
  MobileModerationAction,
  MobileNotification,
  MobilePost,
  MobilePostComment,
  MobileProfile,
  MobileProfileMini,
  MobileProfileDetail,
  MobileSearchFilters,
  MobileSearchPayload,
  MobileStoryMessageContext,
  MobileSuggestedProfile,
  MobileStory,
  MobileStoryCluster,
  MobileViewerSummary,
  PublishMobilePostInput,
  PublishMobileStoryInput,
  SendMobileMessageInput,
  UpdateMobileProfileInput
} from "@/lib/mobile-types";
import {
  buildMobileId,
  formatRelativeMobileTime,
  getConversationPreview,
  getEventExperienceState,
  parseStoryMessageText,
  safeJsonArray,
  toJson,
  uniqueMobileSlug
} from "@/lib/mobile-shared";
import { buildManagedMediaProxyUrl, isManagedMediaRef } from "@/lib/server/tindereo-media";
import { getAuthenticatedUserId } from "@/lib/server/tindereo-auth";
import { deleteRows, insertRow, insertRows, isMissingMobileSchemaError, patchRows, selectRows } from "@/lib/server/mobile-db";
import { sendMobilePushNotifications } from "@/lib/server/mobile-push";
import { publishMobileRealtimeEvent } from "@/lib/server/mobile-realtime";

const TABLES = {
  conversationMembers: "conversation_members",
  conversations: "conversations",
  eventBans: "event_bans",
  eventCohosts: "event_cohosts",
  eventEntryTickets: "event_entry_tickets",
  eventInvites: "event_invites",
  eventMembers: "event_members",
  eventMutes: "event_mutes",
  eventPresence: "event_presence",
  eventReports: "event_reports",
  eventStaffRoles: "event_staff_roles",
  eventWaitlist: "event_waitlist",
  events: "events",
  friendships: "friendships",
  mediaAssets: "media_assets",
  messageReceipts: "message_receipts",
  messages: "messages",
  notifications: "notifications",
  profileFollowRequests: "profile_follow_requests",
  profileFollows: "profile_follows",
  postLikes: "post_likes",
  postComments: "post_comments",
  postMediaItems: "post_media_items",
  posts: "posts",
  profiles: "profiles",
  pushSubscriptions: "push_subscriptions",
  reminderLogs: "reminder_logs",
  stories: "stories",
  storyViews: "story_views"
} as const;

type ProfileRow = {
  avatar_url: string | null;
  bio: string;
  city: string;
  cover_url: string | null;
  created_at: string;
  display_name: string;
  handle: string;
  handle_lower: string;
  id: string;
  is_private: boolean;
  updated_at: string;
};

type EventRow = {
  capacity: number;
  category: string;
  chat_mode: "open" | "announcements";
  city: string;
  cover_image: string | null;
  created_at: string;
  description: string;
  dress_code: string;
  ends_at: string;
  faq_json: unknown;
  host_id: string;
  id: string;
  meeting_point_address: string | null;
  meeting_point_label: string | null;
  meeting_point_lat: number | null;
  meeting_point_lng: number | null;
  playlist_url: string | null;
  price_label: string;
  rules_json: unknown;
  slug: string;
  starts_at: string;
  summary: string;
  tags_json: unknown;
  title: string;
  updated_at: string;
  venue: string;
  visibility: "public" | "private";
};

type EventMemberRow = {
  event_id: string;
  id: string;
  joined_at: string | null;
  requested_at: string;
  responded_at: string | null;
  status: MobileEventMember["status"];
  user_id: string;
};

type EventPresenceRow = {
  arrival_status: MobileEventMember["arrivalStatus"];
  checked_in_at: string | null;
  checked_in_by_user_id: string | null;
  created_at: string;
  event_id: string;
  id: string;
  updated_at: string;
  user_id: string;
};

type EventCohostRow = {
  created_at: string;
  event_id: string;
  id: string;
  user_id: string;
};

type EventStaffRoleRow = {
  created_at: string;
  event_id: string;
  id: string;
  role: "moderator" | "scanner";
  user_id: string;
};

type EventEntryTicketRow = {
  created_at: string;
  event_id: string;
  id: string;
  invalidated_at: string | null;
  invalidated_reason: string | null;
  membership_id: string | null;
  role_label: string;
  scanned_at: string | null;
  scanned_by_user_id: string | null;
  ticket_code: string;
  token: string;
  updated_at: string;
  user_id: string;
  valid_until: string;
};

type EventInviteRow = {
  created_at: string;
  event_id: string;
  from_user_id: string;
  id: string;
  responded_at: string | null;
  status: MobileEventInvite["status"];
  to_user_id: string;
};

type FriendshipRow = {
  created_at?: string;
  id?: string;
  user_a_id: string;
  user_b_id: string;
};

type ProfileFollowRow = {
  created_at: string;
  followee_id: string;
  follower_id: string;
  id: string;
};

type ProfileFollowRequestRow = {
  created_at: string;
  id: string;
  requester_id: string;
  responded_at: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  target_user_id: string;
};

type ConversationRow = {
  chat_mode: "open" | "announcements";
  cover_image: string | null;
  created_at: string;
  event_id: string | null;
  id: string;
  kind: MobileConversationKind;
  owner_id: string;
  title: string | null;
  updated_at: string;
};

type ConversationMemberRow = {
  archived_at: string | null;
  conversation_id: string;
  hidden_at: string | null;
  id: string;
  joined_at: string;
  last_read_at: string | null;
  pinned_at: string | null;
  role: "owner" | "cohost" | "member";
  user_id: string;
};

type MediaAssetRow = {
  created_at: string;
  expires_at: string | null;
  id: string;
  mime_type: string;
  owner_id: string;
  preview_url: string | null;
  purpose: MobileMediaAsset["purpose"];
  storage_ref: string;
};

type MessageRow = {
  author_id: string | null;
  body: string;
  conversation_id: string;
  created_at: string;
  deleted_at: string | null;
  deleted_for_everyone: boolean;
  ephemeral_expires_at: string | null;
  id: string;
  kind: MobileMessage["kind"];
  media_asset_id: string | null;
  thread_root_id: string | null;
};

type MessageReceiptRow = {
  delivered_at: string | null;
  id: string;
  message_id: string;
  read_at: string | null;
  user_id: string;
};

type StoryRow = {
  author_id: string;
  caption: string;
  created_at: string;
  duration_ms: number;
  expires_at: string;
  id: string;
  media_asset_id: string | null;
  owner_id: string;
  owner_type: "user" | "event";
};

type StoryViewRow = {
  id: string;
  seen_at: string;
  story_id: string;
  user_id: string;
};

type PostRow = {
  author_id: string;
  caption: string;
  created_at: string;
  id: string;
  media_asset_id: string | null;
  owner_id: string;
  owner_type: "user" | "event";
  updated_at: string;
};

type PostLikeRow = {
  created_at: string;
  id: string;
  post_id: string;
  user_id: string;
};

type PostCommentRow = {
  author_id: string;
  body: string;
  created_at: string;
  id: string;
  post_id: string;
};

type PostMediaItemRow = {
  created_at: string;
  id: string;
  media_asset_id: string;
  post_id: string;
  sort_order: number;
};

type NotificationRow = {
  body: string;
  created_at: string;
  data_json: unknown;
  entity_id: string | null;
  entity_type: string | null;
  id: string;
  kind: MobileNotification["kind"];
  read_at: string | null;
  title: string;
  user_id: string;
};

export class MobileSchemaNotReadyError extends Error {
  constructor() {
    super("La nueva base de datos movil aun no esta aplicada en Supabase. Aplica la migracion de supabase/mobile_v2.sql antes de usar esta version.");
    this.name = "MobileSchemaNotReadyError";
  }
}

function resolveMediaUrl(value: string | null) {
  if (!value) {
    return null;
  }

  return isManagedMediaRef(value) ? buildManagedMediaProxyUrl(value) : value;
}

function mapProfile(row: ProfileRow): MobileProfile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    city: row.city,
    bio: row.bio,
    avatarUrl: resolveMediaUrl(row.avatar_url),
    coverUrl: resolveMediaUrl(row.cover_url),
    isPrivate: Boolean(row.is_private),
    createdAt: row.created_at,
    relationship: null
  };
}

function mapProfileMini(profile: MobileProfile): MobileProfileMini {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    city: profile.city,
    avatarUrl: profile.avatarUrl,
    isPrivate: profile.isPrivate
  };
}

function buildRecapEndsAt(endsAt: string) {
  const endsAtMs = new Date(endsAt).getTime();
  const fallbackMs = Date.now() + 48 * 60 * 60 * 1000;
  return new Date((Number.isFinite(endsAtMs) ? endsAtMs : fallbackMs) + 48 * 60 * 60 * 1000).toISOString();
}

function mapMediaAsset(row: MediaAssetRow): MobileMediaAsset {
  return {
    id: row.id,
    ownerId: row.owner_id,
    storageRef: row.storage_ref,
    previewUrl: resolveMediaUrl(row.preview_url ?? row.storage_ref),
    mimeType: row.mime_type,
    purpose: row.purpose,
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

function buildFriendAdjacency(friendships: FriendshipRow[]) {
  const adjacency = new Map<string, Set<string>>();

  for (const friendship of friendships) {
    if (!adjacency.has(friendship.user_a_id)) {
      adjacency.set(friendship.user_a_id, new Set<string>());
    }
    if (!adjacency.has(friendship.user_b_id)) {
      adjacency.set(friendship.user_b_id, new Set<string>());
    }

    adjacency.get(friendship.user_a_id)?.add(friendship.user_b_id);
    adjacency.get(friendship.user_b_id)?.add(friendship.user_a_id);
  }

  return adjacency;
}

function buildFollowAdjacency(follows: ProfileFollowRow[]) {
  const followingByUserId = new Map<string, Set<string>>();
  const followersByUserId = new Map<string, Set<string>>();

  for (const follow of follows) {
    if (!followingByUserId.has(follow.follower_id)) {
      followingByUserId.set(follow.follower_id, new Set<string>());
    }
    if (!followersByUserId.has(follow.followee_id)) {
      followersByUserId.set(follow.followee_id, new Set<string>());
    }

    followingByUserId.get(follow.follower_id)?.add(follow.followee_id);
    followersByUserId.get(follow.followee_id)?.add(follow.follower_id);
  }

  return { followersByUserId, followingByUserId };
}

function buildProfileRelationship(
  viewerId: string,
  profileId: string,
  follows: ProfileFollowRow[],
  requests: ProfileFollowRequestRow[]
) {
  if (viewerId === profileId) {
    return {
      followsProfile: false,
      followedByProfile: false,
      outgoingFollowRequestId: null,
      incomingFollowRequestId: null
    };
  }

  return {
    followsProfile: follows.some((follow) => follow.follower_id === viewerId && follow.followee_id === profileId),
    followedByProfile: follows.some((follow) => follow.follower_id === profileId && follow.followee_id === viewerId),
    outgoingFollowRequestId:
      requests.find((request) => request.requester_id === viewerId && request.target_user_id === profileId && request.status === "pending")?.id ?? null,
    incomingFollowRequestId:
      requests.find((request) => request.requester_id === profileId && request.target_user_id === viewerId && request.status === "pending")?.id ?? null
  };
}

function applyViewerRelationshipsToProfiles(
  viewerId: string,
  profiles: MobileProfile[],
  follows: ProfileFollowRow[],
  requests: ProfileFollowRequestRow[]
) {
  return profiles.map((profile) => ({
    ...profile,
    relationship: buildProfileRelationship(viewerId, profile.id, follows, requests)
  }));
}

function buildSuggestedProfilesForViewer(
  viewerId: string,
  profiles: MobileProfile[],
  follows: ProfileFollowRow[]
) {
  const { followersByUserId, followingByUserId } = buildFollowAdjacency(follows);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const viewerFollowing = followingByUserId.get(viewerId) ?? new Set<string>();

  const suggestedProfiles = profiles
    .filter((profile) => profile.id !== viewerId && !viewerFollowing.has(profile.id))
    .map((profile): MobileSuggestedProfile => {
      const candidateFollowers = followersByUserId.get(profile.id) ?? new Set<string>();
      const mutualFriends = [...viewerFollowing]
        .filter((followedId) => candidateFollowers.has(followedId))
        .map((followedId) => profilesById.get(followedId))
        .filter((connection): connection is MobileProfile => Boolean(connection))
        .slice(0, 3)
        .map((connection) => ({
          id: connection.id,
          handle: connection.handle,
          avatarUrl: connection.avatarUrl
        }));

      return {
        ...profile,
        mutualFriendCount: mutualFriends.length,
        mutualFriends
      };
    })
    .sort((left, right) => {
      if (right.mutualFriendCount !== left.mutualFriendCount) {
        return right.mutualFriendCount - left.mutualFriendCount;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });

  return {
    suggestedProfiles,
    viewerFriendIds: viewerFollowing
  };
}

function normalizeSearchFilters(filters?: Partial<MobileSearchFilters>): MobileSearchFilters {
  return {
    city: filters?.city?.trim() ?? "",
    when: filters?.when ?? "all",
    visibility: filters?.visibility ?? "all",
    category: filters?.category?.trim() ?? ""
  };
}

function eventMatchesWhenFilter(event: MobileEvent, when: MobileSearchFilters["when"]) {
  if (when === "all") {
    return true;
  }

  const now = new Date();
  const startsAt = new Date(event.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return when === "live" ? event.experienceState === "live" : true;
  }

  if (when === "live") {
    return event.experienceState === "live";
  }

  if (when === "today") {
    return startsAt.toDateString() === now.toDateString();
  }

  if (when === "week") {
    const diffMs = startsAt.getTime() - now.getTime();
    return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
  }

  if (when === "month") {
    return startsAt.getMonth() === now.getMonth() && startsAt.getFullYear() === now.getFullYear();
  }

  return true;
}

function buildSearchFacets(events: MobileEvent[]) {
  return {
    cities: [...new Set(events.map((event) => event.city.trim()).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right, "es")
    ),
    categories: [...new Set(events.map((event) => event.category.trim()).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right, "es")
    )
  };
}

function mapMember(row: EventMemberRow, presence: EventPresenceRow | undefined): MobileEventMember {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    status: row.status,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
    joinedAt: row.joined_at,
    arrivalStatus: presence?.arrival_status ?? "none",
    checkedInAt: presence?.checked_in_at ?? null
  };
}

function mapEvent(
  row: EventRow,
  memberships: EventMemberRow[],
  presences: EventPresenceRow[]
): MobileEvent {
  const approvedCount = memberships.filter((membership) => membership.status === "approved").length;
  const waitlistCount = memberships.filter((membership) => membership.status === "waitlisted").length;
  const pendingCount = memberships.filter((membership) => membership.status === "pending").length;
  const insideCount = presences.filter((presence) => presence.arrival_status === "inside").length;

  return {
    id: row.id,
    slug: row.slug,
    hostId: row.host_id,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category,
    visibility: row.visibility,
    city: row.city,
    venue: row.venue,
    coverImage: resolveMediaUrl(row.cover_image),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: Number(row.capacity ?? 0),
    priceLabel: row.price_label,
    dressCode: row.dress_code,
    tags: safeJsonArray<string>(row.tags_json, []),
    rules: safeJsonArray<string>(row.rules_json, []),
    faq: safeJsonArray<MobileFaqItem>(row.faq_json, []),
    playlistUrl: row.playlist_url,
    meetingPointLabel: row.meeting_point_label,
    meetingPointAddress: row.meeting_point_address,
    meetingPointLat: row.meeting_point_lat,
    meetingPointLng: row.meeting_point_lng,
    chatMode: row.chat_mode === "announcements" ? "announcements" : "open",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    experienceState: getEventExperienceState({
      startsAt: row.starts_at,
      endsAt: row.ends_at
    }),
    approvedCount,
    waitlistCount,
    insideCount,
    pendingCount,
    recapEndsAt: buildRecapEndsAt(row.ends_at)
  };
}

function mapNotification(row: NotificationRow): MobileNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
    data:
      row.data_json && typeof row.data_json === "object" && !Array.isArray(row.data_json)
        ? (row.data_json as Record<string, string | number | boolean | null>)
        : {}
  };
}

function mapPostComment(row: PostCommentRow, author: MobileProfile | undefined): MobilePostComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorHandle: author?.handle ?? "usuario",
    authorDisplayName: author?.displayName ?? author?.handle ?? "Usuario",
    authorAvatarUrl: author?.avatarUrl ?? null,
    body: row.body,
    createdAt: row.created_at
  };
}

async function ensureMobileSchema() {
  try {
    await selectRows<ProfileRow>(TABLES.profiles, { limit: 1 });
  } catch (error) {
    if (isMissingMobileSchemaError(error)) {
      throw new MobileSchemaNotReadyError();
    }

    throw error;
  }
}

async function getViewerIdFromCookies() {
  return getAuthenticatedUserId(await cookies());
}

export async function requireMobileViewerId() {
  await ensureMobileSchema();
  const viewerId = await getViewerIdFromCookies();
  if (!viewerId) {
    throw new Error("Necesitas iniciar sesion.");
  }

  return viewerId;
}

export async function mobileViewerHasProfile(viewerId: string) {
  await ensureMobileSchema();
  const rows = await selectRows<ProfileRow>(TABLES.profiles, {
    filters: [{ column: "id", op: "eq", value: viewerId }],
    limit: 1
  });
  return Boolean(rows[0]);
}

async function loadProfiles(ids?: string[]) {
  const rows = await selectRows<ProfileRow>(TABLES.profiles, ids && ids.length
    ? { filters: [{ column: "id", op: "in", value: ids }] }
    : { order: [{ column: "created_at", ascending: false }] });
  return rows.map(mapProfile);
}

async function loadProfileFollows() {
  return selectRows<ProfileFollowRow>(TABLES.profileFollows, {
    order: [{ column: "created_at", ascending: false }]
  }).catch(async () => [] as ProfileFollowRow[]);
}

async function loadPendingProfileFollowRequests() {
  return selectRows<ProfileFollowRequestRow>(TABLES.profileFollowRequests, {
    filters: [{ column: "status", op: "eq", value: "pending" }],
    order: [{ column: "created_at", ascending: false }]
  }).catch(async () => [] as ProfileFollowRequestRow[]);
}

async function loadFriendIds(viewerId: string) {
  const follows = await loadProfileFollows();
  const { followersByUserId, followingByUserId } = buildFollowAdjacency(follows);
  return [
    ...new Set([
      ...(followingByUserId.get(viewerId) ?? new Set<string>()),
      ...(followersByUserId.get(viewerId) ?? new Set<string>())
    ])
  ];
}

async function loadMediaAssets(ids: string[]) {
  if (ids.length === 0) {
    return [] as MobileMediaAsset[];
  }

  const rows = await selectRows<MediaAssetRow>(TABLES.mediaAssets, {
    filters: [{ column: "id", op: "in", value: ids }]
  });
  return rows.map(mapMediaAsset);
}

async function loadAllEvents() {
  const [eventRows, memberRows, presenceRows] = await Promise.all([
    selectRows<EventRow>(TABLES.events, { order: [{ column: "starts_at", ascending: true }] }),
    selectRows<EventMemberRow>(TABLES.eventMembers),
    selectRows<EventPresenceRow>(TABLES.eventPresence)
  ]);

  return eventRows.map((row) =>
    mapEvent(
      row,
      memberRows.filter((member) => member.event_id === row.id),
      presenceRows.filter((presence) => presence.event_id === row.id)
    )
  );
}

function mapEventInvite(
  row: EventInviteRow,
  eventRow: EventRow,
  fromProfile: MobileProfile,
  toProfile: MobileProfile
): MobileEventInvite {
  return {
    id: row.id,
    eventId: row.event_id,
    eventSlug: eventRow.slug,
    eventTitle: eventRow.title,
    eventSummary: eventRow.summary,
    eventCity: eventRow.city,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    fromProfile: mapProfileMini(fromProfile),
    toProfile: mapProfileMini(toProfile)
  };
}

async function listEventInvitesForViewer(viewerId: string, options?: { pendingOnly?: boolean }) {
  const inviteRows = await selectRows<EventInviteRow>(TABLES.eventInvites, {
    filters: [
      { column: "to_user_id", op: "eq", value: viewerId },
      ...(options?.pendingOnly ? [{ column: "status", op: "eq" as const, value: "pending" }] : [])
    ],
    order: [{ column: "created_at", ascending: false }]
  }).catch(async () => [] as EventInviteRow[]);

  if (inviteRows.length === 0) {
    return [] as MobileEventInvite[];
  }

  const eventIds = [...new Set(inviteRows.map((row) => row.event_id))];
  const profileIds = [...new Set(inviteRows.flatMap((row) => [row.from_user_id, row.to_user_id]))];
  const [eventRows, profiles] = await Promise.all([
    selectRows<EventRow>(TABLES.events, { filters: [{ column: "id", op: "in", value: eventIds }] }),
    loadProfiles(profileIds)
  ]);
  const eventsById = new Map(eventRows.map((row) => [row.id, row]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return inviteRows
    .map((row) => {
      const eventRow = eventsById.get(row.event_id);
      const fromProfile = profilesById.get(row.from_user_id);
      const toProfile = profilesById.get(row.to_user_id);
      if (!eventRow || !fromProfile || !toProfile) {
        return null;
      }
      return mapEventInvite(row, eventRow, fromProfile, toProfile);
    })
    .filter((invite): invite is MobileEventInvite => Boolean(invite));
}

async function loadConversationRowsForUser(viewerId: string) {
  const memberRows = await selectRows<ConversationMemberRow>(TABLES.conversationMembers, {
    filters: [
      { column: "user_id", op: "eq", value: viewerId },
      { column: "hidden_at", op: "is", value: null }
    ]
  });

  const conversationIds = memberRows.map((row) => row.conversation_id);
  if (conversationIds.length === 0) {
    return {
      conversationRows: [] as ConversationRow[],
      memberRows,
      messageRows: [] as MessageRow[],
      profileRows: [] as ProfileRow[],
      eventRows: [] as EventRow[]
    };
  }

  const [conversationRows, allMemberRows, messageRows, profileRows, eventRows] = await Promise.all([
    selectRows<ConversationRow>(TABLES.conversations, {
      filters: [{ column: "id", op: "in", value: conversationIds }]
    }),
    selectRows<ConversationMemberRow>(TABLES.conversationMembers, {
      filters: [{ column: "conversation_id", op: "in", value: conversationIds }]
    }),
    selectRows<MessageRow>(TABLES.messages, {
      filters: [{ column: "conversation_id", op: "in", value: conversationIds }],
      order: [{ column: "created_at", ascending: true }]
    }),
    selectRows<ProfileRow>(TABLES.profiles),
    selectRows<EventRow>(TABLES.events)
  ]);

  return { conversationRows, memberRows: allMemberRows, messageRows, profileRows, eventRows };
}

async function listConversationSummariesForUser(viewerId: string) {
  const { conversationRows, memberRows, messageRows, profileRows, eventRows } =
    await loadConversationRowsForUser(viewerId);
  const profilesById = new Map(profileRows.map((row) => [row.id, mapProfile(row)]));
  const eventsById = new Map(eventRows.map((row) => [row.id, row]));

  const summaries = conversationRows.map((conversation): MobileConversationSummary => {
    const members = memberRows.filter((member) => member.conversation_id === conversation.id);
    const lastMessage = messageRows
      .filter((message) => message.conversation_id === conversation.id)
      .slice(-1)[0];
    const viewerMember = members.find((member) => member.user_id === viewerId);
    const unreadCount = lastMessage
      ? messageRows.filter(
          (message) =>
            message.conversation_id === conversation.id &&
            message.author_id !== viewerId &&
            (!viewerMember?.last_read_at || message.created_at > viewerMember.last_read_at)
        ).length
      : 0;
    const participantProfiles = members
      .filter((member) => member.user_id !== viewerId)
      .map((member) => profilesById.get(member.user_id))
      .filter((profile): profile is MobileProfile => Boolean(profile));
    const eventRow = conversation.event_id ? eventsById.get(conversation.event_id) : null;

    if (conversation.kind === "event" && eventRow) {
      return {
        id: conversation.id,
        kind: conversation.kind,
        title: eventRow.title,
        subtitle: `${eventRow.city} · ${formatRelativeMobileTime(eventRow.starts_at)}`,
        avatarUrl: resolveMediaUrl(eventRow.cover_image),
        lastMessagePreview: getConversationPreview(lastMessage?.body ?? eventRow.summary),
        lastMessageAt: lastMessage?.created_at ?? eventRow.updated_at,
        unreadCount,
        isPinned: Boolean(viewerMember?.pinned_at),
        isArchived: Boolean(viewerMember?.archived_at),
        chatMode: conversation.chat_mode,
        eventSlug: eventRow.slug,
        eventId: eventRow.id
      };
    }

    if (conversation.kind === "direct") {
      const other = participantProfiles[0] ?? null;
      return {
        id: conversation.id,
        kind: conversation.kind,
        title: other?.handle ? `@${other.handle}` : "Chat",
        subtitle: other?.city ?? "",
        avatarUrl: other?.avatarUrl ?? null,
        lastMessagePreview: getConversationPreview(lastMessage?.body ?? ""),
        lastMessageAt: lastMessage?.created_at ?? conversation.updated_at,
        unreadCount,
        isPinned: Boolean(viewerMember?.pinned_at),
        isArchived: Boolean(viewerMember?.archived_at),
        chatMode: "open",
        eventSlug: null,
        eventId: null
      };
    }

    return {
      id: conversation.id,
      kind: conversation.kind,
      title: conversation.title ?? "Grupo",
      subtitle: `${members.length} personas`,
      avatarUrl: resolveMediaUrl(conversation.cover_image),
      lastMessagePreview: getConversationPreview(lastMessage?.body ?? ""),
      lastMessageAt: lastMessage?.created_at ?? conversation.updated_at,
      unreadCount,
      isPinned: Boolean(viewerMember?.pinned_at),
      isArchived: Boolean(viewerMember?.archived_at),
      chatMode: conversation.chat_mode,
      eventSlug: null,
      eventId: null
    };
  });

  return summaries.sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    if (left.isArchived !== right.isArchived) {
      return left.isArchived ? 1 : -1;
    }

    return (right.lastMessageAt ?? "").localeCompare(left.lastMessageAt ?? "");
  });
}

export async function listMobileConversationSummaries(viewerId: string) {
  await ensureMobileSchema();
  return listConversationSummariesForUser(viewerId);
}

async function loadPostsForViewer(viewerId: string) {
  const [postRows, likeRows, commentRows, postMediaRows, assetRows, profileRows, eventRows] = await Promise.all([
    selectRows<PostRow>(TABLES.posts, { order: [{ column: "created_at", ascending: false }], limit: 40 }),
    selectRows<PostLikeRow>(TABLES.postLikes),
    selectRows<PostCommentRow>(TABLES.postComments, { order: [{ column: "created_at", ascending: true }] }),
    selectRows<PostMediaItemRow>(TABLES.postMediaItems, { order: [{ column: "sort_order", ascending: true }] }).catch(
      async () => [] as PostMediaItemRow[]
    ),
    selectRows<MediaAssetRow>(TABLES.mediaAssets),
    selectRows<ProfileRow>(TABLES.profiles),
    selectRows<EventRow>(TABLES.events)
  ]);
  const assetsById = new Map(assetRows.map((row) => [row.id, mapMediaAsset(row)]));
  const profilesById = new Map(profileRows.map((row) => [row.id, mapProfile(row)]));
  const eventsById = new Map(eventRows.map((row) => [row.id, row]));

  return postRows.map((row): MobilePost => {
    const author = profilesById.get(row.author_id);
    const eventOwner = row.owner_type === "event" ? eventsById.get(row.owner_id) : null;
    const mappedMediaItems = postMediaRows
      .filter((item) => item.post_id === row.id)
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((item) => assetsById.get(item.media_asset_id) ?? null)
      .filter((item): item is MobileMediaAsset => Boolean(item));
    const mediaItems =
      mappedMediaItems.length > 0
        ? mappedMediaItems
        : row.media_asset_id
          ? [assetsById.get(row.media_asset_id) ?? null].filter((item): item is MobileMediaAsset => Boolean(item))
          : [];
    const comments = commentRows
      .filter((comment) => comment.post_id === row.id)
      .map((comment) => mapPostComment(comment, profilesById.get(comment.author_id)));

    return {
      id: row.id,
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      authorId: row.author_id,
      authorHandle: author?.handle ?? "usuario",
      authorDisplayName: author?.displayName ?? author?.handle ?? "Usuario",
      authorAvatarUrl: author?.avatarUrl ?? null,
      ownerLabel:
        row.owner_type === "event"
          ? eventOwner?.title ?? "Evento"
          : author?.handle
            ? `@${author.handle}`
            : "Perfil",
      ownerAvatarUrl:
        row.owner_type === "event"
          ? resolveMediaUrl(eventOwner?.cover_image ?? null)
          : author?.avatarUrl ?? null,
      eventSlug: eventOwner?.slug ?? null,
      media: mediaItems[0] ?? null,
      mediaItems,
      caption: row.caption,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      likeCount: likeRows.filter((like) => like.post_id === row.id).length,
      commentCount: comments.length,
      hasLiked: likeRows.some((like) => like.post_id === row.id && like.user_id === viewerId),
      comments
    };
  });
}

export async function loadAllEventsPublic() {
  await ensureMobileSchema();
  return loadAllEvents();
}

export async function loadVisibleEventsForViewer(viewerId: string) {
  await ensureMobileSchema();
  const [events, memberships, cohosts] = await Promise.all([
    loadAllEvents(),
    selectRows<EventMemberRow>(TABLES.eventMembers),
    selectRows<EventCohostRow>(TABLES.eventCohosts)
  ]);

  return events.filter(
    (event) =>
      event.visibility === "public" ||
      event.hostId === viewerId ||
      memberships.some((membership) => membership.event_id === event.id && membership.user_id === viewerId) ||
      cohosts.some((cohost) => cohost.event_id === event.id && cohost.user_id === viewerId)
  );
}

async function loadActiveStoriesForViewer(viewerId: string) {
  const now = new Date().toISOString();
  const [storyRows, storyViews, assetRows, profileRows, eventRows] = await Promise.all([
    selectRows<StoryRow>(TABLES.stories, {
      filters: [{ column: "expires_at", op: "gt", value: now }],
      order: [{ column: "created_at", ascending: false }]
    }),
    selectRows<StoryViewRow>(TABLES.storyViews),
    selectRows<MediaAssetRow>(TABLES.mediaAssets),
    selectRows<ProfileRow>(TABLES.profiles),
    selectRows<EventRow>(TABLES.events)
  ]);

  const assetsById = new Map(assetRows.map((row) => [row.id, mapMediaAsset(row)]));
  const profilesById = new Map(profileRows.map((row) => [row.id, mapProfile(row)]));
  const eventsById = new Map(eventRows.map((row) => [row.id, row]));

  const stories = storyRows.map((row): MobileStory => ({
    viewers: storyViews
      .filter((view) => view.story_id === row.id)
      .sort((left, right) => right.seen_at.localeCompare(left.seen_at))
      .map((view) => {
        const profile = profilesById.get(view.user_id);
        return {
          id: view.user_id,
          handle: profile?.handle ?? "usuario",
          displayName: profile?.displayName ?? profile?.handle ?? "Usuario",
          avatarUrl: profile?.avatarUrl ?? null,
          seenAt: view.seen_at
        };
      }),
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    authorId: row.author_id,
    media: row.media_asset_id ? assetsById.get(row.media_asset_id) ?? null : null,
    caption: row.caption,
    durationMs: Number(row.duration_ms ?? 5000),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewCount: storyViews.filter((view) => view.story_id === row.id).length,
    hasSeen: storyViews.some((view) => view.story_id === row.id && view.user_id === viewerId)
  }));

  const clusterMap = new Map<string, MobileStoryCluster>();
  for (const story of stories) {
    const key = `${story.ownerType}:${story.ownerId}`;
    const ownerProfile = story.ownerType === "user" ? profilesById.get(story.ownerId) : null;
    const ownerEvent = story.ownerType === "event" ? eventsById.get(story.ownerId) : null;
    const current = clusterMap.get(key);

    if (!current) {
      clusterMap.set(key, {
        ownerId: story.ownerId,
        ownerType: story.ownerType,
        ownerLabel: ownerProfile ? `@${ownerProfile.handle}` : ownerEvent?.title ?? "Story",
        ownerAvatarUrl: ownerProfile?.avatarUrl ?? resolveMediaUrl(ownerEvent?.cover_image ?? null),
        unseenCount: story.hasSeen ? 0 : 1,
        stories: [story]
      });
      continue;
    }

    current.stories.push(story);
    if (!story.hasSeen) {
      current.unseenCount += 1;
    }
  }

  return [...clusterMap.values()].sort((left, right) => {
    const leftDate = left.stories[0]?.createdAt ?? "";
    const rightDate = right.stories[0]?.createdAt ?? "";
    return rightDate.localeCompare(leftDate);
  });
}

async function loadStoryMessageContexts(storyIds: string[]) {
  const uniqueStoryIds = [...new Set(storyIds.filter(Boolean))];
  if (uniqueStoryIds.length === 0) {
    return new Map<string, MobileStoryMessageContext>();
  }

  const storyRows = await selectRows<StoryRow>(TABLES.stories, {
    filters: [{ column: "id", op: "in", value: uniqueStoryIds }]
  });

  if (storyRows.length === 0) {
    return new Map<string, MobileStoryMessageContext>();
  }

  const mediaAssetIds = storyRows.map((row) => row.media_asset_id).filter((id): id is string => Boolean(id));
  const profileIds = [...new Set(storyRows.map((row) => row.author_id))];
  const eventIds = [...new Set(storyRows.filter((row) => row.owner_type === "event").map((row) => row.owner_id))];

  const [mediaAssets, profiles, eventRows] = await Promise.all([
    loadMediaAssets(mediaAssetIds),
    loadProfiles(profileIds),
    eventIds.length
      ? selectRows<EventRow>(TABLES.events, { filters: [{ column: "id", op: "in", value: eventIds }] })
      : Promise.resolve([] as EventRow[])
  ]);

  const assetsById = new Map(mediaAssets.map((asset) => [asset.id, asset]));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const eventsById = new Map(eventRows.map((row) => [row.id, row]));

  return new Map(
    storyRows.map((row) => {
      const author = profilesById.get(row.author_id);
      const ownerEvent = row.owner_type === "event" ? eventsById.get(row.owner_id) : null;
      const ownerLabel =
        row.owner_type === "event"
          ? ownerEvent?.title ?? "Evento"
          : author?.handle
            ? `@${author.handle}`
            : "Historia";

      return [
        row.id,
        {
          storyId: row.id,
          mode: "comment",
          text: "",
          ownerType: row.owner_type,
          ownerId: row.owner_id,
          ownerLabel,
          previewUrl: row.media_asset_id ? assetsById.get(row.media_asset_id)?.previewUrl ?? null : null,
          caption: row.caption,
          createdAt: row.created_at
        } satisfies MobileStoryMessageContext
      ];
    })
  );
}

async function listNotificationsForViewer(viewerId: string) {
  const rows = await selectRows<NotificationRow>(TABLES.notifications, {
    filters: [{ column: "user_id", op: "eq", value: viewerId }],
    order: [{ column: "created_at", ascending: false }],
    limit: 30
  });

  return rows.map(mapNotification);
}

export async function getMobileViewerSummary(viewerId: string): Promise<MobileViewerSummary> {
  const [profiles, chatSummaries, notifications, storyClusters] = await Promise.all([
    loadProfiles([viewerId]),
    listConversationSummariesForUser(viewerId),
    listNotificationsForViewer(viewerId),
    loadActiveStoriesForViewer(viewerId)
  ]);
  const profile = profiles[0];
  if (!profile) {
    throw new Error("No se ha encontrado tu perfil.");
  }

  return {
    profile,
    pendingChatCount: chatSummaries.filter((chat) => chat.unreadCount > 0).length,
    unreadNotificationCount: notifications.filter((notification) => !notification.readAt).length,
    pendingStoryCount: storyClusters.reduce((acc, cluster) => acc + cluster.unseenCount, 0)
  };
}

export async function getMobileBootstrap(viewerId: string) {
  const [viewer, storyClusters, feedPosts, events, chatSummaries, pendingEventInvites] = await Promise.all([
    getMobileViewerSummary(viewerId),
    loadActiveStoriesForViewer(viewerId),
    loadPostsForViewer(viewerId),
    loadAllEvents(),
    listConversationSummariesForUser(viewerId),
    listEventInvitesForViewer(viewerId, { pendingOnly: true })
  ]);

  const joinedEventIds = new Set(
    (await selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [{ column: "user_id", op: "eq", value: viewerId }]
    }))
      .filter((member) => member.status === "approved")
      .map((member) => member.event_id)
  );

  return {
    viewer,
    storyClusters,
    feedPosts,
    joinedEvents: events.filter((event) => joinedEventIds.has(event.id) || event.hostId === viewerId),
    chatSummaries,
    pendingEventInvites
  };
}

export async function getMobileSearch(
  viewerId: string,
  query: string,
  filters?: Partial<MobileSearchFilters>
): Promise<MobileSearchPayload> {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedFilters = normalizeSearchFilters(filters);
  const visibleEvents = await loadVisibleEventsForViewer(viewerId);
  const filteredEvents = visibleEvents.filter((event) => {
    if (
      normalizedFilters.city &&
      event.city.toLowerCase() !== normalizedFilters.city.toLowerCase()
    ) {
      return false;
    }
    if (
      normalizedFilters.visibility !== "all" &&
      event.visibility !== normalizedFilters.visibility
    ) {
      return false;
    }
    if (
      normalizedFilters.category &&
      event.category.toLowerCase() !== normalizedFilters.category.toLowerCase()
    ) {
      return false;
    }
    if (!eventMatchesWhenFilter(event, normalizedFilters.when)) {
      return false;
    }
    return true;
  });
  const facets = buildSearchFacets(visibleEvents);

  if (!normalizedQuery) {
    const [profileRows, follows, followRequests, suggestedPosts] = await Promise.all([
      selectRows<ProfileRow>(TABLES.profiles, { order: [{ column: "created_at", ascending: false }], limit: 80 }),
      loadProfileFollows(),
      loadPendingProfileFollowRequests(),
      loadPostsForViewer(viewerId)
    ]);
    const profiles = applyViewerRelationshipsToProfiles(viewerId, profileRows.map(mapProfile), follows, followRequests);
    const { suggestedProfiles, viewerFriendIds } = buildSuggestedProfilesForViewer(
      viewerId,
      profiles,
      follows
    );
    const suggestedProfileIds = new Set(suggestedProfiles.map((profile) => profile.id));

    return {
      profiles: [],
      events: filteredEvents.slice(0, 12),
      suggestedProfiles: suggestedProfiles.slice(0, 8),
      suggestedPosts: suggestedPosts
        .filter(
          (post) =>
            post.mediaItems.length > 0 &&
            post.authorId !== viewerId &&
            (suggestedProfileIds.has(post.authorId) || !viewerFriendIds.has(post.authorId))
        )
        .slice(0, 18),
      facets
    };
  }

  const profileRows = await selectRows<ProfileRow>(TABLES.profiles, {
    order: [{ column: "created_at", ascending: false }],
    limit: 80
  });
  const [follows, followRequests] = await Promise.all([
    loadProfileFollows(),
    loadPendingProfileFollowRequests()
  ]);
  const mappedProfiles = applyViewerRelationshipsToProfiles(viewerId, profileRows.map(mapProfile), follows, followRequests);

  return {
    profiles: mappedProfiles
      .filter(
        (profile) =>
          profile.handle.toLowerCase().includes(normalizedQuery) ||
          profile.displayName.toLowerCase().includes(normalizedQuery) ||
          profile.city.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 12),
    events: filteredEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(normalizedQuery) ||
        event.category.toLowerCase().includes(normalizedQuery) ||
        event.city.toLowerCase().includes(normalizedQuery) ||
        event.summary.toLowerCase().includes(normalizedQuery)
    ),
    suggestedProfiles: [],
    suggestedPosts: [],
    facets
  };
}

async function createMediaAsset(ownerId: string, input: {
  assetRef: string;
  previewUrl: string | null;
  mimeType: string;
  purpose: MobileMediaAsset["purpose"];
  expiresAt?: string | null;
}) {
  return insertRow<MediaAssetRow, MediaAssetRow>(TABLES.mediaAssets, {
    id: buildMobileId("asset"),
    owner_id: ownerId,
    storage_ref: input.assetRef,
    preview_url: input.previewUrl,
    mime_type: input.mimeType,
    purpose: input.purpose,
    created_at: new Date().toISOString(),
    expires_at: input.expiresAt ?? null
  });
}

export async function registerMobileProfile(
  userId: string,
  input: {
    handle: string;
    name: string;
    city: string;
    bio: string;
  }
) {
  await ensureMobileSchema();
  const now = new Date().toISOString();
  const handleLower = input.handle.trim().replace(/^@+/, "").toLowerCase();

  const existing = await selectRows<ProfileRow>(TABLES.profiles, {
    filters: [{ column: "handle_lower", op: "eq", value: handleLower }],
    limit: 1
  });
  if (existing[0]) {
    throw new Error("Ese nombre de usuario ya esta en uso.");
  }

  const row = await insertRow<ProfileRow, ProfileRow>(TABLES.profiles, {
    id: userId,
    handle: handleLower,
    handle_lower: handleLower,
    display_name: input.name.trim() || handleLower,
    city: input.city.trim() || "Madrid",
    bio: input.bio.trim(),
    avatar_url: null,
    cover_url: null,
    is_private: false,
    created_at: now,
    updated_at: now
  });

  if (!row) {
    throw new Error("No se pudo crear el perfil.");
  }

  return mapProfile(row);
}

export async function updateMobileProfile(viewerId: string, input: UpdateMobileProfileInput) {
  const rows = await patchRows<ProfileRow>(
    TABLES.profiles,
    [{ column: "id", op: "eq", value: viewerId }],
    {
      display_name: input.displayName.trim(),
      city: input.city.trim(),
      bio: input.bio.trim(),
      avatar_url: input.avatarUrl,
      cover_url: input.coverUrl,
      ...(typeof input.isPrivate === "boolean" ? { is_private: input.isPrivate } : {}),
      updated_at: new Date().toISOString()
    }
  );

  const row = rows[0];
  if (!row) {
    throw new Error("No se pudo actualizar el perfil.");
  }

  publishMobileRealtimeEvent({
    type: "profile",
    profileId: viewerId,
    viewerId
  });

  return mapProfile(row);
}

export async function listMobileNotifications(viewerId: string) {
  await ensureMobileSchema();
  return listNotificationsForViewer(viewerId);
}

export async function markAllMobileNotificationsRead(viewerId: string) {
  await patchRows(
    TABLES.notifications,
    [
      { column: "user_id", op: "eq", value: viewerId },
      { column: "read_at", op: "is", value: null }
    ],
    {
      read_at: new Date().toISOString()
    },
    { returning: "minimal" }
  );

  publishMobileRealtimeEvent({ type: "notifications", viewerId });
}

async function resolveProfileByHandle(handle: string) {
  const rows = await selectRows<ProfileRow>(TABLES.profiles, {
    filters: [{ column: "handle_lower", op: "eq", value: handle.trim().replace(/^@+/, "").toLowerCase() }],
    limit: 1
  });

  return rows[0] ? mapProfile(rows[0]) : null;
}

export async function requestProfileFollow(viewerId: string, handle: string) {
  const [viewerProfiles, targetProfile, follows, followRequests] = await Promise.all([
    loadProfiles([viewerId]),
    resolveProfileByHandle(handle),
    loadProfileFollows(),
    loadPendingProfileFollowRequests()
  ]);
  const viewerProfile = viewerProfiles[0];
  if (!viewerProfile || !targetProfile) {
    throw new Error("No pude encontrar ese perfil.");
  }
  if (viewerId === targetProfile.id) {
    throw new Error("No puedes seguirte a ti mismo.");
  }

  const relationship = buildProfileRelationship(viewerId, targetProfile.id, follows, followRequests);
  if (relationship.followsProfile) {
    return relationship;
  }

  if (targetProfile.isPrivate) {
    if (relationship.outgoingFollowRequestId) {
      return relationship;
    }

    const created = await insertRow<ProfileFollowRequestRow, ProfileFollowRequestRow>(TABLES.profileFollowRequests, {
      id: buildMobileId("follow-request"),
      requester_id: viewerId,
      target_user_id: targetProfile.id,
      status: "pending",
      created_at: new Date().toISOString(),
      responded_at: null
    }, {
      onConflict: "requester_id,target_user_id,status",
      returning: "representation"
    });

    await notifyUsers([targetProfile.id], {
      kind: "follow-request",
      title: `@${viewerProfile.handle} quiere seguirte`,
      body: "Tienes una nueva solicitud de seguimiento.",
      entityType: "profile",
      entityId: targetProfile.id,
      data: {
        requestId: created?.id ?? "",
        requesterHandle: viewerProfile.handle
      }
    });

    publishMobileRealtimeEvent({ type: "profile", profileId: targetProfile.id, viewerId });
    publishMobileRealtimeEvent({ type: "profile", profileId: targetProfile.id, viewerId: targetProfile.id });

    return {
      ...relationship,
      outgoingFollowRequestId: created?.id ?? relationship.outgoingFollowRequestId
    };
  }

  await insertRow<ProfileFollowRow, ProfileFollowRow>(TABLES.profileFollows, {
    id: buildMobileId("follow"),
    follower_id: viewerId,
    followee_id: targetProfile.id,
    created_at: new Date().toISOString()
  }, {
    onConflict: "follower_id,followee_id",
    returning: "minimal"
  });

  await notifyUsers([targetProfile.id], {
    kind: "follow-accepted",
    title: `@${viewerProfile.handle} te sigue`,
    body: "Tu perfil publico ha recibido un nuevo seguidor.",
    entityType: "profile",
    entityId: targetProfile.id,
    data: {
      requesterHandle: viewerProfile.handle
    }
  });

  publishMobileRealtimeEvent({ type: "profile", profileId: targetProfile.id, viewerId });
  publishMobileRealtimeEvent({ type: "profile", profileId: targetProfile.id, viewerId: targetProfile.id });

  return {
    followsProfile: true,
    followedByProfile: relationship.followedByProfile,
    outgoingFollowRequestId: null,
    incomingFollowRequestId: relationship.incomingFollowRequestId
  };
}

export async function unfollowProfile(viewerId: string, handle: string) {
  const targetProfile = await resolveProfileByHandle(handle);
  if (!targetProfile) {
    throw new Error("No pude encontrar ese perfil.");
  }

  await deleteRows(TABLES.profileFollows, [
    { column: "follower_id", op: "eq", value: viewerId },
    { column: "followee_id", op: "eq", value: targetProfile.id }
  ], { returning: "minimal" });

  publishMobileRealtimeEvent({ type: "profile", profileId: targetProfile.id, viewerId });
  publishMobileRealtimeEvent({ type: "profile", profileId: targetProfile.id, viewerId: targetProfile.id });
}

export async function cancelProfileFollowRequest(viewerId: string, handle: string) {
  const targetProfile = await resolveProfileByHandle(handle);
  if (!targetProfile) {
    throw new Error("No pude encontrar ese perfil.");
  }

  const now = new Date().toISOString();
  await patchRows(
    TABLES.profileFollowRequests,
    [
      { column: "requester_id", op: "eq", value: viewerId },
      { column: "target_user_id", op: "eq", value: targetProfile.id },
      { column: "status", op: "eq", value: "pending" }
    ],
    {
      status: "cancelled",
      responded_at: now
    },
    { returning: "minimal" }
  );

  publishMobileRealtimeEvent({ type: "profile", profileId: targetProfile.id, viewerId });
  publishMobileRealtimeEvent({ type: "profile", profileId: targetProfile.id, viewerId: targetProfile.id });
}

export async function respondToProfileFollowRequest(viewerId: string, requestId: string, accept: boolean) {
  const requestRows = await selectRows<ProfileFollowRequestRow>(TABLES.profileFollowRequests, {
    filters: [{ column: "id", op: "eq", value: requestId }],
    limit: 1
  });
  const request = requestRows[0];
  if (!request || request.target_user_id !== viewerId || request.status !== "pending") {
    throw new Error("La solicitud ya no esta disponible.");
  }

  const now = new Date().toISOString();
  await patchRows(
    TABLES.profileFollowRequests,
    [{ column: "id", op: "eq", value: requestId }],
    {
      status: accept ? "accepted" : "rejected",
      responded_at: now
    },
    { returning: "minimal" }
  );

  await patchRows(
    TABLES.notifications,
    [
      { column: "user_id", op: "eq", value: viewerId },
      { column: "kind", op: "eq", value: "follow-request" }
    ],
    {
      read_at: now
    },
    { returning: "minimal" }
  ).catch(async () => []);

  if (accept) {
    await insertRow<ProfileFollowRow, ProfileFollowRow>(TABLES.profileFollows, {
      id: buildMobileId("follow"),
      follower_id: request.requester_id,
      followee_id: viewerId,
      created_at: now
    }, {
      onConflict: "follower_id,followee_id",
      returning: "minimal"
    });

    const requester = (await loadProfiles([request.requester_id]))[0] ?? null;
    const viewerProfile = (await loadProfiles([viewerId]))[0] ?? null;
    if (requester && viewerProfile) {
      await notifyUsers([request.requester_id], {
        kind: "follow-accepted",
        title: `@${viewerProfile.handle} acepto tu solicitud`,
        body: "Ya puedes ver su perfil completo.",
        entityType: "profile",
        entityId: viewerId,
        data: {
          targetHandle: viewerProfile.handle
        }
      });
    }
  }

  publishMobileRealtimeEvent({ type: "notifications", viewerId });
  publishMobileRealtimeEvent({ type: "profile", profileId: viewerId, viewerId });
  publishMobileRealtimeEvent({ type: "profile", profileId: viewerId, viewerId: request.requester_id });
}

export async function updateConversationCover(viewerId: string, conversationId: string, coverImage: string | null) {
  const [conversationRows, memberRows] = await Promise.all([
    selectRows<ConversationRow>(TABLES.conversations, {
      filters: [{ column: "id", op: "eq", value: conversationId }],
      limit: 1
    }),
    selectRows<ConversationMemberRow>(TABLES.conversationMembers, {
      filters: [{ column: "conversation_id", op: "eq", value: conversationId }]
    })
  ]);

  const conversation = conversationRows[0];
  if (!conversation) {
    throw new Error("Este grupo ya no existe.");
  }

  if (conversation.kind !== "group") {
    throw new Error("Solo los grupos pueden cambiar su icono.");
  }

  if (!memberRows.some((row) => row.user_id === viewerId)) {
    throw new Error("No puedes cambiar el icono de este grupo.");
  }

  const rows = await patchRows<ConversationRow>(
    TABLES.conversations,
    [{ column: "id", op: "eq", value: conversationId }],
    {
      cover_image: coverImage,
      updated_at: new Date().toISOString()
    }
  );

  const updatedConversation = rows[0];
  if (!updatedConversation) {
    throw new Error("No se pudo actualizar el icono del grupo.");
  }

  for (const member of memberRows) {
    publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId: member.user_id });
  }

  return {
    avatarUrl: resolveMediaUrl(updatedConversation.cover_image),
    ok: true
  };
}

async function createConversationBase(input: {
  id: string;
  kind: MobileConversationKind;
  ownerId: string;
  title: string | null;
  eventId?: string | null;
  coverImage?: string | null;
  chatMode?: "open" | "announcements";
}) {
  const now = new Date().toISOString();
  await insertRow<ConversationRow, ConversationRow>(
    TABLES.conversations,
    {
      id: input.id,
      kind: input.kind,
      owner_id: input.ownerId,
      title: input.title,
      event_id: input.eventId ?? null,
      cover_image: input.coverImage ?? null,
      chat_mode: input.chatMode ?? "open",
      created_at: now,
      updated_at: now
    },
    {
      onConflict: "id",
      returning: "representation"
    }
  );

  return input.id;
}

async function ensureConversationMembers(
  conversationId: string,
  ownerId: string,
  participantIds: string[],
  ownerRole: "owner" | "cohost" | "member" = "owner"
) {
  const now = new Date().toISOString();
  const uniqueIds = [...new Set([ownerId, ...participantIds])];
  await insertRows<ConversationMemberRow, ConversationMemberRow>(
    TABLES.conversationMembers,
    uniqueIds.map((userId) => ({
      id: buildMobileId("cmember"),
      conversation_id: conversationId,
      user_id: userId,
      role: userId === ownerId ? ownerRole : "member",
      joined_at: now,
      last_read_at: userId === ownerId ? now : null,
      pinned_at: null,
      archived_at: null,
      hidden_at: null
    })),
    {
      onConflict: "conversation_id,user_id",
      returning: "minimal"
    }
  );
}

async function notifyUsers(
  userIds: string[],
  input: {
    kind: MobileNotification["kind"];
    title: string;
    body: string;
    entityType?: string | null;
    entityId?: string | null;
    data?: Record<string, string | number | boolean | null>;
  }
) {
  if (userIds.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const created = await insertRows<NotificationRow, NotificationRow>(
    TABLES.notifications,
    userIds.map((userId) => ({
      id: buildMobileId("notification"),
      user_id: userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      data_json: input.data ?? {},
      read_at: null,
      created_at: now
    })),
    { returning: "representation" }
  );

  for (const userId of userIds) {
    publishMobileRealtimeEvent({
      type: "notifications",
      viewerId: userId
    });
  }

  void sendMobilePushNotifications(created.map(mapNotification)).catch(() => undefined);
}

export async function updateConversationState(
  viewerId: string,
  conversationId: string,
  input: {
    pinned?: boolean;
    archived?: boolean;
  }
) {
  const membershipRows = await selectRows<ConversationMemberRow>(TABLES.conversationMembers, {
    filters: [
      { column: "conversation_id", op: "eq", value: conversationId },
      { column: "user_id", op: "eq", value: viewerId }
    ],
    limit: 1
  });
  const membership = membershipRows[0];
  if (!membership) {
    throw new Error("No tienes acceso a este chat.");
  }

  const now = new Date().toISOString();
  await patchRows(
    TABLES.conversationMembers,
    [
      { column: "conversation_id", op: "eq", value: conversationId },
      { column: "user_id", op: "eq", value: viewerId }
    ],
    {
      pinned_at:
        typeof input.pinned === "boolean"
          ? input.pinned
            ? membership.pinned_at ?? now
            : null
          : membership.pinned_at,
      archived_at:
        typeof input.archived === "boolean"
          ? input.archived
            ? membership.archived_at ?? now
            : null
          : membership.archived_at,
      hidden_at: null
    },
    { returning: "minimal" }
  );

  publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId });
}

export async function deleteConversationFromViewerList(viewerId: string, conversationId: string) {
  const membershipRows = await selectRows<ConversationMemberRow>(TABLES.conversationMembers, {
    filters: [
      { column: "conversation_id", op: "eq", value: conversationId },
      { column: "user_id", op: "eq", value: viewerId }
    ],
    limit: 1
  });

  if (!membershipRows[0]) {
    throw new Error("No tienes acceso a este chat.");
  }

  await patchRows(
    TABLES.conversationMembers,
    [
      { column: "conversation_id", op: "eq", value: conversationId },
      { column: "user_id", op: "eq", value: viewerId }
    ],
    {
      pinned_at: null,
      archived_at: null,
      hidden_at: new Date().toISOString()
    },
    { returning: "minimal" }
  );

  publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId });
}

function buildEventConversationId(eventId: string) {
  return `event-chat-${eventId}`;
}

function buildDirectConversationId(a: string, b: string) {
  return `direct-${[a, b].sort().join("-")}`;
}

export async function createMobileConversation(viewerId: string, input: CreateConversationInput) {
  const participantIds = [...new Set(input.participantIds.filter((id) => id && id !== viewerId))];
  if (input.kind === "direct") {
    const targetId = participantIds[0];
    if (!targetId) {
      throw new Error("Necesitas seleccionar a alguien.");
    }

    const conversationId = buildDirectConversationId(viewerId, targetId);
    await createConversationBase({
      id: conversationId,
      kind: "direct",
      ownerId: viewerId,
      title: null,
      chatMode: "open"
    });
    await ensureConversationMembers(conversationId, viewerId, [targetId]);
    publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId });
    publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId: targetId });
    return conversationId;
  }

  if (participantIds.length === 0) {
    throw new Error("Selecciona al menos a una persona.");
  }

  const conversationId = buildMobileId("group");
  await createConversationBase({
    id: conversationId,
    kind: "group",
    ownerId: viewerId,
    title: input.title?.trim() || "Grupo nuevo",
    chatMode: "open"
  });
  await ensureConversationMembers(conversationId, viewerId, participantIds);
  publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId });
  for (const participantId of participantIds) {
    publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId: participantId });
  }
  return conversationId;
}

export async function createMobileEvent(viewerId: string, input: CreateMobileEventInput) {
  const eventRows = await selectRows<EventRow>(TABLES.events, { select: "slug" });
  const slug = uniqueMobileSlug(
    input.title,
    new Set(eventRows.map((row) => row.slug))
  );
  const now = new Date().toISOString();
  const eventId = buildMobileId("event");
  const conversationId = buildEventConversationId(eventId);

  await insertRow<EventRow, EventRow>(TABLES.events, {
    id: eventId,
    slug,
    host_id: viewerId,
    title: input.title.trim(),
    summary: input.summary.trim(),
    description: input.description.trim(),
    category: input.category,
    visibility: input.visibility,
    city: input.city.trim(),
    venue: input.venue.trim(),
    cover_image: input.coverImage,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    capacity: input.capacity,
    price_label: input.priceLabel.trim(),
    dress_code: input.dressCode.trim(),
    tags_json: toJson(input.tags),
    rules_json: toJson(input.rules),
    faq_json: toJson(input.faq),
    playlist_url: input.playlistUrl,
    meeting_point_label: input.meetingPointLabel,
    meeting_point_address: input.meetingPointAddress,
    meeting_point_lat: input.meetingPointLat,
    meeting_point_lng: input.meetingPointLng,
    chat_mode: "open",
    created_at: now,
    updated_at: now
  });

  await insertRow<EventMemberRow, EventMemberRow>(TABLES.eventMembers, {
    id: buildMobileId("membership"),
    event_id: eventId,
    user_id: viewerId,
    status: "approved",
    requested_at: now,
    responded_at: now,
    joined_at: now
  });
  await insertRow<EventPresenceRow, EventPresenceRow>(TABLES.eventPresence, {
    id: buildMobileId("presence"),
    event_id: eventId,
    user_id: viewerId,
    arrival_status: "none",
    checked_in_at: null,
    checked_in_by_user_id: null,
    created_at: now,
    updated_at: now
  });
  await createConversationBase({
    id: conversationId,
    kind: "event",
    ownerId: viewerId,
    title: input.title.trim(),
    eventId,
    coverImage: input.coverImage,
    chatMode: "open"
  });
  await ensureConversationMembers(conversationId, viewerId, []);
  publishMobileRealtimeEvent({ type: "event", eventId, viewerId });
  publishMobileRealtimeEvent({ type: "feed", eventId, viewerId });
  return { eventId, slug, conversationId };
}

async function fillEventWaitlistIfPossible(eventId: string) {
  const [eventRows, memberRows, waitlistRows] = await Promise.all([
    selectRows<EventRow>(TABLES.events, { filters: [{ column: "id", op: "eq", value: eventId }], limit: 1 }),
    selectRows<EventMemberRow>(TABLES.eventMembers, { filters: [{ column: "event_id", op: "eq", value: eventId }] }),
    selectRows<{ created_at: string; event_id: string; id: string; status: string; user_id: string }>(TABLES.eventWaitlist, {
      filters: [{ column: "event_id", op: "eq", value: eventId }],
      order: [{ column: "created_at", ascending: true }]
    })
  ]);

  const eventRow = eventRows[0];
  if (!eventRow) {
    return;
  }

  const approvedCount = memberRows.filter((member) => member.status === "approved").length;
  const freeSeats = Math.max(0, Number(eventRow.capacity ?? 0) - approvedCount);
  if (freeSeats === 0) {
    return;
  }

  const nextWaitlisted = waitlistRows.filter((row) => row.status === "waiting").slice(0, freeSeats);
  if (nextWaitlisted.length === 0) {
    return;
  }

  const isPublic = eventRow.visibility === "public";
  const now = new Date().toISOString();
  if (!isPublic) {
    await notifyUsers(
      [eventRow.host_id],
      {
        kind: "event-waitlist",
        title: "Hay hueco libre",
        body: "Tu evento privado tiene gente en lista de espera pendiente de aprobar.",
        entityType: "event",
        entityId: eventId,
        data: { eventSlug: eventRow.slug }
      }
    );
    return;
  }

  for (const waitlisted of nextWaitlisted) {
    await patchRows<EventMemberRow>(
      TABLES.eventMembers,
      [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: waitlisted.user_id }
      ],
      {
        status: "approved",
        responded_at: now,
        joined_at: now
      },
      { returning: "minimal" }
    );
    await patchRows(TABLES.eventWaitlist, [{ column: "id", op: "eq", value: waitlisted.id }], {
      status: "promoted",
      updated_at: now
    });
    await ensureConversationMembers(buildEventConversationId(eventId), eventRow.host_id, [waitlisted.user_id]);
    await notifyUsers(
      [waitlisted.user_id],
      {
        kind: "event-approved",
        title: "Ya estas dentro",
        body: `Has pasado de la lista de espera a ${eventRow.title}.`,
        entityType: "event",
        entityId: eventId,
        data: { eventSlug: eventRow.slug }
      }
    );
  }
}

export async function joinMobileEvent(
  viewerId: string,
  eventId: string,
  options?: {
    forceApproved?: boolean;
    invitedByUserId?: string | null;
  }
) {
  const [eventRows, existingMembers, existingBans] = await Promise.all([
    selectRows<EventRow>(TABLES.events, { filters: [{ column: "id", op: "eq", value: eventId }], limit: 1 }),
    selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    }),
    selectRows<{ event_id: string; user_id: string }>(TABLES.eventBans, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    })
  ]);

  const eventRow = eventRows[0];
  if (!eventRow) {
    throw new Error("El evento ya no existe.");
  }

  if (existingBans[0]) {
    throw new Error("No puedes volver a entrar en este evento.");
  }

  if (existingMembers[0]) {
    const presence = (
      await selectRows<EventPresenceRow>(TABLES.eventPresence, {
        filters: [
          { column: "event_id", op: "eq", value: eventId },
          { column: "user_id", op: "eq", value: viewerId }
        ],
        limit: 1
      })
    )[0];
    return mapMember(existingMembers[0], presence);
  }

  const approvedCount = (
    await selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [{ column: "event_id", op: "eq", value: eventId }]
    })
  ).filter((member) => member.status === "approved").length;
  const now = new Date().toISOString();
  const status =
    approvedCount < Number(eventRow.capacity ?? 0)
      ? options?.forceApproved
        ? "approved"
        : eventRow.visibility === "private"
          ? "pending"
          : "approved"
      : "waitlisted";

  const memberRow = await insertRow<EventMemberRow, EventMemberRow>(TABLES.eventMembers, {
    id: buildMobileId("membership"),
    event_id: eventId,
    user_id: viewerId,
    status,
    requested_at: now,
    responded_at: status === "approved" ? now : null,
    joined_at: status === "approved" ? now : null
  });

  await insertRow<EventPresenceRow, EventPresenceRow>(TABLES.eventPresence, {
    id: buildMobileId("presence"),
    event_id: eventId,
    user_id: viewerId,
    arrival_status: "none",
    checked_in_at: null,
    checked_in_by_user_id: null,
    created_at: now,
    updated_at: now
  });

  if (status === "waitlisted") {
    await insertRow(TABLES.eventWaitlist, {
      id: buildMobileId("waitlist"),
      event_id: eventId,
      user_id: viewerId,
      status: "waiting",
      created_at: now,
      updated_at: now
    });
  } else if (status === "approved") {
    await ensureConversationMembers(buildEventConversationId(eventId), eventRow.host_id, [viewerId]);
  }

  await notifyUsers(
    [eventRow.host_id],
    {
      kind: status === "approved" ? "event-approved" : "event-waitlist",
      title:
        status === "approved"
          ? options?.invitedByUserId
            ? "Entrada desde invitacion directa"
            : "Nueva persona dentro"
          : "Nueva persona en cola",
      body:
        status === "approved"
          ? options?.invitedByUserId
            ? "Una persona ha aceptado una invitacion directa y ya esta dentro."
            : "Se ha unido una persona nueva al evento."
          : "Se ha añadido alguien a la lista de espera del evento.",
      entityType: "event",
      entityId: eventId,
      data: {
        eventSlug: eventRow.slug,
        ...(options?.invitedByUserId ? { invitedByUserId: options.invitedByUserId } : {})
      }
    }
  );

  publishMobileRealtimeEvent({ type: "event", eventId, viewerId });
  if (status === "approved") {
    publishMobileRealtimeEvent({ type: "conversation", conversationId: buildEventConversationId(eventId), viewerId });
  }

  return mapMember(memberRow!, {
    id: "",
    event_id: eventId,
    user_id: viewerId,
    arrival_status: "none",
    checked_in_at: null,
    checked_in_by_user_id: null,
    created_at: now,
    updated_at: now
  });
}

async function viewerCanManageEvent(viewerId: string, eventId: string) {
  const [eventRow, cohostRow] = await Promise.all([
    selectRows<EventRow>(TABLES.events, {
      filters: [{ column: "id", op: "eq", value: eventId }],
      limit: 1
    }),
    selectRows<EventCohostRow>(TABLES.eventCohosts, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    })
  ]);

  return Boolean(eventRow[0] && (eventRow[0].host_id === viewerId || cohostRow[0]));
}

async function loadEventStaffRoleRows(eventId: string) {
  return selectRows<EventStaffRoleRow>(TABLES.eventStaffRoles, {
    filters: [{ column: "event_id", op: "eq", value: eventId }]
  }).catch(async () => [] as EventStaffRoleRow[]);
}

async function loadEventStaffRoleRowsFromSlug(_slug: string) {
  return selectRows<EventStaffRoleRow>(TABLES.eventStaffRoles).catch(async () => [] as EventStaffRoleRow[]);
}

async function viewerHasEventStaffRole(
  viewerId: string,
  eventId: string,
  role: EventStaffRoleRow["role"]
) {
  const rows = await selectRows<EventStaffRoleRow>(TABLES.eventStaffRoles, {
    filters: [
      { column: "event_id", op: "eq", value: eventId },
      { column: "user_id", op: "eq", value: viewerId },
      { column: "role", op: "eq", value: role }
    ],
    limit: 1
  }).catch(async () => [] as EventStaffRoleRow[]);

  return Boolean(rows[0]);
}

async function viewerCanModerateEvent(viewerId: string, eventId: string) {
  if (await viewerCanManageEvent(viewerId, eventId)) {
    return true;
  }

  return viewerHasEventStaffRole(viewerId, eventId, "moderator");
}

async function viewerCanScanEvent(viewerId: string, eventId: string) {
  if (await viewerCanManageEvent(viewerId, eventId)) {
    return true;
  }

  return viewerHasEventStaffRole(viewerId, eventId, "scanner");
}

async function viewerCanInviteToEvent(viewerId: string, eventId: string) {
  const [eventRows, cohostRows, membershipRows] = await Promise.all([
    selectRows<EventRow>(TABLES.events, {
      filters: [{ column: "id", op: "eq", value: eventId }],
      limit: 1
    }),
    selectRows<EventCohostRow>(TABLES.eventCohosts, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    }),
    selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    })
  ]);
  const eventRow = eventRows[0];
  if (!eventRow) {
    return false;
  }

  return Boolean(
    eventRow.host_id === viewerId ||
      cohostRows[0] ||
      membershipRows[0]?.status === "approved"
  );
}

async function loadInvitableFriendsForEvent(viewerId: string, eventId: string) {
  const [eventRows, friendIds, memberRows, inviteRows, banRows] = await Promise.all([
    selectRows<EventRow>(TABLES.events, {
      filters: [{ column: "id", op: "eq", value: eventId }],
      limit: 1
    }),
    loadFriendIds(viewerId),
    selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [{ column: "event_id", op: "eq", value: eventId }]
    }),
    selectRows<EventInviteRow>(TABLES.eventInvites, {
      filters: [{ column: "event_id", op: "eq", value: eventId }]
    }).catch(async () => [] as EventInviteRow[]),
    selectRows<{ user_id: string }>(TABLES.eventBans, {
      filters: [{ column: "event_id", op: "eq", value: eventId }]
    })
  ]);
  const eventRow = eventRows[0] ?? null;

  const blockedIds = new Set([
    viewerId,
    eventRow?.host_id ?? "",
    ...memberRows.map((row) => row.user_id),
    ...inviteRows.filter((row) => row.status === "pending").map((row) => row.to_user_id),
    ...banRows.map((row) => row.user_id)
  ]);
  const candidateIds = friendIds.filter((friendId) => !blockedIds.has(friendId));
  return loadProfiles(candidateIds);
}

export async function createMobileEventInvite(viewerId: string, eventId: string, targetUserId: string) {
  if (viewerId === targetUserId) {
    throw new Error("No tiene sentido invitarte a ti.");
  }

  const canInvite = await viewerCanInviteToEvent(viewerId, eventId);
  if (!canInvite) {
    throw new Error("Solo puede invitar quien ya esta dentro del evento.");
  }

  const [eventRows, existingInviteRows, existingMembers, friendIds, targetProfiles] = await Promise.all([
    selectRows<EventRow>(TABLES.events, { filters: [{ column: "id", op: "eq", value: eventId }], limit: 1 }),
    selectRows<EventInviteRow>(TABLES.eventInvites, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "to_user_id", op: "eq", value: targetUserId }
      ],
      order: [{ column: "created_at", ascending: false }],
      limit: 1
    }).catch(async () => [] as EventInviteRow[]),
    selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: targetUserId }
      ],
      limit: 1
    }),
    loadFriendIds(viewerId),
    loadProfiles([viewerId, targetUserId])
  ]);
  const eventRow = eventRows[0];
  if (!eventRow) {
    throw new Error("Ese evento ya no existe.");
  }
  if (!friendIds.includes(targetUserId)) {
    throw new Error("Solo puedes mandar invitaciones directas a amistades tuyas.");
  }
  if (existingMembers[0]) {
    throw new Error("Esa persona ya tiene un estado activo en el evento.");
  }
  if (existingInviteRows[0]?.status === "pending") {
    throw new Error("Esa persona ya tiene una invitacion pendiente.");
  }

  const now = new Date().toISOString();
  const created = await insertRow<EventInviteRow, EventInviteRow>(TABLES.eventInvites, {
    id: buildMobileId("invite"),
    event_id: eventId,
    from_user_id: viewerId,
    to_user_id: targetUserId,
    status: "pending",
    created_at: now,
    responded_at: null
  });
  if (!created) {
    throw new Error("No pude crear la invitacion directa.");
  }

  const profilesById = new Map(targetProfiles.map((profile) => [profile.id, profile]));
  const fromProfile = profilesById.get(viewerId);
  const toProfile = profilesById.get(targetUserId);
  if (!fromProfile || !toProfile) {
    throw new Error("Faltan perfiles para completar la invitacion.");
  }

  await notifyUsers([targetUserId], {
    kind: "event-invite",
    title: `@${fromProfile.handle} te ha invitado`,
    body: `Puedes entrar a ${eventRow.title} en un toque.`,
    entityType: "event",
    entityId: eventId,
    data: {
      inviteId: created.id,
      eventSlug: eventRow.slug,
      invitedByUserId: viewerId
    }
  });

  publishMobileRealtimeEvent({ type: "event", eventId, viewerId });
  publishMobileRealtimeEvent({ type: "event", eventId, viewerId: targetUserId });

  return mapEventInvite(created, eventRow, fromProfile, toProfile);
}

export async function respondToMobileEventInvite(viewerId: string, inviteId: string, accept: boolean) {
  const inviteRows = await selectRows<EventInviteRow>(TABLES.eventInvites, {
    filters: [{ column: "id", op: "eq", value: inviteId }],
    limit: 1
  });
  const invite = inviteRows[0];
  if (!invite || invite.to_user_id !== viewerId || invite.status !== "pending") {
    throw new Error("La invitacion ya no esta disponible.");
  }

  const [eventRows, profiles] = await Promise.all([
    selectRows<EventRow>(TABLES.events, {
      filters: [{ column: "id", op: "eq", value: invite.event_id }],
      limit: 1
    }),
    loadProfiles([invite.from_user_id, invite.to_user_id])
  ]);
  const eventRow = eventRows[0];
  if (!eventRow) {
    throw new Error("Ese evento ya no existe.");
  }
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const fromProfile = profilesById.get(invite.from_user_id);
  const toProfile = profilesById.get(invite.to_user_id);
  if (!fromProfile || !toProfile) {
    throw new Error("No pude resolver la invitacion.");
  }

  const now = new Date().toISOString();
  const nextStatus = accept ? "accepted" : "rejected";
  const patchedRows = await patchRows<EventInviteRow>(
    TABLES.eventInvites,
    [{ column: "id", op: "eq", value: inviteId }],
    {
      status: nextStatus,
      responded_at: now
    }
  );
  const updatedInvite = patchedRows[0] ?? {
    ...invite,
    status: nextStatus,
    responded_at: now
  };

  let membershipStatus: string | null = null;
  if (accept) {
    const membership = await joinMobileEvent(viewerId, invite.event_id, {
      forceApproved: true,
      invitedByUserId: invite.from_user_id
    });
    membershipStatus = membership.status;
  }

  await notifyUsers([invite.from_user_id], {
    kind: "event-invite-response",
    title: accept ? "Han aceptado tu invitacion" : "Han rechazado tu invitacion",
    body: accept
      ? `@${toProfile.handle} ya ha respondido y se suma a ${eventRow.title}.`
      : `@${toProfile.handle} ha rechazado la invitacion a ${eventRow.title}.`,
    entityType: "event",
    entityId: invite.event_id,
    data: {
      inviteId,
      accepted: accept,
      eventSlug: eventRow.slug
    }
  });

  publishMobileRealtimeEvent({ type: "event", eventId: invite.event_id, viewerId });
  publishMobileRealtimeEvent({ type: "event", eventId: invite.event_id, viewerId: invite.from_user_id });

  return {
    invite: mapEventInvite(updatedInvite, eventRow, fromProfile, toProfile),
    membershipStatus,
    eventSlug: eventRow.slug
  };
}

export async function reportEventMember(viewerId: string, eventId: string, targetUserId: string, reason: string) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Escribe el motivo del reporte.");
  }

  const [eventRows, membershipRows, targetProfiles] = await Promise.all([
    selectRows<EventRow>(TABLES.events, { filters: [{ column: "id", op: "eq", value: eventId }], limit: 1 }),
    selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: targetUserId }
      ],
      limit: 1
    }),
    loadProfiles([targetUserId])
  ]);
  const eventRow = eventRows[0];
  if (!eventRow) {
    throw new Error("Ese evento ya no existe.");
  }
  if (!membershipRows[0] && eventRow.host_id !== targetUserId) {
    throw new Error("Solo puedes reportar gente relacionada con este evento.");
  }

  await insertRow(TABLES.eventReports, {
    id: buildMobileId("report"),
    event_id: eventId,
    reporter_id: viewerId,
    target_user_id: targetUserId,
    message_id: null,
    reason: trimmedReason,
    status: "open",
    created_at: new Date().toISOString(),
    resolved_at: null,
    resolved_by_user_id: null
  });

  const targetProfile = targetProfiles[0] ?? null;
  await notifyUsers([eventRow.host_id], {
    kind: "event-report",
    title: "Nuevo reporte en el evento",
    body: targetProfile
      ? `Han reportado a @${targetProfile.handle}.`
      : "Han enviado un reporte nuevo.",
    entityType: "event",
    entityId: eventId,
    data: { eventSlug: eventRow.slug }
  });
}

export async function setEventChatMode(viewerId: string, eventId: string, mode: "open" | "announcements") {
  const canManage = await viewerCanManageEvent(viewerId, eventId);
  if (!canManage) {
    throw new Error("No puedes cambiar el modo del chat.");
  }

  await patchRows(TABLES.events, [{ column: "id", op: "eq", value: eventId }], {
    chat_mode: mode,
    updated_at: new Date().toISOString()
  });
  await patchRows(TABLES.conversations, [{ column: "event_id", op: "eq", value: eventId }], {
    chat_mode: mode,
    updated_at: new Date().toISOString()
  });
  publishMobileRealtimeEvent({ type: "event", eventId, viewerId });
  publishMobileRealtimeEvent({ type: "conversation", conversationId: buildEventConversationId(eventId), viewerId });
}

export async function addEventCohost(viewerId: string, eventId: string, targetUserId: string) {
  const [eventRows, membershipRows] = await Promise.all([
    selectRows<EventRow>(TABLES.events, { filters: [{ column: "id", op: "eq", value: eventId }], limit: 1 }),
    selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: targetUserId }
      ],
      limit: 1
    })
  ]);

  const eventRow = eventRows[0];
  if (!eventRow || eventRow.host_id !== viewerId) {
    throw new Error("Solo la persona creadora puede asignar coorganizadores.");
  }

  if (!membershipRows[0] || membershipRows[0].status !== "approved") {
    throw new Error("Solo puedes nombrar coorganizador a alguien que ya este dentro.");
  }

  await insertRow(TABLES.eventCohosts, {
    id: buildMobileId("cohost"),
    event_id: eventId,
    user_id: targetUserId,
    created_at: new Date().toISOString()
  }, {
    onConflict: "event_id,user_id",
    returning: "minimal"
  });
  await patchRows(TABLES.conversationMembers, [
    { column: "conversation_id", op: "eq", value: buildEventConversationId(eventId) },
    { column: "user_id", op: "eq", value: targetUserId }
  ], {
    role: "cohost"
  }, { returning: "minimal" });

  publishMobileRealtimeEvent({ type: "event", eventId, viewerId });
}

export async function setEventMemberStaffRoles(
  viewerId: string,
  eventId: string,
  targetUserId: string,
  roles: Array<"moderator" | "scanner">
) {
  const canManage = await viewerCanManageEvent(viewerId, eventId);
  if (!canManage) {
    throw new Error("No puedes cambiar los roles de staff.");
  }

  const normalizedRoles = [...new Set(roles.filter((role) => role === "moderator" || role === "scanner"))];
  const membershipRows = await selectRows<EventMemberRow>(TABLES.eventMembers, {
    filters: [
      { column: "event_id", op: "eq", value: eventId },
      { column: "user_id", op: "eq", value: targetUserId }
    ],
    limit: 1
  });

  if (!membershipRows[0] || membershipRows[0].status !== "approved") {
    throw new Error("Solo puedes dar roles a personas que ya estan dentro.");
  }

  await deleteRows(TABLES.eventStaffRoles, [
    { column: "event_id", op: "eq", value: eventId },
    { column: "user_id", op: "eq", value: targetUserId }
  ]).catch(async () => undefined);

  if (normalizedRoles.length > 0) {
    const now = new Date().toISOString();
    await insertRows(
      TABLES.eventStaffRoles,
      normalizedRoles.map((role) => ({
        id: buildMobileId("staff-role"),
        event_id: eventId,
        user_id: targetUserId,
        role,
        created_at: now
      })),
      { returning: "minimal" }
    );
  }

  publishMobileRealtimeEvent({ type: "event", eventId, viewerId });
  publishMobileRealtimeEvent({ type: "event", eventId, viewerId: targetUserId });
}

export async function moderateEventMember(
  viewerId: string,
  eventId: string,
  targetUserId: string,
  action: MobileModerationAction
) {
  const canModerate = await viewerCanModerateEvent(viewerId, eventId);
  if (!canModerate) {
    throw new Error("No puedes moderar este evento.");
  }

  const now = new Date().toISOString();
  if (action === "mute") {
    await insertRow(TABLES.eventMutes, {
      id: buildMobileId("mute"),
      event_id: eventId,
      user_id: targetUserId,
      muted_until: null,
      reason: "Silenciado por moderacion",
      created_at: now
    }, { onConflict: "event_id,user_id", returning: "minimal" });
  }

  if (action === "unmute") {
    await deleteRows(TABLES.eventMutes, [
      { column: "event_id", op: "eq", value: eventId },
      { column: "user_id", op: "eq", value: targetUserId }
    ]);
  }

  if (action === "ban") {
    await insertRow(TABLES.eventBans, {
      id: buildMobileId("ban"),
      event_id: eventId,
      user_id: targetUserId,
      reason: "Bloqueado por moderacion",
      created_at: now
    }, { onConflict: "event_id,user_id", returning: "minimal" });
  }

  if (action === "unban") {
    await deleteRows(TABLES.eventBans, [
      { column: "event_id", op: "eq", value: eventId },
      { column: "user_id", op: "eq", value: targetUserId }
    ]);
  }

  if (action === "kick" || action === "ban") {
    await patchRows(TABLES.eventMembers, [
      { column: "event_id", op: "eq", value: eventId },
      { column: "user_id", op: "eq", value: targetUserId }
    ], {
      status: "rejected",
      responded_at: now
    }, { returning: "minimal" });
    await deleteRows(TABLES.conversationMembers, [
      { column: "conversation_id", op: "eq", value: buildEventConversationId(eventId) },
      { column: "user_id", op: "eq", value: targetUserId }
    ]);
    await fillEventWaitlistIfPossible(eventId);
  }

  publishMobileRealtimeEvent({ type: "event", eventId, viewerId });
}

export async function setMobileArrivalStatus(viewerId: string, eventId: string, arrivalStatus: MobileEventMember["arrivalStatus"]) {
  const now = new Date().toISOString();
  const rows = await patchRows<EventPresenceRow>(
    TABLES.eventPresence,
    [
      { column: "event_id", op: "eq", value: eventId },
      { column: "user_id", op: "eq", value: viewerId }
    ],
    {
      arrival_status: arrivalStatus,
      updated_at: now
    }
  );
  if (!rows[0]) {
    throw new Error("No se pudo guardar tu estado de llegada.");
  }
  publishMobileRealtimeEvent({ type: "event", eventId, viewerId });
}

function getCheckInSecret() {
  return process.env.MOBILE_CHECKIN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "mobile-checkin-secret";
}

export function createCheckInToken(eventId: string, issuedByUserId: string, expiresAtMs: number) {
  const issuedAt = Date.now();
  const expiresAt = Math.max(issuedAt + 1000 * 60 * 30, expiresAtMs);
  const payload = `${eventId}.${issuedByUserId}.${issuedAt}.${expiresAt}`;
  const signature = createHmac("sha256", getCheckInSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function createEventAccessTicketToken(
  eventId: string,
  viewerId: string,
  memberReference: string,
  expiresAtMs: number
) {
  const issuedAt = Date.now();
  const expiresAt = Math.max(issuedAt + 1000 * 60 * 30, expiresAtMs);
  const payload = `ticket.${eventId}.${viewerId}.${memberReference}.${issuedAt}.${expiresAt}`;
  const signature = createHmac("sha256", getCheckInSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function parseCheckInToken(token: string) {
  const [eventId, issuedByUserId, issuedAt, expiresAt, signature] = token.split(".");
  if (!eventId || !issuedByUserId || !issuedAt || !expiresAt || !signature) {
    throw new Error("QR invalido.");
  }

  const payload = `${eventId}.${issuedByUserId}.${issuedAt}.${expiresAt}`;
  const expectedSignature = createHmac("sha256", getCheckInSecret()).update(payload).digest("hex");
  if (signature !== expectedSignature) {
    throw new Error("QR invalido.");
  }

  if (Number(expiresAt) < Date.now()) {
    throw new Error("Este QR ya ha caducado.");
  }

  return {
    eventId,
    issuedByUserId,
    issuedAt: Number(issuedAt),
    expiresAt: Number(expiresAt)
  };
}

function parseEventAccessTicketToken(token: string) {
  const [prefix, eventId, viewerId, ticketId, issuedAt, expiresAt, signature] = token.split(".");
  if (prefix !== "ticket" || !eventId || !viewerId || !ticketId || !issuedAt || !expiresAt || !signature) {
    throw new Error("QR invalido.");
  }

  const payload = `${prefix}.${eventId}.${viewerId}.${ticketId}.${issuedAt}.${expiresAt}`;
  const expectedSignature = createHmac("sha256", getCheckInSecret()).update(payload).digest("hex");
  if (signature !== expectedSignature) {
    throw new Error("QR invalido.");
  }

  return {
    eventId,
    viewerId,
    ticketId,
    issuedAt: Number(issuedAt),
    expiresAt: Number(expiresAt)
  };
}

export async function getEventCheckInToken(viewerId: string, eventId: string) {
  const canManage = await viewerCanManageEvent(viewerId, eventId);
  if (!canManage) {
    throw new Error("No puedes generar el QR.");
  }

  const eventRows = await selectRows<EventRow>(TABLES.events, {
    filters: [{ column: "id", op: "eq", value: eventId }],
    limit: 1
  });
  const eventRow = eventRows[0];
  if (!eventRow) {
    throw new Error("Este evento ya no existe.");
  }

  const fallbackEndAt = new Date(eventRow.starts_at).getTime() + 1000 * 60 * 60 * 6;
  const expiresAtMs = Number.isFinite(new Date(eventRow.ends_at).getTime())
    ? new Date(eventRow.ends_at).getTime()
    : fallbackEndAt;

  const token = createCheckInToken(eventId, viewerId, expiresAtMs);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const checkInUrl = `${appUrl}/evento/${eventRow.slug}?checkin=${encodeURIComponent(token)}`;
  return {
    token,
    expiresAt: new Date(Math.max(Date.now() + 1000 * 60 * 30, expiresAtMs)).toISOString(),
    url: checkInUrl,
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkInUrl)}`
  };
}

export async function getEventAccessTicket(viewerId: string, eventId: string): Promise<MobileEventTicket> {
  const [eventRows, membershipRows, cohostRows, viewerProfiles, existingTicketRows] = await Promise.all([
    selectRows<EventRow>(TABLES.events, {
      filters: [{ column: "id", op: "eq", value: eventId }],
      limit: 1
    }),
    selectRows<EventMemberRow>(TABLES.eventMembers, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    }),
    selectRows<EventCohostRow>(TABLES.eventCohosts, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    }),
    loadProfiles([viewerId]),
    selectRows<EventEntryTicketRow>(TABLES.eventEntryTickets, {
      filters: [
        { column: "event_id", op: "eq", value: eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    })
  ]);

  const eventRow = eventRows[0];
  if (!eventRow) {
    throw new Error("Este evento ya no existe.");
  }

  const membership = membershipRows[0] ?? null;
  const isStaff = eventRow.host_id === viewerId || Boolean(cohostRows[0]);
  const isApprovedMember = membership?.status === "approved";

  if (!isStaff && !isApprovedMember) {
    throw new Error("Tu entrada solo aparece cuando ya estas aprobado en el evento.");
  }

  const fallbackEndAt = new Date(eventRow.starts_at).getTime() + 1000 * 60 * 60 * 6;
  const expiresAtMs = Number.isFinite(new Date(eventRow.ends_at).getTime())
    ? new Date(eventRow.ends_at).getTime()
    : fallbackEndAt;
  const roleLabel = isStaff ? "Staff" : "Entrada confirmada";
  let ticketRow: EventEntryTicketRow | null = existingTicketRows[0] ?? null;

  if (!ticketRow) {
    const ticketId = buildMobileId("ticket");
    const token = createEventAccessTicketToken(eventId, viewerId, ticketId, expiresAtMs);
    ticketRow = await insertRow<EventEntryTicketRow, EventEntryTicketRow>(TABLES.eventEntryTickets, {
      id: ticketId,
      event_id: eventId,
      user_id: viewerId,
      membership_id: membership?.id ?? null,
      role_label: roleLabel,
      token,
      ticket_code: `TDR-${eventRow.slug.slice(0, 3).toUpperCase()}-${ticketId.slice(-6).toUpperCase()}`,
      valid_until: new Date(Math.max(Date.now() + 1000 * 60 * 30, expiresAtMs)).toISOString(),
      scanned_at: null,
      scanned_by_user_id: null,
      invalidated_at: null,
      invalidated_reason: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } else if (ticketRow.role_label !== roleLabel || ticketRow.membership_id !== (membership?.id ?? null)) {
    const patchedRows = await patchRows<EventEntryTicketRow>(
      TABLES.eventEntryTickets,
      [{ column: "id", op: "eq", value: ticketRow.id }],
      {
        role_label: roleLabel,
        membership_id: membership?.id ?? null,
        updated_at: new Date().toISOString()
      }
    );
    ticketRow = patchedRows[0] ?? ticketRow;
  }

  if (!ticketRow) {
    throw new Error("No se pudo preparar la entrada.");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shareUrl = `${appUrl}/evento/${eventRow.slug}`;
  const qrTarget = `${shareUrl}?entry=${encodeURIComponent(ticketRow.token)}`;
  const viewerProfile = viewerProfiles[0] ?? null;
  const holderLabel = viewerProfile?.handle ? `@${viewerProfile.handle}` : "Mi entrada";
  const scannerProfiles =
    ticketRow.scanned_by_user_id ? await loadProfiles([ticketRow.scanned_by_user_id]) : [];
  const scannedByProfile = scannerProfiles[0] ?? null;
  const ticketStatus =
    ticketRow.invalidated_at
      ? "invalid"
      : ticketRow.scanned_at
        ? "used"
        : new Date(ticketRow.valid_until).getTime() < Date.now()
          ? "expired"
          : "active";

  return {
    token: ticketRow.token,
    ticketCode: ticketRow.ticket_code,
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrTarget)}`,
    shareUrl,
    validUntil: ticketRow.valid_until,
    holderLabel,
    roleLabel: ticketRow.role_label,
    status: ticketStatus,
    scannedAt: ticketRow.scanned_at,
    scannedByHandle: scannedByProfile?.handle ? `@${scannedByProfile.handle}` : null,
    invalidReason: ticketRow.invalidated_reason
  };
}

export async function checkInToEvent(viewerId: string, token: string, expectedEventId?: string | null) {
  try {
    const parsedTicket = parseEventAccessTicketToken(token);
    if (expectedEventId && parsedTicket.eventId !== expectedEventId) {
      throw new Error("Ese QR pertenece a otro evento.");
    }
    const canScan = await viewerCanScanEvent(viewerId, parsedTicket.eventId);
    if (!canScan) {
      throw new Error("No puedes escanear accesos en este evento.");
    }

    const [ticketRows, membershipRows, banRows, attendeeProfiles] = await Promise.all([
      selectRows<EventEntryTicketRow>(TABLES.eventEntryTickets, {
        filters: [
          { column: "id", op: "eq", value: parsedTicket.ticketId },
          { column: "event_id", op: "eq", value: parsedTicket.eventId },
          { column: "user_id", op: "eq", value: parsedTicket.viewerId }
        ],
        limit: 1
      }),
      selectRows<EventMemberRow>(TABLES.eventMembers, {
        filters: [
          { column: "event_id", op: "eq", value: parsedTicket.eventId },
          { column: "user_id", op: "eq", value: parsedTicket.viewerId }
        ],
        limit: 1
      }),
      selectRows(TABLES.eventBans, {
        filters: [
          { column: "event_id", op: "eq", value: parsedTicket.eventId },
          { column: "user_id", op: "eq", value: parsedTicket.viewerId }
        ],
        limit: 1
      }),
      loadProfiles([parsedTicket.viewerId])
    ]);

    const ticketRow = ticketRows[0];
    if (!ticketRow || ticketRow.token !== token) {
      throw new Error("Esta entrada ya no es valida.");
    }

    if (ticketRow.invalidated_at) {
      throw new Error(ticketRow.invalidated_reason || "Esta entrada ya no es valida.");
    }

    if (ticketRow.scanned_at) {
      throw new Error("Esta entrada ya fue escaneada.");
    }

    if (new Date(ticketRow.valid_until).getTime() < Date.now() || parsedTicket.expiresAt < Date.now()) {
      throw new Error("Esta entrada ha caducado.");
    }

    if (banRows[0]) {
      throw new Error("Esta persona no puede hacer check-in en este evento.");
    }

    const membership = membershipRows[0];
    if (!membership || membership.status !== "approved") {
      throw new Error("Solo puede hacer check-in gente aprobada.");
    }

    const now = new Date().toISOString();
    await insertRow(TABLES.eventPresence, {
      id: buildMobileId("presence"),
      event_id: parsedTicket.eventId,
      user_id: parsedTicket.viewerId,
      arrival_status: "inside",
      checked_in_at: now,
      checked_in_by_user_id: viewerId,
      created_at: now,
      updated_at: now
    }, {
      onConflict: "event_id,user_id",
      returning: "minimal"
    });
    await patchRows(
      TABLES.eventPresence,
      [
        { column: "event_id", op: "eq", value: parsedTicket.eventId },
        { column: "user_id", op: "eq", value: parsedTicket.viewerId }
      ],
      {
        arrival_status: "inside",
        checked_in_at: now,
        checked_in_by_user_id: viewerId,
        updated_at: now
      }
    );
    await patchRows(
      TABLES.eventEntryTickets,
      [{ column: "id", op: "eq", value: ticketRow.id }],
      {
        scanned_at: now,
        scanned_by_user_id: viewerId,
        updated_at: now
      }
    );

    const attendee = attendeeProfiles[0];
    publishMobileRealtimeEvent({ type: "event", eventId: parsedTicket.eventId, viewerId });
    publishMobileRealtimeEvent({ type: "event", eventId: parsedTicket.eventId, viewerId: parsedTicket.viewerId });
    return {
      eventId: parsedTicket.eventId,
      attendeeHandle: attendee?.handle ? `@${attendee.handle}` : "Entrada validada",
      ticketStatus: "used"
    };
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "QR invalido.") {
      throw error;
    }

    const parsed = parseCheckInToken(token);
    if (expectedEventId && parsed.eventId !== expectedEventId) {
      throw new Error("Ese QR pertenece a otro evento.");
    }
    const [membershipRows, banRows] = await Promise.all([
      selectRows<EventMemberRow>(TABLES.eventMembers, {
        filters: [
          { column: "event_id", op: "eq", value: parsed.eventId },
          { column: "user_id", op: "eq", value: viewerId }
        ],
        limit: 1
      }),
      selectRows(TABLES.eventBans, {
        filters: [
          { column: "event_id", op: "eq", value: parsed.eventId },
          { column: "user_id", op: "eq", value: viewerId }
        ],
        limit: 1
      })
    ]);

    if (banRows[0]) {
      throw new Error("No puedes hacer check-in en este evento.");
    }

    const membership = membershipRows[0];
    if (!membership || membership.status !== "approved") {
      throw new Error("Solo puede hacer check-in gente aprobada.");
    }

    const now = new Date().toISOString();
    await patchRows(
      TABLES.eventPresence,
      [
        { column: "event_id", op: "eq", value: parsed.eventId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      {
        arrival_status: "inside",
        checked_in_at: now,
        checked_in_by_user_id: parsed.issuedByUserId,
        updated_at: now
      }
    );
    publishMobileRealtimeEvent({ type: "event", eventId: parsed.eventId, viewerId });
    return {
      eventId: parsed.eventId,
      attendeeHandle: "Check-in completado",
      ticketStatus: "legacy"
    };
  }
}

async function canViewerWriteConversation(viewerId: string, conversation: ConversationRow) {
  const membershipRows = await selectRows<ConversationMemberRow>(TABLES.conversationMembers, {
    filters: [
      { column: "conversation_id", op: "eq", value: conversation.id },
      { column: "user_id", op: "eq", value: viewerId }
    ],
    limit: 1
  });
  const membership = membershipRows[0];
  if (!membership) {
    return false;
  }

  if (conversation.kind !== "event" || conversation.chat_mode === "open") {
    return true;
  }

  return membership.role === "owner" || membership.role === "cohost";
}

export async function sendMobileMessage(viewerId: string, input: SendMobileMessageInput) {
  const conversationRows = await selectRows<ConversationRow>(TABLES.conversations, {
    filters: [{ column: "id", op: "eq", value: input.conversationId }],
    limit: 1
  });
  const conversation = conversationRows[0];
  if (!conversation) {
    throw new Error("La conversacion no existe.");
  }

  const canWrite = await canViewerWriteConversation(viewerId, conversation);
  if (!canWrite) {
    throw new Error("No puedes escribir en este chat.");
  }

  const normalizedBody = input.body.trim();
  const storyMessage = normalizedBody ? parseStoryMessageText(normalizedBody) : null;

  if (!normalizedBody && !input.media) {
    throw new Error("Escribe algo antes de enviar.");
  }

  let mediaAssetId: string | null = null;
  if (input.media?.assetRef) {
    const assetRow = await createMediaAsset(viewerId, {
      assetRef: input.media.assetRef,
      previewUrl: input.media.previewUrl ?? null,
      mimeType: input.media.mimeType,
      purpose: "chat",
      expiresAt: input.ephemeralExpiresAt ?? null
    });
    mediaAssetId = assetRow?.id ?? null;
  }

  const now = new Date().toISOString();
  const messageRow = await insertRow<MessageRow, MessageRow>(TABLES.messages, {
    id: buildMobileId("message"),
    conversation_id: input.conversationId,
    author_id: viewerId,
    body: normalizedBody,
    kind: input.media ? "media" : input.kind ?? "text",
    created_at: now,
    media_asset_id: mediaAssetId,
    thread_root_id: input.threadRootId ?? null,
    deleted_at: null,
    deleted_for_everyone: false,
    ephemeral_expires_at: input.ephemeralExpiresAt ?? null
  });

  await patchRows(TABLES.conversations, [{ column: "id", op: "eq", value: input.conversationId }], {
    updated_at: now
  }, { returning: "minimal" });
  await patchRows(TABLES.conversationMembers, [
    { column: "conversation_id", op: "eq", value: input.conversationId },
    { column: "user_id", op: "eq", value: viewerId }
  ], {
    last_read_at: now
  }, { returning: "minimal" });
  await patchRows(
    TABLES.conversationMembers,
    [{ column: "conversation_id", op: "eq", value: input.conversationId }],
    { hidden_at: null },
    { returning: "minimal" }
  );

  const memberRows = await selectRows<ConversationMemberRow>(TABLES.conversationMembers, {
    filters: [{ column: "conversation_id", op: "eq", value: input.conversationId }]
  });
  const otherUserIds = memberRows.map((row) => row.user_id).filter((userId) => userId !== viewerId);

  await insertRows<MessageReceiptRow, MessageReceiptRow>(
    TABLES.messageReceipts,
    memberRows
      .filter((row) => row.user_id !== viewerId)
      .map((row) => ({
        id: buildMobileId("receipt"),
        message_id: messageRow!.id,
        user_id: row.user_id,
        delivered_at: null,
        read_at: null
      })),
    { returning: "minimal" }
  );

  await notifyUsers(
    otherUserIds,
    {
      kind: storyMessage ? (storyMessage.mode === "reaction" ? "story-reaction" : "story-reply") : "message",
      title: storyMessage
        ? storyMessage.mode === "reaction"
          ? "Nueva reaccion a una historia"
          : "Nueva respuesta a una historia"
        : "Mensaje nuevo",
      body:
        storyMessage?.text ||
        normalizedBody ||
        "Te han enviado una foto",
      entityType: "conversation",
      entityId: input.conversationId,
      data: storyMessage
        ? {
            storyId: storyMessage.storyId,
            conversationId: input.conversationId,
            mode: storyMessage.mode
          }
        : { conversationId: input.conversationId }
    }
  );

  for (const userId of [viewerId, ...otherUserIds]) {
    publishMobileRealtimeEvent({
      type: "conversation",
      conversationId: input.conversationId,
      viewerId: userId
    });
  }

  return messageRow!.id;
}

export async function markConversationRead(viewerId: string, conversationId: string) {
  const now = new Date().toISOString();
  await patchRows(
    TABLES.conversationMembers,
    [
      { column: "conversation_id", op: "eq", value: conversationId },
      { column: "user_id", op: "eq", value: viewerId }
    ],
    { last_read_at: now },
    { returning: "minimal" }
  );

  const messageRows = await selectRows<MessageRow>(TABLES.messages, {
    filters: [{ column: "conversation_id", op: "eq", value: conversationId }]
  });
  const incomingIds = messageRows
    .filter((message) => message.author_id !== viewerId)
    .map((message) => message.id);

  for (const messageId of incomingIds) {
    const existing = await selectRows<MessageReceiptRow>(TABLES.messageReceipts, {
      filters: [
        { column: "message_id", op: "eq", value: messageId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      limit: 1
    });
    if (existing[0]) {
      await patchRows(
        TABLES.messageReceipts,
        [
          { column: "message_id", op: "eq", value: messageId },
          { column: "user_id", op: "eq", value: viewerId }
        ],
        {
          delivered_at: existing[0].delivered_at ?? now,
          read_at: now
        },
        { returning: "minimal" }
      );
    } else {
      await insertRow(TABLES.messageReceipts, {
        id: buildMobileId("receipt"),
        message_id: messageId,
        user_id: viewerId,
        delivered_at: now,
        read_at: now
      });
    }
  }

  publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId });
}

export async function getMobileConversationDetail(viewerId: string, conversationId: string): Promise<MobileConversationDetail> {
  const [conversationRows, memberRows, messageRows, receiptRows] = await Promise.all([
    selectRows<ConversationRow>(TABLES.conversations, {
      filters: [{ column: "id", op: "eq", value: conversationId }],
      limit: 1
    }),
    selectRows<ConversationMemberRow>(TABLES.conversationMembers, {
      filters: [{ column: "conversation_id", op: "eq", value: conversationId }]
    }),
    selectRows<MessageRow>(TABLES.messages, {
      filters: [{ column: "conversation_id", op: "eq", value: conversationId }],
      order: [{ column: "created_at", ascending: true }]
    }),
    selectRows<MessageReceiptRow>(TABLES.messageReceipts, {
      order: [{ column: "message_id", ascending: true }]
    })
  ]);
  const conversation = conversationRows[0];
  if (!conversation) {
    throw new Error("La conversacion ya no existe.");
  }

  const viewerMembership = memberRows.find((row) => row.user_id === viewerId);
  if (!viewerMembership) {
    throw new Error("No tienes acceso a este chat.");
  }

  if (viewerMembership.hidden_at) {
    await patchRows(
      TABLES.conversationMembers,
      [
        { column: "conversation_id", op: "eq", value: conversationId },
        { column: "user_id", op: "eq", value: viewerId }
      ],
      { hidden_at: null },
      { returning: "minimal" }
    );
    publishMobileRealtimeEvent({ type: "conversation", conversationId, viewerId });
  }

  const participantIds = memberRows.map((row) => row.user_id);
  const parsedStoryMessages = new Map(
    messageRows
      .map((row) => [row.id, parseStoryMessageText(row.body)] as const)
      .filter((entry): entry is readonly [string, NonNullable<ReturnType<typeof parseStoryMessageText>>] => Boolean(entry[1]))
  );
  const [profiles, eventRows, mediaAssets, storyContexts] = await Promise.all([
    loadProfiles(participantIds),
    conversation.event_id
      ? selectRows<EventRow>(TABLES.events, {
          filters: [{ column: "id", op: "eq", value: conversation.event_id }],
          limit: 1
        })
      : Promise.resolve([]),
    loadMediaAssets(messageRows.map((row) => row.media_asset_id).filter((id): id is string => Boolean(id))),
    loadStoryMessageContexts([...parsedStoryMessages.values()].map((item) => item.storyId))
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const assetsById = new Map(mediaAssets.map((asset) => [asset.id, asset]));
  const eventRow = eventRows[0] ?? null;

  const summary = (await listConversationSummariesForUser(viewerId)).find((item) => item.id === conversationId) ?? {
    id: conversation.id,
    kind: conversation.kind,
    title: conversation.title ?? eventRow?.title ?? "Chat",
    subtitle: eventRow?.city ?? "",
    avatarUrl: resolveMediaUrl(conversation.cover_image),
    lastMessagePreview: getConversationPreview(messageRows.slice(-1)[0]?.body ?? ""),
    lastMessageAt: messageRows.slice(-1)[0]?.created_at ?? conversation.updated_at,
    unreadCount: 0,
    isPinned: Boolean(viewerMembership.pinned_at),
    isArchived: Boolean(viewerMembership.archived_at),
    chatMode: conversation.chat_mode,
    eventSlug: eventRow?.slug ?? null,
    eventId: eventRow?.id ?? null
  };

  const messages = messageRows.map((row): MobileMessage => {
    const receipts = receiptRows
      .filter((receipt) => receipt.message_id === row.id)
      .map(
        (receipt): MobileMessageReceipt => ({
          messageId: receipt.message_id,
          userId: receipt.user_id,
          deliveredAt: receipt.delivered_at,
          readAt: receipt.read_at
        })
      );
    const deliveryStatus =
      row.author_id !== viewerId
        ? "sent"
        : receipts.every((receipt) => receipt.readAt)
          ? "read"
          : receipts.every((receipt) => receipt.deliveredAt)
            ? "delivered"
            : "sent";
    const parsedStoryMessage = parsedStoryMessages.get(row.id) ?? null;
    const baseStoryContext = parsedStoryMessage ? storyContexts.get(parsedStoryMessage.storyId) ?? null : null;
    const storyContext = baseStoryContext && parsedStoryMessage
      ? {
          ...baseStoryContext,
          mode: parsedStoryMessage.mode,
          text: parsedStoryMessage.text
        }
      : null;
    const body =
      row.deleted_for_everyone
        ? "Este mensaje ha sido borrado"
        : parsedStoryMessage
          ? parsedStoryMessage.text
          : row.body;

    return {
      id: row.id,
      conversationId: row.conversation_id,
      authorId: row.author_id,
      body,
      kind: row.kind,
      createdAt: row.created_at,
      threadRootId: row.thread_root_id,
      media: row.media_asset_id ? assetsById.get(row.media_asset_id) ?? null : null,
      deletedAt: row.deleted_at,
      deletedForEveryone: row.deleted_for_everyone,
      ephemeralExpiresAt: row.ephemeral_expires_at,
      deliveryStatus,
      receipts,
      storyContext
    };
  });

  return {
    viewerId,
    summary,
    participants: participantIds
      .map((participantId) => profilesById.get(participantId))
      .filter((profile): profile is MobileProfile => Boolean(profile)),
    messages
  };
}

export async function publishMobileStory(viewerId: string, input: PublishMobileStoryInput) {
  const ownerId = input.ownerType === "user" ? viewerId : input.ownerId;
  const assetRow = await createMediaAsset(viewerId, {
    assetRef: input.assetRef,
    previewUrl: input.previewUrl,
    mimeType: input.mimeType,
    purpose: "story",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  await insertRow(TABLES.stories, {
    id: buildMobileId("story"),
    owner_type: input.ownerType,
    owner_id: ownerId,
    author_id: viewerId,
    media_asset_id: assetRow?.id ?? null,
    caption: input.caption.trim(),
    duration_ms: input.durationMs || 5000,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  publishMobileRealtimeEvent({ type: "stories", profileId: viewerId, viewerId });
  publishMobileRealtimeEvent({ type: "feed", profileId: viewerId, viewerId });
}

export async function publishMobilePost(viewerId: string, input: PublishMobilePostInput) {
  const ownerId = input.ownerType === "user" ? viewerId : input.ownerId;
  const assetInputs =
    input.assets?.filter((asset) => asset.assetRef.trim().length > 0) ??
    (input.assetRef
      ? [
          {
            assetRef: input.assetRef,
            previewUrl: input.previewUrl ?? null,
            mimeType: input.mimeType ?? "image/jpeg"
          }
        ]
      : []);

  if (assetInputs.length === 0) {
    throw new Error("Selecciona al menos una foto para publicar.");
  }

  const normalizedAssets = assetInputs.slice(0, 20);
  const assetRows = await Promise.all(
    normalizedAssets.map((asset) =>
      createMediaAsset(viewerId, {
        assetRef: asset.assetRef,
        previewUrl: asset.previewUrl,
        mimeType: asset.mimeType,
        purpose: "post"
      })
    )
  );

  const postId = buildMobileId("post");
  const now = new Date().toISOString();
  await insertRow(TABLES.posts, {
    id: postId,
    owner_type: input.ownerType,
    owner_id: ownerId,
    author_id: viewerId,
    media_asset_id: assetRows[0]?.id ?? null,
    caption: input.caption.trim(),
    created_at: now,
    updated_at: now
  });
  await insertRows(
    TABLES.postMediaItems,
    assetRows
      .map((assetRow, index) =>
        assetRow
          ? {
              id: buildMobileId("post-media"),
              post_id: postId,
              media_asset_id: assetRow.id,
              sort_order: index,
              created_at: now
            }
          : null
      )
      .filter(Boolean),
    { returning: "minimal" }
  );
  publishMobileRealtimeEvent({ type: "feed", profileId: viewerId, viewerId });
}

export async function deleteMobileStory(viewerId: string, storyId: string) {
  await deleteRows(TABLES.stories, [
    { column: "id", op: "eq", value: storyId },
    { column: "author_id", op: "eq", value: viewerId }
  ]);
  publishMobileRealtimeEvent({ type: "stories", viewerId });
}

export async function deleteMobilePost(viewerId: string, postId: string) {
  await deleteRows(TABLES.posts, [
    { column: "id", op: "eq", value: postId },
    { column: "author_id", op: "eq", value: viewerId }
  ]);
  publishMobileRealtimeEvent({ type: "feed", viewerId });
}

export async function toggleMobilePostLike(viewerId: string, postId: string) {
  const existing = await selectRows<PostLikeRow>(TABLES.postLikes, {
    filters: [
      { column: "post_id", op: "eq", value: postId },
      { column: "user_id", op: "eq", value: viewerId }
    ],
    limit: 1
  });
  if (existing[0]) {
    await deleteRows(TABLES.postLikes, [
      { column: "post_id", op: "eq", value: postId },
      { column: "user_id", op: "eq", value: viewerId }
    ]);
  } else {
    await insertRow(TABLES.postLikes, {
      id: buildMobileId("like"),
      post_id: postId,
      user_id: viewerId,
      created_at: new Date().toISOString()
    });
  }
  publishMobileRealtimeEvent({ type: "feed", viewerId });
}

export async function createMobilePostComment(viewerId: string, postId: string, body: string) {
  const trimmedBody = body.trim();
  if (!trimmedBody) {
    throw new Error("Escribe un comentario antes de enviarlo.");
  }

  const [postRows, authorProfiles] = await Promise.all([
    selectRows<PostRow>(TABLES.posts, {
      filters: [{ column: "id", op: "eq", value: postId }],
      limit: 1
    }),
    loadProfiles([viewerId])
  ]);

  const post = postRows[0];
  const author = authorProfiles[0];

  if (!post || !author) {
    throw new Error("No se pudo comentar esta publicacion.");
  }

  const created = await insertRow<PostCommentRow, PostCommentRow>(TABLES.postComments, {
    id: buildMobileId("comment"),
    post_id: postId,
    author_id: viewerId,
    body: trimmedBody,
    created_at: new Date().toISOString()
  });

  if (!created) {
    throw new Error("No se pudo guardar el comentario.");
  }

  if (post.author_id !== viewerId) {
    await notifyUsers([post.author_id], {
      kind: "mention",
      title: `@${author.handle} comento tu publicacion`,
      body: trimmedBody,
      entityType: "post",
      entityId: postId,
      data: { postId }
    });
  }

  publishMobileRealtimeEvent({ type: "feed", viewerId });
  return mapPostComment(created, author);
}

export async function markStoryViewed(viewerId: string, storyId: string) {
  await insertRow(TABLES.storyViews, {
    id: buildMobileId("story-view"),
    story_id: storyId,
    user_id: viewerId,
    seen_at: new Date().toISOString()
  }, {
    onConflict: "story_id,user_id",
    returning: "minimal"
  });
  publishMobileRealtimeEvent({ type: "stories", viewerId });
}

export async function getMobileEventDetail(viewerId: string, slug: string): Promise<MobileEventDetail> {
  const [eventRows, memberRows, presenceRows, cohostRows, postRows, storyRows, inviteRows, muteRows, banRows, staffRoleRows] = await Promise.all([
    selectRows<EventRow>(TABLES.events, {
      filters: [{ column: "slug", op: "eq", value: slug }],
      limit: 1
    }),
    selectRows<EventMemberRow>(TABLES.eventMembers),
    selectRows<EventPresenceRow>(TABLES.eventPresence),
    selectRows<EventCohostRow>(TABLES.eventCohosts),
    selectRows<PostRow>(TABLES.posts, { order: [{ column: "created_at", ascending: false }] }),
    selectRows<StoryRow>(TABLES.stories, { order: [{ column: "created_at", ascending: false }] }),
    selectRows<EventInviteRow>(TABLES.eventInvites, { order: [{ column: "created_at", ascending: false }] }).catch(
      async () => [] as EventInviteRow[]
    ),
    selectRows<{ event_id: string; user_id: string }>(TABLES.eventMutes).catch(
      async () => [] as Array<{ event_id: string; user_id: string }>
    ),
    selectRows<{ event_id: string; user_id: string }>(TABLES.eventBans).catch(
      async () => [] as Array<{ event_id: string; user_id: string }>
    ),
    loadEventStaffRoleRowsFromSlug(slug)
  ]);

  const eventRow = eventRows[0];
  if (!eventRow) {
    throw new Error("No se ha encontrado el evento.");
  }

  const eventMemberships = memberRows.filter((member) => member.event_id === eventRow.id);
  const eventPresences = presenceRows.filter((presence) => presence.event_id === eventRow.id);
  const eventInviteRows = inviteRows.filter((invite) => invite.event_id === eventRow.id);
  const eventMuteRows = muteRows.filter((row) => row.event_id === eventRow.id);
  const eventBanRows = banRows.filter((row) => row.event_id === eventRow.id);
  const event = mapEvent(eventRow, eventMemberships, eventPresences);
  const myMembership = eventMemberships.find((member) => member.user_id === viewerId) ?? null;
  const cohostIds = new Set(cohostRows.filter((row) => row.event_id === event.id).map((row) => row.user_id));
  const eventStaffRoleRows = staffRoleRows.filter((row) => row.event_id === event.id);
  const staffRolesByUserId = new Map<string, Array<"moderator" | "scanner">>();
  for (const row of eventStaffRoleRows) {
    const current = staffRolesByUserId.get(row.user_id) ?? [];
    if (!current.includes(row.role)) {
      current.push(row.role);
    }
    staffRolesByUserId.set(row.user_id, current);
  }
  const viewerStaffRoles = staffRolesByUserId.get(viewerId) ?? [];
  const canManage = event.hostId === viewerId || cohostIds.has(viewerId);
  const canModerateMembers = canManage || viewerStaffRoles.includes("moderator");
  const canScan = canManage || viewerStaffRoles.includes("scanner");
  const isStaff = canManage || canModerateMembers || canScan;
  const isApproved = myMembership?.status === "approved" || isStaff;
  const canInviteFriends = canManage || myMembership?.status === "approved";
  const approvedMemberIds = new Set(
    eventMemberships.filter((member) => member.status === "approved").map((member) => member.user_id)
  );
  const visibleMemberships = !isApproved
    ? []
    : isStaff
      ? eventMemberships
      : eventMemberships.filter((member) => member.status === "approved");
  const visibleInviteRows = isStaff
    ? eventInviteRows
    : eventInviteRows.filter((invite) => invite.from_user_id === viewerId || invite.to_user_id === viewerId);
  const profileIdsToLoad = new Set<string>([
    event.hostId,
    viewerId,
    ...visibleMemberships.map((member) => member.user_id),
    ...[...cohostIds],
    ...visibleInviteRows.flatMap((invite) => [invite.from_user_id, invite.to_user_id])
  ]);
  const [profiles, allPosts, storyClusters, inviteCandidates] = await Promise.all([
    loadProfiles([...profileIdsToLoad]),
    loadPostsForViewer(viewerId),
    loadActiveStoriesForViewer(viewerId),
    canInviteFriends ? loadInvitableFriendsForEvent(viewerId, event.id) : Promise.resolve([] as MobileProfile[])
  ]);

  const host = profiles.find((profile) => profile.id === event.hostId);
  if (!host) {
    throw new Error("No se encontro a la persona organizadora.");
  }

  const eventStories = storyClusters
    .flatMap((cluster) => cluster.stories)
    .filter((story) => story.ownerType === "event" && story.ownerId === event.id);
  const eventPosts = allPosts.filter((post) => post.ownerType === "event" && post.ownerId === event.id);
  const members = profiles.filter((profile) => approvedMemberIds.has(profile.id));
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const myInviteRow =
    eventInviteRows.find((invite) => invite.to_user_id === viewerId && invite.status === "pending") ?? null;
  const mappedInvites = visibleInviteRows
    .map((inviteRow) => {
      const fromProfile = profilesById.get(inviteRow.from_user_id);
      const toProfile = profilesById.get(inviteRow.to_user_id);
      if (!fromProfile || !toProfile) {
        return null;
      }
      return mapEventInvite(inviteRow, eventRow, fromProfile, toProfile);
    })
    .filter((invite): invite is MobileEventInvite => Boolean(invite));
  const myInvite =
    myInviteRow && profilesById.get(myInviteRow.from_user_id) && profilesById.get(myInviteRow.to_user_id)
      ? mapEventInvite(
          myInviteRow,
          eventRow,
          profilesById.get(myInviteRow.from_user_id)!,
          profilesById.get(myInviteRow.to_user_id)!
        )
      : null;
  const participants: MobileEventParticipant[] = visibleMemberships
    .map((membership) => {
      const profile = profilesById.get(membership.user_id);
      if (!profile) {
        return null;
      }
      return {
        profile,
        membership: mapMember(membership, eventPresences.find((presence) => presence.user_id === membership.user_id)),
        isCohost: cohostIds.has(membership.user_id),
        staffRoles: staffRolesByUserId.get(membership.user_id) ?? []
      };
    })
    .filter((participant): participant is MobileEventParticipant => Boolean(participant));

  return {
    event,
    host,
    myMembership: myMembership ? mapMember(myMembership, eventPresences.find((presence) => presence.user_id === viewerId)) : null,
    myConversationId:
      myMembership?.status === "approved" || event.hostId === viewerId
        ? buildEventConversationId(event.id)
        : null,
    myInvite,
    cohosts: profiles.filter((profile) => cohostIds.has(profile.id)),
    members: isApproved ? members : [],
    memberRecords: participants.map((participant) => participant.membership),
    participants,
    invites: mappedInvites,
    inviteCandidates,
    canInviteFriends,
    canManage,
    canModerateMembers,
    canScan,
    mutedUserIds: eventMuteRows.map((row) => row.user_id),
    bannedUserIds: eventBanRows.map((row) => row.user_id),
    stories: eventStories,
    posts: eventPosts
  };
}

export async function getMobileProfileDetail(viewerId: string, handle: string): Promise<MobileProfileDetail> {
  const profile = await resolveProfileByHandle(handle);
  if (!profile) {
    throw new Error("No se encontro ese perfil.");
  }
  const [viewerProfiles, events, follows, followRequests, posts, storyClusters, memberships] = await Promise.all([
    loadProfiles([viewerId]),
    loadAllEvents(),
    loadProfileFollows(),
    loadPendingProfileFollowRequests(),
    loadPostsForViewer(viewerId),
    loadActiveStoriesForViewer(viewerId),
    selectRows<EventMemberRow>(TABLES.eventMembers)
  ]);
  const viewer = viewerProfiles[0];
  if (!viewer) {
    throw new Error("No se ha encontrado tu perfil.");
  }
  const relationship = buildProfileRelationship(viewerId, profile.id, follows, followRequests);
  const canViewContent = profile.id === viewerId || !profile.isPrivate || relationship.followsProfile;
  const followerIds = follows.filter((follow) => follow.followee_id === profile.id).map((follow) => follow.follower_id);
  const followingIds = follows.filter((follow) => follow.follower_id === profile.id).map((follow) => follow.followee_id);
  const relatedProfiles = await loadProfiles([...new Set([...followerIds, ...followingIds])]);
  const relatedProfilesById = new Map(relatedProfiles.map((entry) => [entry.id, entry]));

  return {
    viewer,
    profile: {
      ...profile,
      relationship
    },
    isViewer: profile.id === viewerId,
    canViewContent,
    relationship,
    followerCount: followerIds.length,
    followingCount: followingIds.length,
    followers: followerIds
      .map((id) => relatedProfilesById.get(id))
      .filter((entry): entry is MobileProfile => Boolean(entry))
      .map(mapProfileMini),
    following: followingIds
      .map((id) => relatedProfilesById.get(id))
      .filter((entry): entry is MobileProfile => Boolean(entry))
      .map(mapProfileMini),
    createdEvents: canViewContent ? events.filter((event) => event.hostId === profile.id) : [],
    joinedEvents: canViewContent ? events.filter((event) =>
      memberships.some(
        (membership) =>
          membership.user_id === profile.id &&
          membership.event_id === event.id &&
          membership.status === "approved"
      )
    ) : [],
    stories: canViewContent
      ? storyClusters.flatMap((cluster) => cluster.stories).filter((story) => story.authorId === profile.id)
      : [],
    posts: canViewContent ? posts.filter((post) => post.authorId === profile.id) : []
  };
}

export async function runEventReminderDispatch() {
  await ensureMobileSchema();
  const [eventRows, memberRows, reminderRows] = await Promise.all([
    selectRows<EventRow>(TABLES.events),
    selectRows<EventMemberRow>(TABLES.eventMembers),
    selectRows<{ event_id: string; id: string; reminder_kind: string; sent_at: string; user_id: string }>(TABLES.reminderLogs)
  ]);
  const now = Date.now();

  for (const eventRow of eventRows) {
    const startsAt = new Date(eventRow.starts_at).getTime();
    const diff = startsAt - now;
    const reminderKind =
      diff <= 0 && diff >= -10 * 60 * 1000
        ? "event-live"
        : diff <= 2 * 60 * 60 * 1000 && diff > 110 * 60 * 1000
          ? "event-reminder-2h"
          : diff <= 24 * 60 * 60 * 1000 && diff > 23 * 60 * 60 * 1000
            ? "event-reminder-24h"
            : null;

    if (!reminderKind) {
      continue;
    }

    const approvedUserIds = memberRows
      .filter((member) => member.event_id === eventRow.id && member.status === "approved")
      .map((member) => member.user_id);
    for (const userId of approvedUserIds) {
      if (
        reminderRows.some(
          (row) =>
            row.event_id === eventRow.id &&
            row.user_id === userId &&
            row.reminder_kind === reminderKind
        )
      ) {
        continue;
      }

      await insertRow(TABLES.reminderLogs, {
        id: buildMobileId("reminder"),
        event_id: eventRow.id,
        user_id: userId,
        reminder_kind: reminderKind,
        sent_at: new Date().toISOString()
      });
      await notifyUsers(
        [userId],
        {
          kind: reminderKind as MobileNotification["kind"],
          title: reminderKind === "event-live" ? "El evento ya esta en vivo" : "Recordatorio de evento",
          body:
            reminderKind === "event-live"
              ? `${eventRow.title} acaba de empezar.`
              : reminderKind === "event-reminder-2h"
                ? `${eventRow.title} empieza en unas 2 horas.`
                : `${eventRow.title} empieza manana.`,
          entityType: "event",
          entityId: eventRow.id,
          data: { eventSlug: eventRow.slug }
        }
      );
    }
  }
}
