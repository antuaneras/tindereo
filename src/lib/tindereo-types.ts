export type Screen =
  | "qr"
  | "welcome"
  | "register"
  | "interests"
  | "goal"
  | "home"
  | "match"
  | "matches"
  | "chat"
  | "map"
  | "ranking"
  | "profile"
  | "organizer";

export type SwipeDirection = "left" | "right" | "super";

export interface EventInfo {
  name: string;
  subtitle: string;
  eventCode: string;
  location: string;
  dateLabel: string;
  organizerEmail: string;
  organizerPassword: string;
  liveAttendees: number;
}

export interface EventZone {
  id: string;
  label: string;
  emoji: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  people: number;
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  city: string;
  occupation: string;
  instagram: string;
  relationship: string;
  goal: string;
  bio: string;
  interests: string[];
  photo: string;
  coverPhoto: string;
  zoneId: string;
  points: number;
  matches: number;
  superLikes: number;
  gender: "Mujer" | "Hombre" | "No binario";
  joinedAt: string;
  status: "online" | "roaming" | "chatting";
  headline: string;
}

export interface SwipeRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  direction: SwipeDirection;
  createdAt: string;
}

export interface MatchItem {
  id: string;
  userIds: [string, string];
  createdAt: string;
  zoneId: string;
  commonInterests: string[];
  superLike: boolean;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  createdAt: string;
  kind: "text" | "zone" | "instagram";
}

export interface RegistrationDraft {
  name: string;
  age: string;
  instagram: string;
  city: string;
  occupation: string;
  relationship: string;
  bio: string;
  interests: string[];
  goal: string;
  photo: string;
  coverPhoto: string;
}

export interface ActivityPoint {
  time: string;
  users: number;
  matches: number;
}

export interface PersistedState {
  screen: Screen;
  currentUser: UserProfile | null;
  registration: RegistrationDraft;
  swipes: SwipeRecord[];
  matches: MatchItem[];
  messages: Record<string, ChatMessage[]>;
  visitedZones: string[];
  selectedChatId: string | null;
  activeMatchId: string | null;
}
