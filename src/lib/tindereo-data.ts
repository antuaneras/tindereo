import type { EventCategory, PersistedState } from "@/lib/tindereo-types";

export const APP_NAME = "Tindereo";
export const APP_TAGLINE = "Eventos que conectan antes de empezar";

export const EVENT_CATEGORY_META: Record<
  EventCategory,
  { label: string; accent: string; softAccent: string }
> = {
  music: {
    label: "Musica",
    accent: "#FF6B57",
    softAccent: "rgba(255, 107, 87, 0.16)"
  },
  networking: {
    label: "Networking",
    accent: "#F08A24",
    softAccent: "rgba(240, 138, 36, 0.16)"
  },
  food: {
    label: "Food",
    accent: "#C7702E",
    softAccent: "rgba(199, 112, 46, 0.16)"
  },
  creative: {
    label: "Creativo",
    accent: "#8A5CF6",
    softAccent: "rgba(138, 92, 246, 0.16)"
  },
  wellness: {
    label: "Wellness",
    accent: "#2AA876",
    softAccent: "rgba(42, 168, 118, 0.16)"
  }
};

export const EVENT_CATEGORY_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "music", label: "Musica" },
  { value: "networking", label: "Networking" },
  { value: "food", label: "Food" },
  { value: "creative", label: "Creativo" },
  { value: "wellness", label: "Wellness" }
] as const;

export const EVENT_COVER_BY_CATEGORY: Record<EventCategory, string> = {
  music:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1400&q=80",
  networking:
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
  food:
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80",
  creative:
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1400&q=80",
  wellness:
    "https://images.unsplash.com/photo-1483721310020-03333e577078?auto=format&fit=crop&w=1400&q=80"
};

export const DEFAULT_STATE: PersistedState = {
  session: {
    isAuthenticated: false,
    currentUserId: "",
    activeTab: "discover",
    selectedEventId: null,
    selectedEventView: "overview",
    selectedPrivateChatId: null
  },
  users: [],
  events: [],
  memberships: [],
  groupMessages: [],
  privateChatRequests: [],
  privateChats: [],
  privateMessages: [],
  friendships: [],
  eventInvites: [],
  socialPosts: [],
  stories: [],
  conversationReadStates: [],
  notifications: []
};
