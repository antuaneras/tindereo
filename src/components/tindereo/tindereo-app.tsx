"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Copy,
  Heart,
  Inbox,
  Image,
  MapPin,
  MessageCircle,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  Shield,
  Sparkles,
  Ticket,
  Trash2,
  User,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { OrganizerDashboard } from "@/components/tindereo/organizer-dashboard";
import {
  executePlatformAction,
  extractPlatformData,
  fetchPlatformData,
  loginAccount,
  logoutAccount,
  registerAccount,
  resetPlatformData,
  subscribeToPlatformStream,
  uploadManagedMediaFromClient
} from "@/lib/tindereo-api";
import { APP_NAME, APP_TAGLINE, EVENT_CATEGORY_OPTIONS } from "@/lib/tindereo-data";
import {
  disableWebPushNotifications,
  enableWebPushNotifications,
  getWebPushStatus,
  syncExistingWebPushSubscription,
  type WebPushStatus,
} from "@/lib/tindereo-push-client";
import {
  hydratePersistedState,
  readSessionState,
  SESSION_STORAGE_KEY
} from "@/lib/tindereo-session";
import type {
  AppTab,
  CreateEventInput,
  EventInvite,
  EventCategory,
  EventDetailTab,
  EventItem,
  LoginInput,
  PlatformAction,
  PlatformDataEnvelope,
  PersistedState,
  PrivateChat,
  PlatformUser,
  RegisterAccountInput,
  SessionState,
  SocialPost,
  StoryItem
} from "@/lib/tindereo-types";
import {
  areFriends,
  canWriteEventChat,
  formatEventDateRange,
  formatRelativeTime,
  formatTime,
  getActiveStories,
  getCategoryMeta,
  getChatSubtitle,
  getChatTitle,
  getChatPartner,
  getCurrentUser,
  getDiscoverFeedEvents,
  getEventAccessState,
  getEventAttendanceRatio,
  getEventById,
  getEventChatMode,
  getEventConnectionState,
  getEventDeadlineLabel,
  getEventFriendMembers,
  getEventGuestCount,
  getEventInvitableFriends,
  getEventPosts,
  getEventStories,
  getEventHealth,
  getEventInvitesForUser,
  getEventMembers,
  getEventMessages,
  getEventPendingCount,
  getEventPendingRequests,
  getEventRequirementSummary,
  getFeedPosts,
  getFriendSuggestions,
  getFriends,
  getHostPendingRequests,
  getHostedEvents,
  getInitials,
  getJoinedEvents,
  getLatestPrivateMessage,
  getNotificationsForUser,
  getPendingEventInvitesForUser,
  getProfilePosts,
  getProfileStories,
  getPrivateChatsForUser,
  getConversationReadState,
  getPrivateMessages,
  getPrivateRequestsForUser,
  getStoryViews,
  getUnreadChatThreadCount,
  getUnreadEventMessagesCount,
  getUnreadNotificationCount,
  getUnreadPrivateMessagesCount,
  getUserById,
  hasViewedMessageMedia,
  hasViewedStory,
  hasEventAccess,
  isChatMediaExpired,
  isGroupChat,
  normalizeState,
  parseEphemeralMediaMessageText
} from "@/lib/tindereo-utils";

function readSharedEventSlug() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URL(window.location.href).searchParams.get("event");
}

function writeSharedEventSlug(eventSlug: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (eventSlug) {
    url.searchParams.set("event", eventSlug);
  } else {
    url.searchParams.delete("event");
  }

  window.history.replaceState({}, "", url.toString());
}

function buildEventShareUrl(eventSlug: string) {
  if (typeof window === "undefined") {
    return `/?event=${eventSlug}`;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("event", eventSlug);
  return url.toString();
}

function buildEventShareCopy(event: EventItem, shareUrl: string) {
  return `Te paso ${event.title} en Tindereo. ${event.summary} Ãšnete aquÃ­: ${shareUrl}`;
}

function getUserIdentityLabel(user: Pick<PlatformUser, "handle" | "name">) {
  return user.handle?.trim() || user.name;
}

function getUserIdentityMeta(user: Pick<PlatformUser, "city" | "title">) {
  return user.city?.trim() || user.title;
}

function getStoryPreviewImage(story: StoryItem, state: PersistedState) {
  if (story.authorType === "user") {
    return getUserById(state, story.authorId).avatar;
  }

  return getEventById(state, story.authorId)?.coverImage ?? story.imageUrl;
}

function getStoryAuthorLabel(story: StoryItem, state: PersistedState) {
  return story.authorType === "user"
    ? getUserIdentityLabel(getUserById(state, story.authorId))
    : getEventById(state, story.authorId)?.title ?? "Story";
}

async function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function mergeEventIntoCollection(collection: EventItem[], event: EventItem | null) {
  if (!event || collection.some((item) => item.id === event.id)) {
    return collection;
  }

  return [event, ...collection];
}

type RegisterFormState = RegisterAccountInput & {
  confirmPassword: string;
};

const INITIAL_LOGIN_FORM: LoginInput = {
  username: "",
  password: ""
};

const INITIAL_REGISTER_FORM: RegisterFormState = {
  name: "",
  handle: "",
  city: "Madrid",
  bio: "",
  password: "",
  confirmPassword: ""
};

const INITIAL_WEB_PUSH_STATUS: WebPushStatus = {
  isStandalone: false,
  needsStandaloneInstall: false,
  permission: "unsupported",
  subscribed: false,
  supported: false
};

type MediaDraft = {
  imageUrl: string;
  caption: string;
  durationMs?: number | null;
  mediaType?: "image" | "video";
  pendingFile?: File | null;
};

type ReplyTarget = {
  authorLabel: string;
  id: string;
  snippet: string;
};

type MobileEventScreenState = {
  originTab: "discover" | "agenda";
};

type StoryViewerState = {
  activeStoryId: string;
  storyIds: string[];
};

type OptimisticChatMessage = {
  authorId: string;
  clientId: string;
  createdAt: string;
  text: string;
};

type StoryChatAttachment = {
  actionLabel: string;
  mode: "reaction" | "comment";
  storyId: string;
  text: string;
};

type ChatMediaAttachment = NonNullable<ReturnType<typeof parseEphemeralMediaMessageText>>;

type ProfileDrilldown = "created" | "agenda" | "friends" | "private";

type GroupChatComposerState = {
  participantIds: string[];
  title: string;
};

type ChatMediaViewerState = {
  authorLabel: string;
  caption: string;
  imageUrl: string;
  messageId: string;
  title: string;
};

type MessageDeliveryState = "pending" | "sent" | "read";

type CameraComposerState = {
  caption: string;
  durationMs: number | null;
  eventId: string | null;
  imageUrl: string;
  mediaType: "image" | "video";
  mode: "post" | "story";
  pendingFile: File | null;
  taggedUserIds: string[];
  target: "user" | "event";
};

type MediaEditorState =
  | {
      id: string;
      caption: string;
      imageUrl: string;
      kind: "post";
      scope: "user";
    }
  | {
      id: string;
      caption: string;
      imageUrl: string;
      kind: "story";
      scope: "user";
    }
  | {
      eventId: string;
      id: string;
      caption: string;
      imageUrl: string;
      kind: "post";
      scope: "event";
    }
  | {
      eventId: string;
      id: string;
      caption: string;
      imageUrl: string;
      kind: "story";
      scope: "event";
    };

const CAMERA_COMPOSER_INITIAL_STATE: CameraComposerState = {
  caption: "",
  durationMs: null,
  eventId: null,
  imageUrl: "",
  mediaType: "image",
  mode: "post",
  pendingFile: null,
  taggedUserIds: [],
  target: "user"
};

const GROUP_CHAT_COMPOSER_INITIAL_STATE: GroupChatComposerState = {
  participantIds: [],
  title: ""
};

const POST_LIKES_STORAGE_KEY = "tindereo-post-likes-v1";
const PUSH_ONBOARDING_STORAGE_KEY = "tindereo-push-onboarding-v1";
const REPLY_PREFIX = "[reply:";
const STORY_PREFIX = "[story:";
const STORY_AUTO_ADVANCE_MS = 4500;
const STORY_LONG_PRESS_VIDEO_MS = 280;
const STORY_MAX_VIDEO_MS = 20_000;

function getMediaTypeFromUrl(url: string) {
  const normalizedUrl = url.trim().toLowerCase();
  if (
    normalizedUrl.startsWith("data:video/") ||
    normalizedUrl.endsWith(".mp4") ||
    normalizedUrl.endsWith(".mov") ||
    normalizedUrl.endsWith(".webm")
  ) {
    return "video" as const;
  }

  return "image" as const;
}

function isVideoMediaUrl(url: string) {
  return getMediaTypeFromUrl(url) === "video";
}

function getStoryPlaybackDuration(durationMs: number | null) {
  if (!durationMs || Number.isNaN(durationMs)) {
    return STORY_AUTO_ADVANCE_MS;
  }

  return Math.max(2500, Math.min(durationMs, STORY_MAX_VIDEO_MS));
}

function buildReplyMessageText(text: string, replyTarget: ReplyTarget | null) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  if (!replyTarget) {
    return trimmed;
  }

  const encodedAuthor = encodeURIComponent(replyTarget.authorLabel);
  const encodedSnippet = encodeURIComponent(replyTarget.snippet);
  return `${REPLY_PREFIX}${replyTarget.id}|${encodedAuthor}|${encodedSnippet}] ${trimmed}`;
}

function parseReplyMessageText(text: string) {
  if (!text.startsWith(REPLY_PREFIX)) {
    return {
      body: text,
      reply: null as ReplyTarget | null
    };
  }

  const closingIndex = text.indexOf("]");
  if (closingIndex === -1) {
    return {
      body: text,
      reply: null as ReplyTarget | null
    };
  }

  const metadata = text.slice(REPLY_PREFIX.length, closingIndex).split("|");
  if (metadata.length < 3) {
    return {
      body: text,
      reply: null as ReplyTarget | null
    };
  }

  return {
    body: text.slice(closingIndex + 1).trim(),
    reply: {
      id: metadata[0] ?? "",
      authorLabel: decodeURIComponent(metadata[1] ?? ""),
      snippet: decodeURIComponent(metadata.slice(2).join("|"))
    }
  };
}

function buildReplyTarget(authorLabel: string, id: string, text: string): ReplyTarget {
  const parsed = parseChatMessage(text);
  return {
    authorLabel,
    id,
    snippet: (parsed.body || parsed.summary || text).slice(0, 92)
  };
}

function buildStoryMessageText(storyId: string, mode: StoryChatAttachment["mode"], text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  return `${STORY_PREFIX}${storyId}|${mode}|${encodeURIComponent(trimmed)}]`;
}

function parseStoryMessageText(text: string) {
  if (!text.startsWith(STORY_PREFIX)) {
    return null as StoryChatAttachment | null;
  }

  const closingIndex = text.indexOf("]");
  if (closingIndex === -1) {
    return null;
  }

  const metadata = text.slice(STORY_PREFIX.length, closingIndex).split("|");
  if (metadata.length < 3) {
    return null;
  }

  const storyId = metadata[0] ?? "";
  const mode = metadata[1] === "reaction" ? "reaction" : metadata[1] === "comment" ? "comment" : null;
  if (!storyId || !mode) {
    return null;
  }

  const decodedText = decodeURIComponent(metadata.slice(2).join("|"));

  return {
    storyId,
    mode,
    text: decodedText,
    actionLabel: mode === "reaction" ? `Reacciono: ${decodedText}` : "Comento una historia"
  } satisfies StoryChatAttachment;
}

function parseChatMessage(text: string) {
  const reply = parseReplyMessageText(text);
  const story = parseStoryMessageText(reply.body);
  const media = parseEphemeralMediaMessageText(reply.body);

  if (story) {
    return {
      body: story.mode === "comment" ? story.text : "",
      media: null as ChatMediaAttachment | null,
      reply: reply.reply,
      story,
      summary:
        story.mode === "reaction" ? `Reacciono a una historia: ${story.text}` : `Comento una historia: ${story.text}`
    };
  }

  if (media) {
    return {
      body: media.caption,
      media,
      reply: reply.reply,
      story: null as StoryChatAttachment | null,
      summary: media.caption ? `Foto efimera: ${media.caption}` : "Foto efimera"
    };
  }

  return {
    body: reply.body,
    media: null as ChatMediaAttachment | null,
    reply: reply.reply,
    story: null as StoryChatAttachment | null,
    summary: reply.body
  };
}

function buildPostLikeKey(userId: string, postId: string) {
  return `${userId}:${postId}`;
}

function buildPushOnboardingStorageKey(userId: string) {
  return `${PUSH_ONBOARDING_STORAGE_KEY}:${userId}`;
}

function readStoredPostLikes() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(POST_LIKES_STORAGE_KEY) ?? "[]"
    ) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function appendTaggedHandles(caption: string, taggedUsers: PlatformUser[]) {
  const trimmedCaption = caption.trim();
  if (taggedUsers.length === 0) {
    return trimmedCaption;
  }

  const mentions = taggedUsers.map((user) => user.handle).join(" ");
  return `${trimmedCaption}${trimmedCaption ? "\n\n" : ""}${mentions}`;
}

function buildStorySequence(stories: StoryItem[], activeStoryId: string) {
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? null;
  const relevantStories = activeStory
    ? stories.filter(
        (story) =>
          story.authorId === activeStory.authorId && story.authorType === activeStory.authorType
      )
    : stories;
  const orderedStories = relevantStories
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const activeIndex = orderedStories.findIndex((story) => story.id === activeStoryId);

  if (activeIndex <= 0) {
    return orderedStories.map((story) => story.id);
  }

  return [
    ...orderedStories.slice(activeIndex).map((story) => story.id),
    ...orderedStories.slice(0, activeIndex).map((story) => story.id)
  ];
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function buildOptimisticChatMessage(authorId: string, text: string): OptimisticChatMessage {
  return {
    authorId,
    clientId: `optimistic-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    text,
  };
}

function MessageDeliveryIndicator({ status }: { status: MessageDeliveryState }) {
  if (status === "pending") {
    return <Check className="h-3.5 w-3.5 text-current opacity-70" />;
  }

  const toneClass = status === "read" ? "text-[#34b7f1]" : "text-current opacity-70";

  return (
    <span className={`inline-flex items-center ${toneClass}`}>
      <Check className="h-3.5 w-3.5" />
      <Check className="-ml-1 h-3.5 w-3.5" />
    </span>
  );
}

function getPrivateMessageDeliveryState(
  state: PersistedState,
  chat: PrivateChat,
  currentUserId: string,
  messageCreatedAt: string
): Exclude<MessageDeliveryState, "pending"> {
  if (isGroupChat(chat)) {
    return "sent";
  }

  const partner = getChatPartner(state, chat, currentUserId);
  const readState = getConversationReadState(state, partner.id, "private", chat.id);
  return readState?.lastReadAt && readState.lastReadAt >= messageCreatedAt ? "read" : "sent";
}

function revokePreviewUrlIfNeeded(url: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function createObjectPreviewUrl(file: Blob) {
  return typeof window === "undefined" ? "" : URL.createObjectURL(file);
}

async function uploadMediaFileForAction(
  file: File,
  purpose: "avatar" | "chat" | "post" | "story"
) {
  const payload = await uploadManagedMediaFromClient(file, purpose);
  return payload.assetRef;
}

async function canvasToJpegFile(canvas: HTMLCanvasElement) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo preparar la foto."));
          return;
        }

        resolve(
          new File([blob], `capture-${Date.now()}.jpg`, {
            type: "image/jpeg"
          })
        );
      },
      "image/jpeg",
      0.92
    );
  });
}

async function readVideoDurationFromFile(file: File) {
  return new Promise<number>((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve(STORY_MAX_VIDEO_MS);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
      cleanup();
      resolve(durationMs);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("No se pudo leer la duracion del video."));
    };
    video.src = objectUrl;
  });
}

async function readVideoDurationFromUrl(url: string) {
  return new Promise<number>((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve(STORY_MAX_VIDEO_MS);
      return;
    }

    const video = document.createElement("video");
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
      cleanup();
      resolve(durationMs);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("No se pudo cargar la duracion del video."));
    };
    video.src = url;
  });
}

async function readComposerMedia(file: File) {
  const mediaType = file.type.startsWith("video/") ? "video" : "image";
  const durationMs = mediaType === "video" ? await readVideoDurationFromFile(file) : null;

  return {
    durationMs,
    imageUrl: createObjectPreviewUrl(file),
    mediaType,
    pendingFile: file
  } satisfies Pick<CameraComposerState, "durationMs" | "imageUrl" | "mediaType" | "pendingFile">;
}

function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function MediaSurface({
  alt,
  autoPlay,
  className,
  controls,
  muted,
  src
}: {
  alt: string;
  autoPlay?: boolean;
  className: string;
  controls?: boolean;
  muted?: boolean;
  src: string;
}) {
  if (isVideoMediaUrl(src)) {
    return (
      <video
        autoPlay={autoPlay}
        className={className}
        controls={controls}
        muted={muted ?? autoPlay}
        playsInline
        src={src}
      />
    );
  }

  return <img alt={alt} className={className} src={src} />;
}

export function TindereoApp() {
  const [state, setState] = useState<PersistedState | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");
  const [likedPostKeys, setLikedPostKeys] = useState<string[]>([]);
  const [storyViewer, setStoryViewer] = useState<StoryViewerState | null>(null);
  const [storyReplyDraft, setStoryReplyDraft] = useState("");
  const [chatMediaViewer, setChatMediaViewer] = useState<ChatMediaViewerState | null>(null);
  const [cameraComposer, setCameraComposer] = useState<CameraComposerState | null>(null);
  const [groupChatComposer, setGroupChatComposer] = useState<GroupChatComposerState | null>(null);
  const [directChatComposerOpen, setDirectChatComposerOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [mediaEditor, setMediaEditor] = useState<MediaEditorState | null>(null);
  const [uiNotice, setUiNotice] = useState<string | null>(null);
  const [mobileEventScreen, setMobileEventScreen] = useState<MobileEventScreenState | null>(null);
  const [mobilePrivateChatOpen, setMobilePrivateChatOpen] = useState(false);
  const [profileDrilldown, setProfileDrilldown] = useState<ProfileDrilldown | null>(null);
  const [profileFocusUserId, setProfileFocusUserId] = useState<string | null>(null);
  const [eventListMode, setEventListMode] = useState<"joined" | "discover">("joined");
  const [groupReplyTargets, setGroupReplyTargets] = useState<Record<string, ReplyTarget | null>>({});
  const [privateReplyTarget, setPrivateReplyTarget] = useState<ReplyTarget | null>(null);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [requestDrafts, setRequestDrafts] = useState<Record<string, string>>({});
  const [selectedAttendeeByEvent, setSelectedAttendeeByEvent] = useState<Record<string, string>>({});
  const [privateDraft, setPrivateDraft] = useState("");
  const [pendingGroupMessages, setPendingGroupMessages] = useState<Record<string, OptimisticChatMessage[]>>({});
  const [pendingPrivateMessages, setPendingPrivateMessages] = useState<Record<string, OptimisticChatMessage[]>>({});
  const [isSendingGroupMessageByEvent, setIsSendingGroupMessageByEvent] = useState<Record<string, boolean>>({});
  const [isSendingPrivateMessageChatId, setIsSendingPrivateMessageChatId] = useState<string | null>(null);
  const [isSendingGroupMediaEventId, setIsSendingGroupMediaEventId] = useState<string | null>(null);
  const [isSendingPrivateMediaChatId, setIsSendingPrivateMediaChatId] = useState<string | null>(null);
  const [isSendingStoryReply, setIsSendingStoryReply] = useState(false);
  const [isSavingMediaEdit, setIsSavingMediaEdit] = useState(false);
  const [isDeletingMedia, setIsDeletingMedia] = useState(false);
  const [profileMediaDraft, setProfileMediaDraft] = useState({ imageUrl: "", caption: "" });
  const [profileStoryDraft, setProfileStoryDraft] = useState({ imageUrl: "", caption: "" });
  const [eventMediaDrafts, setEventMediaDrafts] = useState<
    Record<string, { imageUrl: string; caption: string }>
  >({});
  const [loginForm, setLoginForm] = useState<LoginInput>(INITIAL_LOGIN_FORM);
  const [registerForm, setRegisterForm] = useState<RegisterFormState>(INITIAL_REGISTER_FORM);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isPushSyncing, setIsPushSyncing] = useState(false);
  const [pushOnboardingVisible, setPushOnboardingVisible] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [webPushStatus, setWebPushStatus] = useState<WebPushStatus>(INITIAL_WEB_PUSH_STATUS);
  const latestRevisionRef = useRef(0);
  const applyPlatformPayloadRef = useRef<
    | ((
        payload: PlatformDataEnvelope,
        sessionPatch?: Partial<PersistedState["session"]>
      ) => void)
    | null
  >(null);

  const getStoredSession = () => {
    if (typeof window === "undefined") {
      return {};
    }

    return readSessionState(window.localStorage.getItem(SESSION_STORAGE_KEY));
  };

  const applyPlatformPayload = (
    payload: PlatformDataEnvelope,
    sessionPatch?: Partial<PersistedState["session"]>
  ) => {
    const revision = payload.meta?.revision ?? 0;
    const hasMetaSessionPatch = Boolean(
      payload.meta &&
        ("currentUserId" in payload.meta || "selectedEventId" in payload.meta)
    );
    const hasExplicitSessionPatch = Boolean(
      sessionPatch && Object.keys(sessionPatch).length > 0
    );

    if (
      revision > 0 &&
      revision < latestRevisionRef.current &&
      !hasMetaSessionPatch &&
      !hasExplicitSessionPatch
    ) {
      return;
    }

    if (
      revision > 0 &&
      revision === latestRevisionRef.current &&
      !hasMetaSessionPatch &&
      !hasExplicitSessionPatch
    ) {
      return;
    }

    if (revision > latestRevisionRef.current) {
      latestRevisionRef.current = revision;
    }

    const data = extractPlatformData(payload);
    const sharedEventId = data.events.find((event) => event.slug === readSharedEventSlug())?.id;
    const metaSessionPatch: Partial<PersistedState["session"]> = {};

    if (payload.meta && "currentUserId" in payload.meta) {
      metaSessionPatch.currentUserId = payload.meta.currentUserId ?? "";
      metaSessionPatch.isAuthenticated = Boolean(payload.meta.currentUserId);
    }

    if (payload.meta && "selectedEventId" in payload.meta) {
      metaSessionPatch.selectedEventId = payload.meta.selectedEventId ?? null;
    }

    setState((current) =>
      normalizeState(
        hydratePersistedState(data, {
          ...(current?.session ?? getStoredSession()),
          ...metaSessionPatch,
          ...(sharedEventId ? { selectedEventId: sharedEventId } : {}),
          ...sessionPatch
        })
      )
    );
  };

  applyPlatformPayloadRef.current = applyPlatformPayload;

  useEffect(() => {
    setLikedPostKeys(readStoredPostLikes());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(POST_LIKES_STORAGE_KEY, JSON.stringify(likedPostKeys));
  }, [likedPostKeys]);

  useEffect(() => {
    if (!uiNotice || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => setUiNotice(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [uiNotice]);

  const loadPlatform = async (sessionPatch?: Partial<PersistedState["session"]>) => {
    setSyncError(null);
    setIsSyncing(true);

    try {
      const payload = await fetchPlatformData();
      applyPlatformPayload(payload, sessionPatch);
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudo cargar la base de datos local."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const runPlatformMutation = async (
    action: PlatformAction,
    sessionPatch?: Partial<PersistedState["session"]>
  ) => {
    setSyncError(null);
    setIsSyncing(true);

    try {
      const payload = await executePlatformAction(action);
      applyPlatformPayload(payload, sessionPatch);
      return payload;
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudo guardar la accion en backend."
      );
      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    void loadPlatform();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToPlatformStream({
      onError: () => setIsRealtimeConnected(false),
      onMessage: (payload) => {
        setIsRealtimeConnected(true);
        applyPlatformPayloadRef.current?.(payload);
      },
      onOpen: () => setIsRealtimeConnected(true)
    });

    return () => {
      unsubscribe();
    };
  }, [state?.session.currentUserId, state?.session.isAuthenticated]);

  useEffect(() => {
    if (!state || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.session));
    writeSharedEventSlug(
      state.events.find((event) => event.id === state.session.selectedEventId)?.slug ?? null
    );
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    const refreshWebPushStatus = async () => {
      try {
        const nextStatus = await getWebPushStatus();
        if (!cancelled) {
          setWebPushStatus(nextStatus);
        }
      } catch {
        if (!cancelled) {
          setWebPushStatus(INITIAL_WEB_PUSH_STATUS);
        }
      }
    };

    void refreshWebPushStatus();

    if (typeof window === "undefined") {
      return () => {
        cancelled = true;
      };
    }

    const handleFocus = () => {
      void refreshWebPushStatus();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!state?.session.isAuthenticated || !webPushStatus.supported || webPushStatus.permission !== "granted") {
      return;
    }

    let cancelled = false;

    const syncWebPushSubscription = async () => {
      try {
        const nextStatus = await syncExistingWebPushSubscription();
        if (!cancelled) {
          setWebPushStatus(nextStatus);
        }
      } catch {
        // Keep the app usable even if push sync fails temporarily.
      }
    };

    void syncWebPushSubscription();

    return () => {
      cancelled = true;
    };
  }, [state?.session.currentUserId, state?.session.isAuthenticated, webPushStatus.permission, webPushStatus.supported]);

  useEffect(() => {
    if (typeof window === "undefined" || !state?.session.isAuthenticated) {
      setPushOnboardingVisible(false);
      return;
    }

    if (
      webPushStatus.permission !== "default" ||
      webPushStatus.subscribed ||
      (!webPushStatus.supported && !webPushStatus.needsStandaloneInstall)
    ) {
      setPushOnboardingVisible(false);
      return;
    }

    const hasDismissedPrompt = Boolean(
      window.localStorage.getItem(
        buildPushOnboardingStorageKey(state.session.currentUserId)
      )
    );

    setPushOnboardingVisible(!hasDismissedPrompt);
  }, [
    state?.session.currentUserId,
    state?.session.isAuthenticated,
    webPushStatus.needsStandaloneInstall,
    webPushStatus.permission,
    webPushStatus.subscribed,
    webPushStatus.supported
  ]);

  const unreadNotificationCount = state?.session.isAuthenticated
    ? getUnreadNotificationCount(state, state.session.currentUserId)
    : 0;
  const unreadChatThreadCount = state?.session.isAuthenticated
    ? getUnreadChatThreadCount(state, state.session.currentUserId)
    : 0;

  useEffect(() => {
    if (!state?.session.isAuthenticated || typeof navigator === "undefined") {
      return;
    }

    const badgeCount = unreadChatThreadCount + unreadNotificationCount;
    const badgeNavigator = navigator as Navigator & {
      clearAppBadge?: () => Promise<void>;
      setAppBadge?: (count?: number) => Promise<void>;
    };

    if (badgeCount > 0 && badgeNavigator.setAppBadge) {
      void badgeNavigator.setAppBadge(badgeCount).catch(() => undefined);
      return;
    }

    if (badgeCount === 0 && badgeNavigator.clearAppBadge) {
      void badgeNavigator.clearAppBadge().catch(() => undefined);
    }
  }, [state?.session.isAuthenticated, unreadChatThreadCount, unreadNotificationCount]);

  if (!state) {
    return <LoadingScreen error={syncError} onRetry={() => void loadPlatform()} />;
  }

  const handleLogin = async () => {
    setSyncError(null);
    setIsSyncing(true);

    try {
      const payload = await loginAccount(loginForm);
      applyPlatformPayload(payload, {
        isAuthenticated: true,
        activeTab: "discover",
        selectedEventView: "overview",
        selectedPrivateChatId: null
      });
      setLoginForm(INITIAL_LOGIN_FORM);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo iniciar sesion.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRegister = async () => {
    if (registerForm.password !== registerForm.confirmPassword) {
      setSyncError("Las contrasenas no coinciden.");
      return;
    }

    setSyncError(null);
    setIsSyncing(true);

    try {
      const payload = await registerAccount({
        name: registerForm.name,
        handle: registerForm.handle,
        city: registerForm.city,
        bio: registerForm.bio,
        password: registerForm.password
      });
      applyPlatformPayload(payload, {
        isAuthenticated: true,
        activeTab: "discover",
        selectedEventView: "overview",
        selectedPrivateChatId: null
      });
      setLoginForm(INITIAL_LOGIN_FORM);
      setRegisterForm(INITIAL_REGISTER_FORM);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo crear la cuenta.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateCurrentUserAvatar = async (file: File | null) => {
    if (!file || !state?.session.currentUserId) {
      return;
    }

    setSyncError(null);
    setIsSyncing(true);

    try {
      const imageUrl = await uploadMediaFileForAction(file, "avatar");
      const payload = await executePlatformAction({
        type: "update-user-avatar",
        actorId: state.session.currentUserId,
        imageUrl
      });
      applyPlatformPayload(payload);
      setUiNotice("Foto de perfil actualizada.");
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudo actualizar la foto de perfil."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const rememberPushOnboardingChoice = (value: "dismissed" | "enabled") => {
    if (typeof window === "undefined" || !state?.session.isAuthenticated) {
      return;
    }

    window.localStorage.setItem(
      buildPushOnboardingStorageKey(state.session.currentUserId),
      value
    );
  };

  const handleEnablePushNotifications = async () => {
    setSyncError(null);
    setIsPushSyncing(true);

    try {
      const nextStatus = await enableWebPushNotifications();
      setWebPushStatus(nextStatus);
      rememberPushOnboardingChoice("enabled");
      setPushOnboardingVisible(false);
      setUiNotice("Notificaciones activadas.");
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudieron activar las notificaciones."
      );
    } finally {
      setIsPushSyncing(false);
    }
  };

  const handleDismissPushOnboarding = () => {
    rememberPushOnboardingChoice("dismissed");
    setPushOnboardingVisible(false);
  };

  const handleDisablePushNotifications = async () => {
    setSyncError(null);
    setIsPushSyncing(true);

    try {
      await disableWebPushNotifications();
      setWebPushStatus((current) => ({
        ...current,
        subscribed: false
      }));
      setUiNotice("Notificaciones desactivadas.");
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudieron desactivar las notificaciones."
      );
    } finally {
      setIsPushSyncing(false);
    }
  };

  if (!state.session.isAuthenticated) {
    return (
      <AuthScreen
        error={syncError}
        loginForm={loginForm}
        form={registerForm}
        isSubmitting={isSyncing}
        onChangeLoginForm={(patch) =>
          setLoginForm((current) => ({
            ...current,
            ...patch
          }))
        }
        onChangeForm={(patch) =>
          setRegisterForm((current) => ({
            ...current,
            ...patch
          }))
        }
        onLogin={() => void handleLogin()}
        onRegister={() => void handleRegister()}
      />
    );
  }

  const currentUser = getCurrentUser(state);
  const discoverEvents = getDiscoverFeedEvents(state, currentUser.id);
  const joinedEvents = getJoinedEvents(state, currentUser.id);
  const hostedEvents = getHostedEvents(state, currentUser.id);
  const hostPendingRequests = getHostPendingRequests(state, currentUser.id);
  const selectedEvent = state.events.find((item) => item.id === state.session.selectedEventId) ?? null;
  const filteredEvents = discoverEvents.filter((event) => {
    const matchesCategory = categoryFilter === "all" || event.category === categoryFilter;
    const haystack = `${event.title} ${event.city} ${event.venue} ${event.tags.join(" ")}`.toLowerCase();
    const matchesSearch = searchTerm.trim() === "" || haystack.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const discoverSelection =
    (selectedEvent &&
    (filteredEvents.some((item) => item.id === selectedEvent.id) ||
      discoverEvents.some((item) => item.id === selectedEvent.id) ||
      selectedEvent.visibility === "private")
      ? selectedEvent
      : null) ??
    pickEvent(filteredEvents, state.session.selectedEventId) ??
    pickEvent(discoverEvents, state.session.selectedEventId) ??
    discoverEvents[0] ??
    null;
  const discoverCollection = mergeEventIntoCollection(
    filteredEvents.length > 0 ? filteredEvents : discoverEvents,
    discoverSelection
  );
  const agendaSelection = pickEvent(joinedEvents, state.session.selectedEventId) ?? joinedEvents[0] ?? null;
  const privateChats = getPrivateChatsForUser(state, currentUser.id);
  const selectedPrivateChat =
    privateChats.find((chat) => chat.id === state.session.selectedPrivateChatId) ??
    privateChats[0] ??
    null;
  const friends = getFriends(state, currentUser.id);
  const friendSuggestions = getFriendSuggestions(state, currentUser.id);
  const feedPosts = getFeedPosts(state, currentUser.id);
  const activeStories = getActiveStories(state, currentUser.id);
  const pendingEventInvites = getPendingEventInvitesForUser(state, currentUser.id);
  const notifications = getNotificationsForUser(state, currentUser.id);
  const joinedCount = joinedEvents.length;
  const hostedCount = hostedEvents.length;
  const pendingApprovalsCount = hostPendingRequests.length;

  const updateSession = (patch: Partial<PersistedState["session"]>) => {
    setState((current) =>
      current
        ? normalizeState({
            ...current,
            session: {
              ...current.session,
              ...patch
            }
          })
        : current
    );
  };

  const navigateToTab = (tab: AppTab) => {
    setMobileEventScreen(null);
    setMobilePrivateChatOpen(false);
    setProfileDrilldown(null);
    setProfileFocusUserId(null);

    if (tab === "agenda") {
      updateSession({
        activeTab: "agenda",
        selectedEventId: agendaSelection?.id ?? null,
        selectedEventView: agendaSelection ? "chat" : "overview"
      });
      return;
    }

    if (tab === "discover") {
      updateSession({
        activeTab: "discover",
        selectedEventId: discoverSelection?.id ?? null,
        selectedEventView: "overview"
      });
      return;
    }

    updateSession({ activeTab: tab });
  };

  const openEvent = (eventId: string, tab: AppTab = state.session.activeTab) => {
    const shouldOpenChat = hasEventAccess(state, eventId, currentUser.id) || tab === "agenda";

    updateSession({
      selectedEventId: eventId,
      selectedEventView: shouldOpenChat ? "chat" : "overview",
      activeTab: tab
    });
    setMobileEventScreen({
      originTab: tab === "agenda" ? "agenda" : "discover"
    });
  };

  const openPrivateChat = (chatId: string) => {
    updateSession({
      activeTab: "inbox",
      selectedPrivateChatId: chatId
    });
    setMobilePrivateChatOpen(true);
  };

  const handleRequestEventAccess = async (eventId: string) => {
    await runPlatformMutation({
      type: "request-event-access",
      actorId: state.session.currentUserId,
      eventId
    });
  };

  const handleRespondEventAccess = async (membershipId: string, accept: boolean) => {
    await runPlatformMutation({
      type: "respond-event-access",
      actorId: state.session.currentUserId,
      membershipId,
      accept
    });
  };

  const handleToggleFriendship = async (targetUserId: string) => {
    await runPlatformMutation({
      type: "toggle-friendship",
      actorId: state.session.currentUserId,
      targetUserId
    });
  };

  const handleSendEventInvite = async (eventId: string, targetUserId: string) => {
    await runPlatformMutation({
      type: "send-event-invite",
      actorId: state.session.currentUserId,
      eventId,
      targetUserId
    });
  };

  const handleRespondEventInvite = async (inviteId: string, accept: boolean) => {
    const payload = await runPlatformMutation(
      {
        type: "respond-event-invite",
        actorId: state.session.currentUserId,
        inviteId,
        accept
      },
      accept
        ? {
            activeTab: "agenda",
            selectedEventView: "chat"
          }
        : undefined
    );

    if (accept) {
      const invite = pendingEventInvites.find((item) => item.id === inviteId);
      if (invite && payload) {
        applyPlatformPayload(payload, {
          activeTab: "agenda",
          selectedEventId: invite.eventId,
          selectedEventView: "chat"
        });
        setMobileEventScreen({ originTab: "agenda" });
      }
    }
  };

  const handleLeaveEvent = async (eventId: string) => {
    const nextTab =
      getJoinedEvents(state, state.session.currentUserId).filter((event) => event.id !== eventId)
        .length > 0
        ? "agenda"
        : "discover";

    await runPlatformMutation(
      {
        type: "leave-event",
        actorId: state.session.currentUserId,
        eventId
      },
      {
        activeTab: nextTab,
        selectedEventId: null,
        selectedEventView: nextTab === "agenda" ? "chat" : "overview"
      }
    );
  };

  const handleSendGroupMessage = async (eventId: string) => {
    const message = groupDrafts[eventId] ?? "";
    const nextText = buildReplyMessageText(message, groupReplyTargets[eventId] ?? null);
    if (!nextText.trim() || isSendingGroupMessageByEvent[eventId]) {
      return;
    }

    const optimisticMessage = buildOptimisticChatMessage(state.session.currentUserId, nextText);
    const currentReplyTarget = groupReplyTargets[eventId] ?? null;
    setGroupDrafts((current) => ({ ...current, [eventId]: "" }));
    setGroupReplyTargets((current) => ({ ...current, [eventId]: null }));
    setPendingGroupMessages((current) => ({
      ...current,
      [eventId]: [...(current[eventId] ?? []), optimisticMessage]
    }));
    setIsSendingGroupMessageByEvent((current) => ({ ...current, [eventId]: true }));

    const payload = await runPlatformActionQuietly({
      type: "send-group-message",
      actorId: state.session.currentUserId,
      eventId,
      text: nextText
    });

    setPendingGroupMessages((current) => ({
      ...current,
      [eventId]: (current[eventId] ?? []).filter(
        (messageEntry) => messageEntry.clientId !== optimisticMessage.clientId
      )
    }));
    setIsSendingGroupMessageByEvent((current) => ({ ...current, [eventId]: false }));

    if (!payload) {
      setGroupDrafts((current) => ({ ...current, [eventId]: message }));
      setGroupReplyTargets((current) => ({ ...current, [eventId]: currentReplyTarget }));
    }
  };

  const handleSendPrivateRequest = async (eventId: string, targetUserId: string) => {
    const draftKey = `${eventId}:${targetUserId}`;
    const message =
      requestDrafts[draftKey] ||
      `Hola. Me apetece conocerte mejor antes de ${getEventById(state, eventId)?.title}. Si te cuadra, abrimos chat privado.`;

    const payload = await runPlatformMutation({
      type: "send-private-request",
      actorId: state.session.currentUserId,
      eventId,
      targetUserId,
      message
    });

    if (payload) {
      setRequestDrafts((current) => ({ ...current, [draftKey]: "" }));
    }
  };

  const handleRespondPrivateRequest = async (requestId: string, accept: boolean) => {
    await runPlatformMutation(
      {
        type: "respond-private-request",
        actorId: state.session.currentUserId,
        requestId,
        accept
      },
      accept
        ? {
            activeTab: "inbox",
            selectedPrivateChatId: null
          }
        : undefined
    );
  };

  const handleStartFriendChat = async (targetUserId: string) => {
    const payload = await runPlatformMutation(
      {
        type: "start-friend-chat",
        actorId: state.session.currentUserId,
        targetUserId
      },
      {
        activeTab: "inbox"
      }
    );

    if (!payload) {
      return;
    }

    const nextData = extractPlatformData(payload);
    const nextChat =
      nextData.privateChats.find(
        (chat) => !isGroupChat(chat) && chat.participantIds.includes(targetUserId)
      ) ?? null;

    applyPlatformPayload(payload, {
      activeTab: "inbox",
      selectedPrivateChatId: nextChat?.id ?? state.session.selectedPrivateChatId
    });
    setMobilePrivateChatOpen(Boolean(nextChat));
  };

  const handleCreateGroupChat = async () => {
    if (!groupChatComposer) {
      return;
    }

    const payload = await runPlatformMutation(
      {
        type: "create-group-chat",
        actorId: state.session.currentUserId,
        title: groupChatComposer.title,
        participantIds: groupChatComposer.participantIds
      },
      {
        activeTab: "inbox"
      }
    );

    if (!payload) {
      return;
    }

    const nextData = extractPlatformData(payload);
    const nextChat =
      nextData.privateChats
        .filter((chat) => isGroupChat(chat) && chat.ownerId === state.session.currentUserId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

    applyPlatformPayload(payload, {
      activeTab: "inbox",
      selectedPrivateChatId: nextChat?.id ?? state.session.selectedPrivateChatId
    });
    setGroupChatComposer(null);
    setMobilePrivateChatOpen(Boolean(nextChat));
    setUiNotice("Grupo creado.");
  };

  const handleSendPrivateMessage = async () => {
    if (
      !selectedPrivateChat ||
      !privateDraft.trim() ||
      isSendingPrivateMessageChatId === selectedPrivateChat.id
    ) {
      return;
    }

    const nextText = buildReplyMessageText(privateDraft, privateReplyTarget);
    const chatId = selectedPrivateChat.id;
    const optimisticMessage = buildOptimisticChatMessage(state.session.currentUserId, nextText);
    const currentDraft = privateDraft;
    const currentReplyTarget = privateReplyTarget;

    setPrivateDraft("");
    setPrivateReplyTarget(null);
    setPendingPrivateMessages((current) => ({
      ...current,
      [chatId]: [...(current[chatId] ?? []), optimisticMessage]
    }));
    setIsSendingPrivateMessageChatId(chatId);

    const payload = await runPlatformActionQuietly({
      type: "send-private-message",
      actorId: state.session.currentUserId,
      chatId,
      text: nextText
    });

    setPendingPrivateMessages((current) => ({
      ...current,
      [chatId]: (current[chatId] ?? []).filter(
        (messageEntry) => messageEntry.clientId !== optimisticMessage.clientId
      )
    }));
    setIsSendingPrivateMessageChatId((current) => (current === chatId ? null : current));

    if (!payload) {
      setPrivateDraft(currentDraft);
      setPrivateReplyTarget(currentReplyTarget);
    }
  };

  const handleSendPrivateMediaMessage = async (chatId: string, file: File | null) => {
    if (!file || isSendingPrivateMediaChatId === chatId) {
      return;
    }

    setIsSendingPrivateMediaChatId(chatId);
    try {
      const imageUrl = await uploadMediaFileForAction(file, "chat");
      const payload = await runPlatformActionQuietly({
        type: "send-private-media-message",
        actorId: state.session.currentUserId,
        chatId,
        imageUrl,
        caption: "",
        viewOnce: true
      });

      if (payload) {
        setUiNotice("Foto efimera enviada.");
      }
    } catch (error) {
      setUiNotice(error instanceof Error ? error.message : "No se pudo enviar la foto.");
    } finally {
      setIsSendingPrivateMediaChatId((current) => (current === chatId ? null : current));
    }
  };

  const handleSendEventMediaMessage = async (eventId: string, file: File | null) => {
    if (!file || isSendingGroupMediaEventId === eventId) {
      return;
    }

    setIsSendingGroupMediaEventId(eventId);
    try {
      const imageUrl = await uploadMediaFileForAction(file, "chat");
      const payload = await runPlatformActionQuietly({
        type: "send-group-media-message",
        actorId: state.session.currentUserId,
        eventId,
        imageUrl,
        caption: "",
        viewOnce: true
      });

      if (payload) {
        setUiNotice("Foto efimera enviada al chat.");
      }
    } catch (error) {
      setUiNotice(error instanceof Error ? error.message : "No se pudo enviar la foto.");
    } finally {
      setIsSendingGroupMediaEventId((current) => (current === eventId ? null : current));
    }
  };

  const handleSetEventChatMode = async (eventId: string, mode: "open" | "announcements") => {
    const payload = await runPlatformMutation({
      type: "set-event-chat-mode",
      actorId: state.session.currentUserId,
      eventId,
      mode
    });

    if (payload) {
      setUiNotice(
        mode === "announcements"
          ? "Chat cerrado: solo escribe el organizador."
          : "Chat reabierto para todos."
      );
    }
  };

  const handleOpenChatMedia = async (
    messageId: string,
    authorId: string,
    authorLabel: string,
    media: ChatMediaAttachment
  ) => {
    if (isChatMediaExpired(media.expiresAt)) {
      setUiNotice("Esta foto ya ha caducado.");
      return;
    }

    const mine = authorId === state.session.currentUserId;
    const alreadyViewed = hasViewedMessageMedia(state, messageId, state.session.currentUserId);

    if (!mine && alreadyViewed) {
      setUiNotice("Esta foto ya se abrio y no puede volver a verse.");
      return;
    }

    if (!mine) {
      await runPlatformMutation({
        type: "mark-chat-media-viewed",
        actorId: state.session.currentUserId,
        messageId
      });
    }

    setChatMediaViewer({
      authorLabel,
      caption: media.caption,
      imageUrl: media.imageUrl,
      messageId,
      title: mine ? "Tu foto efimera" : `Foto de ${authorLabel}`
    });
  };

  const handleCreateUserPost = async (draft: MediaDraft = profileMediaDraft) => {
    if (!draft.imageUrl.trim()) {
      return;
    }

    const payload = await runPlatformMutation({
      type: "create-user-post",
      actorId: state.session.currentUserId,
      imageUrl: draft.imageUrl,
      caption: draft.caption
    });

    if (payload && draft === profileMediaDraft) {
      setProfileMediaDraft({ imageUrl: "", caption: "" });
    }
  };

  const handleCreateUserStory = async (draft: MediaDraft = profileStoryDraft) => {
    if (!draft.imageUrl.trim()) {
      return;
    }

    const payload = await runPlatformMutation({
      type: "create-user-story",
      actorId: state.session.currentUserId,
      imageUrl: draft.imageUrl,
      caption: draft.caption
    });

    if (payload && draft === profileStoryDraft) {
      setProfileStoryDraft({ imageUrl: "", caption: "" });
    }
  };

  const handleCreateEventPost = async (
    eventId: string,
    draftOverride?: { imageUrl: string; caption: string }
  ) => {
    const draft = draftOverride ?? eventMediaDrafts[eventId];
    if (!draft?.imageUrl.trim()) {
      return;
    }

    const payload = await runPlatformMutation({
      type: "create-event-post",
      actorId: state.session.currentUserId,
      eventId,
      imageUrl: draft.imageUrl,
      caption: draft.caption
    });

    if (payload && !draftOverride) {
      setEventMediaDrafts((current) => ({
        ...current,
        [eventId]: { imageUrl: "", caption: "" }
      }));
    }
  };

  const handleCreateEventStory = async (
    eventId: string,
    draftOverride?: { imageUrl: string; caption: string }
  ) => {
    const draft = draftOverride ?? eventMediaDrafts[eventId];
    if (!draft?.imageUrl.trim()) {
      return;
    }

    const payload = await runPlatformMutation({
      type: "create-event-story",
      actorId: state.session.currentUserId,
      eventId,
      imageUrl: draft.imageUrl,
      caption: draft.caption
    });

    if (payload && !draftOverride) {
      setEventMediaDrafts((current) => ({
        ...current,
        [eventId]: { imageUrl: "", caption: "" }
      }));
    }
  };

  const handleMarkThreadRead = async (scope: "event" | "private", targetId: string) => {
    await runPlatformMutation({
      type: "mark-thread-read",
      actorId: state.session.currentUserId,
      scope,
      targetId
    });
  };

  const handleMarkStoryViewed = async (storyId: string) => {
    await runPlatformMutation({
      type: "mark-story-viewed",
      actorId: state.session.currentUserId,
      storyId
    });
  };

  const handleMarkAllNotificationsRead = async () => {
    await runPlatformMutation({
      type: "mark-all-notifications-read",
      actorId: state.session.currentUserId
    });
  };

  const handleOpenNotification = async (notificationId: string) => {
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification) {
      return;
    }

    await runPlatformMutation({
      type: "mark-notification-read",
      actorId: state.session.currentUserId,
      notificationId
    });

    setNotificationCenterOpen(false);

    if (notification.chatId) {
      openPrivateChat(notification.chatId);
      return;
    }

    if (notification.eventId) {
      const tab = hasEventAccess(state, notification.eventId, currentUser.id) ? "agenda" : "discover";
      openEvent(notification.eventId, tab);
      return;
    }

    if (notification.fromUserId) {
      openProfileUser(notification.fromUserId);
    }
  };

  const handleSaveMediaEdit = async () => {
    if (!mediaEditor || isSavingMediaEdit) {
      return;
    }

    let action: PlatformAction;

    if (mediaEditor.scope === "user" && mediaEditor.kind === "post") {
      action = {
        type: "update-user-post",
        actorId: state.session.currentUserId,
        postId: mediaEditor.id,
        caption: mediaEditor.caption
      };
    } else if (mediaEditor.scope === "user" && mediaEditor.kind === "story") {
      action = {
        type: "update-user-story",
        actorId: state.session.currentUserId,
        storyId: mediaEditor.id,
        caption: mediaEditor.caption
      };
    } else if (mediaEditor.scope === "event" && mediaEditor.kind === "post") {
      action = {
        type: "update-event-post",
        actorId: state.session.currentUserId,
        eventId: mediaEditor.eventId,
        postId: mediaEditor.id,
        caption: mediaEditor.caption
      };
    } else {
      action = {
        type: "update-event-story",
        actorId: state.session.currentUserId,
        eventId: mediaEditor.eventId,
        storyId: mediaEditor.id,
        caption: mediaEditor.caption
      };
    }

    setIsSavingMediaEdit(true);
    const payload = await runPlatformMutation(action);
    setIsSavingMediaEdit(false);
    if (payload) {
      setMediaEditor(null);
      setUiNotice(mediaEditor.kind === "story" ? "Historia actualizada." : "Publicacion actualizada.");
    }
  };

  const handleDeleteMedia = async () => {
    if (!mediaEditor || isDeletingMedia) {
      return;
    }

    let action: PlatformAction;

    if (mediaEditor.scope === "user" && mediaEditor.kind === "post") {
      action = {
        type: "delete-user-post",
        actorId: state.session.currentUserId,
        postId: mediaEditor.id
      };
    } else if (mediaEditor.scope === "user" && mediaEditor.kind === "story") {
      action = {
        type: "delete-user-story",
        actorId: state.session.currentUserId,
        storyId: mediaEditor.id
      };
    } else if (mediaEditor.scope === "event" && mediaEditor.kind === "post") {
      action = {
        type: "delete-event-post",
        actorId: state.session.currentUserId,
        eventId: mediaEditor.eventId,
        postId: mediaEditor.id
      };
    } else {
      action = {
        type: "delete-event-story",
        actorId: state.session.currentUserId,
        eventId: mediaEditor.eventId,
        storyId: mediaEditor.id
      };
    }

    setIsDeletingMedia(true);
    const payload = await runPlatformMutation(action);
    setIsDeletingMedia(false);
    if (payload) {
      if (storyViewer?.activeStoryId === mediaEditor.id) {
        setStoryViewer(null);
      }
      setMediaEditor(null);
      setUiNotice(mediaEditor.kind === "story" ? "Historia eliminada." : "Publicacion eliminada.");
    }
  };

  const handleSwitchUser = (userId: string) => {
    setState((current) =>
      current
        ? normalizeState({
            ...current,
            session: {
              ...current.session,
              isAuthenticated: true,
              currentUserId: userId,
              selectedEventId: null,
              selectedPrivateChatId: null
            }
          })
        : current
    );
    setMobileEventScreen(null);
    setMobilePrivateChatOpen(false);
    setProfileDrilldown(null);
    setProfileFocusUserId(null);
    setStoryViewer(null);
    setStoryReplyDraft("");
    setPrivateReplyTarget(null);
    setNotificationCenterOpen(false);
    setMediaEditor(null);
  };

  const handleLogout = async () => {
    setSyncError(null);
    setIsSyncing(true);

    try {
      await disableWebPushNotifications().catch(() => undefined);
      await logoutAccount();
      await loadPlatform({
        isAuthenticated: false,
        currentUserId: "",
        activeTab: "discover",
        selectedEventId: null,
        selectedEventView: "overview",
        selectedPrivateChatId: null
      });
      setLoginForm(INITIAL_LOGIN_FORM);
      setRegisterForm(INITIAL_REGISTER_FORM);
      setWebPushStatus((current) => ({
        ...current,
        subscribed: false
      }));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No se pudo cerrar sesion.");
    } finally {
      setIsSyncing(false);
    }

    setMobileEventScreen(null);
    setMobilePrivateChatOpen(false);
    setStoryViewer(null);
    setProfileDrilldown(null);
    setProfileFocusUserId(null);
    setNotificationCenterOpen(false);
    setMediaEditor(null);
  };

  const handleCreateEvent = async (input: CreateEventInput) => {
    setSyncError(null);
    setIsSyncing(true);

    try {
      const payload = await executePlatformAction({
        type: "create-event",
        actorId: state.session.currentUserId,
        input
      });

      applyPlatformPayload(payload, {
        activeTab: "agenda",
        selectedEventId: payload.meta?.selectedEventId ?? null,
        selectedEventView: "chat"
      });
      setMobileEventScreen({ originTab: "agenda" });
      setUiNotice("Evento creado. Ya puedes entrar en su chat.");
      return true;
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudo crear el evento."
      );
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const runPlatformActionQuietly = async (
    action: PlatformAction,
    sessionPatch?: Partial<PersistedState["session"]>
  ) => {
    setSyncError(null);

    try {
      const payload = await executePlatformAction(action);
      applyPlatformPayload(payload, sessionPatch);
      return payload;
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudo guardar la accion en backend."
      );
      return null;
    }
  };

  const handleResetDemo = async () => {
    setSyncError(null);
    setIsSyncing(true);

    try {
      const payload = await resetPlatformData();
      applyPlatformPayload(payload, {
        isAuthenticated: false,
        currentUserId: "",
        activeTab: "discover",
        selectedEventId: null,
        selectedEventView: "overview",
        selectedPrivateChatId: null
      });
      setSearchTerm("");
      setCategoryFilter("all");
      setGroupDrafts({});
      setRequestDrafts({});
      setSelectedAttendeeByEvent({});
      setPrivateDraft("");
      setProfileMediaDraft({ imageUrl: "", caption: "" });
      setProfileStoryDraft({ imageUrl: "", caption: "" });
      setEventMediaDrafts({});
      setStoryViewer(null);
      setStoryReplyDraft("");
      setCameraComposer(null);
      setNotificationCenterOpen(false);
      setMediaEditor(null);
      setMobileEventScreen(null);
      setMobilePrivateChatOpen(false);
      setProfileDrilldown(null);
      setProfileFocusUserId(null);
      setGroupReplyTargets({});
      setPrivateReplyTarget(null);
      setUiNotice("Datos vaciados.");
      setLoginForm(INITIAL_LOGIN_FORM);
      setRegisterForm(INITIAL_REGISTER_FORM);
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudieron vaciar los datos."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const togglePostLike = (postId: string) => {
    const likeKey = buildPostLikeKey(currentUser.id, postId);
    setLikedPostKeys((current) =>
      current.includes(likeKey)
        ? current.filter((item) => item !== likeKey)
        : [...current, likeKey]
    );
  };

  const openStoryViewer = (storyId: string, sourceStories: StoryItem[]) => {
    setStoryViewer({
      activeStoryId: storyId,
      storyIds: buildStorySequence(sourceStories, storyId)
    });
    setStoryReplyDraft("");
  };

  const closeStoryViewer = () => {
    setStoryViewer(null);
    setStoryReplyDraft("");
  };

  const moveStoryViewer = (direction: "next" | "prev") => {
    setStoryViewer((current) => {
      if (!current) {
        return current;
      }

      const currentIndex = current.storyIds.findIndex((storyId) => storyId === current.activeStoryId);
      if (currentIndex === -1) {
        return current;
      }

      if (direction === "next") {
        const nextStoryId = current.storyIds[currentIndex + 1];
        if (!nextStoryId) {
          return null;
        }

        return {
          ...current,
          activeStoryId: nextStoryId
        };
      }

      const previousStoryId = current.storyIds[currentIndex - 1];
      if (!previousStoryId) {
        return current;
      }

      return {
        ...current,
        activeStoryId: previousStoryId
      };
    });
  };

  const openCameraComposer = (draft?: Partial<CameraComposerState>) => {
    const selectedEventForCamera =
      state.session.selectedEventId !== null
        ? getEventById(state, state.session.selectedEventId)
        : null;
    const canPostAsSelectedEvent = Boolean(
      selectedEventForCamera && selectedEventForCamera.hostId === currentUser.id
    );

    setCameraComposer({
      ...CAMERA_COMPOSER_INITIAL_STATE,
      target: canPostAsSelectedEvent ? "event" : "user",
      eventId: canPostAsSelectedEvent ? selectedEventForCamera?.id ?? null : null,
      ...draft
    });
  };

  const closeCameraComposer = () => {
    if (cameraComposer?.imageUrl) {
      revokePreviewUrlIfNeeded(cameraComposer.imageUrl);
    }
    setCameraComposer(null);
  };

  const handleCameraFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      const media = await readComposerMedia(file);
      if (media.mediaType === "video" && (media.durationMs ?? 0) > STORY_MAX_VIDEO_MS) {
        revokePreviewUrlIfNeeded(media.imageUrl);
        setUiNotice("El video para historia no puede durar mas de 20 segundos.");
        return;
      }

      setCameraComposer((current) => {
        if (!current) {
          revokePreviewUrlIfNeeded(media.imageUrl);
          return current;
        }

        revokePreviewUrlIfNeeded(current.imageUrl);
        return {
          ...current,
          durationMs: media.durationMs,
          imageUrl: media.imageUrl,
          mediaType: media.mediaType,
          mode: media.mediaType === "video" ? "story" : current.mode,
          pendingFile: media.pendingFile
        };
      });
    } catch {
      setUiNotice("No se pudo leer ese archivo.");
    }
  };

  const submitCameraComposer = async () => {
    if (!cameraComposer?.imageUrl) {
      return;
    }

    const taggedUsers = state.users.filter((user) =>
      cameraComposer.taggedUserIds.includes(user.id)
    );
    const caption = appendTaggedHandles(cameraComposer.caption, taggedUsers);
    if (cameraComposer.mediaType === "video" && cameraComposer.mode !== "story") {
      setUiNotice("Los videos se publican como historias.");
      return;
    }

    const uploadedImageUrl = cameraComposer.pendingFile
      ? await uploadMediaFileForAction(
          cameraComposer.pendingFile,
          cameraComposer.mode === "story" ? "story" : "post"
        )
      : cameraComposer.imageUrl;
    const mediaDraft = {
      durationMs: cameraComposer.durationMs,
      imageUrl: uploadedImageUrl,
      caption,
      mediaType: cameraComposer.mediaType,
      pendingFile: null
    };

    if (cameraComposer.target === "event" && cameraComposer.eventId) {
      if (cameraComposer.mode === "story") {
        await handleCreateEventStory(cameraComposer.eventId, mediaDraft);
      } else {
        await handleCreateEventPost(cameraComposer.eventId, mediaDraft);
      }
    } else if (cameraComposer.mode === "story") {
      await handleCreateUserStory(mediaDraft);
    } else {
      await handleCreateUserPost(mediaDraft);
    }

    revokePreviewUrlIfNeeded(cameraComposer.imageUrl);
    setCameraComposer(null);
    setUiNotice(cameraComposer.mode === "story" ? "Historia publicada." : "Publicacion subida.");
  };

  const closeMobileEventScreen = () => {
    if (state.session.selectedEventView !== "chat") {
      updateSession({ selectedEventView: "chat" });
      return;
    }

    setMobileEventScreen(null);
  };

  const openProfileDrilldown = (detail: ProfileDrilldown) => {
    setProfileDrilldown(detail);
  };

  const openProfileUser = (userId: string) => {
    setProfileFocusUserId(userId);
  };

  const closeProfileFocus = () => {
    setProfileFocusUserId(null);
  };

  const closeProfileDrilldown = () => {
    setProfileDrilldown(null);
  };

  const handleStoryReply = async (message: string, reaction?: string) => {
    if (!storyViewer || isSendingStoryReply) {
      return false;
    }

    const story = state.stories.find((item) => item.id === storyViewer.activeStoryId);
    if (!story) {
      return false;
    }

    const normalizedMessage = message.trim();
    const normalizedReaction = reaction?.trim() ?? "";
    const mode =
      normalizedMessage.length > 0 ? "comment" : normalizedReaction.length > 0 ? "reaction" : null;
    const storyPayload =
      mode === "comment"
        ? buildStoryMessageText(story.id, "comment", normalizedMessage)
        : mode === "reaction"
          ? buildStoryMessageText(story.id, "reaction", normalizedReaction)
          : "";

    if (!storyPayload || !mode) {
      return false;
    }

    setIsSendingStoryReply(true);

    if (story.authorType === "event") {
      if (!hasEventAccess(state, story.authorId, currentUser.id)) {
        setUiNotice("Entra al evento para responder a su historia.");
        setIsSendingStoryReply(false);
        return false;
      }

      const payload = await runPlatformActionQuietly({
        type: "send-group-message",
        actorId: state.session.currentUserId,
        eventId: story.authorId,
        text: storyPayload
      });
      if (payload) {
        setStoryReplyDraft("");
        setUiNotice("Respuesta enviada al chat del evento.");
      }
      setIsSendingStoryReply(false);
      return Boolean(payload);
    }

    if (story.authorId === currentUser.id) {
      setIsSendingStoryReply(false);
      return false;
    }

    const existingChat =
      state.privateChats.find(
        (chat) =>
          !isGroupChat(chat) &&
          chat.participantIds.includes(currentUser.id) && chat.participantIds.includes(story.authorId)
      ) ?? null;

    if (existingChat) {
      const payload = await runPlatformActionQuietly({
        type: "send-private-message",
        actorId: state.session.currentUserId,
        chatId: existingChat.id,
        text: storyPayload
      });
      if (payload) {
        setStoryReplyDraft("");
        setUiNotice("Mensaje enviado por privado.");
      }
      setIsSendingStoryReply(false);
      return Boolean(payload);
    }

    const sharedEvent = state.events.find(
      (event) =>
        hasEventAccess(state, event.id, currentUser.id) && hasEventAccess(state, event.id, story.authorId)
    );

    if (!sharedEvent) {
      setUiNotice("Todavia no compartis evento para abrir privado.");
      setIsSendingStoryReply(false);
      return false;
    }

    const payload = await runPlatformActionQuietly({
      type: "send-private-request",
      actorId: state.session.currentUserId,
      eventId: sharedEvent.id,
      targetUserId: story.authorId,
      message:
        mode === "reaction"
          ? `Quiero abrir privado contigo. Reaccione a tu historia con "${normalizedReaction}".`
          : `Quiero abrir privado contigo. Te comente tu historia: "${normalizedMessage}".`
    });
    if (payload) {
      setStoryReplyDraft("");
      setUiNotice("Solicitud privada enviada desde la historia.");
    }
    setIsSendingStoryReply(false);
    return Boolean(payload);
  };

  const handleOpenDirectChatComposerChat = async (targetUserId: string) => {
    const existingChat =
      privateChats.find(
        (chat) => !isGroupChat(chat) && chat.participantIds.includes(targetUserId)
      ) ?? null;

    setDirectChatComposerOpen(false);

    if (existingChat) {
      openPrivateChat(existingChat.id);
      return;
    }

    await handleStartFriendChat(targetUserId);
  };

  const focusedProfileUser =
    profileFocusUserId && profileFocusUserId !== currentUser.id
      ? getUserById(state, profileFocusUserId)
      : null;
  const activeStory =
    storyViewer &&
    storyViewer.storyIds.length > 0
      ? state.stories.find((story) => story.id === storyViewer.activeStoryId) ?? null
      : null;

  const shouldHideMobileNavigation = Boolean(
    storyViewer ||
      chatMediaViewer ||
      cameraComposer ||
      groupChatComposer ||
      directChatComposerOpen ||
      notificationCenterOpen ||
      mediaEditor ||
      mobileEventScreen ||
      mobilePrivateChatOpen ||
      profileDrilldown ||
      focusedProfileUser
  );

  return (
    <div className="min-h-screen bg-[#f6efe7] text-[#1d160f]">
      <ThreadReadEffects
        activeTab={state.session.activeTab}
        currentUserId={currentUser.id}
        onMarkThreadRead={handleMarkThreadRead}
        selectedEvent={selectedEvent}
        selectedEventView={state.session.selectedEventView}
        selectedPrivateChat={selectedPrivateChat}
        state={state}
      />

      {pushOnboardingVisible ? (
        <PushNotificationsPrompt
          isLoading={isPushSyncing}
          needsStandaloneInstall={webPushStatus.needsStandaloneInstall}
          onDismiss={handleDismissPushOnboarding}
          onEnable={() => void handleEnablePushNotifications()}
        />
      ) : null}

      <div className="md:hidden">
        <MobileAppShell
          activeStory={activeStory}
          cameraComposer={cameraComposer}
          closeCameraComposer={closeCameraComposer}
          closeMobileEventScreen={closeMobileEventScreen}
          closePrivateChat={() => setMobilePrivateChatOpen(false)}
          closeProfileDrilldown={closeProfileDrilldown}
          closeProfileFocus={closeProfileFocus}
          closeStoryViewer={closeStoryViewer}
          currentUser={currentUser}
          eventListMode={eventListMode}
          focusedProfileUser={focusedProfileUser}
          friendSuggestions={friendSuggestions}
          friends={friends}
          groupDrafts={groupDrafts}
          groupReplyTargets={groupReplyTargets}
          hostedCount={hostedCount}
          isSyncing={isSyncing}
          joinedCount={joinedCount}
          likedPostKeys={likedPostKeys}
          mobileEventScreen={mobileEventScreen}
          mobilePrivateChatOpen={mobilePrivateChatOpen}
          onChangeEventListMode={setEventListMode}
          onChangeEventView={(view) => updateSession({ selectedEventView: view })}
          onChangeGroupDraft={(eventId, value) =>
            setGroupDrafts((current) => ({ ...current, [eventId]: value }))
          }
          onChangePrivateDraft={setPrivateDraft}
          onCreateGroupChat={() => setGroupChatComposer(GROUP_CHAT_COMPOSER_INITIAL_STATE)}
          onCreateEvent={handleCreateEvent}
          onGoToCreate={() => navigateToTab("host")}
          onMarkAllNotificationsRead={() => void handleMarkAllNotificationsRead()}
          onMarkStoryViewed={(storyId) => void handleMarkStoryViewed(storyId)}
          onOpenNotification={(notificationId) => void handleOpenNotification(notificationId)}
          onOpenNotifications={() => navigateToTab("search")}
          onOpenDirectChatComposer={() => setDirectChatComposerOpen(true)}
          onOpenProfileTab={() => navigateToTab("profile")}
          onOpenChatMedia={(messageId, authorId, authorLabel, media) =>
            void handleOpenChatMedia(messageId, authorId, authorLabel, media)
          }
          onUpdateAvatar={(file) => void handleUpdateCurrentUserAvatar(file)}
          onEnablePushNotifications={() => void handleEnablePushNotifications()}
          onDisablePushNotifications={() => void handleDisablePushNotifications()}
          onOpenCamera={openCameraComposer}
          onOpenEvent={(eventId, tab) => openEvent(eventId, tab)}
          onOpenPrivateChat={openPrivateChat}
          onOpenProfileDrilldown={openProfileDrilldown}
          onOpenProfileUser={openProfileUser}
          onOpenStory={openStoryViewer}
          onMoveStory={moveStoryViewer}
          onLogout={() => void handleLogout()}
          onReplyGroupMessage={(eventId, replyTarget) =>
            setGroupReplyTargets((current) => ({ ...current, [eventId]: replyTarget }))
          }
          onReplyPrivateMessage={setPrivateReplyTarget}
          onRespondEventAccess={handleRespondEventAccess}
          onRespondEventInvite={(inviteId, accept) => void handleRespondEventInvite(inviteId, accept)}
          onRespondPrivateRequest={handleRespondPrivateRequest}
          onRequestEventAccess={handleRequestEventAccess}
          onResetDemo={() => void handleResetDemo()}
          onSendGroupMessage={handleSendGroupMessage}
          onSendGroupMediaMessage={(eventId, file) => void handleSendEventMediaMessage(eventId, file)}
          onSendPrivateMessage={() => void handleSendPrivateMessage()}
          onSendPrivateMediaMessage={(chatId, file) => void handleSendPrivateMediaMessage(chatId, file)}
          onSendPrivateRequest={handleSendPrivateRequest}
          onSendStoryReply={handleStoryReply}
          onStartFriendChat={(targetUserId) => void handleStartFriendChat(targetUserId)}
          onSubmitCameraComposer={() => void submitCameraComposer()}
          onToggleEventChatMode={(eventId, mode) => void handleSetEventChatMode(eventId, mode)}
          onToggleFriendship={(targetUserId) => void handleToggleFriendship(targetUserId)}
          onTogglePostLike={togglePostLike}
          onUpdateCameraComposer={setCameraComposer}
          onUploadCameraFile={handleCameraFileChange}
          pendingApprovalsCount={pendingApprovalsCount}
          pendingEventInvites={pendingEventInvites}
          isPushSyncing={isPushSyncing}
          notifications={notifications}
          notificationCenterOpen={notificationCenterOpen}
          privateChats={privateChats}
          privateDraft={privateDraft}
          privateReplyTarget={privateReplyTarget}
          profileDrilldown={profileDrilldown}
          searchTerm={searchTerm}
          selectedChat={selectedPrivateChat}
          selectedEvent={getEventById(state, state.session.selectedEventId)}
          setSearchTerm={setSearchTerm}
          setStoryReplyDraft={setStoryReplyDraft}
          state={state}
          storyReplyDraft={storyReplyDraft}
          storyViewer={storyViewer}
          unreadChatThreadCount={unreadChatThreadCount}
          unreadNotificationCount={unreadNotificationCount}
          uiNotice={uiNotice}
          webPushStatus={webPushStatus}
          mediaEditor={mediaEditor}
          onCloseMediaEditor={() => setMediaEditor(null)}
          onCloseNotifications={() => setNotificationCenterOpen(false)}
          onDeleteMedia={() => void handleDeleteMedia()}
          onOpenMediaEditor={setMediaEditor}
          onSaveMediaEdit={() => void handleSaveMediaEdit()}
          setMediaEditor={setMediaEditor}
          pendingGroupMessages={pendingGroupMessages}
          pendingPrivateMessages={pendingPrivateMessages}
          isDeletingMedia={isDeletingMedia}
          isSavingMediaEdit={isSavingMediaEdit}
          isSendingGroupMediaEventId={isSendingGroupMediaEventId}
          isSendingGroupMessageByEvent={isSendingGroupMessageByEvent}
          isSendingPrivateMediaChatId={isSendingPrivateMediaChatId}
          isSendingPrivateMessageChatId={isSendingPrivateMessageChatId}
          isSendingStoryReply={isSendingStoryReply}
          syncError={syncError}
        />
      </div>

      <div className="hidden md:block">
        <main className="mx-auto max-w-[1240px] px-4 pb-16 pt-6 md:px-6">
        <header className="hidden flex-wrap items-center justify-between gap-4">
          <BrandMark />
          {/*
          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-[#eadfd3] bg-white/88 px-4 py-2 text-sm text-[#6d5749] md:block">
              <span>
                {joinedCount} grupos - {hostedCount} creados - {pendingApprovalsCount} por revisar
              <span>{hostedCount} creados Â· {pendingApprovalsCount} por revisar</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white/88 px-4 py-2 text-sm font-semibold text-[#5f4b3f] shadow-[0_10px_24px_rgba(52,34,22,0.06)]"
              onClick={() => void handleResetDemo()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Vaciar datos
            </button>
          </div>
          */}
          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-[#eadfd3] bg-white/88 px-4 py-2 text-sm text-[#6d5749] md:block">
              <span>
                {joinedCount} grupos - {hostedCount} creados - {pendingApprovalsCount} por revisar
              </span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white/88 px-4 py-2 text-sm font-semibold text-[#5f4b3f] shadow-[0_10px_24px_rgba(52,34,22,0.06)]"
              onClick={() => void handleResetDemo()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Vaciar datos
            </button>
          </div>
        </header>

        <DesktopNavigation activeTab={state.session.activeTab} onChange={navigateToTab} />

        <SyncStatus
          error={syncError}
          isRealtimeConnected={isRealtimeConnected}
          isSyncing={isSyncing}
        />

        {state.session.activeTab === "discover" ? (
          <div className="space-y-5">
            <SocialHomeSection
              currentUser={currentUser}
              onOpenEvent={(eventId) => openEvent(eventId, "discover")}
              onOpenProfileUser={openProfileUser}
              onRespondEventInvite={handleRespondEventInvite}
              pendingEventInvites={pendingEventInvites}
              posts={feedPosts}
              state={state}
              stories={activeStories}
            />

            <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                    Explorar eventos
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                    Feed de eventos que puedes abrir o pedir acceso
                  </h1>
                </div>
                <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                  {filteredEvents.length} visibles para ti
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                <label className="flex-1 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                    Buscar
                  </span>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-[#8f6f59]" />
                    <input
                      className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Madrid, rooftop, brunch..."
                      value={searchTerm}
                    />
                  </div>
                </label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_CATEGORY_OPTIONS.map((option) => {
                    const active = categoryFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        className={`rounded-full border px-4 py-3 text-sm font-semibold transition ${
                          active
                            ? "border-[#ffb493] bg-[#fff0e8] text-[#d45d28]"
                            : "border-[#eadfd3] bg-[#fffaf6] text-[#6d5749]"
                        }`}
                        onClick={() => setCategoryFilter(option.value as EventCategory | "all")}
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {discoverSelection ? (
              <EventWorkspace
                collection={discoverCollection}
                currentUser={currentUser}
                currentView={state.session.selectedEventView}
                event={discoverSelection}
                groupDraft={groupDrafts[discoverSelection.id] ?? ""}
                mode="discover"
                onChangeEvent={openEvent}
                onChangeGroupDraft={(value) =>
                  setGroupDrafts((current) => ({ ...current, [discoverSelection.id]: value }))
                }
                onChangeEventMediaDraft={(patch) =>
                  setEventMediaDrafts((current) => ({
                    ...current,
                    [discoverSelection.id]: {
                      imageUrl: patch.imageUrl ?? current[discoverSelection.id]?.imageUrl ?? "",
                      caption: patch.caption ?? current[discoverSelection.id]?.caption ?? ""
                    }
                  }))
                }
                onChangeRequestDraft={(targetUserId, value) =>
                  setRequestDrafts((current) => ({
                    ...current,
                    [`${discoverSelection.id}:${targetUserId}`]: value
                  }))
                }
                onChangeView={(view) => updateSession({ selectedEventView: view })}
                onCreateEventPost={() => void handleCreateEventPost(discoverSelection.id)}
                onCreateEventStory={() => void handleCreateEventStory(discoverSelection.id)}
                onLeaveEvent={handleLeaveEvent}
                onOpenChatMedia={(messageId, authorId, authorLabel, media) =>
                  void handleOpenChatMedia(messageId, authorId, authorLabel, media)
                }
                onOpenPrivateChat={openPrivateChat}
                onRequestEventAccess={handleRequestEventAccess}
                onRespondEventAccess={handleRespondEventAccess}
                onRespondEventInvite={(inviteId, accept) =>
                  void handleRespondEventInvite(inviteId, accept)
                }
                onSendEventInvite={(targetUserId) =>
                  void handleSendEventInvite(discoverSelection.id, targetUserId)
                }
                onRespondPrivateRequest={handleRespondPrivateRequest}
                onSelectAttendee={(userId) =>
                  setSelectedAttendeeByEvent((current) => ({
                    ...current,
                    [discoverSelection.id]: userId
                  }))
                }
                onSendGroupMessage={() => handleSendGroupMessage(discoverSelection.id)}
                onSendGroupMediaMessage={(file) =>
                  void handleSendEventMediaMessage(discoverSelection.id, file)
                }
                onSendPrivateRequest={(targetUserId) =>
                  handleSendPrivateRequest(discoverSelection.id, targetUserId)
                }
                onToggleEventChatMode={(mode) =>
                  void handleSetEventChatMode(discoverSelection.id, mode)
                }
                onToggleFriendship={(targetUserId) => void handleToggleFriendship(targetUserId)}
                eventMediaDraft={eventMediaDrafts[discoverSelection.id] ?? { imageUrl: "", caption: "" }}
                requestDraft={
                  requestDrafts[
                    `${discoverSelection.id}:${selectedAttendeeByEvent[discoverSelection.id] ?? ""}`
                  ] ?? ""
                }
                selectedAttendeeId={selectedAttendeeByEvent[discoverSelection.id] ?? null}
                state={state}
              />
            ) : (
              <EmptyState
                title="No hay eventos con ese filtro"
                copy="Prueba con otra categoria o limpia la busqueda para volver a ver el feed."
              />
            )}
          </div>
        ) : null}

        {state.session.activeTab === "search" ? (
          <SearchHubSection
            currentUser={currentUser}
            onOpenEvent={(eventId) =>
              openEvent(eventId, hasEventAccess(state, eventId, currentUser.id) ? "agenda" : "discover")
            }
            onOpenProfileUser={openProfileUser}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            state={state}
          />
        ) : null}

        {state.session.activeTab === "agenda" ? (
          <div className="space-y-5">
            <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                Tus grupos
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                Eventos en los que ya estas dentro
              </h1>
              <p className="mt-2 text-sm text-[#6d5749]">
                Entra en cada evento como si fuera un grupo: lista de miembros, chat general y
                acceso rapido al privado si conectas con alguien.
              </p>
            </section>

            {agendaSelection ? (
              <>
                <JoinedGroupsList
                  events={joinedEvents}
                  onOpenEvent={(eventId) => openEvent(eventId, "agenda")}
                  selectedEventId={agendaSelection.id}
                  state={state}
                />
                <EventWorkspace
                  collection={joinedEvents}
                  currentUser={currentUser}
                  currentView={state.session.selectedEventView}
                  event={agendaSelection}
                  groupDraft={groupDrafts[agendaSelection.id] ?? ""}
                  mode="agenda"
                  onChangeEvent={(eventId) => openEvent(eventId, "agenda")}
                  onChangeGroupDraft={(value) =>
                    setGroupDrafts((current) => ({ ...current, [agendaSelection.id]: value }))
                  }
                  onChangeEventMediaDraft={(patch) =>
                    setEventMediaDrafts((current) => ({
                      ...current,
                      [agendaSelection.id]: {
                        imageUrl: patch.imageUrl ?? current[agendaSelection.id]?.imageUrl ?? "",
                        caption: patch.caption ?? current[agendaSelection.id]?.caption ?? ""
                      }
                    }))
                  }
                  onChangeRequestDraft={(targetUserId, value) =>
                    setRequestDrafts((current) => ({
                      ...current,
                      [`${agendaSelection.id}:${targetUserId}`]: value
                    }))
                  }
                  onChangeView={(view) => updateSession({ selectedEventView: view })}
                  onCreateEventPost={() => void handleCreateEventPost(agendaSelection.id)}
                  onCreateEventStory={() => void handleCreateEventStory(agendaSelection.id)}
                  onLeaveEvent={handleLeaveEvent}
                  onOpenChatMedia={(messageId, authorId, authorLabel, media) =>
                    void handleOpenChatMedia(messageId, authorId, authorLabel, media)
                  }
                  onOpenPrivateChat={openPrivateChat}
                  onRequestEventAccess={handleRequestEventAccess}
                  onRespondEventAccess={handleRespondEventAccess}
                  onRespondEventInvite={(inviteId, accept) =>
                    void handleRespondEventInvite(inviteId, accept)
                  }
                  onSendEventInvite={(targetUserId) =>
                    void handleSendEventInvite(agendaSelection.id, targetUserId)
                  }
                  onRespondPrivateRequest={handleRespondPrivateRequest}
                  onSelectAttendee={(userId) =>
                    setSelectedAttendeeByEvent((current) => ({
                      ...current,
                      [agendaSelection.id]: userId
                    }))
                  }
                  onSendGroupMessage={() => handleSendGroupMessage(agendaSelection.id)}
                  onSendGroupMediaMessage={(file) =>
                    void handleSendEventMediaMessage(agendaSelection.id, file)
                  }
                  onSendPrivateRequest={(targetUserId) =>
                    handleSendPrivateRequest(agendaSelection.id, targetUserId)
                  }
                  onToggleEventChatMode={(mode) =>
                    void handleSetEventChatMode(agendaSelection.id, mode)
                  }
                  onToggleFriendship={(targetUserId) => void handleToggleFriendship(targetUserId)}
                  eventMediaDraft={eventMediaDrafts[agendaSelection.id] ?? { imageUrl: "", caption: "" }}
                  requestDraft={
                    requestDrafts[
                      `${agendaSelection.id}:${selectedAttendeeByEvent[agendaSelection.id] ?? ""}`
                    ] ?? ""
                  }
                  selectedAttendeeId={selectedAttendeeByEvent[agendaSelection.id] ?? null}
                  state={state}
                />
              </>
            ) : (
              <EmptyState
                title="Todavia no tienes eventos en agenda"
                copy="Solicita acceso a un evento publico o crea el tuyo propio desde la pestaÃ±a Crear."
                action={
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white"
                    onClick={() => navigateToTab("discover")}
                    type="button"
                  >
                    Ver eventos
                    <ArrowRight className="h-4 w-4" />
                  </button>
                }
              />
            )}
          </div>
        ) : null}

        {state.session.activeTab === "inbox" ? (
          <InboxSection
            currentUser={currentUser}
            onChangePrivateDraft={setPrivateDraft}
            onCreateGroupChat={() => setGroupChatComposer(GROUP_CHAT_COMPOSER_INITIAL_STATE)}
            onOpenChatMedia={(messageId, authorId, authorLabel, media) =>
              void handleOpenChatMedia(messageId, authorId, authorLabel, media)
            }
            onOpenChat={openPrivateChat}
            onOpenDirectChatComposer={() => setDirectChatComposerOpen(true)}
            onRespondPrivateRequest={handleRespondPrivateRequest}
            onSendMessage={handleSendPrivateMessage}
            onSendPrivateMediaMessage={(chatId, file) => void handleSendPrivateMediaMessage(chatId, file)}
            isSendingMedia={isSendingPrivateMediaChatId === selectedPrivateChat?.id}
            isSendingMessage={isSendingPrivateMessageChatId === selectedPrivateChat?.id}
            pendingMessagesByChatId={pendingPrivateMessages}
            privateChats={privateChats}
            privateDraft={privateDraft}
            selectedChatId={selectedPrivateChat?.id ?? null}
            state={state}
          />
        ) : null}

        {state.session.activeTab === "profile" ? (
          <ProfileSection
            currentUser={currentUser}
            friendSuggestions={friendSuggestions}
            friends={friends}
            hostedCount={hostedCount}
            joinedCount={joinedCount}
            onCreateUserPost={() => void handleCreateUserPost()}
            onCreateUserStory={() => void handleCreateUserStory()}
            pendingApprovalsCount={pendingApprovalsCount}
            onLogout={() => void handleLogout()}
            onResetDemo={handleResetDemo}
            onToggleFriendship={(targetUserId) => void handleToggleFriendship(targetUserId)}
            pendingEventInvites={pendingEventInvites}
            profileMediaDraft={profileMediaDraft}
            profilePosts={getProfilePosts(state, currentUser.id)}
            profileStories={getProfileStories(state, currentUser.id)}
            profileStoryDraft={profileStoryDraft}
            setProfileMediaDraft={setProfileMediaDraft}
            setProfileStoryDraft={setProfileStoryDraft}
            state={state}
          />
        ) : null}

        {state.session.activeTab === "host" ? (
          <OrganizerDashboard
            currentUser={currentUser}
            error={syncError}
            isSubmitting={isSyncing}
            onCreateEvent={handleCreateEvent}
            onRespondToAccess={handleRespondEventAccess}
            onSelectEvent={(eventId) => openEvent(eventId, "discover")}
            state={state}
          />
        ) : null}
        </main>
      </div>

      <MobileNavigation
        activeTab={state.session.activeTab}
        currentUser={currentUser}
        hidden={shouldHideMobileNavigation}
        onChange={navigateToTab}
        onOpenCamera={() => openCameraComposer()}
        unreadChatThreadCount={unreadChatThreadCount}
      />

      {groupChatComposer ? (
        <GroupChatComposerSheet
          currentUser={currentUser}
          draft={groupChatComposer}
          friends={friends}
          onClose={() => setGroupChatComposer(null)}
          onCreate={() => void handleCreateGroupChat()}
          onToggleParticipant={(userId) =>
            setGroupChatComposer((current) =>
              current
                ? {
                    ...current,
                    participantIds: current.participantIds.includes(userId)
                      ? current.participantIds.filter((participantId) => participantId !== userId)
                      : [...current.participantIds, userId]
                  }
                : current
            )
          }
          onUpdateTitle={(value) =>
            setGroupChatComposer((current) => (current ? { ...current, title: value } : current))
          }
        />
      ) : null}

      {directChatComposerOpen ? (
        <DirectChatComposerSheet
          friends={friends}
          onClose={() => setDirectChatComposerOpen(false)}
          onSelectFriend={(targetUserId) => void handleOpenDirectChatComposerChat(targetUserId)}
          privateChats={privateChats}
        />
      ) : null}

      {chatMediaViewer ? (
        <ChatMediaViewerSheet viewer={chatMediaViewer} onClose={() => setChatMediaViewer(null)} />
      ) : null}
    </div>
  );
}

function ThreadReadEffects({
  activeTab,
  currentUserId,
  onMarkThreadRead,
  selectedEvent,
  selectedEventView,
  selectedPrivateChat,
  state
}: {
  activeTab: AppTab;
  currentUserId: string;
  onMarkThreadRead: (scope: "event" | "private", targetId: string) => Promise<void>;
  selectedEvent: EventItem | null;
  selectedEventView: EventDetailTab;
  selectedPrivateChat: PrivateChat | null;
  state: PersistedState;
}) {
  const lastReadSignatureRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!selectedPrivateChat || activeTab !== "inbox") {
      return;
    }

    const lastMessage = getPrivateMessages(state, selectedPrivateChat.id).slice(-1)[0];
    if (!lastMessage) {
      return;
    }

    const signature = `private:${selectedPrivateChat.id}:${lastMessage.createdAt}:${currentUserId}`;
    if (lastReadSignatureRef.current.private === signature) {
      return;
    }

    lastReadSignatureRef.current.private = signature;
    void onMarkThreadRead("private", selectedPrivateChat.id);
  }, [activeTab, currentUserId, onMarkThreadRead, selectedPrivateChat, state]);

  useEffect(() => {
    if (!selectedEvent || selectedEventView !== "chat") {
      return;
    }

    if (!hasEventAccess(state, selectedEvent.id, currentUserId)) {
      return;
    }

    if (activeTab !== "agenda" && activeTab !== "discover" && activeTab !== "search") {
      return;
    }

    const lastMessage = getEventMessages(state, selectedEvent.id).slice(-1)[0];
    if (!lastMessage) {
      return;
    }

    const signature = `event:${selectedEvent.id}:${lastMessage.createdAt}:${currentUserId}`;
    if (lastReadSignatureRef.current.event === signature) {
      return;
    }

    lastReadSignatureRef.current.event = signature;
    void onMarkThreadRead("event", selectedEvent.id);
  }, [activeTab, currentUserId, onMarkThreadRead, selectedEvent, selectedEventView, state]);

  return null;
}

function PushNotificationsPrompt({
  isLoading,
  needsStandaloneInstall,
  onDismiss,
  onEnable
}: {
  isLoading: boolean;
  needsStandaloneInstall: boolean;
  onDismiss: () => void;
  onEnable: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#1d160f]/35 px-4 pb-6 pt-10 md:items-center">
      <div className="w-full max-w-md rounded-[32px] border border-[#eadfd3] bg-[#fffaf6] p-6 shadow-[0_24px_60px_rgba(29,22,15,0.22)]">
        <div className="inline-flex rounded-full bg-[#fff1e7] p-3 text-[#f08a24]">
          <Shield className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-[#1d160f]">
          Activa las notificaciones
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#5f4b3f]">
          {needsStandaloneInstall
            ? "En iPhone solo funcionan si abres Tindereo desde el acceso directo de pantalla de inicio, no desde Safari normal."
            : "Asi te llegarÃ¡n mensajes privados, respuestas de historias y movimiento de tus eventos aunque la app este en segundo plano."}
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {!needsStandaloneInstall ? (
            <button
              className="flex-1 rounded-full bg-[#1d160f] px-5 py-3 text-sm font-semibold text-white"
              disabled={isLoading}
              onClick={onEnable}
              type="button"
            >
              {isLoading ? "Activando..." : "Activar ahora"}
            </button>
          ) : null}
          <button
            className="flex-1 rounded-full border border-[#eadfd3] bg-white px-5 py-3 text-sm font-semibold text-[#6d5749]"
            onClick={onDismiss}
            type="button"
          >
            {needsStandaloneInstall ? "Entendido" : "Mas tarde"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileAppShell({
  activeStory,
  cameraComposer,
  closeCameraComposer,
  closeMobileEventScreen,
  closePrivateChat,
  closeProfileDrilldown,
  closeProfileFocus,
  closeStoryViewer,
  currentUser,
  eventListMode,
  focusedProfileUser,
  friendSuggestions,
  friends,
  groupDrafts,
  groupReplyTargets,
  hostedCount,
  isPushSyncing,
  isSyncing,
  joinedCount,
  likedPostKeys,
  mobileEventScreen,
  mobilePrivateChatOpen,
  onChangeEventListMode,
  onChangeEventView,
  onChangeGroupDraft,
  onChangePrivateDraft,
  onCreateGroupChat,
  onCreateEvent,
  onGoToCreate,
  onMarkAllNotificationsRead,
  onMarkStoryViewed,
  onDisablePushNotifications,
  onEnablePushNotifications,
  onOpenDirectChatComposer,
  onOpenNotification,
  onOpenNotifications,
  onOpenProfileTab,
  onOpenChatMedia,
  onUpdateAvatar,
  onOpenCamera,
  onOpenEvent,
  onOpenMediaEditor,
  onOpenPrivateChat,
  onOpenProfileDrilldown,
  onOpenProfileUser,
  onOpenStory,
  onMoveStory,
  onLogout,
  onReplyGroupMessage,
  onReplyPrivateMessage,
  onRespondEventAccess,
  onRespondEventInvite,
  onRespondPrivateRequest,
  onRequestEventAccess,
  onResetDemo,
  onSendGroupMessage,
  onSendGroupMediaMessage,
  onSendPrivateMessage,
  onSendPrivateMediaMessage,
  onSendPrivateRequest,
  onSendStoryReply,
  onStartFriendChat,
  onSubmitCameraComposer,
  onToggleEventChatMode,
  onToggleFriendship,
  onTogglePostLike,
  onUpdateCameraComposer,
  onUploadCameraFile,
  onCloseMediaEditor,
  onCloseNotifications,
  onDeleteMedia,
  onSaveMediaEdit,
  pendingApprovalsCount,
  pendingGroupMessages,
  pendingPrivateMessages,
  pendingEventInvites,
  notifications,
  notificationCenterOpen,
  privateChats,
  privateDraft,
  privateReplyTarget,
  profileDrilldown,
  searchTerm,
  selectedChat,
  selectedEvent,
  setSearchTerm,
  setStoryReplyDraft,
  state,
  storyReplyDraft,
  storyViewer,
  unreadChatThreadCount,
  unreadNotificationCount,
  uiNotice,
  webPushStatus,
  isDeletingMedia,
  isSavingMediaEdit,
  isSendingGroupMediaEventId,
  isSendingGroupMessageByEvent,
  isSendingPrivateMediaChatId,
  isSendingPrivateMessageChatId,
  isSendingStoryReply,
  mediaEditor,
  setMediaEditor,
  syncError
}: {
  activeStory: StoryItem | null;
  cameraComposer: CameraComposerState | null;
  closeCameraComposer: () => void;
  closeMobileEventScreen: () => void;
  closePrivateChat: () => void;
  closeProfileDrilldown: () => void;
  closeProfileFocus: () => void;
  closeStoryViewer: () => void;
  currentUser: PlatformUser;
  eventListMode: "joined" | "discover";
  focusedProfileUser: PlatformUser | null;
  friendSuggestions: PlatformUser[];
  friends: PlatformUser[];
  groupDrafts: Record<string, string>;
  groupReplyTargets: Record<string, ReplyTarget | null>;
  hostedCount: number;
  isPushSyncing: boolean;
  isSyncing: boolean;
  joinedCount: number;
  likedPostKeys: string[];
  mobileEventScreen: MobileEventScreenState | null;
  mobilePrivateChatOpen: boolean;
  onChangeEventListMode: Dispatch<SetStateAction<"joined" | "discover">>;
  onChangeEventView: (view: EventDetailTab) => void;
  onChangeGroupDraft: (eventId: string, value: string) => void;
  onChangePrivateDraft: (value: string) => void;
  onCreateGroupChat: () => void;
  onCreateEvent: (input: CreateEventInput) => Promise<boolean>;
  onGoToCreate: () => void;
  onMarkAllNotificationsRead: () => void;
  onMarkStoryViewed: (storyId: string) => void;
  onDisablePushNotifications: () => void;
  onEnablePushNotifications: () => void;
  onOpenDirectChatComposer: () => void;
  onOpenNotification: (notificationId: string) => void;
  onOpenNotifications: () => void;
  onOpenProfileTab: () => void;
  onOpenChatMedia: (
    messageId: string,
    authorId: string,
    authorLabel: string,
    media: ChatMediaAttachment
  ) => void;
  onUpdateAvatar: (file: File | null) => void;
  onOpenCamera: (draft?: Partial<CameraComposerState>) => void;
  onOpenEvent: (eventId: string, tab: AppTab) => void;
  onOpenMediaEditor: Dispatch<SetStateAction<MediaEditorState | null>>;
  onOpenPrivateChat: (chatId: string) => void;
  onOpenProfileDrilldown: (detail: ProfileDrilldown) => void;
  onOpenProfileUser: (userId: string) => void;
  onOpenStory: (storyId: string, stories: StoryItem[]) => void;
  onMoveStory: (direction: "next" | "prev") => void;
  onLogout: () => void;
  onReplyGroupMessage: (eventId: string, replyTarget: ReplyTarget | null) => void;
  onReplyPrivateMessage: (replyTarget: ReplyTarget | null) => void;
  onRespondEventAccess: (membershipId: string, accept: boolean) => void;
  onRespondEventInvite: (inviteId: string, accept: boolean) => void;
  onRespondPrivateRequest: (requestId: string, accept: boolean) => void;
  onRequestEventAccess: (eventId: string) => void;
  onResetDemo: () => void;
  onSendGroupMessage: (eventId: string) => void;
  onSendGroupMediaMessage: (eventId: string, file: File | null) => void;
  onSendPrivateMessage: () => void;
  onSendPrivateMediaMessage: (chatId: string, file: File | null) => void;
  onSendPrivateRequest: (eventId: string, targetUserId: string) => void;
  onSendStoryReply: (message: string, reaction?: string) => Promise<boolean>;
  onStartFriendChat: (targetUserId: string) => void;
  onSubmitCameraComposer: () => void;
  onToggleEventChatMode: (eventId: string, mode: "open" | "announcements") => void;
  onToggleFriendship: (targetUserId: string) => void;
  onTogglePostLike: (postId: string) => void;
  onUpdateCameraComposer: Dispatch<SetStateAction<CameraComposerState | null>>;
  onUploadCameraFile: (file: File | null) => void;
  onCloseMediaEditor: () => void;
  onCloseNotifications: () => void;
  onDeleteMedia: () => void;
  onSaveMediaEdit: () => void;
  pendingApprovalsCount: number;
  pendingGroupMessages: Record<string, OptimisticChatMessage[]>;
  pendingPrivateMessages: Record<string, OptimisticChatMessage[]>;
  pendingEventInvites: EventInvite[];
  notifications: ReturnType<typeof getNotificationsForUser>;
  notificationCenterOpen: boolean;
  privateChats: ReturnType<typeof getPrivateChatsForUser>;
  privateDraft: string;
  privateReplyTarget: ReplyTarget | null;
  profileDrilldown: ProfileDrilldown | null;
  searchTerm: string;
  selectedChat: ReturnType<typeof getPrivateChatsForUser>[number] | null;
  selectedEvent: EventItem | null;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  setStoryReplyDraft: Dispatch<SetStateAction<string>>;
  state: PersistedState;
  storyReplyDraft: string;
  storyViewer: StoryViewerState | null;
  unreadChatThreadCount: number;
  unreadNotificationCount: number;
  uiNotice: string | null;
  webPushStatus: WebPushStatus;
  isDeletingMedia: boolean;
  isSavingMediaEdit: boolean;
  isSendingGroupMediaEventId: string | null;
  isSendingGroupMessageByEvent: Record<string, boolean>;
  isSendingPrivateMediaChatId: string | null;
  isSendingPrivateMessageChatId: string | null;
  isSendingStoryReply: boolean;
  mediaEditor: MediaEditorState | null;
  setMediaEditor: Dispatch<SetStateAction<MediaEditorState | null>>;
  syncError: string | null;
}) {
  const activeStories = getActiveStories(state, currentUser.id);
  const feedPosts = getFeedPosts(state, currentUser.id);
  const joinedEvents = getJoinedEvents(state, currentUser.id);
  const discoverEvents = getDiscoverFeedEvents(state, currentUser.id);
  const hostedEvents = getHostedEvents(state, currentUser.id);
  const profilePosts = getProfilePosts(state, currentUser.id);
  const profileStories = getProfileStories(state, currentUser.id);
  const privateRequests = getPrivateRequestsForUser(state, currentUser.id);
  const incomingRequests = privateRequests.filter(
    (request) => request.toUserId === currentUser.id && request.status === "pending"
  );
  const mobileTabLabel =
    state.session.activeTab === "discover"
      ? "Inicio"
      : state.session.activeTab === "search"
        ? "Buscar"
        : state.session.activeTab === "agenda"
          ? "Eventos"
          : state.session.activeTab === "inbox"
            ? "Chats"
            : state.session.activeTab === "profile"
              ? "Perfil"
              : "Crear";

  if (cameraComposer) {
    return (
      <MobileCameraComposerScreen
        composer={cameraComposer}
        currentUser={currentUser}
        isSubmitting={isSyncing}
        onClose={closeCameraComposer}
        onSubmit={onSubmitCameraComposer}
        onUpdateComposer={onUpdateCameraComposer}
        onUploadCameraFile={onUploadCameraFile}
        state={state}
      />
    );
  }

  if (notificationCenterOpen) {
    return (
      <NotificationCenterSheet
        notifications={notifications}
        onClose={onCloseNotifications}
        onMarkAllRead={onMarkAllNotificationsRead}
        onOpenNotification={onOpenNotification}
      />
    );
  }

  if (storyViewer && activeStory) {
    return (
      <StoryViewerOverlay
        activeStory={activeStory}
        currentUserId={currentUser.id}
        isSendingReply={isSendingStoryReply}
        onClose={closeStoryViewer}
        onMarkViewed={onMarkStoryViewed}
        onMove={onMoveStory}
        onOpenMediaEditor={onOpenMediaEditor}
        onSendReply={onSendStoryReply}
        replyDraft={storyReplyDraft}
        setReplyDraft={setStoryReplyDraft}
        storyIds={storyViewer.storyIds}
        state={state}
      />
    );
  }

  if (mediaEditor) {
    return (
      <MediaEditorSheet
        editor={mediaEditor}
        onChange={(caption) =>
          setMediaEditor((current) => (current ? { ...current, caption } : current))
        }
        onClose={onCloseMediaEditor}
        onDelete={onDeleteMedia}
        onSave={onSaveMediaEdit}
        isDeleting={isDeletingMedia}
        isSaving={isSavingMediaEdit}
      />
    );
  }

  if (focusedProfileUser) {
    return (
      <MobileUserProfileScreen
        currentUser={currentUser}
        likedPostKeys={likedPostKeys}
        onBack={closeProfileFocus}
        onOpenStory={onOpenStory}
        onStartFriendChat={onStartFriendChat}
        onToggleFriendship={onToggleFriendship}
        onTogglePostLike={onTogglePostLike}
        state={state}
        user={focusedProfileUser}
      />
    );
  }

  if (profileDrilldown) {
    return (
      <MobileProfileCollectionScreen
        currentUser={currentUser}
        detail={profileDrilldown}
        onBack={closeProfileDrilldown}
        onOpenChat={(chatId) => {
          onOpenPrivateChat(chatId);
          closeProfileDrilldown();
        }}
        onOpenEvent={(eventId) => {
          closeProfileDrilldown();
          onOpenEvent(eventId, "agenda");
        }}
        onOpenProfileUser={(userId) => {
          closeProfileDrilldown();
          onOpenProfileUser(userId);
        }}
        privateChats={privateChats}
        state={state}
      />
    );
  }

  if (mobileEventScreen && selectedEvent) {
    return (
      <MobileEventScreen
        currentUser={currentUser}
        draft={groupDrafts[selectedEvent.id] ?? ""}
        event={selectedEvent}
        onBack={closeMobileEventScreen}
        onChangeDraft={(value) => onChangeGroupDraft(selectedEvent.id, value)}
        onChangeView={onChangeEventView}
        onChangeChatMode={(mode) => onToggleEventChatMode(selectedEvent.id, mode)}
        onOpenCamera={(draft) => onOpenCamera({ eventId: selectedEvent.id, target: "event", ...draft })}
        onOpenChatMedia={onOpenChatMedia}
        onOpenPrivateChat={onOpenPrivateChat}
        onOpenMediaEditor={onOpenMediaEditor}
        onOpenProfileUser={onOpenProfileUser}
        onOpenStory={onOpenStory}
        onQuickPrivateRequest={(targetUserId) => onSendPrivateRequest(selectedEvent.id, targetUserId)}
        onReplyMessage={(replyTarget) => onReplyGroupMessage(selectedEvent.id, replyTarget)}
        onRequestAccess={() => onRequestEventAccess(selectedEvent.id)}
        onRespondEventAccess={onRespondEventAccess}
        onRespondPrivateRequest={onRespondPrivateRequest}
        onSendMediaMessage={(file) => onSendGroupMediaMessage(selectedEvent.id, file)}
        onSendMessage={() => onSendGroupMessage(selectedEvent.id)}
        onToggleFriendship={onToggleFriendship}
        isSendingMedia={isSendingGroupMediaEventId === selectedEvent.id}
        isSendingMessage={Boolean(isSendingGroupMessageByEvent[selectedEvent.id])}
        pendingMessages={pendingGroupMessages[selectedEvent.id] ?? []}
        replyTarget={groupReplyTargets[selectedEvent.id] ?? null}
        state={state}
        view={state.session.selectedEventView}
      />
    );
  }

  if (state.session.activeTab === "inbox" && mobilePrivateChatOpen && selectedChat) {
    return (
      <MobilePrivateChatScreen
        chat={selectedChat}
        currentUser={currentUser}
        draft={privateDraft}
        onBack={closePrivateChat}
        onChangeDraft={onChangePrivateDraft}
        onOpenChatMedia={onOpenChatMedia}
        onOpenProfileUser={onOpenProfileUser}
        onReplyMessage={onReplyPrivateMessage}
        onSendMediaMessage={(file) => onSendPrivateMediaMessage(selectedChat.id, file)}
        onSendMessage={onSendPrivateMessage}
        isSendingMedia={isSendingPrivateMediaChatId === selectedChat.id}
        isSendingMessage={isSendingPrivateMessageChatId === selectedChat.id}
        pendingMessages={pendingPrivateMessages[selectedChat.id] ?? []}
        replyTarget={privateReplyTarget}
        state={state}
      />
    );
  }

  return (
    <div className="min-h-screen px-3 pb-28 pt-[calc(env(safe-area-inset-top)+1.35rem)]">
      <MobileTopBar
        activeTab={state.session.activeTab}
        currentUser={currentUser}
        onOpenProfileTab={onOpenProfileTab}
        onOpenSearchTab={onOpenNotifications}
        title={mobileTabLabel}
      />

      {syncError ? (
        <div className="mb-3 rounded-[22px] border border-[#ffcfbb] bg-[#fff4ed] px-4 py-3 text-sm text-[#b14a20] shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
          {syncError}
        </div>
      ) : null}

      {uiNotice ? (
        <div className="mb-3 rounded-[22px] border border-[#eadfd3] bg-white/90 px-4 py-3 text-sm text-[#5f4b3f] shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
          {uiNotice}
        </div>
      ) : null}

      {state.session.activeTab === "discover" ? (
        <MobileHomeScreen
          currentUser={currentUser}
          likedPostKeys={likedPostKeys}
          onOpenEvent={(eventId) => onOpenEvent(eventId, "discover")}
          onOpenProfileUser={onOpenProfileUser}
          onOpenStory={onOpenStory}
          onRespondEventInvite={onRespondEventInvite}
          onTogglePostLike={onTogglePostLike}
          pendingEventInvites={pendingEventInvites}
          posts={feedPosts}
          state={state}
          stories={activeStories}
        />
      ) : null}

      {state.session.activeTab === "search" ? (
        <MobileSearchScreen
          currentUser={currentUser}
          onOpenEvent={(eventId) => onOpenEvent(eventId, hasEventAccess(state, eventId, currentUser.id) ? "agenda" : "discover")}
          onOpenProfileUser={onOpenProfileUser}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          state={state}
        />
      ) : null}

      {state.session.activeTab === "agenda" ? (
        <MobileEventsScreen
          currentUser={currentUser}
          discoverEvents={discoverEvents}
          eventListMode={eventListMode}
          joinedEvents={joinedEvents}
          onChangeEventListMode={onChangeEventListMode}
          onCreateEvent={onGoToCreate}
          onOpenEvent={(eventId) => onOpenEvent(eventId, eventListMode === "joined" ? "agenda" : "discover")}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          state={state}
        />
      ) : null}

      {state.session.activeTab === "inbox" ? (
        <MobileInboxScreen
          currentUser={currentUser}
          incomingRequests={incomingRequests}
          onCreateGroupChat={onCreateGroupChat}
          onOpenChat={onOpenPrivateChat}
          onOpenDirectChatComposer={onOpenDirectChatComposer}
          onOpenProfileUser={onOpenProfileUser}
          onRespondPrivateRequest={onRespondPrivateRequest}
          privateChats={privateChats}
          state={state}
          unreadChatThreadCount={unreadChatThreadCount}
        />
      ) : null}

      {state.session.activeTab === "profile" ? (
        <MobileProfileScreen
          currentUser={currentUser}
          friendSuggestions={friendSuggestions}
          friends={friends}
          hostedCount={hostedCount}
          isPushSyncing={isPushSyncing}
          joinedCount={joinedCount}
          onDisablePushNotifications={onDisablePushNotifications}
          onEnablePushNotifications={onEnablePushNotifications}
          onOpenCreateEvent={onGoToCreate}
          onOpenDetail={onOpenProfileDrilldown}
          onOpenMediaEditor={onOpenMediaEditor}
          onOpenProfileUser={onOpenProfileUser}
          onOpenStory={onOpenStory}
          onUpdateAvatar={onUpdateAvatar}
          onLogout={onLogout}
          onResetDemo={onResetDemo}
          onToggleFriendship={onToggleFriendship}
          pendingApprovalsCount={pendingApprovalsCount}
          pendingEventInvites={pendingEventInvites}
          profilePosts={profilePosts}
          profileStories={profileStories}
          state={state}
          webPushStatus={webPushStatus}
        />
      ) : null}

      {state.session.activeTab === "host" ? (
        <div className="space-y-4">
          <OrganizerDashboard
            compact
            currentUser={currentUser}
            error={syncError}
            isSubmitting={isSyncing}
            onCreateEvent={onCreateEvent}
            onRespondToAccess={onRespondEventAccess}
            onSelectEvent={(eventId) => onOpenEvent(eventId, "discover")}
            state={state}
          />
        </div>
      ) : null}

      {isSyncing ? (
        <div className="mt-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
          Sincronizando cambios...
        </div>
      ) : null}
    </div>
  );
}

function MobileTopBar({
  activeTab,
  currentUser,
  onOpenProfileTab,
  onOpenSearchTab,
  title
}: {
  activeTab: AppTab;
  currentUser: PlatformUser;
  onOpenProfileTab: () => void;
  onOpenSearchTab: () => void;
  title: string;
}) {
  const showingSearch = activeTab !== "search";

  return (
    <div className="mb-4 flex items-center justify-between gap-3 px-1">
      <div className="rounded-full border border-[#eadfd3] bg-white/90 px-4 py-2 text-sm font-semibold text-[#6d5749]">
        {title}
      </div>
      <button
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#eadfd3] bg-white/92 text-[#1d160f] shadow-[0_14px_30px_rgba(52,34,22,0.08)]"
        onClick={showingSearch ? onOpenSearchTab : onOpenProfileTab}
        type="button"
      >
        {showingSearch ? (
          <Search className="h-5 w-5" />
        ) : (
          <div className="h-9 w-9 overflow-hidden rounded-full border border-[#eadfd3] bg-[#f5e4d6]">
            <img
              alt={getUserIdentityLabel(currentUser)}
              className="h-full w-full object-cover"
              src={currentUser.avatar}
            />
          </div>
        )}
      </button>
    </div>
  );
}

function NotificationCenterSheet({
  notifications,
  onClose,
  onMarkAllRead,
  onOpenNotification
}: {
  notifications: ReturnType<typeof getNotificationsForUser>;
  onClose: () => void;
  onMarkAllRead: () => void;
  onOpenNotification: (notificationId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-[#f6efe7] px-3 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="mb-4 flex items-center gap-3">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1d160f] shadow-[0_12px_24px_rgba(52,34,22,0.08)]"
          onClick={onClose}
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
            Notificaciones
          </p>
          <h2 className="text-2xl font-black tracking-tight text-[#1d160f]">Actividad reciente</h2>
        </div>
        {notifications.some((notification) => !notification.readAt) ? (
          <button
            className="rounded-full border border-[#eadfd3] bg-white px-4 py-2 text-sm font-semibold text-[#6d5749]"
            onClick={onMarkAllRead}
            type="button"
          >
            Marcar todo
          </button>
        ) : null}
      </div>

      <div className="space-y-3 overflow-y-auto pb-8">
        {notifications.length === 0 ? (
          <EmptyState
            copy="Cuando lleguen solicitudes, mensajes o nuevas historias, las veras aqui."
            title="Todavia no hay actividad"
          />
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              className={`w-full rounded-[24px] border p-4 text-left shadow-[0_20px_40px_rgba(52,34,22,0.08)] ${
                notification.readAt
                  ? "border-[#eadfd3] bg-white/85"
                  : "border-[#ffcfbb] bg-[#fff6f1]"
              }`}
              onClick={() => onOpenNotification(notification.id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#1d160f]">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#5f4b3f]">{notification.body}</p>
                </div>
                {!notification.readAt ? (
                  <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-[#ff6b57]" />
                ) : null}
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                {formatRelativeTime(notification.createdAt)}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function MediaEditorSheet({
  editor,
  isDeleting,
  isSaving,
  onChange,
  onClose,
  onDelete,
  onSave
}: {
  editor: MediaEditorState;
  isDeleting: boolean;
  isSaving: boolean;
  onChange: (caption: string) => void;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const isStoryEditor = editor.kind === "story";

  return (
    <div
      className={`fixed inset-0 z-[72] ${
        isStoryEditor
          ? "flex items-center justify-center bg-[rgba(18,13,10,0.72)] px-4"
          : "bg-[#f6efe7] px-3 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]"
      }`}
    >
      <div
        className={`${
          isStoryEditor
            ? "w-full max-w-md rounded-[30px] border border-white/10 bg-[#1d160f] p-4 text-white shadow-[0_24px_60px_rgba(18,13,10,0.42)]"
            : ""
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          <button
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
              isStoryEditor
                ? "bg-white/10 text-white"
                : "bg-white text-[#1d160f] shadow-[0_12px_24px_rgba(52,34,22,0.08)]"
            }`}
            onClick={onClose}
            type="button"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p
              className={`text-xs font-semibold uppercase tracking-[0.24em] ${
                isStoryEditor ? "text-white/60" : "text-[#8f6f59]"
              }`}
            >
              Editar
            </p>
            <h2
              className={`text-2xl font-black tracking-tight ${
                isStoryEditor ? "text-white" : "text-[#1d160f]"
              }`}
            >
              {editor.kind === "story" ? "Tu historia" : "Tu publicacion"}
            </h2>
          </div>
        </div>

        <div
          className={`rounded-[28px] border p-4 ${
            isStoryEditor
              ? "border-white/10 bg-white/5"
              : "border-[#eadfd3] bg-white/92 shadow-[0_20px_40px_rgba(52,34,22,0.08)]"
          }`}
        >
          <MediaSurface
            alt="Contenido"
            className="h-64 w-full rounded-[22px] object-cover"
            controls={isVideoMediaUrl(editor.imageUrl)}
            src={editor.imageUrl}
          />
          <label className="mt-4 grid gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                isStoryEditor ? "text-white/60" : "text-[#8f6f59]"
              }`}
            >
              Texto
            </span>
            <textarea
              className={`min-h-[120px] resize-none rounded-[18px] border px-4 py-3 text-sm outline-none ${
                isStoryEditor
                  ? "border-white/10 bg-white/10 text-white"
                  : "border-[#eadfd3] bg-[#fffaf6] text-[#1d160f]"
              }`}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Escribe el pie de foto o texto de la historia"
              value={editor.caption}
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={isSaving || isDeleting}
              onClick={onSave}
              type="button"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              className="flex items-center justify-center gap-2 rounded-full border border-[#ffcfbb] bg-[#fff4ed] px-4 py-3 text-sm font-semibold text-[#b14a20] disabled:opacity-50"
              disabled={isSaving || isDeleting}
              onClick={onDelete}
              type="button"
            >
              {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMediaViewerSheet({
  viewer,
  onClose
}: {
  viewer: ChatMediaViewerState;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[78] bg-[#1d160f] px-3 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)] text-white">
      <div className="mb-4 flex items-center gap-3">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
          onClick={onClose}
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
            {viewer.authorLabel}
          </p>
          <h2 className="truncate text-xl font-black tracking-tight">{viewer.title}</h2>
        </div>
      </div>

      <div className="overflow-hidden rounded-[30px] border border-white/10 bg-white/5">
        <MediaSurface
          alt={viewer.title}
          className="max-h-[70vh] w-full object-contain"
          src={viewer.imageUrl}
        />
      </div>
      {viewer.caption ? <p className="mt-4 text-sm text-white/76">{viewer.caption}</p> : null}
    </div>
  );
}

function GroupChatComposerSheet({
  currentUser,
  draft,
  friends,
  onClose,
  onCreate,
  onToggleParticipant,
  onUpdateTitle
}: {
  currentUser: PlatformUser;
  draft: GroupChatComposerState;
  friends: PlatformUser[];
  onClose: () => void;
  onCreate: () => void;
  onToggleParticipant: (userId: string) => void;
  onUpdateTitle: (value: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[77] overflow-y-auto bg-[#f6efe7] px-3 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="mb-4 flex items-center gap-3">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_12px_24px_rgba(52,34,22,0.08)]"
          onClick={onClose}
          type="button"
        >
          <ChevronLeft className="h-5 w-5 text-[#1d160f]" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
            Nuevo grupo
          </p>
          <h2 className="text-2xl font-black tracking-tight text-[#1d160f]">
            Chat tipo WhatsApp
          </h2>
        </div>
      </div>

      <div className="rounded-[30px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <label className="grid gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
            Nombre del grupo
          </span>
          <input
            className="rounded-[18px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none"
            onChange={(event) => onUpdateTitle(event.target.value)}
            placeholder={`Ej. Cena con ${currentUser.city}`}
            value={draft.title}
          />
        </label>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
            Participantes
          </p>
          <div className="mt-3 space-y-3">
            {friends.length === 0 ? (
              <EmptyState
                copy="Primero necesitas tener al menos dos amistades aÃ±adidas."
                title="Aun no puedes crear grupos"
              />
            ) : (
              friends.map((friend) => {
                const checked = draft.participantIds.includes(friend.id);
                return (
                  <label
                    key={friend.id}
                    className="flex cursor-pointer items-center gap-3 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-3"
                  >
                    <input
                      checked={checked}
                      className="h-4 w-4 accent-[#1d160f]"
                      onChange={() => onToggleParticipant(friend.id)}
                      type="checkbox"
                    />
                    <AvatarChip user={friend} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#1d160f]">
                        {getUserIdentityLabel(friend)}
                      </p>
                      <p className="truncate text-sm text-[#8f6f59]">{getUserIdentityMeta(friend)}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <button
          className="mt-4 w-full rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
          onClick={onCreate}
          type="button"
        >
          Crear grupo
        </button>
      </div>
    </div>
  );
}

function DirectChatComposerSheet({
  friends,
  onClose,
  onSelectFriend,
  privateChats
}: {
  friends: PlatformUser[];
  onClose: () => void;
  onSelectFriend: (targetUserId: string) => void;
  privateChats: ReturnType<typeof getPrivateChatsForUser>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredFriends = friends.filter((friend) => {
    const haystack = `${friend.name} ${friend.handle} ${friend.city} ${friend.title}`.toLowerCase();
    return normalizedSearch === "" || haystack.includes(normalizedSearch);
  });

  return (
    <div className="fixed inset-0 z-[77] overflow-y-auto bg-[#f6efe7] px-3 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="mb-4 flex items-center gap-3">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_12px_24px_rgba(52,34,22,0.08)]"
          onClick={onClose}
          type="button"
        >
          <ChevronLeft className="h-5 w-5 text-[#1d160f]" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
            Nuevo privado
          </p>
          <h2 className="text-2xl font-black tracking-tight text-[#1d160f]">
            Busca a quien quieres escribir
          </h2>
        </div>
      </div>

      <div className="rounded-[30px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <label className="flex items-center gap-2 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
          <Search className="h-4 w-4 text-[#8f6f59]" />
          <input
            className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Busca por @usuario, nombre o ciudad..."
            value={searchTerm}
          />
        </label>

        <div className="mt-4 space-y-3">
          {filteredFriends.length === 0 ? (
            <EmptyState
              copy="No hay amistades que encajen con ese filtro. Cuando agregues gente, podras abrir privados desde aqui."
              title="Sin resultados"
            />
          ) : (
            filteredFriends.map((friend) => {
              const existingChat = privateChats.find(
                (chat) => !isGroupChat(chat) && chat.participantIds.includes(friend.id)
              );

              return (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-3"
                >
                  <AvatarChip user={friend} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#1d160f]">
                      {getUserIdentityLabel(friend)}
                    </p>
                    <p className="truncate text-sm text-[#8f6f59]">
                      {getUserIdentityMeta(friend)}
                    </p>
                  </div>
                  <button
                    className="rounded-full bg-[#1d160f] px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => onSelectFriend(friend.id)}
                    type="button"
                  >
                    {existingChat ? "Abrir" : "Crear"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function MobileHomeScreen({
  currentUser,
  likedPostKeys,
  onOpenEvent,
  onOpenProfileUser,
  onOpenStory,
  onRespondEventInvite,
  onTogglePostLike,
  pendingEventInvites,
  posts,
  state,
  stories
}: {
  currentUser: PlatformUser;
  likedPostKeys: string[];
  onOpenEvent: (eventId: string) => void;
  onOpenProfileUser: (userId: string) => void;
  onOpenStory: (storyId: string, stories: StoryItem[]) => void;
  onRespondEventInvite: (inviteId: string, accept: boolean) => void;
  onTogglePostLike: (postId: string) => void;
  pendingEventInvites: EventInvite[];
  posts: SocialPost[];
  state: PersistedState;
  stories: StoryItem[];
}) {
  return (
    <div className="space-y-4">
      {stories.length > 0 ? (
        <MobileStoriesBar bare onOpenStory={onOpenStory} state={state} stories={stories} />
      ) : (
        <EmptyState
          copy="Cuando tu o tus amigos subais historias, apareceran aqui arriba como en un carrusel."
          title="Aun no hay historias"
        />
      )}

      {pendingEventInvites.length > 0 ? (
        <section className="space-y-3">
          {pendingEventInvites.map((invite) => {
            const event = getEventById(state, invite.eventId);
            const sender = getUserById(state, invite.fromUserId);

            if (!event) {
              return null;
            }

            return (
              <div
                key={invite.id}
                className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                  Invitacion directa
                </p>
                <h2 className="mt-2 text-xl font-black tracking-tight text-[#1d160f]">
                  {event.title}
                </h2>
                <p className="mt-2 text-sm text-[#5f4b3f]">
                  {getUserIdentityLabel(sender)} te ha invitado personalmente.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => onRespondEventInvite(invite.id, true)}
                    type="button"
                  >
                    Entrar
                  </button>
                  <button
                    className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]"
                    onClick={() => onRespondEventInvite(invite.id, false)}
                    type="button"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="space-y-4">
        {posts.length === 0 ? (
          <EmptyState
            copy="Crea eventos, publica fotos o usa la camara central para empezar a llenar el inicio."
            title="Todavia no hay publicaciones"
          />
        ) : (
          posts.map((post) => (
            <MobileFeedPostCard
              key={post.id}
              currentUser={currentUser}
              likedPostKeys={likedPostKeys}
              onOpenEvent={onOpenEvent}
              onOpenProfileUser={onOpenProfileUser}
              onTogglePostLike={onTogglePostLike}
              post={post}
              state={state}
            />
          ))
        )}
      </section>
    </div>
  );
}

function MobileSearchScreen({
  currentUser,
  onOpenEvent,
  onOpenProfileUser,
  searchTerm,
  setSearchTerm,
  state
}: {
  currentUser: PlatformUser;
  onOpenEvent: (eventId: string) => void;
  onOpenProfileUser: (userId: string) => void;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  state: PersistedState;
}) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const people = state.users
    .filter((user) => {
      if (user.id === currentUser.id) {
        return false;
      }

      const haystack = `${user.name} ${user.handle} ${user.city} ${user.bio}`.toLowerCase();
      return normalizedSearch === "" || haystack.includes(normalizedSearch);
    })
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
  const events = getDiscoverFeedEvents(state, currentUser.id).filter((event) => {
    const haystack = `${event.title} ${event.city} ${event.venue} ${event.tags.join(" ")}`.toLowerCase();
    return normalizedSearch === "" || haystack.includes(normalizedSearch);
  });

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Buscar</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-[#1d160f]">
          Personas y eventos
        </h1>
        <label className="mt-4 flex items-center gap-2 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
          <Search className="h-4 w-4 text-[#8f6f59]" />
          <input
            className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Busca por nombre, @handle, ciudad o plan..."
            value={searchTerm}
          />
        </label>
      </section>

      <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Personas</p>
          <span className="text-xs text-[#8f6f59]">{people.length} visibles</span>
        </div>
        <div className="mt-3 space-y-3">
          {people.length === 0 ? (
            <EmptyState
              copy="Prueba otra busqueda o empieza a crear perfiles reales desde el login."
              title="No hay personas con ese filtro"
            />
          ) : (
            people.slice(0, 10).map((user) => (
              <button
                key={user.id}
                className="flex w-full items-center gap-3 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-3 text-left"
                onClick={() => onOpenProfileUser(user.id)}
                type="button"
              >
                <AvatarChip user={user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#1d160f]">{getUserIdentityLabel(user)}</p>
                  <p className="truncate text-sm text-[#8f6f59]">{getUserIdentityMeta(user)}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#8f6f59]" />
              </button>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Eventos</p>
          <span className="text-xs text-[#8f6f59]">{events.length} resultados</span>
        </div>
        <div className="mt-3 space-y-3">
          {events.length === 0 ? (
            <EmptyState
              copy="Todavia no hay eventos que encajen con esta busqueda."
              title="Sin eventos para ese filtro"
            />
          ) : (
            events.slice(0, 10).map((event) => {
              const access = getEventAccessState(state, event.id, currentUser.id);
              return (
                <button
                  key={event.id}
                  className="flex w-full items-center gap-3 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-3 text-left"
                  onClick={() => onOpenEvent(event.id)}
                  type="button"
                >
                  <div className="h-16 w-16 overflow-hidden rounded-[18px] border border-[#eadfd3]">
                    <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-[#1d160f]">{event.title}</p>
                      <AccessBadge access={access.kind} />
                    </div>
                    <p className="mt-1 truncate text-sm text-[#8f6f59]">
                      {event.city} - {formatEventDateRange(event)}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-[#5f4b3f]">{event.summary}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function SearchHubSection({
  currentUser,
  onOpenEvent,
  onOpenProfileUser,
  searchTerm,
  setSearchTerm,
  state
}: {
  currentUser: PlatformUser;
  onOpenEvent: (eventId: string) => void;
  onOpenProfileUser: (userId: string) => void;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  state: PersistedState;
}) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const people = state.users
    .filter((user) => {
      if (user.id === currentUser.id) {
        return false;
      }

      const haystack = `${user.name} ${user.handle} ${user.city} ${user.bio}`.toLowerCase();
      return normalizedSearch === "" || haystack.includes(normalizedSearch);
    })
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
  const events = getDiscoverFeedEvents(state, currentUser.id).filter((event) => {
    const haystack = `${event.title} ${event.city} ${event.venue} ${event.tags.join(" ")}`.toLowerCase();
    return normalizedSearch === "" || haystack.includes(normalizedSearch);
  });

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-5 shadow-[0_24px_60px_rgba(52,34,22,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Buscar</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#1d160f]">
          Encuentra gente y eventos
        </h1>
        <label className="mt-4 flex items-center gap-2 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
          <Search className="h-4 w-4 text-[#8f6f59]" />
          <input
            className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Nombre, @handle, ciudad o plan..."
            value={searchTerm}
          />
        </label>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Personas</SectionLabel>
            <span className="text-sm text-[#8f6f59]">{people.length} resultados</span>
          </div>
          <div className="mt-4 space-y-3">
            {people.length === 0 ? (
              <EmptyState
                copy="No hay personas con ese filtro ahora mismo."
                title="Sin resultados"
              />
            ) : (
              people.slice(0, 12).map((user) => (
                <button
                  key={user.id}
                  className="flex w-full items-center gap-3 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4 text-left"
                  onClick={() => onOpenProfileUser(user.id)}
                  type="button"
                >
                  <AvatarChip user={user} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#1d160f]">{getUserIdentityLabel(user)}</p>
                    <p className="truncate text-sm text-[#6d5749]">{getUserIdentityMeta(user)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#8f6f59]" />
                </button>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Eventos</SectionLabel>
            <span className="text-sm text-[#8f6f59]">{events.length} resultados</span>
          </div>
          <div className="mt-4 space-y-3">
            {events.length === 0 ? (
              <EmptyState
                copy="Prueba otra busqueda o crea tu primer evento."
                title="Sin eventos para ese filtro"
              />
            ) : (
              events.slice(0, 12).map((event) => {
                const access = getEventAccessState(state, event.id, currentUser.id);
                return (
                  <button
                    key={event.id}
                    className="flex w-full items-center gap-3 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4 text-left"
                    onClick={() => onOpenEvent(event.id)}
                    type="button"
                  >
                    <div className="h-20 w-20 overflow-hidden rounded-[22px] border border-[#eadfd3]">
                      <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-semibold text-[#1d160f]">{event.title}</p>
                        <AccessBadge access={access.kind} />
                      </div>
                      <p className="mt-1 text-sm text-[#6d5749]">
                        {event.city} - {formatEventDateRange(event)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#5f4b3f]">{event.summary}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function MobileEventsScreen({
  currentUser,
  discoverEvents,
  eventListMode,
  joinedEvents,
  onChangeEventListMode,
  onCreateEvent,
  onOpenEvent,
  searchTerm,
  setSearchTerm,
  state
}: {
  currentUser: PlatformUser;
  discoverEvents: EventItem[];
  eventListMode: "joined" | "discover";
  joinedEvents: EventItem[];
  onChangeEventListMode: Dispatch<SetStateAction<"joined" | "discover">>;
  onCreateEvent: () => void;
  onOpenEvent: (eventId: string) => void;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  state: PersistedState;
}) {
  const collection = (eventListMode === "joined" ? joinedEvents : discoverEvents).filter((event) => {
    const haystack = `${event.title} ${event.city} ${event.venue} ${event.tags.join(" ")}`.toLowerCase();
    return searchTerm.trim() === "" || haystack.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Eventos</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#1d160f]">
              {eventListMode === "joined" ? "Tus chats de evento" : "Descubrir planes"}
            </h1>
          </div>
          <button
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1d160f] text-white"
            onClick={onCreateEvent}
            type="button"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          {[
            { id: "joined" as const, label: "Mis eventos" },
            { id: "discover" as const, label: "Descubrir" }
          ].map((item) => (
            <button
              key={item.id}
              className={`rounded-full px-4 py-3 text-sm font-semibold ${
                eventListMode === item.id
                  ? "bg-[#1d160f] text-white"
                  : "border border-[#eadfd3] bg-[#fffaf6] text-[#6d5749]"
              }`}
              onClick={() => onChangeEventListMode(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
          <Search className="h-4 w-4 text-[#8f6f59]" />
          <input
            className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={eventListMode === "joined" ? "Busca un grupo..." : "Madrid, brunch, live set..."}
            value={searchTerm}
          />
        </label>
      </section>

      <section className="space-y-3">
        {collection.length === 0 ? (
          <EmptyState
            copy={
              eventListMode === "joined"
                ? "Aun no te has unido a ningun evento. Descubre uno y entra en su chat."
                : "Todavia no hay eventos publicados. Crea el primero desde el boton superior."
            }
            title={eventListMode === "joined" ? "Sin eventos en tu agenda" : "Sin eventos publicados"}
          />
        ) : (
          collection.map((event) => {
            const lastMessage = getEventMessages(state, event.id).slice(-1)[0] ?? null;
            const isJoined = hasEventAccess(state, event.id, currentUser.id);
            const unreadCount = isJoined ? getUnreadEventMessagesCount(state, currentUser.id, event.id) : 0;
            const access = getEventAccessState(state, event.id, currentUser.id);
            return (
              <div
                key={event.id}
                className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]"
              >
                <button
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => onOpenEvent(event.id)}
                  type="button"
                >
                  <div className="h-16 w-16 overflow-hidden rounded-[20px] border border-[#eadfd3] bg-[#f4e3d8]">
                    <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-[#1d160f]">{event.title}</p>
                      <span className="text-[11px] text-[#8f6f59]">
                        {formatTime(lastMessage?.createdAt ?? event.startsAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#8f6f59]">
                      {getEventGuestCount(state, event.id)} asistentes - {event.city}
                    </p>
                    <p className="mt-2 truncate text-sm text-[#5f4b3f]">
                      {isJoined
                        ? lastMessage
                          ? parseChatMessage(lastMessage.text).summary
                          : event.summary
                        : event.summary}
                    </p>
                  </div>
                </button>
                <div className="mt-4 flex items-center justify-between gap-3">
                  {isJoined ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold text-[#6d5749]">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {unreadCount > 0 ? `${unreadCount} nuevos` : "Al dia"}
                    </div>
                  ) : (
                    <AccessBadge access={access.kind} />
                  )}
                  <button
                    className={`rounded-full px-4 py-3 text-sm font-semibold ${
                      isJoined
                        ? "border border-[#eadfd3] bg-white text-[#6d5749]"
                        : "bg-gradient-to-r from-[#ff6b57] to-[#f08a24] text-white shadow-[0_16px_30px_rgba(240,138,36,0.22)]"
                    }`}
                    onClick={() => onOpenEvent(event.id)}
                    type="button"
                  >
                    {isJoined ? "Abrir chat" : access.kind === "pending" ? "Ver solicitud" : "Pedir acceso"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function MobileInboxScreen({
  currentUser,
  incomingRequests,
  onCreateGroupChat,
  onOpenChat,
  onOpenDirectChatComposer,
  onOpenProfileUser,
  onRespondPrivateRequest,
  privateChats,
  state,
  unreadChatThreadCount
}: {
  currentUser: PlatformUser;
  incomingRequests: ReturnType<typeof getPrivateRequestsForUser>;
  onCreateGroupChat: () => void;
  onOpenChat: (chatId: string) => void;
  onOpenDirectChatComposer: () => void;
  onOpenProfileUser: (userId: string) => void;
  onRespondPrivateRequest: (requestId: string, accept: boolean) => void;
  privateChats: ReturnType<typeof getPrivateChatsForUser>;
  state: PersistedState;
  unreadChatThreadCount: number;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Chats</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-[#1d160f]">
              Conversaciones
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold text-[#6d5749]">
              {unreadChatThreadCount} pendientes
            </div>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#eadfd3] bg-white text-[#1d160f]"
              onClick={onOpenDirectChatComposer}
              type="button"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1d160f] text-white"
              onClick={onCreateGroupChat}
              type="button"
            >
              <Users className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {incomingRequests.length > 0 ? (
        <section className="space-y-3">
          {incomingRequests.map((request) => {
            const sender = getUserById(state, request.fromUserId);
            return (
              <div
                key={request.id}
                className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]"
              >
                <button className="flex items-center gap-3" onClick={() => onOpenProfileUser(sender.id)} type="button">
                  <AvatarChip user={sender} />
                  <div className="text-left">
                    <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(sender)}</p>
                    <p className="text-sm text-[#8f6f59]">{getUserIdentityMeta(sender)}</p>
                  </div>
                </button>
                <p className="mt-3 text-sm text-[#5f4b3f]">{request.message}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    className="flex-1 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => onRespondPrivateRequest(request.id, true)}
                    type="button"
                  >
                    Aceptar
                  </button>
                  <button
                    className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]"
                    onClick={() => onRespondPrivateRequest(request.id, false)}
                    type="button"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="space-y-3">
        {privateChats.length === 0 ? (
          <EmptyState
            copy="Los privados apareceran aqui cuando alguien acepte abrir conversacion contigo."
            title="Aun no tienes chats privados"
          />
        ) : (
          privateChats.map((chat) => {
            const lastMessage = getLatestPrivateMessage(state, chat.id);
            const unreadCount = getUnreadPrivateMessagesCount(state, currentUser.id, chat.id);
            return (
              <button
                key={chat.id}
                className="flex w-full items-center gap-3 rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 text-left shadow-[0_20px_40px_rgba(52,34,22,0.08)]"
                onClick={() => onOpenChat(chat.id)}
                type="button"
              >
                <ChatAvatarChip chat={chat} currentUserId={currentUser.id} state={state} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-[#1d160f]">
                      {getChatTitle(state, chat, currentUser.id)}
                    </p>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 ? (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#ff6b57] px-2 py-1 text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-[#8f6f59]">
                        {lastMessage ? formatTime(lastMessage.createdAt) : ""}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-xs text-[#8f6f59]">
                    {getChatSubtitle(state, chat, currentUser.id)}
                  </p>
                  <p className="mt-1 truncate text-sm text-[#5f4b3f]">
                    {lastMessage ? parseChatMessage(lastMessage.text).summary : "Chat listo para empezar"}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </section>
    </div>
  );
}

function MobileProfileScreen({
  currentUser,
  friendSuggestions,
  friends,
  hostedCount,
  isPushSyncing,
  joinedCount,
  onDisablePushNotifications,
  onEnablePushNotifications,
  onLogout,
  onOpenCreateEvent,
  onOpenDetail,
  onOpenMediaEditor,
  onOpenProfileUser,
  onOpenStory,
  onUpdateAvatar,
  onResetDemo,
  onToggleFriendship,
  pendingApprovalsCount,
  pendingEventInvites,
  profilePosts,
  profileStories,
  state,
  webPushStatus
}: {
  currentUser: PlatformUser;
  friendSuggestions: PlatformUser[];
  friends: PlatformUser[];
  hostedCount: number;
  isPushSyncing: boolean;
  joinedCount: number;
  onDisablePushNotifications: () => void;
  onEnablePushNotifications: () => void;
  onLogout: () => void;
  onOpenCreateEvent: () => void;
  onOpenDetail: (detail: ProfileDrilldown) => void;
  onOpenMediaEditor: Dispatch<SetStateAction<MediaEditorState | null>>;
  onOpenProfileUser: (userId: string) => void;
  onOpenStory: (storyId: string, stories: StoryItem[]) => void;
  onUpdateAvatar: (file: File | null) => void;
  onResetDemo: () => void;
  onToggleFriendship: (targetUserId: string) => void;
  pendingApprovalsCount: number;
  pendingEventInvites: EventInvite[];
  profilePosts: SocialPost[];
  profileStories: StoryItem[];
  state: PersistedState;
  webPushStatus: WebPushStatus;
}) {
  const privateChats = getPrivateChatsForUser(state, currentUser.id);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <section className="rounded-[32px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <input
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            void onUpdateAvatar(file);
            event.target.value = "";
          }}
          ref={avatarInputRef}
          type="file"
        />
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-white shadow-[0_14px_24px_rgba(29,22,15,0.12)]">
            <img alt={currentUser.name} className="h-full w-full object-cover" src={currentUser.avatar} />
            <button
              className="absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1d160f] text-white shadow-[0_14px_24px_rgba(29,22,15,0.2)]"
              onClick={() => avatarInputRef.current?.click()}
              type="button"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="truncate text-2xl font-black tracking-tight text-[#1d160f]">
              {getUserIdentityLabel(currentUser)}
            </h1>
            <p className="truncate text-sm text-[#8f6f59]">
              {currentUser.title} - {currentUser.city}
            </p>
            <button
              className="mt-3 rounded-full border border-[#eadfd3] bg-white px-4 py-2 text-sm font-semibold text-[#6d5749]"
              onClick={() => avatarInputRef.current?.click()}
              type="button"
            >
              Cambiar foto de perfil
            </button>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#5f4b3f]">{currentUser.bio}</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <button className="rounded-[20px] border border-[#eadfd3] bg-[#fffaf6] px-3 py-4" onClick={() => onOpenDetail("created")} type="button">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">Creados</p>
            <p className="mt-2 text-xl font-black text-[#1d160f]">{hostedCount}</p>
          </button>
          <button className="rounded-[20px] border border-[#eadfd3] bg-[#fffaf6] px-3 py-4" onClick={() => onOpenDetail("agenda")} type="button">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">Agenda</p>
            <p className="mt-2 text-xl font-black text-[#1d160f]">{joinedCount}</p>
          </button>
          <button className="rounded-[20px] border border-[#eadfd3] bg-[#fffaf6] px-3 py-4" onClick={() => onOpenDetail("friends")} type="button">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">Amigos</p>
            <p className="mt-2 text-xl font-black text-[#1d160f]">{friends.length}</p>
          </button>
          <button className="rounded-[20px] border border-[#eadfd3] bg-[#fffaf6] px-3 py-4" onClick={() => onOpenDetail("private")} type="button">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">Privado</p>
            <p className="mt-2 text-xl font-black text-[#1d160f]">{privateChats.length}</p>
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white" onClick={onOpenCreateEvent} type="button">
            Crear evento
          </button>
          <button className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]" onClick={onLogout} type="button">
            Logout
          </button>
        </div>
        <div className="mt-3">
          <button className="w-full rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]" onClick={onResetDemo} type="button">
            Vaciar datos
          </button>
        </div>
      </section>

      {profileStories.length > 0 ? (
        <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Historias</p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {profileStories.map((story) => (
              <div key={story.id} className="w-[118px] flex-none text-left">
                <button className="w-full text-left" onClick={() => onOpenStory(story.id, profileStories)} type="button">
                  <div className="rounded-[24px] bg-[linear-gradient(135deg,#ff6b57,#f08a24)] p-[2px]">
                    <div className="h-[110px] overflow-hidden rounded-[22px] border border-white/70">
                      <MediaSurface alt={currentUser.name} className="h-full w-full object-cover" muted src={story.imageUrl} />
                    </div>
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-[#1d160f]">
                    {story.caption || "Historia"}
                  </p>
                </button>
                <div className="mt-2 flex gap-2">
                  <button
                    className="flex-1 rounded-full border border-[#eadfd3] bg-white px-3 py-2 text-[11px] font-semibold text-[#6d5749]"
                    onClick={() =>
                      onOpenMediaEditor({
                        id: story.id,
                        caption: story.caption,
                        imageUrl: story.imageUrl,
                        kind: "story",
                        scope: "user"
                      })
                    }
                    type="button"
                  >
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {profilePosts.length > 0 ? (
        <section className="grid grid-cols-3 gap-2">
          {profilePosts.map((post) => (
            <div key={post.id} className="overflow-hidden rounded-[22px] border border-[#eadfd3] bg-white/92 p-2">
              <MediaSurface alt={currentUser.name} className="h-28 w-full rounded-[18px] object-cover" src={post.imageUrl} />
              <button
                className="mt-2 w-full rounded-full border border-[#eadfd3] bg-white px-3 py-2 text-[11px] font-semibold text-[#6d5749]"
                onClick={() =>
                  onOpenMediaEditor({
                    id: post.id,
                    caption: post.caption,
                    imageUrl: post.imageUrl,
                    kind: "post",
                    scope: "user"
                  })
                }
                type="button"
              >
                Editar
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Sugerencias</p>
          <p className="text-xs text-[#8f6f59]">{pendingApprovalsCount} por revisar</p>
        </div>
        <div className="mt-3 space-y-3">
          {friendSuggestions.slice(0, 3).map((user) => (
            <div key={user.id} className="flex items-center gap-3 rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-3">
              <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpenProfileUser(user.id)} type="button">
                <AvatarChip user={user} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#1d160f]">{getUserIdentityLabel(user)}</p>
                  <p className="truncate text-sm text-[#8f6f59]">{getUserIdentityMeta(user)}</p>
                </div>
              </button>
              <button className="rounded-full bg-[#1d160f] px-4 py-2 text-sm font-semibold text-white" onClick={() => onToggleFriendship(user.id)} type="button">
                Seguir
              </button>
            </div>
          ))}
        </div>
        {pendingEventInvites.length > 0 ? (
          <p className="mt-4 text-sm text-[#5f4b3f]">
            Tienes {pendingEventInvites.length} invitaciones directas pendientes.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function MobileStoriesBar({
  bare,
  onOpenStory,
  state,
  stories
}: {
  bare?: boolean;
  onOpenStory: (storyId: string, stories: StoryItem[]) => void;
  state: PersistedState;
  stories: StoryItem[];
}) {
  const storyCountByAuthor = stories.reduce((collection, story) => {
    const key = `${story.authorType}:${story.authorId}`;
    collection.set(key, (collection.get(key) ?? 0) + 1);
    return collection;
  }, new Map<string, number>());
  const latestStories = Array.from(
    stories.reduce((collection, story) => {
      const key = `${story.authorType}:${story.authorId}`;
      if (!collection.has(key)) {
        collection.set(key, story);
      }
      return collection;
    }, new Map<string, StoryItem>()).values()
  );

  return (
    <section
      className={
        bare
          ? ""
          : "rounded-[28px] border border-[#eadfd3] bg-white/92 px-3 py-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]"
      }
    >
      <div className={`flex gap-3 overflow-x-auto pb-1 ${bare ? "px-1" : ""}`}>
      {latestStories.map((story) => {
          const user = story.authorType === "user" ? getUserById(state, story.authorId) : null;
          const event = story.authorType === "event" ? getEventById(state, story.authorId) : null;
          const label = user ? getUserIdentityLabel(user) : event?.title ?? "Story";
          const storyCount = storyCountByAuthor.get(`${story.authorType}:${story.authorId}`) ?? 1;
          return (
            <button key={story.id} className="w-[78px] flex-none text-center" onClick={() => onOpenStory(story.id, stories)} type="button">
              <div className="relative mx-auto w-fit rounded-full bg-[linear-gradient(135deg,#ff6b57,#f08a24)] p-[2px]">
                <div className="h-[64px] w-[64px] overflow-hidden rounded-full border-2 border-white bg-[#f6efe7]">
                  <MediaSurface
                    alt={label}
                    className="h-full w-full object-cover"
                    muted
                    src={getStoryPreviewImage(story, state)}
                  />
                </div>
                {storyCount > 1 ? (
                  <span className="absolute -bottom-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#1d160f] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {storyCount}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-[#1d160f]">{label}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MobileFeedPostCard({
  currentUser,
  likedPostKeys,
  onOpenEvent,
  onOpenProfileUser,
  onTogglePostLike,
  post,
  state
}: {
  currentUser: PlatformUser;
  likedPostKeys: string[];
  onOpenEvent: (eventId: string) => void;
  onOpenProfileUser: (userId: string) => void;
  onTogglePostLike: (postId: string) => void;
  post: SocialPost;
  state: PersistedState;
}) {
  const likeKey = buildPostLikeKey(currentUser.id, post.id);
  const liked = likedPostKeys.includes(likeKey);

  if (post.authorType === "event") {
    const event = getEventById(state, post.authorId);
    if (!event) {
      return null;
    }

    return (
      <article className="overflow-hidden rounded-[28px] border border-[#eadfd3] bg-white/92 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
        <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => onOpenEvent(event.id)} type="button">
          <div className="h-12 w-12 overflow-hidden rounded-[18px] border border-[#eadfd3]">
            <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#1d160f]">{event.title}</p>
            <p className="text-sm text-[#8f6f59]">Evento</p>
          </div>
        </button>
        <MediaSurface alt={event.title} className="h-[320px] w-full object-cover" src={post.imageUrl} />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <button className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${liked ? "bg-[#fff0e8] text-[#ff6b57]" : "border border-[#eadfd3] bg-white text-[#6d5749]"}`} onClick={() => onTogglePostLike(post.id)} type="button">
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
              Like
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#5f4b3f]">{post.caption}</p>
        </div>
      </article>
    );
  }

  const author = getUserById(state, post.authorId);

  return (
    <article className="overflow-hidden rounded-[28px] border border-[#eadfd3] bg-white/92 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
      <button className="flex w-full items-center gap-3 p-4 text-left" onClick={() => onOpenProfileUser(author.id)} type="button">
        <AvatarChip user={author} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[#1d160f]">{getUserIdentityLabel(author)}</p>
          <p className="text-sm text-[#8f6f59]">{formatRelativeTime(post.createdAt)}</p>
        </div>
      </button>
      <MediaSurface alt={author.name} className="h-[340px] w-full object-cover" src={post.imageUrl} />
      <div className="p-4">
        <button className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${liked ? "bg-[#fff0e8] text-[#ff6b57]" : "border border-[#eadfd3] bg-white text-[#6d5749]"}`} onClick={() => onTogglePostLike(post.id)} type="button">
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          Like
        </button>
        <p className="mt-3 text-sm leading-6 text-[#5f4b3f]">{post.caption}</p>
      </div>
    </article>
  );
}

function StoryMessageCard({
  dark,
  state,
  storyAttachment
}: {
  dark?: boolean;
  state: PersistedState;
  storyAttachment: StoryChatAttachment;
}) {
  const story = state.stories.find((entry) => entry.id === storyAttachment.storyId) ?? null;
  const authorLabel =
    story?.authorType === "event"
      ? getEventById(state, story.authorId)?.title ?? "Evento"
      : story
        ? getUserIdentityLabel(getUserById(state, story.authorId))
        : "Historia";

  return (
    <div
      className={`mb-2 rounded-[18px] border p-2 ${
        dark ? "border-white/10 bg-white/10 text-white" : "border-[#eadfd3] bg-[#fffaf6] text-[#1d160f]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 overflow-hidden rounded-[14px] ${dark ? "bg-white/10" : "bg-[#f3e7dc]"}`}>
          {story?.imageUrl ? (
            <MediaSurface alt={authorLabel} className="h-full w-full object-cover" muted src={story.imageUrl} />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-xs font-semibold uppercase tracking-[0.16em] ${dark ? "text-white/68" : "text-[#8f6f59]"}`}>
            {authorLabel}
          </p>
          <p className="truncate text-sm font-semibold">{story?.caption || "Historia compartida"}</p>
        </div>
      </div>
      <p className={`mt-2 text-xs ${dark ? "text-white/78" : "text-[#6d5749]"}`}>{storyAttachment.actionLabel}</p>
    </div>
  );
}

function ChatMediaMessageCard({
  dark,
  media,
  mine,
  onOpen,
  viewed
}: {
  dark?: boolean;
  media: ChatMediaAttachment;
  mine: boolean;
  onOpen: () => void;
  viewed: boolean;
}) {
  const expired = isChatMediaExpired(media.expiresAt);
  const canOpen = mine ? !expired : !expired && !viewed;
  const statusLabel = expired
    ? "Caducada"
    : mine
      ? "Disponible 24 h"
      : viewed
        ? "Vista"
        : "Ver una vez";

  return (
    <button
      className={`mb-2 flex w-full items-center gap-3 rounded-[18px] border p-3 text-left ${
        dark ? "border-white/10 bg-white/10 text-white" : "border-[#eadfd3] bg-[#fffaf6] text-[#1d160f]"
      } ${canOpen ? "" : "opacity-75"}`}
      onClick={onOpen}
      type="button"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-[14px] ${
          dark ? "bg-white/12" : "bg-[#f3e7dc]"
        }`}
      >
        <Image className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-xs font-semibold uppercase tracking-[0.16em] ${
            dark ? "text-white/68" : "text-[#8f6f59]"
          }`}
        >
          Foto efimera
        </p>
        <p className="truncate text-sm font-semibold">{media.caption || "Toca para abrirla"}</p>
        <p className={`mt-1 text-xs ${dark ? "text-white/72" : "text-[#6d5749]"}`}>{statusLabel}</p>
      </div>
    </button>
  );
}

function StoryViewerOverlay({
  activeStory,
  currentUserId,
  isSendingReply,
  onClose,
  onMarkViewed,
  onMove,
  onOpenMediaEditor,
  onSendReply,
  replyDraft,
  setReplyDraft,
  storyIds,
  state
}: {
  activeStory: StoryItem;
  currentUserId: string;
  isSendingReply: boolean;
  onClose: () => void;
  onMarkViewed: (storyId: string) => void | Promise<void>;
  onMove: (direction: "next" | "prev") => void;
  onOpenMediaEditor: Dispatch<SetStateAction<MediaEditorState | null>>;
  onSendReply: (message: string, reaction?: string) => Promise<boolean>;
  replyDraft: string;
  setReplyDraft: Dispatch<SetStateAction<string>>;
  storyIds: string[];
  state: PersistedState;
}) {
  const authorName = getStoryAuthorLabel(activeStory, state);
  const editable =
    activeStory.authorType === "user"
      ? activeStory.authorId === currentUserId
      : getEventById(state, activeStory.authorId)?.hostId === currentUserId;
  const activeStoryIndex = Math.max(0, storyIds.findIndex((storyId) => storyId === activeStory.id));
  const isVideoStory = isVideoMediaUrl(activeStory.imageUrl);
  const [progress, setProgress] = useState(0);
  const [storyDurationMs, setStoryDurationMs] = useState(STORY_AUTO_ADVANCE_MS);
  const [showViews, setShowViews] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const storyStartedAtRef = useRef<number | null>(null);
  const storyElapsedAtPauseRef = useRef(0);
  const onCloseRef = useRef(onClose);
  const onMoveRef = useRef(onMove);
  const shouldAutoAdvanceRef = useRef(storyIds.length > 1);
  const replyInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewers = getStoryViews(state, activeStory.id).map((view) => getUserById(state, view.userId));
  const shouldPausePlayback = isPaused || isReplyFocused || showViews || isSendingReply;

  useEffect(() => {
    onCloseRef.current = onClose;
    onMoveRef.current = onMove;
    shouldAutoAdvanceRef.current = storyIds.length > 1;
  }, [onClose, onMove, storyIds.length]);

  useEffect(() => {
    setShowViews(false);
    setProgress(0);
    setIsPaused(false);
    setIsReplyFocused(false);
    setIsMuted(true);
    storyElapsedAtPauseRef.current = 0;
    storyStartedAtRef.current =
      typeof window === "undefined" ? Date.now() : window.performance.now();
  }, [activeStory.id]);

  useEffect(() => {
    void onMarkViewed(activeStory.id);
  }, [activeStory.id, onMarkViewed]);

  useEffect(() => {
    if (!isVideoMediaUrl(activeStory.imageUrl)) {
      setStoryDurationMs(STORY_AUTO_ADVANCE_MS);
      return undefined;
    }

    let isCancelled = false;
    void readVideoDurationFromUrl(activeStory.imageUrl)
      .then((durationMs) => {
        if (!isCancelled) {
          setStoryDurationMs(getStoryPlaybackDuration(durationMs));
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setStoryDurationMs(STORY_MAX_VIDEO_MS);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeStory.imageUrl]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (shouldPausePlayback) {
      if (storyStartedAtRef.current !== null) {
        storyElapsedAtPauseRef.current = window.performance.now() - storyStartedAtRef.current;
        storyStartedAtRef.current = null;
      }
      return undefined;
    }

    if (storyStartedAtRef.current === null) {
      storyStartedAtRef.current = window.performance.now() - storyElapsedAtPauseRef.current;
    }
  }, [shouldPausePlayback]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (shouldPausePlayback) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const elapsed = window.performance.now() - (storyStartedAtRef.current ?? window.performance.now());
      storyElapsedAtPauseRef.current = elapsed;
      const nextProgress = Math.min(elapsed / storyDurationMs, 1);
      setProgress(nextProgress);

      if (elapsed >= storyDurationMs) {
        window.clearInterval(intervalId);
        if (shouldAutoAdvanceRef.current) {
          onMoveRef.current("next");
        } else {
          onCloseRef.current();
        }
      }
    }, 90);

    return () => window.clearInterval(intervalId);
  }, [activeStory.id, shouldPausePlayback, storyDurationMs]);

  useEffect(() => {
    if (!isVideoStory || !videoRef.current) {
      return;
    }

    if (shouldPausePlayback) {
      videoRef.current.pause();
      return;
    }

    void videoRef.current.play().catch(() => undefined);
  }, [activeStory.id, isVideoStory, shouldPausePlayback]);

  const handleTogglePause = () => {
    setIsPaused((current) => !current);
  };

  const handleSendReplyMessage = async () => {
    const sent = await onSendReply(replyDraft);
    if (sent) {
      replyInputRef.current?.blur();
      setIsReplyFocused(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#120d0a] text-white">
      <div className="flex h-full flex-col">
        <div className="px-4 pt-[max(0.6rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-1.5">
            {storyIds.map((storyId, index) => {
              const width =
                index < activeStoryIndex ? "100%" : index === activeStoryIndex ? `${progress * 100}%` : "0%";
              return (
                <div key={storyId} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-white transition-[width]" style={{ width }} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <p className="truncate font-semibold">{authorName}</p>
            <p className="text-sm text-white/70">{formatRelativeTime(activeStory.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
              onClick={handleTogglePause}
              type="button"
            >
              {shouldPausePlayback ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            {isVideoStory ? (
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
                onClick={() => setIsMuted((current) => !current)}
                type="button"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            ) : null}
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10" onClick={onClose} type="button">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <button className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={() => onMove("prev")} type="button" />
          <button className="absolute inset-y-0 right-0 z-10 w-1/3" onClick={() => onMove("next")} type="button" />
          {isVideoStory ? (
            <video
              autoPlay
              className="h-full w-full object-cover"
              muted={isMuted}
              playsInline
              ref={videoRef}
              src={activeStory.imageUrl}
            />
          ) : (
            <img alt={authorName} className="h-full w-full object-cover" src={activeStory.imageUrl} />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.78))] px-4 pb-6 pt-16">
            <p className="text-base font-semibold">{activeStory.caption}</p>
          </div>
        </div>
        <div className="space-y-3 border-t border-white/10 bg-[#120d0a] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
          {editable ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold"
                onClick={() => {
                  onClose();
                  onOpenMediaEditor(
                    activeStory.authorType === "user"
                      ? {
                          id: activeStory.id,
                          caption: activeStory.caption,
                          imageUrl: activeStory.imageUrl,
                          kind: "story",
                          scope: "user"
                        }
                      : {
                          id: activeStory.id,
                          caption: activeStory.caption,
                          imageUrl: activeStory.imageUrl,
                          kind: "story",
                          scope: "event",
                          eventId: activeStory.authorId
                        }
                  );
                }}
                type="button"
              >
                Editar historia
              </button>
              <button
                className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold"
                onClick={() => setShowViews((current) => !current)}
                type="button"
              >
                {showViews ? "Ocultar vistas" : `Ver vistas (${viewers.length})`}
              </button>
            </div>
          ) : null}
          {editable && showViews ? (
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-3">
              {viewers.length === 0 ? (
                <p className="text-sm text-white/72">Todavia nadie ha visto esta historia.</p>
              ) : (
                <div className="space-y-2">
                  {viewers.map((viewer) => (
                    <div key={viewer.id} className="flex items-center gap-3">
                      <AvatarChip user={viewer} />
                      <div>
                        <p className="text-sm font-semibold text-white">{getUserIdentityLabel(viewer)}</p>
                        <p className="text-xs text-white/70">{getUserIdentityMeta(viewer)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "love", label: "Like" },
              { id: "fire", label: "Fuego" },
              { id: "clap", label: "Aplauso" },
              { id: "wow", label: "Wow" }
            ].map((reaction) => (
              <button
                key={reaction.id}
                className="rounded-full bg-white/10 px-3 py-2 text-sm font-semibold disabled:opacity-45"
                disabled={isSendingReply}
                onClick={() => void onSendReply("", reaction.label)}
                type="button"
              >
                {reaction.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
              onChange={(event) => setReplyDraft(event.target.value)}
              onBlur={() => setIsReplyFocused(false)}
              onFocus={() => setIsReplyFocused(true)}
              placeholder="Responder historia..."
              ref={replyInputRef}
              value={replyDraft}
            />
            <button
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1d160f] disabled:opacity-45"
              disabled={!replyDraft.trim() || isSendingReply}
              onClick={() => void handleSendReplyMessage()}
              type="button"
            >
              {isSendingReply ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobilePrivateChatScreen({
  chat,
  currentUser,
  draft,
  isSendingMedia,
  isSendingMessage,
  onBack,
  onChangeDraft,
  onOpenChatMedia,
  onOpenProfileUser,
  onReplyMessage,
  onSendMediaMessage,
  onSendMessage,
  pendingMessages,
  replyTarget,
  state
}: {
  chat: PrivateChat;
  currentUser: PlatformUser;
  draft: string;
  isSendingMedia: boolean;
  isSendingMessage: boolean;
  onBack: () => void;
  onChangeDraft: (value: string) => void;
  onOpenChatMedia: (
    messageId: string,
    authorId: string,
    authorLabel: string,
    media: ChatMediaAttachment
  ) => void;
  onOpenProfileUser: (userId: string) => void;
  onReplyMessage: (replyTarget: ReplyTarget | null) => void;
  onSendMediaMessage: (file: File | null) => void;
  onSendMessage: () => void;
  pendingMessages: OptimisticChatMessage[];
  replyTarget: ReplyTarget | null;
  state: PersistedState;
}) {
  const partner = getChatPartner(state, chat, currentUser.id);
  const messages = getPrivateMessages(state, chat.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const groupChat = isGroupChat(chat);
  const chatTitle = getChatTitle(state, chat, currentUser.id);
  const chatSubtitle = getChatSubtitle(state, chat, currentUser.id);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#efe8df]">
      <div className="flex items-center gap-3 border-b border-[#eadfd3] bg-white/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0e8]" onClick={onBack} type="button">
          <ChevronLeft className="h-5 w-5 text-[#1d160f]" />
        </button>
        <button
          className="flex min-w-0 items-center gap-3 text-left"
          onClick={() => (!groupChat ? onOpenProfileUser(partner.id) : undefined)}
          type="button"
        >
          <ChatAvatarChip chat={chat} currentUserId={currentUser.id} state={state} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#1d160f]">{chatTitle}</p>
            <p className="truncate text-sm text-[#8f6f59]">{chatSubtitle}</p>
          </div>
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(255,107,87,0.08),transparent_24%),#efe8df] px-3 py-4">
        {messages.map((message) => {
          const mine = message.authorId === currentUser.id;
          const parsed = parseChatMessage(message.text);
          const authorUser = getUserById(state, message.authorId);
          const author = getUserIdentityLabel(authorUser);
          const viewed = hasViewedMessageMedia(state, message.id, currentUser.id);
          const deliveryState = mine
            ? getPrivateMessageDeliveryState(state, chat, currentUser.id, message.createdAt)
            : null;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <button
                className={`max-w-[82%] rounded-[22px] px-4 py-3 text-left text-sm ${
                  mine ? "bg-[#d1f7c4] text-[#1d160f]" : "bg-white text-[#1d160f]"
                }`}
                onClick={() => onReplyMessage(buildReplyTarget(author, message.id, parsed.summary))}
                type="button"
              >
                {groupChat ? (
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                    {author}
                  </p>
                ) : null}
                {parsed.reply ? (
                  <div className="mb-2 rounded-[16px] border-l-2 border-[#ff6b57] bg-black/5 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                      {parsed.reply.authorLabel}
                    </p>
                    <p className="mt-1 text-xs text-[#5f4b3f]">{parsed.reply.snippet}</p>
                  </div>
                ) : null}
                {parsed.story ? <StoryMessageCard dark={mine} state={state} storyAttachment={parsed.story} /> : null}
                {parsed.media ? (
                  <ChatMediaMessageCard
                    dark={mine}
                    media={parsed.media}
                    mine={mine}
                    onOpen={() => onOpenChatMedia(message.id, message.authorId, author, parsed.media!)}
                    viewed={viewed}
                  />
                ) : null}
                {parsed.body ? <p>{parsed.body}</p> : null}
                <div
                  className={`mt-2 flex items-center gap-1 text-[11px] ${
                    mine ? "justify-end text-[#55725b]" : "text-[#8f6f59]"
                  }`}
                >
                  <span>{formatTime(message.createdAt)}</span>
                  {mine && deliveryState ? <MessageDeliveryIndicator status={deliveryState} /> : null}
                </div>
              </button>
            </div>
          );
        })}
        {pendingMessages.map((message) => {
          const parsed = parseChatMessage(message.text);
          return (
            <div key={message.clientId} className="flex justify-end">
              <div className="max-w-[82%] rounded-[22px] bg-[#d1f7c4] px-4 py-3 text-left text-sm text-[#1d160f]">
                {parsed.reply ? (
                  <div className="mb-2 rounded-[16px] border-l-2 border-[#ff6b57] bg-black/5 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                      {parsed.reply.authorLabel}
                    </p>
                    <p className="mt-1 text-xs text-[#5f4b3f]">{parsed.reply.snippet}</p>
                  </div>
                ) : null}
                {parsed.body ? <p>{parsed.body}</p> : null}
                <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-[#55725b]">
                  <span>{formatTime(message.createdAt)}</span>
                  <MessageDeliveryIndicator status="pending" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[#eadfd3] bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-3">
        <input
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void onSendMediaMessage(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
        {replyTarget ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-[18px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                Respondiendo a {replyTarget.authorLabel}
              </p>
              <p className="mt-1 text-sm text-[#5f4b3f]">{replyTarget.snippet}</p>
            </div>
            <button className="text-[#8f6f59]" onClick={() => onReplyMessage(null)} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#eadfd3] bg-[#fffaf6] text-[#1d160f] disabled:opacity-45"
            disabled={isSendingMedia}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {isSendingMedia ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
          </button>
          <input
            className="min-w-0 flex-1 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none"
            disabled={isSendingMessage}
            onChange={(event) => onChangeDraft(event.target.value)}
            placeholder={`Escribe en ${chatTitle}...`}
            value={draft}
          />
          <button
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1d160f] text-white disabled:opacity-45"
            disabled={isSendingMessage || !draft.trim()}
            onClick={onSendMessage}
            type="button"
          >
            {isSendingMessage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileEventScreen({
  currentUser,
  draft,
  event,
  isSendingMedia,
  isSendingMessage,
  onBack,
  onChangeChatMode,
  onChangeDraft,
  onChangeView,
  onOpenCamera,
  onOpenChatMedia,
  onOpenPrivateChat,
  onOpenMediaEditor,
  onOpenProfileUser,
  onOpenStory,
  onQuickPrivateRequest,
  onReplyMessage,
  onRequestAccess,
  onRespondEventAccess,
  onRespondPrivateRequest,
  onSendMediaMessage,
  onSendMessage,
  onToggleFriendship,
  pendingMessages,
  replyTarget,
  state,
  view
}: {
  currentUser: PlatformUser;
  draft: string;
  event: EventItem;
  isSendingMedia: boolean;
  isSendingMessage: boolean;
  onBack: () => void;
  onChangeChatMode: (mode: "open" | "announcements") => void;
  onChangeDraft: (value: string) => void;
  onChangeView: (view: EventDetailTab) => void;
  onOpenCamera: (draft?: Partial<CameraComposerState>) => void;
  onOpenChatMedia: (
    messageId: string,
    authorId: string,
    authorLabel: string,
    media: ChatMediaAttachment
  ) => void;
  onOpenPrivateChat: (chatId: string) => void;
  onOpenMediaEditor: Dispatch<SetStateAction<MediaEditorState | null>>;
  onOpenProfileUser: (userId: string) => void;
  onOpenStory: (storyId: string, stories: StoryItem[]) => void;
  onQuickPrivateRequest: (targetUserId: string) => void;
  onReplyMessage: (replyTarget: ReplyTarget | null) => void;
  onRequestAccess: () => void;
  onRespondEventAccess: (membershipId: string, accept: boolean) => void;
  onRespondPrivateRequest: (requestId: string, accept: boolean) => void;
  onSendMediaMessage: (file: File | null) => void;
  onSendMessage: () => void;
  onToggleFriendship: (targetUserId: string) => void;
  pendingMessages: OptimisticChatMessage[];
  replyTarget: ReplyTarget | null;
  state: PersistedState;
  view: EventDetailTab;
}) {
  const host = getUserById(state, event.hostId);
  const accessState = getEventAccessState(state, event.id, currentUser.id);
  const canAccess = hasEventAccess(state, event.id, currentUser.id);
  const messages = getEventMessages(state, event.id);
  const eventStories = getEventStories(state, event.id);
  const eventPosts = getEventPosts(state, event.id);
  const members = getEventMembers(state, event.id);
  const friendMembers = getEventFriendMembers(state, event.id, currentUser.id);
  const pendingRequests = getEventPendingRequests(state, event.id);
  const canWrite = canWriteEventChat(state, event.id, currentUser.id);
  const chatMode = getEventChatMode(state, event.id);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const shareUrl = buildEventShareUrl(event.slug);
  const shareCopy = buildEventShareCopy(event, shareUrl);

  useEffect(() => {
    if (!shareNotice || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => setShareNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [shareNotice]);

  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      const copied = await copyToClipboard(shareCopy);
      setShareNotice(
        copied ? "Texto copiado para compartir el evento." : "No se pudo abrir el compartir nativo."
      );
      return;
    }

    try {
      await navigator.share({
        title: event.title,
        text: event.summary,
        url: shareUrl
      });
      setShareNotice("Evento listo para compartir.");
    } catch {
      setShareNotice(null);
    }
  };

  const handleWhatsappShare = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(shareCopy)}`, "_blank", "noopener,noreferrer");
  };

  const handleCopyShareLink = async () => {
    const copied = await copyToClipboard(shareUrl);
    setShareNotice(copied ? "Enlace copiado." : "No se pudo copiar el enlace.");
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#efe8df]">
      <div className="flex items-center gap-3 border-b border-[#eadfd3] bg-white/95 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#fff0e8]" onClick={onBack} type="button">
          <ChevronLeft className="h-5 w-5 text-[#1d160f]" />
        </button>
        <button className="min-w-0 flex-1 text-left" onClick={() => onChangeView(view === "chat" ? "overview" : "chat")} type="button">
          <p className="truncate font-semibold text-[#1d160f]">{event.title}</p>
          <p className="truncate text-sm text-[#8f6f59]">
            {view === "chat" ? "Toca para ver detalles y miembros" : "Volver al chat"}
          </p>
        </button>
      </div>

      {view === "chat" ? (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(255,107,87,0.08),transparent_24%),#efe8df] px-3 py-4">
            <input
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(eventValue) => {
                void onSendMediaMessage(eventValue.target.files?.[0] ?? null);
                eventValue.target.value = "";
              }}
              ref={mediaInputRef}
              type="file"
            />
            {canAccess ? (
              <div className="rounded-[22px] border border-[#eadfd3] bg-white/92 px-4 py-3 text-sm text-[#5f4b3f] shadow-[0_12px_24px_rgba(52,34,22,0.06)]">
                {chatMode === "announcements"
                  ? currentUser.id === event.hostId
                    ? "Modo solo organizador activo. Solo tus mensajes saldran al grupo."
                    : "El organizador ha cerrado temporalmente el chat. Puedes leer, pero solo escribe el."
                  : "Chat abierto para todos los asistentes."}
              </div>
            ) : null}
            {!canAccess ? (
              <div className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
                <img alt={event.title} className="h-44 w-full rounded-[22px] object-cover" src={event.coverImage} />
                <h2 className="mt-4 text-2xl font-black tracking-tight text-[#1d160f]">{event.title}</h2>
                <p className="mt-2 text-sm text-[#5f4b3f]">{event.summary}</p>
                <button className="mt-4 w-full rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white" onClick={onRequestAccess} type="button">
                  {accessState.kind === "pending" ? "Solicitud pendiente" : "Pedir acceso"}
                </button>
              </div>
            ) : null}

            {canAccess
              ? messages.map((message) => {
                  const mine = message.authorId === currentUser.id;
                  const author =
                    message.authorId === "system" ? null : getUserById(state, message.authorId);
                  const authorLabel = author ? getUserIdentityLabel(author) : "Sistema";
                  const parsed = parseChatMessage(message.text);
                  const viewed = hasViewedMessageMedia(state, message.id, currentUser.id);

                  if (message.authorId === "system") {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <button
                          className="max-w-[84%] rounded-[22px] bg-white px-4 py-3 text-left text-sm text-[#5f4b3f]"
                          onClick={() => onReplyMessage(buildReplyTarget(authorLabel, message.id, parsed.body))}
                          type="button"
                        >
                          {parsed.reply ? (
                            <div className="mb-2 rounded-[16px] border-l-2 border-[#ff6b57] bg-black/5 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                                {parsed.reply.authorLabel}
                              </p>
                              <p className="mt-1 text-xs text-[#5f4b3f]">{parsed.reply.snippet}</p>
                            </div>
                          ) : null}
                          {parsed.story ? <StoryMessageCard state={state} storyAttachment={parsed.story} /> : null}
                          {parsed.media ? (
                            <ChatMediaMessageCard
                              media={parsed.media}
                              mine={false}
                              onOpen={() =>
                                onOpenChatMedia(message.id, message.authorId, authorLabel, parsed.media!)
                              }
                              viewed={viewed}
                            />
                          ) : null}
                          {parsed.body ? <p>{parsed.body}</p> : null}
                          <p className="mt-2 text-[11px] text-[#8f6f59]">{formatTime(message.createdAt)}</p>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {!mine && author ? (
                        <button onClick={() => onOpenProfileUser(author.id)} type="button">
                          <AvatarChip user={author} />
                        </button>
                      ) : null}
                      <button
                        className={`max-w-[78%] rounded-[22px] px-4 py-3 text-left text-sm ${
                          mine ? "bg-[#d1f7c4] text-[#1d160f]" : "bg-white text-[#1d160f]"
                        }`}
                        onClick={() => onReplyMessage(buildReplyTarget(authorLabel, message.id, parsed.body))}
                        type="button"
                      >
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                          {authorLabel}
                        </p>
                        {parsed.reply ? (
                          <div className="mb-2 rounded-[16px] border-l-2 border-[#ff6b57] bg-black/5 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                              {parsed.reply.authorLabel}
                            </p>
                            <p className="mt-1 text-xs text-[#5f4b3f]">{parsed.reply.snippet}</p>
                          </div>
                        ) : null}
                        {parsed.story ? <StoryMessageCard dark={message.authorId !== "system" && mine} state={state} storyAttachment={parsed.story} /> : null}
                        {parsed.media ? (
                          <ChatMediaMessageCard
                            dark={message.authorId !== "system" && mine}
                            media={parsed.media}
                            mine={mine}
                            onOpen={() =>
                              onOpenChatMedia(message.id, message.authorId, authorLabel, parsed.media!)
                            }
                            viewed={viewed}
                          />
                        ) : null}
                        {parsed.body ? <p>{parsed.body}</p> : null}
                        <div
                          className={`mt-2 flex items-center gap-1 text-[11px] ${
                            mine ? "justify-end text-[#55725b]" : "text-[#8f6f59]"
                          }`}
                        >
                          <span>{formatTime(message.createdAt)}</span>
                          {mine ? <MessageDeliveryIndicator status="sent" /> : null}
                        </div>
                      </button>
                      {mine && author ? (
                        <button onClick={() => onOpenProfileUser(author.id)} type="button">
                          <AvatarChip user={author} />
                        </button>
                      ) : null}
                    </div>
                  );
                })
              : null}
            {canAccess
              ? pendingMessages.map((message) => {
                  const parsed = parseChatMessage(message.text);
                  return (
                    <div key={message.clientId} className="flex items-end justify-end gap-2">
                      <div className="max-w-[78%] rounded-[22px] bg-[#d1f7c4] px-4 py-3 text-left text-sm text-[#1d160f]">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                          {getUserIdentityLabel(currentUser)}
                        </p>
                        {parsed.reply ? (
                          <div className="mb-2 rounded-[16px] border-l-2 border-[#ff6b57] bg-black/5 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                              {parsed.reply.authorLabel}
                            </p>
                            <p className="mt-1 text-xs text-[#5f4b3f]">{parsed.reply.snippet}</p>
                          </div>
                        ) : null}
                        {parsed.body ? <p>{parsed.body}</p> : null}
                        <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-[#55725b]">
                          <span>{formatTime(message.createdAt)}</span>
                          <MessageDeliveryIndicator status="pending" />
                        </div>
                      </div>
                      <button onClick={() => onOpenProfileUser(currentUser.id)} type="button">
                        <AvatarChip user={currentUser} />
                      </button>
                    </div>
                  );
                })
              : null}
          </div>
          {canAccess ? (
            <div className="border-t border-[#eadfd3] bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-3">
              {replyTarget ? (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-[18px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                      Respondiendo a {replyTarget.authorLabel}
                    </p>
                    <p className="mt-1 text-sm text-[#5f4b3f]">{replyTarget.snippet}</p>
                  </div>
                  <button className="text-[#8f6f59]" onClick={() => onReplyMessage(null)} type="button">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#eadfd3] bg-[#fffaf6] text-[#1d160f] disabled:opacity-45"
                  disabled={!canWrite || isSendingMedia}
                  onClick={() => mediaInputRef.current?.click()}
                  type="button"
                >
                  {isSendingMedia ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
                </button>
                <input
                  className="min-w-0 flex-1 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none"
                  onChange={(eventValue) => onChangeDraft(eventValue.target.value)}
                  placeholder={
                    canWrite ? "Responder al grupo..." : "El chat esta en modo solo organizador"
                  }
                  disabled={!canWrite || isSendingMessage}
                  value={draft}
                />
                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1d160f] text-white disabled:opacity-45"
                  disabled={!canWrite || isSendingMessage || !draft.trim()}
                  onClick={onSendMessage}
                  type="button"
                >
                  {isSendingMessage ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-4 flex gap-2">
            {[
              { id: "overview" as const, label: "Detalles" },
              { id: "people" as const, label: "Miembros" },
              { id: "chat" as const, label: "Chat" }
            ].map((item) => (
              <button
                key={item.id}
                className={`rounded-full px-4 py-3 text-sm font-semibold ${
                  view === item.id
                    ? "bg-[#1d160f] text-white"
                    : "border border-[#eadfd3] bg-white text-[#6d5749]"
                }`}
                onClick={() => onChangeView(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          {view === "overview" ? (
            <div className="space-y-4">
              <section className="overflow-hidden rounded-[28px] border border-[#eadfd3] bg-white/92 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
                <img alt={event.title} className="h-48 w-full object-cover" src={event.coverImage} />
                <div className="p-4">
                  <h2 className="text-2xl font-black tracking-tight text-[#1d160f]">{event.title}</h2>
                  <p className="mt-2 text-sm text-[#5f4b3f]">{event.description}</p>
                  <div className="mt-4 grid gap-2">
                    <div className="rounded-[18px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm text-[#5f4b3f]">
                      {formatEventDateRange(event)}
                    </div>
                    <div className="rounded-[18px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm text-[#5f4b3f]">
                      {event.venue}, {event.city}
                    </div>
                    <button className="rounded-[18px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-left text-sm text-[#5f4b3f]" onClick={() => onOpenProfileUser(host.id)} type="button">
                      Creado por {getUserIdentityLabel(host)}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
                {event.hostId === currentUser.id ? (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button
                      className={`rounded-full px-4 py-3 text-sm font-semibold ${
                        chatMode === "open"
                          ? "bg-[#1d160f] text-white"
                          : "border border-[#eadfd3] bg-white text-[#6d5749]"
                      }`}
                      onClick={() => onChangeChatMode("open")}
                      type="button"
                    >
                      Chat abierto
                    </button>
                    <button
                      className={`rounded-full px-4 py-3 text-sm font-semibold ${
                        chatMode === "announcements"
                          ? "bg-[#1d160f] text-white"
                          : "border border-[#eadfd3] bg-white text-[#6d5749]"
                      }`}
                      onClick={() => onChangeChatMode("announcements")}
                      type="button"
                    >
                      Solo organizador
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => void handleNativeShare()}
                    type="button"
                  >
                    Compartir
                  </button>
                  <button
                    className="rounded-full border border-[#d7f1e4] bg-[#effbf4] px-4 py-3 text-sm font-semibold text-[#1f8d60]"
                    onClick={handleWhatsappShare}
                    type="button"
                  >
                    WhatsApp
                  </button>
                  <button
                    className="rounded-full border border-[#eadfd3] bg-[#fff4fb] px-4 py-3 text-sm font-semibold text-[#8a3d69]"
                    onClick={() => void handleNativeShare()}
                    type="button"
                  >
                    Instagram
                  </button>
                  <button
                    className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-[#6d5749]"
                    onClick={() => void handleCopyShareLink()}
                    type="button"
                  >
                    Copiar enlace
                  </button>
                </div>
                {shareNotice ? (
                  <p className="mt-3 text-sm text-[#8f6f59]">{shareNotice}</p>
                ) : null}
              </section>

              {eventStories.length > 0 ? (
                <MobileStoriesBar onOpenStory={onOpenStory} state={state} stories={eventStories} />
              ) : null}

              {event.hostId === currentUser.id ? (
                <button className="w-full rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white" onClick={() => onOpenCamera({ mode: "story" })} type="button">
                  Subir foto o historia del evento
                </button>
              ) : null}

              {eventPosts.map((post) => (
                <div key={post.id} className="overflow-hidden rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
                  <MediaSurface alt={event.title} className="h-[280px] w-full object-cover" src={post.imageUrl} />
                  <p className="pt-4 text-sm text-[#5f4b3f]">{post.caption}</p>
                  {event.hostId === currentUser.id ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded-full border border-[#eadfd3] bg-white px-4 py-2 text-sm font-semibold text-[#6d5749]"
                        onClick={() =>
                          onOpenMediaEditor({
                            id: post.id,
                            caption: post.caption,
                            imageUrl: post.imageUrl,
                            kind: "post",
                            scope: "event",
                            eventId: event.id
                          })
                        }
                        type="button"
                      >
                        Editar publicacion
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {accessState.kind === "host" && pendingRequests.length > 0 ? (
                <section className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Pendientes</p>
                  <div className="mt-3 space-y-3">
                    {pendingRequests.map((membership) => {
                      const attendee = getUserById(state, membership.userId);
                      return (
                        <div key={membership.id} className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-3">
                          <button className="flex items-center gap-3" onClick={() => onOpenProfileUser(attendee.id)} type="button">
                            <AvatarChip user={attendee} />
                            <div className="text-left">
                              <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(attendee)}</p>
                              <p className="text-sm text-[#8f6f59]">{getUserIdentityMeta(attendee)}</p>
                            </div>
                          </button>
                          <div className="mt-3 flex gap-2">
                            <button className="flex-1 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white" onClick={() => onRespondEventAccess(membership.id, true)} type="button">
                              Aceptar
                            </button>
                            <button className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]" onClick={() => onRespondEventAccess(membership.id, false)} type="button">
                              Rechazar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {(canAccess ? members : friendMembers).map((member) => {
                const connectionState =
                  canAccess && member.id !== currentUser.id
                    ? getEventConnectionState(state, event.id, currentUser.id, member.id)
                    : null;
                return (
                  <div key={member.id} className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
                    <div className="flex items-center gap-3">
                      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onOpenProfileUser(member.id)} type="button">
                        <AvatarChip user={member} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#1d160f]">{getUserIdentityLabel(member)}</p>
                          <p className="truncate text-sm text-[#8f6f59]">{getUserIdentityMeta(member)}</p>
                        </div>
                      </button>
                      {member.id !== currentUser.id ? (
                        <button className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-sm font-semibold text-[#6d5749]" onClick={() => onToggleFriendship(member.id)} type="button">
                          {areFriends(state, currentUser.id, member.id) ? "Amigos" : "Agregar"}
                        </button>
                      ) : null}
                    </div>
                    {canAccess && member.id !== currentUser.id && connectionState ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {connectionState.kind === "available" ? (
                          <button className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white" onClick={() => onQuickPrivateRequest(member.id)} type="button">
                            Solicitar privado
                          </button>
                        ) : null}
                        {connectionState.kind === "chat" ? (
                          <button className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white" onClick={() => onOpenPrivateChat(connectionState.chat.id)} type="button">
                            Abrir chat
                          </button>
                        ) : null}
                        {connectionState.kind === "incoming-request" ? (
                          <>
                            <button className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white" onClick={() => onRespondPrivateRequest(connectionState.request.id, true)} type="button">
                              Aceptar
                            </button>
                            <button className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]" onClick={() => onRespondPrivateRequest(connectionState.request.id, false)} type="button">
                              Rechazar
                            </button>
                          </>
                        ) : null}
                        {connectionState.kind === "outgoing-request" ? (
                          <span className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-[#8f6f59]">
                            Solicitud enviada
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {!canAccess ? (
                <div className="rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 text-sm text-[#5f4b3f] shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
                  Aun no estas dentro. Solo puedes ver a amistades tuyas ya apuntadas.
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MobileProfileCollectionScreen({
  currentUser,
  detail,
  onBack,
  onOpenChat,
  onOpenEvent,
  onOpenProfileUser,
  privateChats,
  state
}: {
  currentUser: PlatformUser;
  detail: ProfileDrilldown;
  onBack: () => void;
  onOpenChat: (chatId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenProfileUser: (userId: string) => void;
  privateChats: ReturnType<typeof getPrivateChatsForUser>;
  state: PersistedState;
}) {
  const title =
    detail === "created"
      ? "Eventos creados"
      : detail === "agenda"
        ? "Tu agenda"
        : detail === "friends"
          ? "Amigos"
          : "Privados";

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-[#f6efe7] px-3 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-4 flex items-center gap-3">
        <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_16px_30px_rgba(52,34,22,0.08)]" onClick={onBack} type="button">
          <ChevronLeft className="h-5 w-5 text-[#1d160f]" />
        </button>
        <h1 className="text-2xl font-black tracking-tight text-[#1d160f]">{title}</h1>
      </div>
      <div className="space-y-3">
        {detail === "created"
          ? getHostedEvents(state, currentUser.id).map((event) => (
              <button key={event.id} className="flex w-full items-center gap-3 rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 text-left shadow-[0_20px_40px_rgba(52,34,22,0.08)]" onClick={() => onOpenEvent(event.id)} type="button">
                <div className="h-16 w-16 overflow-hidden rounded-[20px] border border-[#eadfd3]">
                  <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#1d160f]">{event.title}</p>
                  <p className="text-sm text-[#8f6f59]">{formatEventDateRange(event)}</p>
                </div>
              </button>
            ))
          : null}
        {detail === "agenda"
          ? getJoinedEvents(state, currentUser.id).map((event) => (
              <button key={event.id} className="flex w-full items-center gap-3 rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 text-left shadow-[0_20px_40px_rgba(52,34,22,0.08)]" onClick={() => onOpenEvent(event.id)} type="button">
                <div className="h-16 w-16 overflow-hidden rounded-[20px] border border-[#eadfd3]">
                  <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#1d160f]">{event.title}</p>
                  <p className="text-sm text-[#8f6f59]">{event.city}</p>
                </div>
              </button>
            ))
          : null}
        {detail === "friends"
          ? getFriends(state, currentUser.id).map((user) => (
              <button key={user.id} className="flex w-full items-center gap-3 rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 text-left shadow-[0_20px_40px_rgba(52,34,22,0.08)]" onClick={() => onOpenProfileUser(user.id)} type="button">
                <AvatarChip user={user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#1d160f]">{getUserIdentityLabel(user)}</p>
                  <p className="text-sm text-[#8f6f59]">{getUserIdentityMeta(user)}</p>
                </div>
              </button>
            ))
          : null}
        {detail === "private"
          ? privateChats.map((chat) => {
              return (
                <button key={chat.id} className="flex w-full items-center gap-3 rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 text-left shadow-[0_20px_40px_rgba(52,34,22,0.08)]" onClick={() => onOpenChat(chat.id)} type="button">
                  <ChatAvatarChip chat={chat} currentUserId={currentUser.id} state={state} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#1d160f]">
                      {getChatTitle(state, chat, currentUser.id)}
                    </p>
                    <p className="text-sm text-[#8f6f59]">
                      {getChatSubtitle(state, chat, currentUser.id)}
                    </p>
                  </div>
                </button>
              );
            })
          : null}
      </div>
    </div>
  );
}

function MobileUserProfileScreen({
  currentUser,
  likedPostKeys,
  onBack,
  onOpenStory,
  onStartFriendChat,
  onToggleFriendship,
  onTogglePostLike,
  state,
  user
}: {
  currentUser: PlatformUser;
  likedPostKeys: string[];
  onBack: () => void;
  onOpenStory: (storyId: string, stories: StoryItem[]) => void;
  onStartFriendChat: (targetUserId: string) => void;
  onToggleFriendship: (targetUserId: string) => void;
  onTogglePostLike: (postId: string) => void;
  state: PersistedState;
  user: PlatformUser;
}) {
  const posts = getProfilePosts(state, user.id);
  const stories = getProfileStories(state, user.id);
  const isFriend = areFriends(state, currentUser.id, user.id);
  const friendCount = getFriends(state, user.id).length;
  const privateChat = getPrivateChatsForUser(state, currentUser.id).find((chat) =>
    !isGroupChat(chat) && chat.participantIds.includes(user.id)
  );

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-[#f6efe7] pb-6">
      <div className="relative h-36">
        <img alt={user.name} className="h-full w-full object-cover" src={user.coverImage} />
        <button className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white" onClick={onBack} type="button">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="px-3">
        <section className="-mt-10 rounded-[30px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
          <div className="flex items-start gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-[#f6efe7] bg-white">
              <img alt={user.name} className="h-full w-full object-cover" src={user.avatar} />
            </div>
            <div className="min-w-0 flex-1 pt-2">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-2xl font-black tracking-tight text-[#1d160f]">{user.handle}</h1>
                {user.verified ? (
                  <span className="rounded-full bg-[#1d160f] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    Verificado
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-black text-[#1d160f]">{posts.length}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#8f6f59]">Posts</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#1d160f]">{stories.length}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#8f6f59]">Stories</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#1d160f]">{friendCount}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#8f6f59]">Amigos</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <p className="font-semibold text-[#1d160f]">{user.name}</p>
            <p className="text-sm text-[#8f6f59]">{user.title}</p>
            <p className="text-sm text-[#8f6f59]">{user.city}</p>
            <p className="pt-1 text-sm leading-6 text-[#5f4b3f]">{user.bio}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className={`rounded-full px-4 py-3 text-sm font-semibold ${isFriend ? "border border-[#eadfd3] bg-white text-[#6d5749]" : "bg-[#1d160f] text-white"}`} onClick={() => onToggleFriendship(user.id)} type="button">
              {isFriend ? "Quitar de amigos" : "Agregar a amigos"}
            </button>
            {isFriend ? (
              <button
                className="rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-4 py-3 text-sm font-semibold text-white"
                onClick={() => onStartFriendChat(user.id)}
                type="button"
              >
                {privateChat ? "Abrir chat" : "Escribir"}
              </button>
            ) : (
              <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-center text-sm font-semibold text-[#8f6f59]">
                @{user.handle.replace(/^@/, "")}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {user.interests.map((interest) => (
              <span key={interest} className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold text-[#6d5749]">
                {interest}
              </span>
            ))}
          </div>
        </section>

        {stories.length > 0 ? (
          <section className="mt-4 rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Historias</p>
            <MobileStoriesBar bare onOpenStory={onOpenStory} state={state} stories={stories} />
          </section>
        ) : null}

        <section className="mt-4 rounded-[28px] border border-[#eadfd3] bg-white/92 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Publicaciones</p>
            <p className="text-xs text-[#8f6f59]">{posts.length} visibles</p>
          </div>
          {posts.length === 0 ? (
            <p className="mt-4 text-sm text-[#6d5749]">Todavia no ha subido publicaciones.</p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <button
                  key={post.id}
                  className="aspect-square overflow-hidden rounded-[18px] border border-[#eadfd3] bg-[#fffaf6] text-left"
                  onClick={() => onTogglePostLike(post.id)}
                  type="button"
                >
                  <MediaSurface alt={user.name} className="h-full w-full object-cover" src={post.imageUrl} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MobileCameraComposerScreen({
  composer,
  currentUser,
  isSubmitting,
  onClose,
  onSubmit,
  onUpdateComposer,
  onUploadCameraFile,
  state
}: {
  composer: CameraComposerState;
  currentUser: PlatformUser;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onUpdateComposer: Dispatch<SetStateAction<CameraComposerState | null>>;
  onUploadCameraFile: (file: File | null) => void;
  state: PersistedState;
}) {
  const currentEvent = composer.eventId ? getEventById(state, composer.eventId) : null;
  const photoCaptureInputRef = useRef<HTMLInputElement>(null);
  const videoCaptureInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const capturePressStartedAtRef = useRef<number | null>(null);
  const videoCaptureStartedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingFrameRef = useRef<number | null>(null);
  const [tagSearchTerm, setTagSearchTerm] = useState("");
  const [cameraAccessError, setCameraAccessError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [hasLiveCamera, setHasLiveCamera] = useState(false);
  const [isLivePreviewReady, setIsLivePreviewReady] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const selectableUsers =
    composer.target === "event" && currentEvent
      ? getEventMembers(state, currentEvent.id).filter((user) => user.id !== currentUser.id)
      : getFriends(state, currentUser.id);
  const filteredSelectableUsers = selectableUsers.filter((user) => {
    const normalizedTerm = tagSearchTerm.trim().toLowerCase();
    if (!normalizedTerm) {
      return true;
    }

    return `${user.name} ${user.handle}`.toLowerCase().includes(normalizedTerm);
  });
  const videoOnlyStory = composer.mediaType === "video";

  const clearCaptureTimer = () => {
    if (holdTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  };

  const clearRecordingProgress = () => {
    if (recordingFrameRef.current !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(recordingFrameRef.current);
      recordingFrameRef.current = null;
    }

    setRecordingProgress(0);
  };

  const attachLiveStreamToVideoElement = async () => {
    const video = liveVideoRef.current;
    const stream = streamRef.current;

    if (!video || !stream) {
      return false;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");

    try {
      await video.play();
    } catch {
      return false;
    }

    return true;
  };

  const stopLiveStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (liveVideoRef.current) {
      liveVideoRef.current.pause();
      liveVideoRef.current.srcObject = null;
    }
    setHasLiveCamera(false);
    setIsLivePreviewReady(false);
  };

  const openNativePhotoCapture = () => {
    photoCaptureInputRef.current?.click();
  };

  const openNativeVideoCapture = () => {
    videoCaptureInputRef.current?.click();
  };

  const updateRecordingProgressFrame = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (!recordingStartedAtRef.current || !isRecordingVideo) {
      clearRecordingProgress();
      return;
    }

    const elapsedMs = Date.now() - recordingStartedAtRef.current;
    const nextProgress = Math.min(100, (elapsedMs / STORY_MAX_VIDEO_MS) * 100);
    setRecordingProgress(nextProgress);

    if (nextProgress >= 100) {
      recordingFrameRef.current = null;
      return;
    }

    recordingFrameRef.current = window.requestAnimationFrame(updateRecordingProgressFrame);
  };

  useEffect(() => {
    let cancelled = false;

    const startLiveCamera = async () => {
      if (
        composer.imageUrl ||
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        return;
      }

      setIsLivePreviewReady(false);
      stopLiveStream();

      const preferredFacingMode =
        cameraFacingMode === "user" ? "user" : ({ ideal: "environment" } as const);

      try {
        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: preferredFacingMode,
              height: { ideal: 1920 },
              width: { ideal: 1080 }
            }
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
          });
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setCameraAccessError(null);
        setHasLiveCamera(true);
      } catch {
        if (!cancelled) {
          setHasLiveCamera(false);
          setIsLivePreviewReady(false);
          setCameraAccessError(
            "No he podido abrir la camara en directo. Puedes reintentarlo o usar la camara del sistema."
          );
        }
      }
    };

    void startLiveCamera();

    return () => {
      cancelled = true;
      clearCaptureTimer();
      clearRecordingTimeout();
      clearRecordingProgress();
      mediaRecorderRef.current?.stop?.();
      mediaRecorderRef.current = null;
      stopLiveStream();
    };
  }, [cameraFacingMode, cameraRetryNonce, composer.imageUrl]);

  useEffect(() => {
    if (!hasLiveCamera || composer.imageUrl) {
      return undefined;
    }

    let cancelled = false;

    const bindPreview = async () => {
      const attached = await attachLiveStreamToVideoElement();

      if (!attached || cancelled) {
        if (!cancelled && streamRef.current) {
          window.setTimeout(() => {
            if (!cancelled) {
              void attachLiveStreamToVideoElement();
            }
          }, 180);
        }
        return;
      }

      setCameraAccessError(null);
    };

    void bindPreview();

    return () => {
      cancelled = true;
    };
  }, [composer.imageUrl, hasLiveCamera]);

  useEffect(() => {
    if (!hasLiveCamera || isLivePreviewReady || composer.imageUrl || typeof window === "undefined") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (!isLivePreviewReady) {
        setCameraAccessError(
          "He pedido acceso a la camara pero el movil no ha mostrado la preview. Reintenta o usa la camara del sistema."
        );
        setHasLiveCamera(false);
        stopLiveStream();
      }
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [composer.imageUrl, hasLiveCamera, isLivePreviewReady]);

  const capturePhotoFromLiveCamera = async () => {
    const video = liveVideoRef.current;
    if (!video || !hasLiveCamera || video.videoWidth === 0 || video.videoHeight === 0) {
      openNativePhotoCapture();
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      openNativePhotoCapture();
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const file = await canvasToJpegFile(canvas);
      const imageUrl = createObjectPreviewUrl(file);
      onUpdateComposer((current) => {
        if (!current) {
          revokePreviewUrlIfNeeded(imageUrl);
          return current;
        }

        revokePreviewUrlIfNeeded(current.imageUrl);
        return {
          ...current,
          durationMs: null,
          imageUrl,
          mediaType: "image",
          pendingFile: file
        };
      });
    } catch {
      openNativePhotoCapture();
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    clearRecordingTimeout();
    clearRecordingProgress();
  };

  const startVideoRecording = () => {
    if (isSubmitting) {
      return;
    }

    if (!streamRef.current || typeof MediaRecorder === "undefined") {
      setCameraAccessError(
        "No he podido grabar en directo. Usa el acceso de video del sistema o la fototeca."
      );
      return;
    }

    try {
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const durationMs = recordingStartedAtRef.current
          ? Math.min(Date.now() - recordingStartedAtRef.current, STORY_MAX_VIDEO_MS)
          : STORY_MAX_VIDEO_MS;
        const nextMimeType = recordingChunksRef.current[0]?.type || mimeType || "video/webm";
        const nextBlob = new Blob(recordingChunksRef.current, { type: nextMimeType });
        const extension = nextMimeType.includes("mp4") ? "mp4" : "webm";
        const nextFile = new File([nextBlob], `story-${Date.now()}.${extension}`, {
          type: nextMimeType
        });
        const imageUrl = createObjectPreviewUrl(nextFile);
        onUpdateComposer((current) => {
          if (!current) {
            revokePreviewUrlIfNeeded(imageUrl);
            return current;
          }

          revokePreviewUrlIfNeeded(current.imageUrl);
          return {
            ...current,
            durationMs,
            imageUrl,
            mediaType: "video",
            mode: "story",
            pendingFile: nextFile
          };
        });
        recordingChunksRef.current = [];
        recordingStartedAtRef.current = null;
        setIsRecordingVideo(false);
        clearRecordingProgress();
      };

      recorder.onerror = () => {
        setIsRecordingVideo(false);
        recordingChunksRef.current = [];
        recordingStartedAtRef.current = null;
        clearRecordingProgress();
        setCameraAccessError("La grabacion en directo ha fallado. Puedes probar otra vez.");
      };

      recorder.start();
      setIsRecordingVideo(true);
      setRecordingProgress(0);
      if (typeof window !== "undefined") {
        clearRecordingProgress();
        recordingFrameRef.current = window.requestAnimationFrame(updateRecordingProgressFrame);
      }
      clearRecordingTimeout();
      recordingTimeoutRef.current = window.setTimeout(() => {
        stopVideoRecording();
      }, STORY_MAX_VIDEO_MS);
    } catch {
      setCameraAccessError(
        "No he podido iniciar la grabacion en directo. Usa el video del sistema si lo prefieres."
      );
    }
  };

  const handleCapturePressStart = () => {
    if (typeof window === "undefined" || isSubmitting) {
      return;
    }

    capturePressStartedAtRef.current = window.performance.now();
    videoCaptureStartedRef.current = false;

    if (!hasLiveCamera) {
      return;
    }

    clearCaptureTimer();
    holdTimerRef.current = window.setTimeout(() => {
      videoCaptureStartedRef.current = true;
      startVideoRecording();
      holdTimerRef.current = null;
    }, STORY_LONG_PRESS_VIDEO_MS);
  };

  const handleCapturePressEnd = () => {
    if (isSubmitting) {
      return;
    }

    const pressStartedAt = capturePressStartedAtRef.current;
    const wasLongPress =
      typeof window !== "undefined" &&
      pressStartedAt !== null &&
      window.performance.now() - pressStartedAt >= STORY_LONG_PRESS_VIDEO_MS;
    capturePressStartedAtRef.current = null;

    if (!hasLiveCamera) {
      if (wasLongPress) {
        openNativeVideoCapture();
      } else {
        openNativePhotoCapture();
      }
      return;
    }

    const shouldStopVideo = videoCaptureStartedRef.current;
    clearCaptureTimer();

    if (shouldStopVideo) {
      stopVideoRecording();
    } else {
      void capturePhotoFromLiveCamera();
    }

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        videoCaptureStartedRef.current = false;
      }, 0);
    }
  };

  const handleCapturePressCancel = () => {
    capturePressStartedAtRef.current = null;
    clearCaptureTimer();
    if (videoCaptureStartedRef.current) {
      stopVideoRecording();
    }
    videoCaptureStartedRef.current = false;
  };

  const handleRetryCamera = () => {
    if (isSubmitting) {
      return;
    }

    setCameraAccessError(null);
    setCameraRetryNonce((current) => current + 1);
  };

  const handleSwitchCamera = () => {
    if (isSubmitting || isRecordingVideo || composer.imageUrl) {
      return;
    }

    setIsLivePreviewReady(false);
    setCameraFacingMode((current) => (current === "environment" ? "user" : "environment"));
  };

  const handleResetPreview = () => {
    revokePreviewUrlIfNeeded(composer.imageUrl);
    onUpdateComposer((current) =>
      current
        ? {
            ...current,
            durationMs: null,
            imageUrl: "",
            mediaType: "image",
            pendingFile: null
          }
        : current
    );
    setCameraAccessError(null);
    setCameraRetryNonce((current) => current + 1);
  };

  const handleLiveVideoReady = () => {
    const video = liveVideoRef.current;
    if (video) {
      void video.play().catch(() => undefined);
    }
    setIsLivePreviewReady(true);
  };

  const cameraFrameClass = "h-[min(68vh,36rem)] min-h-[28rem]";
  const interactionLockStyle = {
    WebkitTouchCallout: "none",
    WebkitUserSelect: "none",
    userSelect: "none"
  } as const;

  return (
    <div className="fixed inset-0 z-[65] overflow-y-auto overscroll-contain bg-[#120d0a] px-4 pb-8 text-white">
      <div className="flex items-center justify-between pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10" onClick={onClose} type="button">
          <X className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/72">
          {composer.mode === "story" ? "Historia" : "Publicacion"}
        </p>
        <button
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1d160f] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || !composer.imageUrl}
          onClick={onSubmit}
          type="button"
        >
          {isSubmitting ? "Subiendo..." : "Subir"}
        </button>
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
          {composer.imageUrl ? (
            <div className="relative">
              <MediaSurface
                alt="Preview"
                autoPlay={composer.mediaType === "video"}
                className={`${cameraFrameClass} w-full object-cover`}
                controls={composer.mediaType === "video"}
                muted={composer.mediaType === "video"}
                src={composer.imageUrl}
              />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-[linear-gradient(180deg,rgba(0,0,0,0.54),transparent)] px-4 pb-10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                  Vista previa
                </p>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-sm font-semibold text-white"
                  onClick={handleResetPreview}
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" />
                  Repetir
                </button>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.76))] px-5 pb-5 pt-16">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  {videoOnlyStory
                    ? `Video listo para historia · ${Math.max(
                        1,
                        Math.ceil((composer.durationMs ?? STORY_MAX_VIDEO_MS) / 1000)
                      )} s`
                    : "Ajusta el texto, las etiquetas y el destino antes de subir"}
                </p>
              </div>
            </div>
          ) : hasLiveCamera ? (
            <div className={`relative w-full overflow-hidden bg-black ${cameraFrameClass}`} style={interactionLockStyle}>
              {isRecordingVideo ? (
                <div className="absolute inset-x-4 top-4 z-10 h-1.5 overflow-hidden rounded-full bg-white/18">
                  <div
                    className="h-full rounded-full bg-[#ff6b57] transition-[width] duration-100"
                    style={{ width: `${recordingProgress}%` }}
                  />
                </div>
              ) : null}
              {!isLivePreviewReady ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_32%),rgba(7,5,4,0.84)] px-6 text-center">
                  <div className="h-10 w-10 animate-pulse rounded-full border border-white/18 bg-white/12" />
                  <p className="text-sm font-semibold text-white">Abriendo la camara...</p>
                  <p className="max-w-xs text-xs uppercase tracking-[0.18em] text-white/55">
                    En cuanto llegue la primera imagen veras la preview completa
                  </p>
                </div>
              ) : null}
              <video
                autoPlay
                className={`h-full w-full object-cover transition-opacity duration-200 ${
                  cameraFacingMode === "user" ? "-scale-x-100" : ""
                } ${isLivePreviewReady ? "opacity-100" : "opacity-0"}`}
                disablePictureInPicture
                muted
                onLoadedData={handleLiveVideoReady}
                onLoadedMetadata={handleLiveVideoReady}
                onPlaying={handleLiveVideoReady}
                playsInline
                ref={liveVideoRef}
              />
              <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-[linear-gradient(180deg,rgba(0,0,0,0.6),transparent)] px-4 pb-16 pt-4">
                <div className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  En directo
                </div>
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isRecordingVideo}
                  onClick={handleSwitchCamera}
                  type="button"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.76))] px-5 pb-6 pt-20">
                <p className="text-sm font-medium text-white/82">
                  {isRecordingVideo
                    ? "Grabando historia en video. Suelta para terminar."
                    : "Toca para foto. Manten pulsado para grabar una historia de hasta 20 segundos."}
                </p>
              </div>
            </div>
          ) : (
            <div className={`flex flex-col items-center justify-center gap-4 px-6 text-center ${cameraFrameClass}`}>
              <Camera className="h-12 w-12 text-white/72" />
              <p className="max-w-xs text-sm text-white/72">
                Intento abrir la camara al entrar. Si tu movil la bloquea, puedes reintentarlo o usar la del sistema.
              </p>
              {cameraAccessError ? <p className="max-w-xs text-xs text-[#ffd0c2]">{cameraAccessError}</p> : null}
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#1d160f]"
                  onClick={handleRetryCamera}
                  type="button"
                >
                  Reintentar camara
                </button>
                <button
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                  onClick={openNativePhotoCapture}
                  type="button"
                >
                  Foto del sistema
                </button>
                <button
                  className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                  onClick={openNativeVideoCapture}
                  type="button"
                >
                  Video del sistema
                </button>
              </div>
            </div>
          )}
        </div>

        <input
          accept="image/*"
          capture={cameraFacingMode}
          className="hidden"
          onChange={(event) => onUploadCameraFile(event.target.files?.[0] ?? null)}
          ref={photoCaptureInputRef}
          type="file"
        />
        <input
          accept="video/*"
          capture={cameraFacingMode}
          className="hidden"
          onChange={(event) => onUploadCameraFile(event.target.files?.[0] ?? null)}
          ref={videoCaptureInputRef}
          type="file"
        />
        <input
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => onUploadCameraFile(event.target.files?.[0] ?? null)}
          ref={libraryInputRef}
          type="file"
        />

        {!composer.imageUrl ? (
          <div className="space-y-4" style={interactionLockStyle}>
            <div className="flex items-center justify-between gap-4 px-1">
              <button
                className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/8 text-white"
                onClick={() => libraryInputRef.current?.click()}
                type="button"
              >
                <Image className="h-5 w-5" />
              </button>
              <button
                className="relative inline-flex h-24 w-24 touch-none select-none items-center justify-center rounded-full border-2 border-white bg-white/12 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
                onContextMenu={(event) => event.preventDefault()}
                onDragStart={(event) => event.preventDefault()}
                onPointerCancel={(event) => {
                  event.preventDefault();
                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                  handleCapturePressCancel();
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  handleCapturePressStart();
                }}
                onPointerUp={(event) => {
                  event.preventDefault();
                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                  handleCapturePressEnd();
                }}
                style={{ ...interactionLockStyle, touchAction: "none" }}
                type="button"
              >
                <span
                  className={`inline-flex h-[4.4rem] w-[4.4rem] items-center justify-center rounded-full transition ${
                    isRecordingVideo ? "scale-90 bg-[#ff6b57]" : "bg-white text-[#1d160f]"
                  }`}
                >
                  {isRecordingVideo ? (
                    <span className="h-7 w-7 rounded-2xl bg-white" />
                  ) : (
                    <Camera className="h-7 w-7" />
                  )}
                </span>
              </button>
              <button
                className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isRecordingVideo || Boolean(composer.imageUrl)}
                onClick={handleSwitchCamera}
                type="button"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm font-semibold text-white">
                {hasLiveCamera
                  ? isRecordingVideo
                    ? "Grabando historia en video"
                    : cameraFacingMode === "user"
                      ? "Camara selfie activa"
                      : "Camara trasera activa"
                  : "Usa la camara en directo o la del sistema"}
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Toca para foto · Mantener para video
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                onClick={openNativePhotoCapture}
                type="button"
              >
                Foto del sistema
              </button>
              <button
                className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                onClick={openNativeVideoCapture}
                type="button"
              >
                Video del sistema
              </button>
              <button
                className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                onClick={handleRetryCamera}
                type="button"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[30px] border border-white/10 bg-white/6 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/72">
                  Compartir como
                </p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/52">
                  {videoOnlyStory ? "Video solo en historia" : "Historia o publicacion"}
                </p>
              </div>

              <div className="mt-3 flex gap-2">
                {[
                  { id: "story" as const, label: "Historia" },
                  { id: "post" as const, label: "Publicacion" }
                ].map((item) => {
                  const disabled = videoOnlyStory && item.id === "post";

                  return (
                    <button
                      key={item.id}
                      className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold ${
                        disabled
                          ? "cursor-not-allowed bg-white/5 text-white/35"
                          : composer.mode === item.id
                            ? "bg-white text-[#1d160f]"
                            : "bg-white/10 text-white"
                      }`}
                      onClick={() => {
                        if (disabled) {
                          return;
                        }

                        onUpdateComposer((current) =>
                          current
                            ? {
                                ...current,
                                mode: item.id
                              }
                            : current
                        );
                      }}
                      type="button"
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {currentEvent ? (
                <div className="mt-3 flex gap-2">
                  {[
                    { id: "user" as const, label: "Tu perfil" },
                    { id: "event" as const, label: currentEvent.title }
                  ].map((item) => (
                    <button
                      key={item.id}
                      className={`rounded-full px-4 py-3 text-sm font-semibold ${
                        composer.target === item.id ? "bg-white text-[#1d160f]" : "bg-white/10 text-white"
                      }`}
                      onClick={() =>
                        onUpdateComposer((current) =>
                          current
                            ? {
                                ...current,
                                target: item.id,
                                eventId: item.id === "event" ? currentEvent.id : null
                              }
                            : current
                        )
                      }
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <textarea
                className="mt-3 min-h-[120px] w-full resize-none rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 text-sm text-white outline-none"
                onChange={(event) =>
                  onUpdateComposer((current) =>
                    current
                      ? {
                          ...current,
                          caption: event.target.value
                        }
                      : current
                  )
                }
                placeholder="Escribe algo y etiqueta gente..."
                value={composer.caption}
              />
            </div>

            {selectableUsers.length > 0 ? (
              <div className="rounded-[30px] border border-white/10 bg-white/6 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/72">
                    Etiquetar personas
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/52">
                    {composer.taggedUserIds.length} seleccionadas
                  </p>
                </div>
                <input
                  className="mt-3 w-full rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-white/42"
                  onChange={(event) => setTagSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre o usuario"
                  value={tagSearchTerm}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {filteredSelectableUsers.map((user) => {
                    const active = composer.taggedUserIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        className={`rounded-full px-4 py-3 text-sm font-semibold ${
                          active ? "bg-white text-[#1d160f]" : "bg-white/10 text-white"
                        }`}
                        onClick={() =>
                          onUpdateComposer((current) =>
                            current
                              ? {
                                  ...current,
                                  taggedUserIds: active
                                    ? current.taggedUserIds.filter((id) => id !== user.id)
                                    : [...current.taggedUserIds, user.id]
                                }
                              : current
                          )
                        }
                        type="button"
                      >
                        {getUserIdentityLabel(user)} - {getUserIdentityMeta(user)}
                      </button>
                    );
                  })}
                </div>
                {filteredSelectableUsers.length === 0 ? (
                  <p className="mt-3 text-sm text-white/52">No he encontrado a nadie con esa busqueda.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {isSubmitting ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[#120d0a]/75 px-6 text-center">
          <div className="rounded-[26px] border border-white/10 bg-black/30 px-5 py-4">
            <p className="text-sm font-semibold text-white">Subiendo contenido...</p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/70">
              Espera un momento para evitar duplicados
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AuthScreen({
  error,
  loginForm,
  form,
  isSubmitting,
  onChangeLoginForm,
  onChangeForm,
  onLogin,
  onRegister
}: {
  error: string | null;
  form: RegisterFormState;
  isSubmitting: boolean;
  loginForm: LoginInput;
  onChangeLoginForm: (patch: Partial<LoginInput>) => void;
  onChangeForm: (patch: Partial<RegisterFormState>) => void;
  onLogin: () => void;
  onRegister: () => void;
}) {
  const [showRegister, setShowRegister] = useState(false);

  return (
    <div className="min-h-screen bg-[#f6efe7] px-4 py-5 text-[#1d160f] md:px-6 md:py-8">
      <main className="mx-auto max-w-[560px] space-y-5">
        <BrandMark />

        <SectionCard>
          <SectionLabel>Login</SectionLabel>
          {error ? (
            <div className="mt-4 rounded-[22px] border border-[#ffcfbb] bg-[#fff4ed] px-4 py-3 text-sm text-[#b14a20]">
              {error}
            </div>
          ) : null}
          <div className="mt-4 grid gap-3">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                Usuario
              </span>
              <input
                autoCapitalize="none"
                autoCorrect="off"
                className="rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                onChange={(event) => onChangeLoginForm({ username: event.target.value })}
                placeholder="tuusuario"
                value={loginForm.username}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                Contrasena
              </span>
              <input
                className="rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                onChange={(event) => onChangeLoginForm({ password: event.target.value })}
                placeholder="Tu contrasena"
                type="password"
                value={loginForm.password}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <button
              className="w-full rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(240,138,36,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              onClick={onLogin}
              type="button"
            >
              {isSubmitting ? "Entrando..." : "Entrar"}
            </button>
            <button
              className="w-full rounded-full border border-[#eadfd3] bg-white px-5 py-3 text-sm font-semibold text-[#6d5749]"
              onClick={() => setShowRegister((current) => !current)}
              type="button"
            >
              {showRegister ? "Ya tengo cuenta" : "Crear cuenta"}
            </button>
          </div>
        </SectionCard>

        {showRegister ? (
          <SectionCard>
            <SectionLabel>Crear cuenta</SectionLabel>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                  Nombre
                </span>
                <input
                  className="rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                  onChange={(event) => onChangeForm({ name: event.target.value })}
                  placeholder="Ana Torres"
                  value={form.name}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                    Usuario
                  </span>
                  <input
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                    onChange={(event) => onChangeForm({ handle: event.target.value })}
                    placeholder="anagoesout"
                    value={form.handle}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                    Ciudad
                  </span>
                  <input
                    className="rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                    onChange={(event) => onChangeForm({ city: event.target.value })}
                    placeholder="Madrid"
                    value={form.city}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                    Contrasena
                  </span>
                  <input
                    className="rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                    onChange={(event) => onChangeForm({ password: event.target.value })}
                    placeholder="Minimo 8 caracteres"
                    type="password"
                    value={form.password}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                    Repite la contrasena
                  </span>
                  <input
                    className="rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                    onChange={(event) => onChangeForm({ confirmPassword: event.target.value })}
                    placeholder="Repite tu contrasena"
                    type="password"
                    value={form.confirmPassword}
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                  Bio corta
                </span>
                <textarea
                  className="min-h-[120px] resize-none rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                  onChange={(event) => onChangeForm({ bio: event.target.value })}
                  placeholder="Que tipo de eventos te gusta descubrir y con quien conectarias antes de ir."
                  value={form.bio}
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(240,138,36,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={onRegister}
                type="button"
              >
                {isSubmitting ? "Creando cuenta..." : "Crear cuenta y entrar"}
              </button>
            </div>
          </SectionCard>
        ) : null}
      </main>
    </div>
  );
}

function JoinedGroupsList({
  events,
  onOpenEvent,
  selectedEventId,
  state
}: {
  events: EventItem[];
  onOpenEvent: (eventId: string) => void;
  selectedEventId: string;
  state: PersistedState;
}) {
  return (
    <SectionCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>Lista de grupos</SectionLabel>
          <p className="mt-2 text-sm text-[#6d5749]">
            Abre el grupo del evento que quieras revisar o donde quieras escribir ahora.
          </p>
        </div>
        <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
          {events.length} activos
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {events.map((event) => {
          const lastMessage = getEventMessages(state, event.id).slice(-1)[0] ?? null;
          const members = getEventMembers(state, event.id).length;
          const active = event.id === selectedEventId;

          return (
            <button
              key={event.id}
              className={`flex items-center gap-3 rounded-[26px] border p-4 text-left transition ${
                active ? "border-[#ffb493] bg-[#fff0e8]" : "border-[#eadfd3] bg-[#fffaf6]"
              }`}
              onClick={() => onOpenEvent(event.id)}
              type="button"
            >
              <div className="h-16 w-16 overflow-hidden rounded-[20px] border border-[#eadfd3] bg-[#f4e3d8]">
                <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold text-[#1d160f]">{event.title}</p>
                  <span className="text-[11px] text-[#8f6f59]">
                    {formatTime(lastMessage?.createdAt ?? event.startsAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#8f6f59]">
                  {members} miembros - {event.city}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-[#5f4b3f]">
                  {lastMessage ? parseChatMessage(lastMessage.text).summary : event.summary}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

function DesktopNavigation({
  activeTab,
  onChange
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const items = buildNavItems();

  return (
    <nav className="mb-5 mt-5 hidden flex-wrap gap-2 md:flex">
      {items.map((item) => {
        const active = item.id === activeTab;
        return (
          <button
            key={item.id}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition ${
              active
                ? "bg-[#1d160f] text-white shadow-[0_16px_30px_rgba(29,22,15,0.18)]"
                : "border border-[#eadfd3] bg-white/88 text-[#6d5749]"
            }`}
            onClick={() => onChange(item.id)}
            type="button"
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function MobileNavigation({
  activeTab,
  currentUser,
  hidden,
  onChange,
  onOpenCamera,
  unreadChatThreadCount
}: {
  activeTab: AppTab;
  currentUser: PlatformUser;
  hidden?: boolean;
  onChange: (tab: AppTab) => void;
  onOpenCamera: () => void;
  unreadChatThreadCount: number;
}) {
  const items = [
    {
      id: "discover" as const,
      label: "Inicio",
      icon: <Compass className="h-4 w-4" />
    },
    {
      id: "agenda" as const,
      label: "Eventos",
      icon: <Ticket className="h-4 w-4" />
    },
    {
      id: "inbox" as const,
      label: "Chats",
      icon: <Inbox className="h-4 w-4" />
    },
    {
      id: "profile" as const,
      label: "Perfil",
      icon: <User className="h-4 w-4" />
    }
  ];

  if (hidden) {
    return null;
  }

  return (
    <div className="md:hidden">
      <div className="h-[104px]" />
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#eadfd3] bg-[rgba(249,244,238,0.96)] backdrop-blur-xl">
        <div className="relative mx-auto grid max-w-[560px] grid-cols-5 items-center gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-3">
          {items.slice(0, 2).map((item) => {
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                className={`flex min-w-0 flex-col items-center gap-1 px-1 text-[11px] font-semibold ${
                  active ? "text-[#ff6b57]" : "text-[#7a6455]"
                }`}
                onClick={() => onChange(item.id)}
                type="button"
              >
                <span className="relative inline-flex">
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                      active ? "bg-[#fff0e8]" : "bg-transparent"
                    }`}
                  >
                    {item.icon}
                  </span>
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
          <button
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] text-white shadow-[0_18px_35px_rgba(240,138,36,0.32)]"
            onClick={onOpenCamera}
            type="button"
          >
            <Camera className="h-5 w-5" />
          </button>
          {items.slice(2).map((item) => {
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                className={`flex min-w-0 flex-col items-center gap-1 px-1 text-[11px] font-semibold ${
                  active ? "text-[#ff6b57]" : "text-[#7a6455]"
                }`}
                onClick={() => onChange(item.id)}
                type="button"
              >
                <span className="relative inline-flex">
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                      active ? "bg-[#fff0e8]" : "bg-transparent"
                    }`}
                  >
                    {item.id === "profile" ? (
                      <div className="h-8 w-8 overflow-hidden rounded-full border border-[#eadfd3] bg-[#f5e4d6]">
                        <img
                          alt={getUserIdentityLabel(currentUser)}
                          className="h-full w-full object-cover"
                          src={currentUser.avatar}
                        />
                      </div>
                    ) : (
                      item.icon
                    )}
                  </span>
                  {item.id === "inbox" && unreadChatThreadCount > 0 ? (
                    <span className="absolute -right-1 top-0 inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff6b57] px-1.5 py-1 text-[10px] font-bold text-white">
                      {unreadChatThreadCount > 9 ? "9+" : unreadChatThreadCount}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/*
function SummaryBanner({
  currentUser,
  hostedCount,
  joinedCount,
  pendingApprovalsCount,
  privateRequestCount
}: {
  currentUser: PlatformUser;
  hostedCount: number;
  joinedCount: number;
  pendingApprovalsCount: number;
  privateRequestCount: number;
}) {
  return (
    <section className="mb-5 overflow-hidden rounded-[34px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_26px_64px_rgba(52,34,22,0.08)] md:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_0.8fr]">
        <div className="flex flex-wrap items-center gap-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/80 bg-[#f4e3d8] shadow-[0_14px_24px_rgba(52,34,22,0.08)]">
              <img alt={currentUser.name} className="h-full w-full object-cover" src={currentUser.avatar} />
            </div>
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight md:text-[2rem]">{getUserIdentityLabel(currentUser)}</h2>
              {currentUser.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#e7dacd] bg-[#fff7f2] px-3 py-1 text-xs font-semibold text-[#c86730]">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Perfil verificado
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-semibold text-[#8f6f59]">
              {currentUser.title}
              {currentUser.company ? ` Â· ${currentUser.company}` : ""}
            </p>
            <p className="mt-2 text-sm text-[#6d5749]">{currentUser.tagline}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Creados" value={String(hostedCount)} />
          <MetricTile label="Agenda" value={String(joinedCount)} />
          <MetricTile label="Pendientes" value={String(pendingApprovalsCount)} />
          <MetricTile label="Privados" value={String(privateRequestCount)} />
        </div>
      </div>
    </section>
  );
}
*/

function SocialHomeSection({
  currentUser,
  onOpenEvent,
  onOpenProfileUser,
  onRespondEventInvite,
  pendingEventInvites,
  posts,
  state,
  stories
}: {
  currentUser: PlatformUser;
  onOpenEvent: (eventId: string) => void;
  onOpenProfileUser: (userId: string) => void;
  onRespondEventInvite: (inviteId: string, accept: boolean) => void;
  pendingEventInvites: EventInvite[];
  posts: SocialPost[];
  state: PersistedState;
  stories: StoryItem[];
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-5">
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionLabel>Inicio social</SectionLabel>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                Historias y fotos de tu red
              </h1>
              <p className="mt-2 text-sm text-[#6d5749]">
                Aqui se mezcla la gente que conoces con los eventos que estas siguiendo o a los que
                ya tienes acceso.
              </p>
            </div>
            <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
              Hola, {getUserIdentityLabel(currentUser)}
            </div>
          </div>

          <div className="mt-5">
            <SectionLabel>Historias 24h</SectionLabel>
            <div className="mt-4">
              <StoriesRail
                currentUserId={currentUser.id}
                emptyCopy="Todavia no hay historias activas en tu red."
                onOpenEvent={onOpenEvent}
                state={state}
                stories={stories}
              />
            </div>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
              Como funcionan las invitaciones
            </p>
            <p className="mt-3 text-sm leading-6 text-[#5f4b3f]">
              El enlace compartido abre la ficha del evento, pero no mete a nadie dentro por si
              solo. La invitacion expresa es la directa: el creador se la manda a un amigo y esa
              persona puede aceptarla desde aqui.
            </p>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Invitaciones directas</SectionLabel>
            <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
              {pendingEventInvites.length} pendientes
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {pendingEventInvites.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#eadfd3] bg-[#fffaf6] p-4 text-sm text-[#6d5749]">
                Cuando un creador te invite de forma expresa a un evento, te aparecera aqui con
                acceso directo.
              </div>
            ) : (
              pendingEventInvites.map((invite) => {
                const event = getEventById(state, invite.eventId);
                const sender = getUserById(state, invite.fromUserId);

                if (!event) {
                  return null;
                }

                return (
                  <div
                    key={invite.id}
                    className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                          Invitacion directa
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-[#1d160f]">{event.title}</h3>
                        <p className="mt-2 text-sm text-[#5f4b3f]">
                          {getUserIdentityLabel(sender)} te ha invitado personalmente a este evento.
                        </p>
                        <p className="mt-2 text-xs text-[#8f6f59]">
                          {formatEventDateRange(event)} - {event.venue}, {event.city}
                        </p>
                      </div>
                      <button
                        className="rounded-full border border-[#eadfd3] bg-white px-4 py-2 text-sm font-semibold text-[#1d160f]"
                        onClick={() => onOpenEvent(event.id)}
                        type="button"
                      >
                        Ver evento
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                        onClick={() => void onRespondEventInvite(invite.id, true)}
                        type="button"
                      >
                        Entrar al chat
                      </button>
                      <button
                        className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]"
                        onClick={() => void onRespondEventInvite(invite.id, false)}
                        type="button"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-5">
        <div>
          <SectionLabel>Ultimas fotos</SectionLabel>
          <p className="mt-2 text-sm text-[#6d5749]">
            El feed mezcla publicaciones de amigos y de eventos visibles para ti, como si cada
            evento fuera tambien un perfil vivo.
          </p>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            title="Tu feed aun esta en silencio"
            copy="Empieza siguiendo gente, unete a eventos o sube tu primera foto desde Perfil para encender esta pantalla."
          />
        ) : (
          posts.map((post) => (
            <SocialPostCard
              key={post.id}
              onOpenEvent={onOpenEvent}
              onOpenProfileUser={onOpenProfileUser}
              post={post}
              state={state}
            />
          ))
        )}
      </div>
    </section>
  );
}

function StoriesRail({
  currentUserId,
  emptyCopy,
  onOpenEvent,
  state,
  stories
}: {
  currentUserId: string;
  emptyCopy: string;
  onOpenEvent?: (eventId: string) => void;
  state: PersistedState;
  stories: StoryItem[];
}) {
  const latestStories = Array.from(
    stories.reduce((collection, story) => {
      const key = `${story.authorType}:${story.authorId}`;
      if (!collection.has(key)) {
        collection.set(key, story);
      }
      return collection;
    }, new Map<string, StoryItem>()).values()
  );

  if (latestStories.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#eadfd3] bg-[#fffaf6] p-4 text-sm text-[#6d5749]">
        {emptyCopy}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {latestStories.map((story) => {
        const isUserStory = story.authorType === "user";
        const user = isUserStory ? getUserById(state, story.authorId) : null;
        const event = isUserStory ? null : getEventById(state, story.authorId);
        const label = isUserStory ? getUserIdentityLabel(user ?? { handle: "", name: "Perfil" }) : event?.title ?? "Evento";
        const subtitle = isUserStory
          ? getUserIdentityMeta(user ?? { city: "", title: "Story" })
          : `${formatRelativeTime(story.createdAt)} - evento`;
        const isCurrentUser = isUserStory && story.authorId === currentUserId;
        const canOpenEvent = Boolean(event && onOpenEvent);

        return (
          <button
            key={story.id}
            className={`min-w-[102px] max-w-[102px] rounded-[28px] border p-2 text-left transition ${
              canOpenEvent
                ? "border-[#eadfd3] bg-[#fffaf6] hover:bg-white"
                : "border-[#eadfd3] bg-[#fffaf6]"
            }`}
            disabled={!canOpenEvent}
            onClick={() => {
              if (event && onOpenEvent) {
                onOpenEvent(event.id);
              }
            }}
            type="button"
          >
            <div className="mx-auto w-fit rounded-full bg-[linear-gradient(135deg,#ff6b57,#f08a24)] p-[2px]">
              <div className="h-[76px] w-[76px] overflow-hidden rounded-full border-2 border-white bg-[#f7e7dc]">
                <img
                  alt={label}
                  className="h-full w-full object-cover"
                  src={getStoryPreviewImage(story, state)}
                />
              </div>
            </div>
            <p className="mt-3 truncate text-sm font-semibold text-[#1d160f]">
              {isCurrentUser ? "Tu historia" : label}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-[#8f6f59]">{subtitle}</p>
          </button>
        );
      })}
    </div>
  );
}

function SocialPostCard({
  onOpenEvent,
  onOpenProfileUser,
  post,
  state
}: {
  onOpenEvent: (eventId: string) => void;
  onOpenProfileUser: (userId: string) => void;
  post: SocialPost;
  state: PersistedState;
}) {
  if (post.authorType === "event") {
    const event = getEventById(state, post.authorId);

    if (!event) {
      return null;
    }

    return (
      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-[#eadfd3] bg-[#f5e4d6]">
              <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
            </div>
            <div>
              <p className="font-semibold text-[#1d160f]">{event.title}</p>
              <p className="text-sm text-[#6d5749]">
                Evento - {formatRelativeTime(post.createdAt)}
              </p>
            </div>
          </div>
          <button
            className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm font-semibold text-[#1d160f]"
            onClick={() => onOpenEvent(event.id)}
            type="button"
          >
            Abrir chat
          </button>
        </div>
        <div className="mt-4 overflow-hidden rounded-[28px] border border-[#eadfd3] bg-[#f6efe7]">
          <img alt={event.title} className="h-[320px] w-full object-cover" src={post.imageUrl} />
        </div>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1d160f]">{event.venue}</p>
            <p className="mt-1 text-sm leading-6 text-[#5f4b3f]">
              {post.caption || event.summary}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f6f59]">
            <Ticket className="h-3.5 w-3.5" />
            Evento
          </div>
        </div>
      </SectionCard>
    );
  }

  const author = getUserById(state, post.authorId);

  return (
    <SectionCard>
      <button className="flex w-full items-center gap-3 text-left" onClick={() => onOpenProfileUser(author.id)} type="button">
        <AvatarChip user={author} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(author)}</p>
          <p className="text-sm text-[#6d5749]">{formatRelativeTime(post.createdAt)}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f6f59]">
          <Heart className="h-3.5 w-3.5" />
          Perfil
        </div>
      </button>
      <div className="mt-4 overflow-hidden rounded-[28px] border border-[#eadfd3] bg-[#f6efe7]">
        <img alt={author.name} className="h-[320px] w-full object-cover" src={post.imageUrl} />
      </div>
      <p className="mt-4 text-sm leading-6 text-[#5f4b3f]">{post.caption || author.tagline}</p>
    </SectionCard>
  );
}

function EventWorkspace({
  collection,
  currentUser,
  currentView,
  event,
  eventMediaDraft,
  groupDraft,
  mode,
  onChangeEvent,
  onChangeEventMediaDraft,
  onChangeGroupDraft,
  onChangeRequestDraft,
  onChangeView,
  onCreateEventPost,
  onCreateEventStory,
  onLeaveEvent,
  onOpenChatMedia,
  onOpenPrivateChat,
  onRequestEventAccess,
  onRespondEventAccess,
  onRespondEventInvite,
  onSendEventInvite,
  onRespondPrivateRequest,
  onSelectAttendee,
  onSendGroupMessage,
  onSendGroupMediaMessage,
  onSendPrivateRequest,
  onToggleEventChatMode,
  onToggleFriendship,
  requestDraft,
  selectedAttendeeId,
  state
}: {
  collection: ReturnType<typeof getDiscoverFeedEvents>;
  currentUser: PlatformUser;
  currentView: EventDetailTab;
  event: NonNullable<ReturnType<typeof getEventById>>;
  eventMediaDraft: { imageUrl: string; caption: string };
  groupDraft: string;
  mode: "discover" | "agenda";
  onChangeEvent: (eventId: string) => void;
  onChangeEventMediaDraft: (patch: Partial<{ imageUrl: string; caption: string }>) => void;
  onChangeGroupDraft: (value: string) => void;
  onChangeRequestDraft: (targetUserId: string, value: string) => void;
  onChangeView: (view: EventDetailTab) => void;
  onCreateEventPost: () => void;
  onCreateEventStory: () => void;
  onLeaveEvent: (eventId: string) => void;
  onOpenChatMedia: (
    messageId: string,
    authorId: string,
    authorLabel: string,
    media: ChatMediaAttachment
  ) => void;
  onOpenPrivateChat: (chatId: string) => void;
  onRequestEventAccess: (eventId: string) => void;
  onRespondEventAccess: (membershipId: string, accept: boolean) => void;
  onRespondEventInvite: (inviteId: string, accept: boolean) => void;
  onSendEventInvite: (targetUserId: string) => void;
  onRespondPrivateRequest: (requestId: string, accept: boolean) => void;
  onSelectAttendee: (userId: string) => void;
  onSendGroupMessage: () => void;
  onSendGroupMediaMessage: (file: File | null) => void;
  onSendPrivateRequest: (targetUserId: string) => void;
  onToggleEventChatMode: (mode: "open" | "announcements") => void;
  onToggleFriendship: (targetUserId: string) => void;
  requestDraft: string;
  selectedAttendeeId: string | null;
  state: PersistedState;
}) {
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const host = getUserById(state, event.hostId);
  const accessState = getEventAccessState(state, event.id, currentUser.id);
  const isHost = accessState.kind === "host";
  const canAccess = hasEventAccess(state, event.id, currentUser.id);
  const guestCount = getEventGuestCount(state, event.id);
  const pendingCount = getEventPendingCount(state, event.id);
  const fill = Math.round(getEventAttendanceRatio(state, event.id) * 100);
  const messages = getEventMessages(state, event.id);
  const members = getEventMembers(state, event.id);
  const friendMembers = getEventFriendMembers(state, event.id, currentUser.id);
  const pendingRequests = isHost ? getEventPendingRequests(state, event.id) : [];
  const pendingInvites = getEventInvitesForUser(state, currentUser.id).filter(
    (invite) => invite.eventId === event.id && invite.status === "pending"
  );
  const health = getEventHealth(state, event.id);
  const requirement = getEventRequirementSummary(state, event.id);
  const categoryMeta = getCategoryMeta(event.category);
  const invitableFriends = getEventInvitableFriends(state, event.id, currentUser.id);
  const eventPosts = getEventPosts(state, event.id);
  const eventStories = getEventStories(state, event.id);
  const attendee =
    (canAccess ? members : friendMembers).find((user) => user.id === selectedAttendeeId) ??
    (canAccess ? members : friendMembers).find((user) => user.id !== currentUser.id) ??
    (canAccess ? members : friendMembers)[0] ??
    null;
  const connectionState =
    attendee && canAccess
      ? getEventConnectionState(state, event.id, currentUser.id, attendee.id)
      : null;
  const shareUrl = buildEventShareUrl(event.slug);
  const shareCopy = buildEventShareCopy(event, shareUrl);
  const canWrite = canWriteEventChat(state, event.id, currentUser.id);
  const chatMode = getEventChatMode(state, event.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventTabs =
    mode === "agenda"
      ? [
          { id: "chat" as const, label: "Chat" },
          { id: "people" as const, label: "Miembros" },
          { id: "overview" as const, label: "Detalles" }
        ]
      : [
          { id: "overview" as const, label: "Detalles" },
          { id: "chat" as const, label: "Chat general" },
          { id: "people" as const, label: "Asistentes" }
        ];

  useEffect(() => {
    if (!shareNotice || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => setShareNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [shareNotice]);

  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      const copied = await copyToClipboard(shareCopy);
      setShareNotice(
        copied
          ? "Enlace copiado. Ya puedes compartirlo donde quieras."
          : "Tu navegador no permite compartir directamente aqui."
      );
      return;
    }

    try {
      await navigator.share({
        title: event.title,
        text: event.summary,
        url: shareUrl
      });
      setShareNotice("Evento listo para compartir.");
    } catch {
      setShareNotice(null);
    }
  };

  const handleWhatsappShare = () => {
    if (typeof window === "undefined") {
      return;
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareCopy)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyShareLink = async () => {
    const copied = await copyToClipboard(shareUrl);
    setShareNotice(
      copied ? "Enlace copiado. Ya lo puedes pasar por mensaje o story." : "No se pudo copiar el enlace."
    );
  };

  const handleInstagramShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: shareCopy,
          url: shareUrl
        });
        setShareNotice("Abierto el panel de compartir para Instagram.");
        return;
      } catch {
        setShareNotice(null);
      }
    }

    const copied = await copyToClipboard(shareCopy);
    setShareNotice(
      copied
        ? "Texto copiado para pegarlo en una story o DM de Instagram."
        : "Copia manualmente el enlace para compartirlo en Instagram."
    );
  };

  return (
    <div className="space-y-5">
      {mode === "agenda" ? (
        <SectionCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-[24px] border border-[#eadfd3] bg-[#f4e3d8] shadow-[0_16px_30px_rgba(29,22,15,0.08)]">
                <img alt={event.title} className="h-full w-full object-cover" src={event.coverImage} />
              </div>
              <button
                className="min-w-0 text-left"
                onClick={() => onChangeView("overview")}
                type="button"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                  Grupo del evento
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-[#1d160f] md:text-4xl">
                  {event.title}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-[#5f4b3f]">{event.summary}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b07f63]">
                  Toca el titulo para abrir detalles, miembros e historias
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="light">{categoryMeta.label}</Pill>
                  <Pill tone="light">{guestCount} miembros</Pill>
                  <Pill tone="light">{event.visibility === "public" ? "Publico" : "Privado"}</Pill>
                </div>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                onClick={() => onChangeView("chat")}
                type="button"
              >
                Abrir chat
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-[#5f4b3f]"
                onClick={() => onChangeView("people")}
                type="button"
              >
                Ver miembros
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-[#5f4b3f]"
                onClick={() => void handleNativeShare()}
                type="button"
              >
                <Share2 className="h-4 w-4" />
                Compartir
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">Fecha</p>
              <p className="mt-2 text-sm font-semibold text-[#1d160f]">{formatEventDateRange(event)}</p>
            </div>
            <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">Lugar</p>
              <p className="mt-2 text-sm font-semibold text-[#1d160f]">
                {event.venue}, {event.city}
              </p>
            </div>
            <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">Creador</p>
              <p className="mt-2 text-sm font-semibold text-[#1d160f]">{getUserIdentityLabel(host)}</p>
            </div>
          </div>
        </SectionCard>
      ) : (
        <section className="relative overflow-hidden rounded-[38px] border border-[#eadfd3] text-white shadow-[0_34px_90px_rgba(20,17,16,0.18)]">
          <img alt={event.title} className="absolute inset-0 h-full w-full object-cover" src={event.coverImage} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,9,0.28),rgba(16,12,9,0.86))]" />
          <div className="relative p-5 md:p-7">
            <div className="flex flex-wrap gap-2">
              <Pill tone="dark">{categoryMeta.label}</Pill>
              <Pill tone="dark">{event.visibility === "public" ? "Publico" : "Privado"}</Pill>
              <Pill tone="dark">{guestCount} confirmados</Pill>
              <Pill tone="dark">{event.priceLabel}</Pill>
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
              {event.title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-white/76 md:text-base">{event.summary}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <InfoChip icon={<CalendarDays className="h-4 w-4" />} value={formatEventDateRange(event)} />
              <InfoChip icon={<MapPin className="h-4 w-4" />} value={`${event.venue}, ${event.city}`} />
              <InfoChip icon={<Users className="h-4 w-4" />} value={`${guestCount} de ${event.capacity} plazas`} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {isHost ? (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(240,138,36,0.28)]"
                    onClick={() => onChangeView("people")}
                    type="button"
                  >
                    Gestionar accesos
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
                    onClick={() => onChangeView("chat")}
                    type="button"
                  >
                    Abrir chat general
                  </button>
                </>
              ) : null}

              {accessState.kind === "approved" ? (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(240,138,36,0.28)]"
                    onClick={() => onChangeView("chat")}
                    type="button"
                  >
                    Entrar al chat general
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
                    onClick={() => onLeaveEvent(event.id)}
                    type="button"
                  >
                    Salir del evento
                  </button>
                </>
              ) : null}

              {accessState.kind === "available" ? (
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(240,138,36,0.28)]"
                  onClick={() => onRequestEventAccess(event.id)}
                  type="button"
                >
                  Solicitar acceso
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}

              {accessState.kind === "pending" ? (
                <div className="rounded-full border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white">
                  Solicitud pendiente de revision
                </div>
              ) : null}

              {accessState.kind === "rejected" ? (
                <div className="rounded-full border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white">
                  Solicitud rechazada
                </div>
              ) : null}

              <button
                className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
                onClick={() => void handleNativeShare()}
                type="button"
              >
                <Share2 className="h-4 w-4" />
                Compartir evento
              </button>

              <div className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/72">
                Crea {getUserIdentityLabel(host)}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className={mode === "agenda" ? "space-y-4" : "grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]"}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {eventTabs.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                    active
                      ? "bg-[#1d160f] text-white shadow-[0_14px_26px_rgba(29,22,15,0.16)]"
                      : "border border-[#eadfd3] bg-white/88 text-[#6d5749]"
                  }`}
                  onClick={() => onChangeView(item.id as EventDetailTab)}
                  type="button"
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {currentView === "overview" ? (
            <div className="space-y-4">
              {pendingInvites.length > 0 ? (
                <SectionCard>
                  <SectionLabel>Invitacion directa pendiente</SectionLabel>
                  <div className="mt-4 space-y-3">
                    {pendingInvites.map((invite) => {
                      const sender = getUserById(state, invite.fromUserId);

                      return (
                        <div
                          key={invite.id}
                          className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4"
                        >
                          <p className="text-sm leading-6 text-[#5f4b3f]">
                            {getUserIdentityLabel(sender)} te ha invitado personalmente. Si aceptas, entras
                            directamente en el grupo del evento.
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                              onClick={() => onRespondEventInvite(invite.id, true)}
                              type="button"
                            >
                              Entrar al chat
                            </button>
                            <button
                              className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#1d160f]"
                              onClick={() => onRespondEventInvite(invite.id, false)}
                              type="button"
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionLabel>Perfil del evento</SectionLabel>
                    <p className="mt-2 text-sm text-[#6d5749]">
                      Al entrar en el grupo, el evento vive como un perfil: puede publicar fotos,
                      historias y mover la conversacion antes de que llegue el dia.
                    </p>
                  </div>
                  <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                    {eventPosts.length} fotos - {eventStories.length} historias activas
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#5f4b3f]">{event.description}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {event.highlights.map((highlight) => (
                    <div
                      key={highlight}
                      className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4 text-sm text-[#5f4b3f]"
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#ff6b57]">
                        <Check className="h-4 w-4" />
                      </span>
                      <p className="mt-3 font-medium">{highlight}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                    Historias activas del evento
                  </p>
                  <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                    {eventStories.length === 0 ? (
                      <div className="rounded-[20px] border border-dashed border-[#eadfd3] bg-white px-4 py-4 text-sm text-[#6d5749]">
                        El evento todavia no ha subido historias.
                      </div>
                    ) : (
                      eventStories.map((story) => (
                        <div key={story.id} className="min-w-[160px] max-w-[160px]">
                          <div className="rounded-[26px] bg-[linear-gradient(135deg,#ff6b57,#f08a24)] p-[2px]">
                            <div className="overflow-hidden rounded-[24px] border border-white/60 bg-white">
                              <img
                                alt={event.title}
                                className="h-[210px] w-full object-cover"
                                src={story.imageUrl}
                              />
                            </div>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-[#1d160f]">
                            {story.caption || event.title}
                          </p>
                          <p className="mt-1 text-xs text-[#8f6f59]">
                            {formatRelativeTime(story.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {eventPosts.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[#eadfd3] bg-[#fffaf6] p-4 text-sm text-[#6d5749]">
                      El evento aun no ha publicado fotos.
                    </div>
                  ) : (
                    eventPosts.map((post) => (
                      <div
                        key={post.id}
                        className="overflow-hidden rounded-[24px] border border-[#eadfd3] bg-[#fffaf6]"
                      >
                        <img
                          alt={event.title}
                          className="h-[240px] w-full object-cover"
                          src={post.imageUrl}
                        />
                        <div className="p-4">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8f6f59]">
                            <Image className="h-4 w-4" />
                            Publicacion del evento
                          </div>
                          <p className="mt-3 text-sm leading-6 text-[#5f4b3f]">
                            {post.caption || event.summary}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              {isHost ? (
                <SectionCard>
                  <SectionLabel>Publicar como evento</SectionLabel>
                  <p className="mt-3 text-sm text-[#5f4b3f]">
                    Sube una foto o una historia para que el evento tenga vida propia como si fuera
                    un perfil.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.9fr]">
                    <label className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                        URL de imagen
                      </span>
                      <input
                        className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
                        onChange={(eventValue) =>
                          onChangeEventMediaDraft({ imageUrl: eventValue.target.value })
                        }
                        placeholder="https://..."
                        value={eventMediaDraft.imageUrl}
                      />
                    </label>
                    <label className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                        Texto
                      </span>
                      <input
                        className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
                        onChange={(eventValue) =>
                          onChangeEventMediaDraft({ caption: eventValue.target.value })
                        }
                        placeholder="Cuenta el ambiente, un avance o una foto del lugar"
                        value={eventMediaDraft.caption}
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                      onClick={onCreateEventPost}
                      type="button"
                    >
                      <Image className="h-4 w-4" />
                      Publicar foto
                    </button>
                    <button
                      className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#1d160f]"
                      onClick={onCreateEventStory}
                      type="button"
                    >
                      <Clock3 className="h-4 w-4" />
                      Subir historia 24h
                    </button>
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard>
                <SectionLabel>Acceso y viabilidad</SectionLabel>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                      Politica de acceso
                    </p>
                    <p className="mt-3 text-sm text-[#5f4b3f]">
                      {event.visibility === "public"
                        ? "Es publico y aparece en Descubrir, pero el creador aprueba cada solicitud."
                        : "Es privado. Solo lo ve quien lo crea y quien ya tiene acceso aprobado."}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                      Regla de la semana
                    </p>
                    <p className="mt-3 text-sm text-[#5f4b3f]">
                      Minimo {event.minimumGuestsRequired} personas inscritas en {event.validationWindowDays} dias.
                      {health === "confirmed"
                        ? " Este evento ya cumple el objetivo."
                        : ` Quedan ${requirement.remainingCount} por confirmar antes del ${getEventDeadlineLabel(event)}.`}
                    </p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard>
                <SectionLabel>Compartir e invitar</SectionLabel>
                <p className="mt-3 text-sm leading-6 text-[#5f4b3f]">
                  Comparte el enlace para abrir la ficha del evento. Si quieres invitar a alguien de
                  forma expresa, usa las invitaciones directas de abajo.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => void handleNativeShare()}
                    type="button"
                  >
                    <Share2 className="h-4 w-4" />
                    Compartir
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-[#d7f1e4] bg-[#effbf4] px-4 py-3 text-sm font-semibold text-[#1f8d60]"
                    onClick={handleWhatsappShare}
                    type="button"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-[#6d5749]"
                    onClick={() => void handleInstagramShare()}
                    type="button"
                  >
                    <Camera className="h-4 w-4" />
                    Instagram
                  </button>
                </div>
                <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                    Enlace del evento
                  </p>
                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <p className="min-w-0 flex-1 truncate text-sm text-[#5f4b3f]">{shareUrl}</p>
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#1d160f]"
                      onClick={() => void handleCopyShareLink()}
                      type="button"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar enlace
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-[#8f6f59]">
                    {shareNotice ??
                      "WhatsApp abre el evento al instante. Para Instagram usamos el compartir nativo o te copiamos el texto para pegarlo en story o DM."}
                  </p>
                </div>

                {isHost ? (
                  <div className="mt-5 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                        Invitar amigos
                      </p>
                      <div className="rounded-full border border-[#eadfd3] bg-white px-3 py-2 text-xs font-semibold text-[#6d5749]">
                        {invitableFriends.length} disponibles
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {invitableFriends.length === 0 ? (
                        <p className="text-sm text-[#6d5749]">
                          No te quedan amigos pendientes de invitar a este evento.
                        </p>
                      ) : (
                        invitableFriends.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#eadfd3] bg-white px-3 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <AvatarChip user={friend} />
                              <div>
                                <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(friend)}</p>
                                <p className="text-sm text-[#6d5749]">{getUserIdentityMeta(friend)}</p>
                              </div>
                            </div>
                            <button
                              className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                              onClick={() => onSendEventInvite(friend.id)}
                              type="button"
                            >
                              <UserPlus className="h-4 w-4" />
                              Invitar
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </SectionCard>
            </div>
          ) : null}

          {currentView === "chat" ? (
            canAccess ? (
              <SectionCard>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionLabel>Chat general del evento</SectionLabel>
                    <p className="mt-2 text-sm text-[#6d5749]">
                      {mode === "agenda"
                        ? "Este es el grupo principal del evento. Entra aqui para llegar ya con la conversacion empezada."
                        : "Solo los confirmados y el creador pueden escribir aqui. La idea es llegar con la comunidad ya calentada."}
                    </p>
                    <p className="mt-2 text-sm text-[#8f6f59]">
                      {chatMode === "announcements"
                        ? isHost
                          ? "Modo solo organizador activo."
                          : "Modo solo organizador activo: puedes leer, pero no escribir."
                        : "Modo abierto para todos."}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                      {messages.length} mensajes
                    </div>
                    {isHost ? (
                      <>
                        <button
                          className={`rounded-full px-4 py-2 text-sm font-semibold ${
                            chatMode === "open"
                              ? "bg-[#1d160f] text-white"
                              : "border border-[#eadfd3] bg-[#fffaf6] text-[#6d5749]"
                          }`}
                          onClick={() => onToggleEventChatMode("open")}
                          type="button"
                        >
                          Abierto
                        </button>
                        <button
                          className={`rounded-full px-4 py-2 text-sm font-semibold ${
                            chatMode === "announcements"
                              ? "bg-[#1d160f] text-white"
                              : "border border-[#eadfd3] bg-[#fffaf6] text-[#6d5749]"
                          }`}
                          onClick={() => onToggleEventChatMode("announcements")}
                          type="button"
                        >
                          Solo yo
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {messages.map((message) => {
                    const parsed = parseChatMessage(message.text);
                    if (message.authorId === "system") {
                      return (
                        <div
                          key={message.id}
                          className="rounded-[20px] border border-dashed border-[#f0d8ca] bg-[#fff3ec] px-4 py-3 text-sm text-[#c86730]"
                        >
                          {parsed.summary}
                        </div>
                      );
                    }

                    const author = getUserById(state, message.authorId);
                    const mine = message.authorId === currentUser.id;
                    const authorLabel = getUserIdentityLabel(author);
                    const viewed = hasViewedMessageMedia(state, message.id, currentUser.id);

                    if (mine) {
                      return (
                        <div key={message.id} className="flex items-end justify-end gap-3">
                          <div className="max-w-[560px] rounded-[24px] bg-[#1d160f] px-4 py-3 text-sm text-white shadow-[0_18px_34px_rgba(29,22,15,0.14)]">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/68">
                              {authorLabel}
                            </p>
                            {parsed.story ? <StoryMessageCard dark state={state} storyAttachment={parsed.story} /> : null}
                            {parsed.media ? (
                              <ChatMediaMessageCard
                                dark
                                media={parsed.media}
                                mine
                                onOpen={() =>
                                  onOpenChatMedia(message.id, message.authorId, authorLabel, parsed.media!)
                                }
                                viewed={viewed}
                              />
                            ) : null}
                            {parsed.body ? <p>{parsed.body}</p> : null}
                            <p className="mt-2 text-[11px] text-white/64">
                              {formatTime(message.createdAt)}
                            </p>
                          </div>
                          <AvatarChip user={author} />
                        </div>
                      );
                    }

                    return (
                      <div key={message.id} className="flex gap-3">
                        <AvatarChip user={author} />
                        <div className="max-w-[620px] rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm text-[#5f4b3f]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold text-[#1d160f]">{authorLabel}</p>
                            <span className="text-xs text-[#8f6f59]">{formatTime(message.createdAt)}</span>
                          </div>
                          {parsed.story ? <StoryMessageCard state={state} storyAttachment={parsed.story} /> : null}
                          {parsed.media ? (
                            <ChatMediaMessageCard
                              media={parsed.media}
                              mine={false}
                              onOpen={() =>
                                onOpenChatMedia(message.id, message.authorId, authorLabel, parsed.media!)
                              }
                              viewed={viewed}
                            />
                          ) : null}
                          {parsed.body ? <p className="mt-1">{parsed.body}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                  <input
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(event) => {
                      void onSendGroupMediaMessage(event.target.files?.[0] ?? null);
                      event.target.value = "";
                    }}
                    ref={fileInputRef}
                    type="file"
                  />
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                      Escribe al grupo
                    </span>
                    <textarea
                      className="w-full resize-none rounded-[18px] border border-[#e7d8cb] bg-white px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                      onChange={(eventValue) => onChangeGroupDraft(eventValue.target.value)}
                      placeholder={canWrite ? event.conversationPrompt : "Modo solo organizador activo"}
                      rows={3}
                      disabled={!canWrite}
                      value={groupDraft}
                    />
                  </label>
                  <div className="mt-3 flex justify-between gap-3">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#1d160f] disabled:opacity-45"
                      disabled={!canWrite}
                      onClick={() => fileInputRef.current?.click()}
                      type="button"
                    >
                      <Image className="h-4 w-4" />
                      Foto efimera
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-45"
                      disabled={!canWrite}
                      onClick={onSendGroupMessage}
                      type="button"
                    >
                      <Send className="h-4 w-4" />
                      Enviar mensaje
                    </button>
                  </div>
                </div>
              </SectionCard>
            ) : (
              <EmptyState
                title="Necesitas aprobacion para entrar al chat"
                copy="El grupo general se activa cuando el creador acepta tu solicitud de acceso."
                action={
                  accessState.kind === "available" ? (
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white"
                      onClick={() => onRequestEventAccess(event.id)}
                      type="button"
                    >
                      Solicitar acceso
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : undefined
                }
              />
            )
          ) : null}

          {currentView === "people" ? (
            canAccess || isHost ? (
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <SectionCard>
                  <div className="flex items-center justify-between gap-3">
                    <SectionLabel>Asistentes visibles</SectionLabel>
                    <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                      {members.length} perfiles
                    </div>
                  </div>

                  {isHost ? (
                    <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                        Solicitudes pendientes
                      </p>
                      <div className="mt-3 space-y-3">
                        {pendingRequests.length === 0 ? (
                          <p className="text-sm text-[#6d5749]">
                            No hay solicitudes pendientes en este evento.
                          </p>
                        ) : (
                          pendingRequests.map((membership) => {
                            const applicant = getUserById(state, membership.userId);
                            return (
                              <div
                                key={membership.id}
                                className="rounded-[20px] border border-[#eadfd3] bg-white px-3 py-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(applicant)}</p>
                                    <p className="text-xs text-[#8f6f59]">
                                      {formatRelativeTime(membership.requestedAt)}
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      className="rounded-full bg-[#1d160f] px-3 py-2 text-xs font-semibold text-white"
                                      onClick={() => onRespondEventAccess(membership.id, true)}
                                      type="button"
                                    >
                                      Aprobar
                                    </button>
                                    <button
                                      className="rounded-full border border-[#eadfd3] px-3 py-2 text-xs font-semibold text-[#6d5749]"
                                      onClick={() => onRespondEventAccess(membership.id, false)}
                                      type="button"
                                    >
                                      Rechazar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {members.map((member) => {
                      const active = attendee?.id === member.id;
                      return (
                        <button
                          key={member.id}
                          className={`flex w-full items-center gap-3 rounded-[24px] border p-3 text-left transition ${
                            active
                              ? "border-[#ffb493] bg-[#fff0e8]"
                              : "border-[#eadfd3] bg-[#fffaf6]"
                          }`}
                          onClick={() => onSelectAttendee(member.id)}
                          type="button"
                        >
                          <AvatarChip user={member} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold text-[#1d160f]">{getUserIdentityLabel(member)}</p>
                              {member.id === event.hostId ? (
                                <span className="rounded-full bg-[#1d160f] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                  Host
                                </span>
                              ) : null}
                              {areFriends(state, currentUser.id, member.id) ? (
                                <span className="rounded-full border border-[#d7f1e4] bg-[#effbf4] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1f8d60]">
                                  Amigo
                                </span>
                              ) : null}
                            </div>
                            <p className="truncate text-sm text-[#6d5749]">{member.title}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-[#8f6f59]" />
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard>
                  {attendee ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-full border border-[#eadfd3] bg-[#f5e4d6]">
                          <img alt={attendee.name} className="h-full w-full object-cover" src={attendee.avatar} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-2xl font-black tracking-tight text-[#1d160f]">
                              {getUserIdentityLabel(attendee)}
                            </h3>
                            {attendee.id === event.hostId ? (
                              <span className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-1 text-xs font-semibold text-[#6d5749]">
                                Creador del evento
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm font-semibold text-[#8f6f59]">
                            {attendee.title}
                            {attendee.company ? ` Â· ${attendee.company}` : ""}
                          </p>
                          <p className="mt-2 text-sm text-[#5f4b3f]">{attendee.bio}</p>
                        </div>
                      </div>

                      {attendee.id !== currentUser.id ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold ${
                              areFriends(state, currentUser.id, attendee.id)
                                ? "border border-[#eadfd3] bg-white text-[#6d5749]"
                                : "bg-[#1d160f] text-white"
                            }`}
                            onClick={() => onToggleFriendship(attendee.id)}
                            type="button"
                          >
                            <UserPlus className="h-4 w-4" />
                            {areFriends(state, currentUser.id, attendee.id)
                              ? "Quitar de amigos"
                              : "Agregar a amigos"}
                          </button>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {attendee.interests.map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold text-[#6d5749]"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>

                      <div className="mt-5 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                          Conexion privada
                        </p>

                        {connectionState?.kind === "self" ? (
                          <p className="mt-3 text-sm text-[#5f4b3f]">
                            Este eres tu. Cambia de perfil desde Perfil si quieres probar el otro lado
                            del flujo.
                          </p>
                        ) : null}

                        {connectionState?.kind === "available" ? (
                          <div className="mt-3">
                            <textarea
                              className="w-full resize-none rounded-[18px] border border-[#e7d8cb] bg-white px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                              onChange={(eventValue) => onChangeRequestDraft(attendee.id, eventValue.target.value)}
                              placeholder={`Hola ${getUserIdentityLabel(attendee)}, me encantaria conocerte mejor antes del evento.`}
                              rows={4}
                              value={requestDraft}
                            />
                            <div className="mt-3 flex justify-end">
                              <button
                                className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                                onClick={() => onSendPrivateRequest(attendee.id)}
                                type="button"
                              >
                                Solicitar chat privado
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {connectionState?.kind === "outgoing-request" ? (
                          <div className="mt-3 rounded-[18px] border border-[#eadfd3] bg-white px-4 py-4 text-sm text-[#5f4b3f]">
                            <p className="font-semibold text-[#1d160f]">Solicitud enviada</p>
                            <p className="mt-2">{connectionState.request.message}</p>
                            <p className="mt-3 text-xs text-[#8f6f59]">
                              Enviada {formatRelativeTime(connectionState.request.createdAt)}
                            </p>
                          </div>
                        ) : null}

                        {connectionState?.kind === "incoming-request" ? (
                          <div className="mt-3 rounded-[18px] border border-[#eadfd3] bg-white px-4 py-4 text-sm text-[#5f4b3f]">
                            <p className="font-semibold text-[#1d160f]">
                              {getUserIdentityLabel(getUserById(state, connectionState.request.fromUserId))} quiere hablar
                              contigo
                            </p>
                            <p className="mt-2">{connectionState.request.message}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                                onClick={() => onRespondPrivateRequest(connectionState.request.id, true)}
                                type="button"
                              >
                                Aceptar
                              </button>
                              <button
                                className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-[#6d5749]"
                                onClick={() => onRespondPrivateRequest(connectionState.request.id, false)}
                                type="button"
                              >
                                Rechazar
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {connectionState?.kind === "chat" ? (
                          <div className="mt-3 rounded-[18px] border border-[#eadfd3] bg-white px-4 py-4 text-sm text-[#5f4b3f]">
                            <p className="font-semibold text-[#1d160f]">Ya teneis chat privado abierto</p>
                            <p className="mt-2">
                              Este chat no caduca aunque el evento termine. Puedes abrirlo desde aqui o
                              desde Inbox.
                            </p>
                            <div className="mt-4">
                              <button
                                className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                                onClick={() => onOpenPrivateChat(connectionState.chat.id)}
                                type="button"
                              >
                                Abrir chat
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {connectionState?.kind === "rejected" ? (
                          <div className="mt-3 rounded-[18px] border border-[#eadfd3] bg-white px-4 py-4 text-sm text-[#5f4b3f]">
                            <p className="font-semibold text-[#1d160f]">Solicitud no disponible</p>
                            <p className="mt-2">
                              {connectionState.by === "them"
                                ? "La otra persona no acepto esta solicitud, asi que el privado no se ha abierto."
                                : "Has rechazado esta solicitud y el privado permanece cerrado."}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="Selecciona un asistente"
                      copy="Aqui podras revisar su perfil y gestionar el privado."
                    />
                  )}
                </SectionCard>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <SectionCard>
                  <div className="flex items-center justify-between gap-3">
                    <SectionLabel>Quien va</SectionLabel>
                    <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                      {guestCount} apuntados
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#5f4b3f]">
                    Hasta que no entres al evento no puedes ver la lista completa. Solo mostramos la
                    cantidad total y, si tienes amistades dentro, quienes son.
                  </p>

                  <div className="mt-5 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                      Amigos que ya estan dentro
                    </p>
                    <div className="mt-4 space-y-3">
                      {friendMembers.length === 0 ? (
                        <p className="text-sm text-[#6d5749]">
                          Ningun amigo tuyo aparece todavia en este evento.
                        </p>
                      ) : (
                        friendMembers.map((member) => {
                          const active = attendee?.id === member.id;

                          return (
                            <button
                              key={member.id}
                              className={`flex w-full items-center gap-3 rounded-[24px] border p-3 text-left transition ${
                                active
                                  ? "border-[#ffb493] bg-[#fff0e8]"
                                  : "border-[#eadfd3] bg-white"
                              }`}
                              onClick={() => onSelectAttendee(member.id)}
                              type="button"
                            >
                              <AvatarChip user={member} />
                              <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-[#1d160f]">{getUserIdentityLabel(member)}</p>
                              <p className="truncate text-sm text-[#6d5749]">{getUserIdentityMeta(member)}</p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-[#8f6f59]" />
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard>
                  {attendee ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="h-20 w-20 overflow-hidden rounded-full border border-[#eadfd3] bg-[#f5e4d6]">
                          <img alt={attendee.name} className="h-full w-full object-cover" src={attendee.avatar} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black tracking-tight text-[#1d160f]">
                            {getUserIdentityLabel(attendee)}
                          </h3>
                          <p className="mt-1 text-sm font-semibold text-[#8f6f59]">{attendee.title}</p>
                          <p className="mt-2 text-sm text-[#5f4b3f]">
                            Ya es amistad tuya y esta dentro del evento.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {attendee.interests.map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold text-[#6d5749]"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      title="Privacidad protegida"
                      copy="Cuando el creador te acepte podras ver a todo el grupo y pedir chats privados."
                    />
                  )}
                </SectionCard>
              </div>
            )
          ) : null}
        </div>

        {mode === "agenda" ? null : (
        <div className="space-y-4">
          <SectionCard>
            <SectionLabel>Mas eventos</SectionLabel>
            <div className="mt-4 space-y-3">
              {collection.map((item) => {
                const active = item.id === event.id;
                const itemAccess = getEventAccessState(state, item.id, currentUser.id);
                return (
                  <button
                    key={item.id}
                    className={`w-full rounded-[24px] border p-4 text-left transition ${
                      active
                        ? "border-[#ffb493] bg-[#fff0e8]"
                        : "border-[#eadfd3] bg-[#fffaf6]"
                    }`}
                    onClick={() => onChangeEvent(item.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                            {getCategoryMeta(item.category).label}
                          </span>
                          <span className="rounded-full border border-[#eadfd3] bg-white px-2 py-1 text-[10px] font-semibold text-[#6d5749]">
                            {item.visibility === "public" ? "Publico" : "Privado"}
                          </span>
                        </div>
                        <h3 className="mt-1 text-base font-bold text-[#1d160f]">{item.title}</h3>
                        <p className="mt-2 text-sm text-[#6d5749]">{formatEventDateRange(item)}</p>
                      </div>
                      <AccessBadge access={itemAccess.kind} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-[#6d5749]">
                      <span>{getEventGuestCount(state, item.id)} confirmados</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard>
            <SectionLabel>Senales del evento</SectionLabel>
            <div className="mt-4 space-y-4">
              <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                  Creador
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <AvatarChip user={host} />
                  <div>
                    <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(host)}</p>
                    <p className="text-sm text-[#6d5749]">
                      {host.title}
                      {host.company ? ` Â· ${host.company}` : ""}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-[#8f6f59]">
                  <span>Ocupacion</span>
                  <span>{fill}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[#efe5db]">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24]"
                    style={{ width: `${fill}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-[#5f4b3f]">
                  {guestCount} confirmados y {pendingCount} solicitudes pendientes.
                </p>
              </div>
              <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                  Objetivo minimo
                </p>
                <p className="mt-3 text-sm text-[#5f4b3f]">
                  {health === "confirmed"
                    ? "Este evento ya ha superado el minimo de 4 personas."
                    : `Quedan ${requirement.remainingCount} confirmaciones antes del ${getEventDeadlineLabel(event)}.`}
                </p>
              </div>
              <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                  Etiquetas
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-[#eadfd3] bg-white px-3 py-2 text-xs font-semibold text-[#6d5749]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
        )}
      </div>
    </div>
  );
}

function InboxSection({
  currentUser,
  onChangePrivateDraft,
  onCreateGroupChat,
  onOpenChatMedia,
  onOpenChat,
  onOpenDirectChatComposer,
  onRespondPrivateRequest,
  onSendMessage,
  onSendPrivateMediaMessage,
  isSendingMedia,
  isSendingMessage,
  pendingMessagesByChatId,
  privateChats,
  privateDraft,
  selectedChatId,
  state
}: {
  currentUser: PlatformUser;
  onChangePrivateDraft: (value: string) => void;
  onCreateGroupChat: () => void;
  onOpenChatMedia: (
    messageId: string,
    authorId: string,
    authorLabel: string,
    media: ChatMediaAttachment
  ) => void;
  onOpenChat: (chatId: string) => void;
  onOpenDirectChatComposer: () => void;
  onRespondPrivateRequest: (requestId: string, accept: boolean) => void;
  onSendMessage: () => void;
  onSendPrivateMediaMessage: (chatId: string, file: File | null) => void;
  isSendingMedia: boolean;
  isSendingMessage: boolean;
  pendingMessagesByChatId: Record<string, OptimisticChatMessage[]>;
  privateChats: ReturnType<typeof getPrivateChatsForUser>;
  privateDraft: string;
  selectedChatId: string | null;
  state: PersistedState;
}) {
  const privateRequests = getPrivateRequestsForUser(state, currentUser.id);
  const incomingRequests = privateRequests.filter(
    (request) => request.toUserId === currentUser.id && request.status === "pending"
  );
  const myAccessRequests = state.memberships
    .filter((membership) => membership.userId === currentUser.id)
    .slice()
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));
  const selectedChat = privateChats.find((chat) => chat.id === selectedChatId) ?? privateChats[0] ?? null;
  const selectedMessages = selectedChat ? getPrivateMessages(state, selectedChat.id) : [];
  const pendingMessages = selectedChat ? pendingMessagesByChatId[selectedChat.id] ?? [] : [];
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Inbox</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
          Solicitudes de acceso y conversaciones
        </h1>
        <p className="mt-2 text-sm text-[#6d5749]">
          Aqui ves si te han aprobado un evento y tambien gestionas los privados entre asistentes.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard>
            <SectionLabel>Estado de tus accesos</SectionLabel>
            <div className="mt-4 space-y-3">
              {myAccessRequests.length === 0 ? (
                <p className="rounded-[22px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-5 text-sm text-[#7a6455]">
                  Aun no has pedido acceso a ningun evento.
                </p>
              ) : (
                myAccessRequests.map((membership) => {
                  const event = getEventById(state, membership.eventId);
                  const tone =
                    membership.status === "approved"
                      ? "text-[#1f8d60] bg-[#e8fbf2]"
                      : membership.status === "rejected"
                        ? "text-[#d45d28] bg-[#fff0e8]"
                        : "text-[#8f6f59] bg-[#f7f1ea]";
                  const label =
                    membership.status === "approved"
                      ? "Aprobado"
                      : membership.status === "rejected"
                        ? "Rechazado"
                        : "Pendiente";
                  return (
                    <div
                      key={membership.id}
                      className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#1d160f]">{event?.title}</p>
                          <p className="mt-1 text-sm text-[#6d5749]">
                            Solicitado {formatRelativeTime(membership.requestedAt)}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
                          {label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <SectionLabel>Privados pendientes</SectionLabel>
            <div className="mt-4 space-y-3">
              {incomingRequests.length === 0 ? (
                <p className="rounded-[22px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-5 text-sm text-[#7a6455]">
                  Ahora mismo no tienes solicitudes privadas pendientes.
                </p>
              ) : (
                incomingRequests.map((request) => {
                  const sender = getUserById(state, request.fromUserId);
                  const event = getEventById(state, request.eventId);
                  return (
                    <div key={request.id} className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                      <div className="flex items-start gap-3">
                        <AvatarChip user={sender} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(sender)}</p>
                          <p className="text-sm text-[#8f6f59]">{event?.title}</p>
                          <p className="mt-2 text-sm text-[#5f4b3f]">{request.message}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                              onClick={() => onRespondPrivateRequest(request.id, true)}
                              type="button"
                            >
                              Aceptar
                            </button>
                            <button
                              className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]"
                              onClick={() => onRespondPrivateRequest(request.id, false)}
                              type="button"
                            >
                              Rechazar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard>
          <SectionLabel>Chats abiertos</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#1d160f]"
              onClick={onOpenDirectChatComposer}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Nuevo privado
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
              onClick={onCreateGroupChat}
              type="button"
            >
              <Users className="h-4 w-4" />
              Nuevo grupo
            </button>
          </div>
          <div className="mt-4 space-y-3">
              {privateChats.length === 0 ? (
                <p className="rounded-[22px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-5 text-sm text-[#7a6455]">
                  Todavia no has abierto ningun chat privado.
                </p>
              ) : (
                privateChats.map((chat) => {
                  const lastMessage = getLatestPrivateMessage(state, chat.id);
                  const active = chat.id === selectedChatId;
                  return (
                    <button
                      key={chat.id}
                      className={`flex w-full items-center gap-3 rounded-[24px] border p-4 text-left transition ${
                        active ? "border-[#ffb493] bg-[#fff0e8]" : "border-[#eadfd3] bg-[#fffaf6]"
                      }`}
                      onClick={() => onOpenChat(chat.id)}
                      type="button"
                    >
                      <ChatAvatarChip chat={chat} currentUserId={currentUser.id} state={state} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-semibold text-[#1d160f]">
                            {getChatTitle(state, chat, currentUser.id)}
                          </p>
                          <span className="text-xs text-[#8f6f59]">
                            {lastMessage ? formatTime(lastMessage.createdAt) : ""}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[#8f6f59]">
                          {getChatSubtitle(state, chat, currentUser.id)}
                        </p>
                        <p className="mt-1 truncate text-sm text-[#6d5749]">
                  {lastMessage ? parseChatMessage(lastMessage.text).summary : "Chat listo para empezar"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </SectionCard>
        </div>

        <SectionCard>
          {selectedChat ? (
            <div>
              <input
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  void onSendPrivateMediaMessage(selectedChat.id, event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
                ref={fileInputRef}
                type="file"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ChatAvatarChip chat={selectedChat} currentUserId={currentUser.id} state={state} />
                  <div>
                    <p className="font-semibold text-[#1d160f]">
                      {getChatTitle(state, selectedChat, currentUser.id)}
                    </p>
                    <p className="text-sm text-[#6d5749]">
                      {getChatSubtitle(state, selectedChat, currentUser.id)}
                    </p>
                  </div>
                </div>
                <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                  {selectedChat.originEventId
                    ? `Origen: ${getEventById(state, selectedChat.originEventId)?.title}`
                    : isGroupChat(selectedChat)
                      ? "Grupo libre"
                      : "Chat directo"}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedMessages.map((message) => {
                  const mine = message.authorId === currentUser.id;
                  const parsed = parseChatMessage(message.text);
                  const author = getUserById(state, message.authorId);
                  const authorLabel = getUserIdentityLabel(author);
                  const viewed = hasViewedMessageMedia(state, message.id, currentUser.id);
                  const deliveryState = mine
                    ? getPrivateMessageDeliveryState(state, selectedChat, currentUser.id, message.createdAt)
                    : null;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[520px] rounded-[24px] px-4 py-3 text-sm ${
                          mine
                            ? "bg-[#1d160f] text-white"
                            : "border border-[#eadfd3] bg-[#fffaf6] text-[#5f4b3f]"
                        }`}
                      >
                        {isGroupChat(selectedChat) ? (
                          <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${mine ? "text-white/70" : "text-[#8f6f59]"}`}>
                            {authorLabel}
                          </p>
                        ) : null}
                        {parsed.story ? <StoryMessageCard dark={mine} state={state} storyAttachment={parsed.story} /> : null}
                        {parsed.media ? (
                          <ChatMediaMessageCard
                            dark={mine}
                            media={parsed.media}
                            mine={mine}
                            onOpen={() =>
                              onOpenChatMedia(message.id, message.authorId, authorLabel, parsed.media!)
                            }
                            viewed={viewed}
                          />
                        ) : null}
                        {parsed.body ? <p>{parsed.body}</p> : null}
                        <div
                          className={`mt-2 flex items-center gap-1 text-[11px] ${
                            mine ? "justify-end text-white/64" : "text-[#8f6f59]"
                          }`}
                        >
                          <span>{formatTime(message.createdAt)}</span>
                          {mine && deliveryState ? <MessageDeliveryIndicator status={deliveryState} /> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {pendingMessages.map((message) => {
                  const parsed = parseChatMessage(message.text);
                  return (
                    <div key={message.clientId} className="flex justify-end">
                      <div className="max-w-[520px] rounded-[24px] bg-[#1d160f] px-4 py-3 text-sm text-white">
                        {parsed.reply ? (
                          <div className="mb-2 rounded-[16px] border-l-2 border-[#ff6b57] bg-white/10 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                              {parsed.reply.authorLabel}
                            </p>
                            <p className="mt-1 text-xs text-white/74">{parsed.reply.snippet}</p>
                          </div>
                        ) : null}
                        {parsed.body ? <p>{parsed.body}</p> : null}
                        <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-white/64">
                          <span>{formatTime(message.createdAt)}</span>
                          <MessageDeliveryIndicator status="pending" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                <div className="mb-3 flex justify-end">
                  <button
                    className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white px-4 py-2 text-sm font-semibold text-[#6d5749] disabled:opacity-45"
                    disabled={isSendingMedia}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <Image className="h-4 w-4" />
                    {isSendingMedia ? "Subiendo..." : "Foto efimera"}
                  </button>
                </div>
                <textarea
                  className="w-full resize-none rounded-[18px] border border-[#e7d8cb] bg-white px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                  disabled={isSendingMessage}
                  onChange={(eventValue) => onChangePrivateDraft(eventValue.target.value)}
                  placeholder={`Escribe en ${getChatTitle(state, selectedChat, currentUser.id)}...`}
                  rows={3}
                  value={privateDraft}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-45"
                    disabled={isSendingMessage || !privateDraft.trim()}
                    onClick={onSendMessage}
                    type="button"
                  >
                    {isSendingMessage ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isSendingMessage ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Sin chat seleccionado"
              copy="Acepta una solicitud o abre una conversacion desde la columna de la izquierda."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function ProfileSection({
  currentUser,
  friendSuggestions,
  friends,
  hostedCount,
  joinedCount,
  onCreateUserPost,
  onCreateUserStory,
  pendingApprovalsCount,
  onLogout,
  onResetDemo,
  onToggleFriendship,
  pendingEventInvites,
  profileMediaDraft,
  profilePosts,
  profileStories,
  profileStoryDraft,
  setProfileMediaDraft,
  setProfileStoryDraft,
  state
}: {
  currentUser: PlatformUser;
  friendSuggestions: PlatformUser[];
  friends: PlatformUser[];
  hostedCount: number;
  joinedCount: number;
  onCreateUserPost: () => void;
  onCreateUserStory: () => void;
  pendingApprovalsCount: number;
  onLogout: () => void;
  onResetDemo: () => void;
  onToggleFriendship: (targetUserId: string) => void;
  pendingEventInvites: EventInvite[];
  profileMediaDraft: MediaDraft;
  profilePosts: SocialPost[];
  profileStories: StoryItem[];
  profileStoryDraft: MediaDraft;
  setProfileMediaDraft: Dispatch<SetStateAction<MediaDraft>>;
  setProfileStoryDraft: Dispatch<SetStateAction<MediaDraft>>;
  state: PersistedState;
}) {
  const privateChats = getPrivateChatsForUser(state, currentUser.id);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[34px] border border-[#eadfd3] bg-white/88 shadow-[0_24px_60px_rgba(52,34,22,0.08)]">
        <div className="relative h-48 bg-[#eadfd3]">
          <img alt={currentUser.name} className="h-full w-full object-cover" src={currentUser.coverImage} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,16,12,0.02),rgba(20,16,12,0.44))]" />
        </div>
        <div className="relative px-5 pb-5">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-[#f6efe7] bg-white shadow-[0_16px_30px_rgba(29,22,15,0.12)]">
              <img alt={currentUser.name} className="h-full w-full object-cover" src={currentUser.avatar} />
            </div>
            <div className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight">{getUserIdentityLabel(currentUser)}</h1>
                {currentUser.verified ? (
                  <span className="rounded-full bg-[#1d160f] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                    Verificado
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-semibold text-[#8f6f59]">
                {currentUser.title}
                {currentUser.company ? ` Â· ${currentUser.company}` : ""}
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[#5f4b3f]">{currentUser.bio}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {currentUser.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold text-[#6d5749]"
              >
                {interest}
              </span>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <MetricTile label="Creados" value={String(hostedCount)} />
            <MetricTile label="Agenda" value={String(joinedCount)} />
            <MetricTile label="Amigos" value={String(friends.length)} />
            <MetricTile label="Privados" value={String(privateChats.length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <SectionCard>
          <SectionLabel>Tu contenido</SectionLabel>
          <p className="mt-3 text-sm text-[#5f4b3f]">
            Sube fotos a tu perfil o historias de 24 horas para que aparezcan en la portada tipo
            Instagram.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.9fr]">
            <label className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                Foto del perfil
              </span>
              <input
                className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
                onChange={(eventValue) =>
                  setProfileMediaDraft((current) => ({
                    ...current,
                    imageUrl: eventValue.target.value
                  }))
                }
                placeholder="https://..."
                value={profileMediaDraft.imageUrl}
              />
            </label>
            <label className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                Texto de la foto
              </span>
              <input
                className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
                onChange={(eventValue) =>
                  setProfileMediaDraft((current) => ({
                    ...current,
                    caption: eventValue.target.value
                  }))
                }
                placeholder="Algo que quieras contar"
                value={profileMediaDraft.caption}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
              onClick={onCreateUserPost}
              type="button"
            >
              <Image className="h-4 w-4" />
              Publicar foto
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_0.9fr]">
            <label className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                Historia 24h
              </span>
              <input
                className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
                onChange={(eventValue) =>
                  setProfileStoryDraft((current) => ({
                    ...current,
                    imageUrl: eventValue.target.value
                  }))
                }
                placeholder="https://..."
                value={profileStoryDraft.imageUrl}
              />
            </label>
            <label className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                Texto de la historia
              </span>
              <input
                className="w-full border-none bg-transparent p-0 text-sm text-[#1d160f] outline-none"
                onChange={(eventValue) =>
                  setProfileStoryDraft((current) => ({
                    ...current,
                    caption: eventValue.target.value
                  }))
                }
                placeholder="Que estas haciendo ahora"
                value={profileStoryDraft.caption}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#1d160f]"
              onClick={onCreateUserStory}
              type="button"
            >
              <Clock3 className="h-4 w-4" />
              Subir historia
            </button>
          </div>

          <div className="mt-5 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                Historias activas
              </p>
              <div className="rounded-full border border-[#eadfd3] bg-white px-3 py-2 text-xs font-semibold text-[#6d5749]">
                {profileStories.length}
              </div>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {profileStories.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#eadfd3] bg-white px-4 py-4 text-sm text-[#6d5749]">
                  Todavia no has subido historias.
                </div>
              ) : (
                profileStories.map((story) => (
                  <div key={story.id} className="min-w-[148px] max-w-[148px]">
                    <div className="rounded-[24px] bg-[linear-gradient(135deg,#ff6b57,#f08a24)] p-[2px]">
                      <div className="overflow-hidden rounded-[22px] border border-white/60 bg-white">
                        <img
                          alt={currentUser.name}
                          className="h-[190px] w-full object-cover"
                          src={story.imageUrl}
                        />
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#1d160f]">
                      {story.caption || "Tu historia"}
                    </p>
                    <p className="mt-1 text-xs text-[#8f6f59]">
                      {formatRelativeTime(story.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>Fotos del perfil</SectionLabel>
              <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                {profilePosts.length} publicaciones
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {profilePosts.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#eadfd3] bg-[#fffaf6] p-4 text-sm text-[#6d5749] sm:col-span-2">
                  Aun no has publicado fotos en tu perfil.
                </div>
              ) : (
                profilePosts.map((post) => (
                  <div
                    key={post.id}
                    className="overflow-hidden rounded-[24px] border border-[#eadfd3] bg-[#fffaf6]"
                  >
                    <img
                      alt={currentUser.name}
                      className="h-[220px] w-full object-cover"
                      src={post.imageUrl}
                    />
                    <div className="p-4">
                      <p className="text-sm leading-6 text-[#5f4b3f]">
                        {post.caption || currentUser.tagline}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionLabel>Amigos y red</SectionLabel>
          <p className="mt-3 text-sm text-[#5f4b3f]">
            Desde aqui controlas tus amistades. Si alguien es amigo tuyo, podras saber si esta
            dentro de un evento aunque todavia no te hayas unido.
          </p>
          <div className="mt-4 space-y-3">
            {friends.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#eadfd3] bg-[#fffaf6] p-4 text-sm text-[#6d5749]">
                Todavia no tienes amigos agregados.
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4"
                >
                  <div className="flex items-center gap-3">
                    <AvatarChip user={friend} />
                    <div>
                      <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(friend)}</p>
                      <p className="text-sm text-[#6d5749]">{getUserIdentityMeta(friend)}</p>
                    </div>
                  </div>
                  <button
                    className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]"
                    onClick={() => onToggleFriendship(friend.id)}
                    type="button"
                  >
                    Quitar amigo
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                Sugerencias
              </p>
              <div className="rounded-full border border-[#eadfd3] bg-white px-3 py-2 text-xs font-semibold text-[#6d5749]">
                {friendSuggestions.length}
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {friendSuggestions.slice(0, 4).map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#eadfd3] bg-white px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <AvatarChip user={user} />
                    <div>
                      <p className="font-semibold text-[#1d160f]">{getUserIdentityLabel(user)}</p>
                      <p className="text-sm text-[#6d5749]">{getUserIdentityMeta(user)}</p>
                    </div>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => onToggleFriendship(user.id)}
                    type="button"
                  >
                    <UserPlus className="h-4 w-4" />
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
              <SectionLabel>Invitaciones directas</SectionLabel>
              <div className="mt-4 space-y-3">
                {pendingEventInvites.length === 0 ? (
                  <p className="text-sm text-[#6d5749]">
                    No tienes invitaciones directas pendientes ahora mismo.
                  </p>
                ) : (
                  pendingEventInvites.map((invite) => {
                    const inviteEvent = getEventById(state, invite.eventId);
                    const sender = getUserById(state, invite.fromUserId);

                    if (!inviteEvent) {
                      return null;
                    }

                    return (
                      <div
                        key={invite.id}
                        className="rounded-[20px] border border-[#eadfd3] bg-white px-3 py-3"
                      >
                        <p className="font-semibold text-[#1d160f]">{inviteEvent.title}</p>
                        <p className="mt-1 text-sm text-[#6d5749]">
                          Invitacion de {getUserIdentityLabel(sender)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
              <SectionLabel>Cuenta y datos</SectionLabel>
              <p className="mt-3 text-sm text-[#5f4b3f]">
                Puedes cerrar sesion o vaciar los datos guardados para volver al estado inicial.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#5f4b3f]"
                  onClick={onLogout}
                  type="button"
                >
                  Cerrar sesion
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                  onClick={onResetDemo}
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reiniciar todo
                </button>
              </div>
              <div className="mt-4 rounded-[20px] border border-[#eadfd3] bg-white px-4 py-4 text-sm text-[#6d5749]">
                {pendingApprovalsCount} solicitudes por revisar en tus eventos.
              </div>
            </section>
          </div>
        </SectionCard>
      </section>

    </div>
  );
}

function SyncStatus({
  error,
  isRealtimeConnected,
  isSyncing
}: {
  error: string | null;
  isRealtimeConnected: boolean;
  isSyncing: boolean;
}) {
  if (!error && !isSyncing && isRealtimeConnected) {
    return null;
  }

  return (
    <section
      className={`mb-5 rounded-[24px] border px-4 py-3 text-sm shadow-[0_16px_30px_rgba(52,34,22,0.05)] ${
        error
          ? "border-[#ffcfbb] bg-[#fff4ed] text-[#b14a20]"
          : "border-[#eadfd3] bg-white/88 text-[#6d5749]"
      }`}
    >
      {error
        ? `Backend local: ${error}`
        : `Backend activo: cambios guardandose en el store local o remoto. Chat en tiempo real ${
            isRealtimeConnected ? "conectado" : "reconectando"
          }.`}
    </section>
  );
}

function LoadingScreen({
  error,
  onRetry
}: {
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6efe7] px-4">
      <div className="rounded-[34px] border border-[#eadfd3] bg-white/88 px-6 py-8 text-center shadow-[0_24px_60px_rgba(52,34,22,0.08)]">
        <BrandMark />
        <p className="mt-4 text-sm text-[#6d5749]">
          {error ?? "Cargando la plataforma social..."}
        </p>
        {error && onRetry ? (
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
            onClick={onRetry}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[#eadfd3] bg-white/88 px-4 py-3 shadow-[0_14px_28px_rgba(52,34,22,0.06)]">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff6b57] to-[#f08a24] text-white shadow-[0_14px_24px_rgba(240,138,36,0.25)]">
        <Sparkles className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-black tracking-tight text-[#1d160f]">{APP_NAME}</p>
        <p className="text-[11px] uppercase tracking-[0.26em] text-[#8f6f59]">{APP_TAGLINE}</p>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-[#1d160f]">{value}</p>
    </div>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">{children}</p>
  );
}

function EmptyState({
  action,
  copy,
  title
}: {
  action?: ReactNode;
  copy: string;
  title: string;
}) {
  return (
    <section className="rounded-[30px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] p-6 text-center shadow-[0_24px_60px_rgba(52,34,22,0.04)]">
      <p className="text-lg font-bold text-[#1d160f]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-[#6d5749]">{copy}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}

function InfoChip({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-[22px] border border-white/16 bg-white/10 px-4 py-3 text-sm text-white/76 backdrop-blur">
      <span className="text-white">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: "dark" | "light" }) {
  return (
    <span
      className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
        tone === "dark"
          ? "border border-white/16 bg-white/10 text-white/78"
          : "border border-[#eadfd3] bg-[#fffaf6] text-[#6d5749]"
      }`}
    >
      {children}
    </span>
  );
}

function AvatarChip({ user }: { user: PlatformUser }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-11 w-11 overflow-hidden rounded-full border border-[#eadfd3] bg-[#f5e4d6]">
        {user.avatar ? (
          <img alt={getUserIdentityLabel(user)} className="h-full w-full object-cover" src={user.avatar} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#1d160f]">
            {getInitials(getUserIdentityLabel(user).replace(/^@/, ""))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatAvatarChip({
  chat,
  currentUserId,
  state
}: {
  chat: PrivateChat;
  currentUserId: string;
  state: PersistedState;
}) {
  if (!isGroupChat(chat)) {
    return <AvatarChip user={getChatPartner(state, chat, currentUserId)} />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#eadfd3] bg-[linear-gradient(135deg,#ff6b57,#f08a24)] text-white">
        <Users className="h-5 w-5" />
      </div>
    </div>
  );
}

function AccessBadge({
  access
}: {
  access: ReturnType<typeof getEventAccessState>["kind"];
}) {
  const config =
    access === "host"
      ? { label: "Host", className: "bg-[#1d160f] text-white" }
      : access === "approved"
        ? { label: "Dentro", className: "bg-[#e8fbf2] text-[#1f8d60]" }
        : access === "pending"
          ? { label: "Pendiente", className: "bg-[#f7f1ea] text-[#8f6f59]" }
          : access === "rejected"
            ? { label: "Rechazado", className: "bg-[#fff0e8] text-[#d45d28]" }
            : { label: "Solicitar", className: "bg-white text-[#6d5749] border border-[#eadfd3]" };

  return <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${config.className}`}>{config.label}</span>;
}

function buildNavItems() {
  return [
    {
      id: "discover" as const,
      label: "Inicio",
      icon: <Compass className="h-4 w-4" />
    },
    {
      id: "search" as const,
      label: "Buscar",
      icon: <Search className="h-4 w-4" />
    },
    {
      id: "agenda" as const,
      label: "Eventos",
      icon: <Ticket className="h-4 w-4" />
    },
    {
      id: "inbox" as const,
      label: "Chats",
      icon: <Inbox className="h-4 w-4" />
    },
    {
      id: "profile" as const,
      label: "Perfil",
      icon: <User className="h-4 w-4" />
    },
    {
      id: "host" as const,
      label: "Crear",
      icon: <Shield className="h-4 w-4" />
    }
  ];
}

function pickEvent(
  events: ReturnType<typeof getDiscoverFeedEvents>,
  selectedEventId: string | null
) {
  return events.find((event) => event.id === selectedEventId) ?? null;
}
