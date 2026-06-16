export type AppTab = "discover" | "agenda" | "inbox" | "profile" | "host";

export type EventDetailTab = "overview" | "chat" | "people";

export type UserRole = "attendee" | "organizer";

export type EventCategory = "music" | "networking" | "food" | "creative" | "wellness";

export type GroupMessageKind = "text" | "system";

export type PrivateChatRequestStatus = "pending" | "accepted" | "rejected";

export type OrganizerLeadStatus = "pending" | "contacted";

export interface PlatformUser {
  id: string;
  name: string;
  handle: string;
  role: UserRole;
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
  city: string;
  venue: string;
  coverImage: string;
  startsAt: string;
  endsAt: string;
  priceLabel: string;
  capacity: number;
  baseGuestCount: number;
  waitlistCount: number;
  hostId: string;
  summary: string;
  description: string;
  highlights: string[];
  tags: string[];
  dressCode: string;
  conversationPrompt: string;
}

export interface EventMembership {
  id: string;
  eventId: string;
  userId: string;
  joinedAt: string;
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

export interface OrganizerLead {
  id: string;
  fromUserId: string;
  companyName: string;
  concept: string;
  message: string;
  status: OrganizerLeadStatus;
  createdAt: string;
}

export interface SessionState {
  currentUserId: string;
  activeTab: AppTab;
  selectedEventId: string | null;
  selectedEventView: EventDetailTab;
  selectedPrivateChatId: string | null;
}

export interface PersistedState {
  session: SessionState;
  users: PlatformUser[];
  events: EventItem[];
  memberships: EventMembership[];
  groupMessages: EventGroupMessage[];
  privateChatRequests: PrivateChatRequest[];
  privateChats: PrivateChat[];
  privateMessages: PrivateMessage[];
  organizerLeads: OrganizerLead[];
}

export interface CreateEventInput {
  title: string;
  category: EventCategory;
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

export interface OrganizerLeadInput {
  companyName: string;
  concept: string;
  message: string;
}

export type EventConnectionState =
  | { kind: "self" }
  | { kind: "available" }
  | { kind: "chat"; chat: PrivateChat }
  | { kind: "incoming-request"; request: PrivateChatRequest }
  | { kind: "outgoing-request"; request: PrivateChatRequest }
  | { kind: "rejected"; request: PrivateChatRequest; by: "me" | "them" };
