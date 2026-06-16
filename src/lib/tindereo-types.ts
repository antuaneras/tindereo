export type AppTab = "discover" | "search" | "agenda" | "inbox" | "profile" | "host";

export type EventDetailTab = "overview" | "chat" | "people";

export type EventCategory = "music" | "networking" | "food" | "creative" | "wellness";

export type EventVisibility = "public" | "private";

export type EventAttendanceStatus = "pending" | "approved" | "rejected";

export type EventHealthStatus = "building" | "confirmed" | "at-risk";

export type GroupMessageKind = "text" | "system";

export type PrivateChatRequestStatus = "pending" | "accepted" | "rejected";

export type SocialAuthorType = "user" | "event";

export type EventInviteStatus = "pending" | "accepted" | "declined";

export type ConversationScope = "event" | "private";

export type NotificationKind =
  | "friendship"
  | "event-invite"
  | "event-invite-response"
  | "event-request"
  | "event-request-response"
  | "private-request"
  | "private-request-response"
  | "story"
  | "post"
  | "group-message"
  | "private-message";

export interface PlatformUser {
  id: string;
  name: string;
  handle: string;
  city: string;
  title: string;
  company?: string;
  bio: string;
  tagline: string;
  avatar: string;
  coverImage: string;
  interests: string[];
  verified: boolean;
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  category: EventCategory;
  visibility: EventVisibility;
  city: string;
  venue: string;
  coverImage: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  priceLabel: string;
  capacity: number;
  baseGuestCount: number;
  hostId: string;
  summary: string;
  description: string;
  highlights: string[];
  tags: string[];
  dressCode: string;
  conversationPrompt: string;
  minimumGuestsRequired: number;
  validationWindowDays: number;
}

export interface EventMembership {
  id: string;
  eventId: string;
  userId: string;
  status: EventAttendanceStatus;
  requestedAt: string;
  respondedAt?: string;
}

export interface EventGroupMessage {
  id: string;
  eventId: string;
  authorId: string | "system";
  text: string;
  kind: GroupMessageKind;
  createdAt: string;
}

export interface PrivateChatRequest {
  id: string;
  eventId: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: PrivateChatRequestStatus;
  createdAt: string;
  respondedAt?: string;
}

export interface PrivateChat {
  id: string;
  participantIds: [string, string];
  originEventId: string;
  requestId: string;
  createdAt: string;
}

export interface PrivateMessage {
  id: string;
  chatId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Friendship {
  id: string;
  userIds: [string, string];
  createdAt: string;
}

export interface EventInvite {
  id: string;
  eventId: string;
  fromUserId: string;
  toUserId: string;
  status: EventInviteStatus;
  createdAt: string;
  respondedAt?: string;
}

export interface SocialPost {
  id: string;
  authorType: SocialAuthorType;
  authorId: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
}

export interface StoryItem {
  id: string;
  authorType: SocialAuthorType;
  authorId: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
}

export interface ConversationReadState {
  id: string;
  userId: string;
  scope: ConversationScope;
  targetId: string;
  lastReadAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
  eventId?: string;
  chatId?: string;
  fromUserId?: string;
  postId?: string;
  storyId?: string;
}

export interface SessionState {
  isAuthenticated: boolean;
  currentUserId: string;
  activeTab: AppTab;
  selectedEventId: string | null;
  selectedEventView: EventDetailTab;
  selectedPrivateChatId: string | null;
}

export interface AppDataset {
  users: PlatformUser[];
  events: EventItem[];
  memberships: EventMembership[];
  groupMessages: EventGroupMessage[];
  privateChatRequests: PrivateChatRequest[];
  privateChats: PrivateChat[];
  privateMessages: PrivateMessage[];
  friendships: Friendship[];
  eventInvites: EventInvite[];
  socialPosts: SocialPost[];
  stories: StoryItem[];
  conversationReadStates: ConversationReadState[];
  notifications: AppNotification[];
}

export interface PersistedState extends AppDataset {
  session: SessionState;
}

export interface CreateEventInput {
  title: string;
  category: EventCategory;
  visibility: EventVisibility;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  priceLabel: string;
  capacity: number;
  summary: string;
  description: string;
  dressCode: string;
  tags: string[];
  highlights: string[];
  coverImage?: string;
}

export interface RegisterUserInput {
  name: string;
  handle: string;
  city: string;
  bio: string;
}

export type PlatformAction =
  | { type: "register-user"; input: RegisterUserInput }
  | { type: "create-event"; actorId: string; input: CreateEventInput }
  | { type: "request-event-access"; actorId: string; eventId: string }
  | { type: "respond-event-access"; actorId: string; membershipId: string; accept: boolean }
  | { type: "leave-event"; actorId: string; eventId: string }
  | { type: "send-group-message"; actorId: string; eventId: string; text: string }
  | { type: "toggle-friendship"; actorId: string; targetUserId: string }
  | { type: "send-event-invite"; actorId: string; eventId: string; targetUserId: string }
  | { type: "respond-event-invite"; actorId: string; inviteId: string; accept: boolean }
  | { type: "create-user-post"; actorId: string; imageUrl: string; caption: string }
  | { type: "create-user-story"; actorId: string; imageUrl: string; caption: string }
  | { type: "update-user-post"; actorId: string; postId: string; caption: string }
  | { type: "delete-user-post"; actorId: string; postId: string }
  | { type: "update-user-story"; actorId: string; storyId: string; caption: string }
  | { type: "delete-user-story"; actorId: string; storyId: string }
  | { type: "create-event-post"; actorId: string; eventId: string; imageUrl: string; caption: string }
  | { type: "create-event-story"; actorId: string; eventId: string; imageUrl: string; caption: string }
  | { type: "update-event-post"; actorId: string; eventId: string; postId: string; caption: string }
  | { type: "delete-event-post"; actorId: string; eventId: string; postId: string }
  | { type: "update-event-story"; actorId: string; eventId: string; storyId: string; caption: string }
  | { type: "delete-event-story"; actorId: string; eventId: string; storyId: string }
  | {
      type: "send-private-request";
      actorId: string;
      eventId: string;
      targetUserId: string;
      message: string;
    }
  | { type: "respond-private-request"; actorId: string; requestId: string; accept: boolean }
  | { type: "send-private-message"; actorId: string; chatId: string; text: string }
  | { type: "mark-thread-read"; actorId: string; scope: ConversationScope; targetId: string }
  | { type: "mark-notification-read"; actorId: string; notificationId: string }
  | { type: "mark-all-notifications-read"; actorId: string };

export interface PlatformDataEnvelope {
  data: AppDataset;
  meta?: {
    currentUserId?: string | null;
    revision?: number;
    selectedEventId?: string | null;
  };
}

export type EventAccessState =
  | { kind: "host" }
  | { kind: "approved"; membership: EventMembership }
  | { kind: "pending"; membership: EventMembership }
  | { kind: "rejected"; membership: EventMembership }
  | { kind: "available" };

export type EventConnectionState =
  | { kind: "self" }
  | { kind: "available" }
  | { kind: "chat"; chat: PrivateChat }
  | { kind: "incoming-request"; request: PrivateChatRequest }
  | { kind: "outgoing-request"; request: PrivateChatRequest }
  | { kind: "rejected"; request: PrivateChatRequest; by: "me" | "them" };
