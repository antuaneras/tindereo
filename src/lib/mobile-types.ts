export type MobileEventVisibility = "public" | "private";
export type MobileEventStatus = "upcoming" | "live" | "afterglow";
export type MobileEventMemberStatus = "pending" | "approved" | "rejected" | "waitlisted";
export type MobileArrivalStatus = "none" | "going" | "eta20" | "inside";
export type MobileConversationKind = "event" | "direct" | "group";
export type MobileConversationRole = "owner" | "cohost" | "member";
export type MobileChatMode = "open" | "announcements";
export type MobileMessageKind = "text" | "system" | "media";
export type MobileDeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";
export type MobileStoryOwnerType = "user" | "event";
export type MobileNotificationKind =
  | "event-approved"
  | "event-waitlist"
  | "event-reminder-24h"
  | "event-reminder-2h"
  | "event-live"
  | "story-reply"
  | "story-reaction"
  | "message"
  | "mention";
export type MobileModerationAction = "mute" | "unmute" | "kick" | "ban" | "unban";
export type MobileFeedTab = "home" | "search" | "events" | "chats" | "profile";

export interface MobileFaqItem {
  question: string;
  answer: string;
}

export interface MobileProfile {
  id: string;
  handle: string;
  displayName: string;
  city: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
}

export interface MobileViewerSummary {
  profile: MobileProfile;
  pendingChatCount: number;
  unreadNotificationCount: number;
  pendingStoryCount: number;
}

export interface MobileConversationSummary {
  id: string;
  kind: MobileConversationKind;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  unreadCount: number;
  chatMode: MobileChatMode;
  eventSlug: string | null;
  eventId: string | null;
}

export interface MobileMediaAsset {
  id: string;
  ownerId: string;
  storageRef: string;
  previewUrl: string | null;
  mimeType: string;
  purpose: "avatar" | "chat" | "event-cover" | "post" | "story";
  createdAt: string;
  expiresAt: string | null;
}

export interface MobileStory {
  id: string;
  ownerType: MobileStoryOwnerType;
  ownerId: string;
  authorId: string;
  media: MobileMediaAsset | null;
  caption: string;
  durationMs: number;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  hasSeen: boolean;
}

export interface MobileStoryCluster {
  ownerId: string;
  ownerType: MobileStoryOwnerType;
  ownerLabel: string;
  ownerAvatarUrl: string | null;
  unseenCount: number;
  stories: MobileStory[];
}

export interface MobilePostComment {
  id: string;
  postId: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface MobilePost {
  id: string;
  ownerType: MobileStoryOwnerType;
  ownerId: string;
  authorId: string;
  authorHandle: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  ownerLabel: string;
  ownerAvatarUrl: string | null;
  eventSlug: string | null;
  media: MobileMediaAsset | null;
  mediaItems: MobileMediaAsset[];
  caption: string;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  commentCount: number;
  hasLiked: boolean;
  comments: MobilePostComment[];
}

export interface MobileSuggestedProfile {
  id: string;
  handle: string;
  displayName: string;
  city: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
  mutualFriendCount: number;
  mutualFriends: Array<Pick<MobileProfile, "id" | "handle" | "avatarUrl">>;
}

export interface MobileEventMember {
  id: string;
  eventId: string;
  userId: string;
  status: MobileEventMemberStatus;
  requestedAt: string;
  respondedAt: string | null;
  joinedAt: string | null;
  arrivalStatus: MobileArrivalStatus;
  checkedInAt: string | null;
}

export interface MobileEventCohost {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
}

export interface MobileEvent {
  id: string;
  slug: string;
  hostId: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  visibility: MobileEventVisibility;
  city: string;
  venue: string;
  coverImage: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  priceLabel: string;
  dressCode: string;
  tags: string[];
  rules: string[];
  faq: MobileFaqItem[];
  playlistUrl: string | null;
  meetingPointLabel: string | null;
  meetingPointAddress: string | null;
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  chatMode: MobileChatMode;
  createdAt: string;
  updatedAt: string;
  experienceState: MobileEventStatus;
  approvedCount: number;
  waitlistCount: number;
  insideCount: number;
  pendingCount: number;
}

export interface MobileMessageReceipt {
  messageId: string;
  userId: string;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface MobileMessage {
  id: string;
  conversationId: string;
  authorId: string | null;
  body: string;
  kind: MobileMessageKind;
  createdAt: string;
  threadRootId: string | null;
  media: MobileMediaAsset | null;
  deletedAt: string | null;
  deletedForEveryone: boolean;
  ephemeralExpiresAt: string | null;
  deliveryStatus: MobileDeliveryStatus;
  receipts: MobileMessageReceipt[];
}

export interface MobileConversationDetail {
  viewerId: string;
  summary: MobileConversationSummary;
  participants: MobileProfile[];
  messages: MobileMessage[];
}

export interface MobileEventDetail {
  event: MobileEvent;
  host: MobileProfile;
  myMembership: MobileEventMember | null;
  myConversationId: string | null;
  cohosts: MobileProfile[];
  members: MobileProfile[];
  memberRecords: MobileEventMember[];
  stories: MobileStory[];
  posts: MobilePost[];
}

export interface MobileProfileDetail {
  viewer: MobileProfile;
  profile: MobileProfile;
  isViewer: boolean;
  isFriend: boolean;
  friendCount: number;
  createdEvents: MobileEvent[];
  joinedEvents: MobileEvent[];
  stories: MobileStory[];
  posts: MobilePost[];
}

export interface MobileNotification {
  id: string;
  userId: string;
  kind: MobileNotificationKind;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
  data: Record<string, string | number | boolean | null>;
}

export interface MobileBootstrapPayload {
  viewer: MobileViewerSummary;
  storyClusters: MobileStoryCluster[];
  feedPosts: MobilePost[];
  joinedEvents: MobileEvent[];
  chatSummaries: MobileConversationSummary[];
}

export interface MobileSearchPayload {
  profiles: MobileProfile[];
  events: MobileEvent[];
  suggestedProfiles: MobileSuggestedProfile[];
  suggestedPosts: MobilePost[];
}

export interface CreateMobileEventInput {
  title: string;
  summary: string;
  description: string;
  category: string;
  visibility: MobileEventVisibility;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  priceLabel: string;
  dressCode: string;
  tags: string[];
  rules: string[];
  faq: MobileFaqItem[];
  playlistUrl: string | null;
  meetingPointLabel: string | null;
  meetingPointAddress: string | null;
  meetingPointLat: number | null;
  meetingPointLng: number | null;
  coverImage: string | null;
}

export interface UpdateMobileProfileInput {
  displayName: string;
  city: string;
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
}

export interface PublishMobileStoryInput {
  ownerType: MobileStoryOwnerType;
  ownerId: string;
  assetRef: string;
  previewUrl: string | null;
  mimeType: string;
  caption: string;
  durationMs: number;
}

export interface PublishMobilePostInput {
  ownerType: MobileStoryOwnerType;
  ownerId: string;
  assetRef?: string;
  previewUrl?: string | null;
  mimeType?: string;
  assets?: Array<{
    assetRef: string;
    previewUrl: string | null;
    mimeType: string;
  }>;
  caption: string;
}

export interface SendMobileMessageInput {
  conversationId: string;
  body: string;
  kind?: MobileMessageKind;
  threadRootId?: string | null;
  ephemeralExpiresAt?: string | null;
  media?:
    | {
        assetRef: string;
        previewUrl: string | null;
        mimeType: string;
      }
    | null;
}

export interface CreateConversationInput {
  kind: "direct" | "group";
  title: string | null;
  participantIds: string[];
}

export interface JoinEventResult {
  membership: MobileEventMember;
  event: MobileEvent;
}

export interface MobileStreamEvent {
  type:
    | "bootstrap"
    | "conversation"
    | "event"
    | "feed"
    | "stories"
    | "profile"
    | "notifications";
  conversationId?: string | null;
  eventId?: string | null;
  profileId?: string | null;
  viewerId?: string | null;
  at: string;
}
