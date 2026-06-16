"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Copy,
  Heart,
  Inbox,
  Image,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Share2,
  Shield,
  Sparkles,
  Ticket,
  User,
  UserPlus,
  Users
} from "lucide-react";
import { OrganizerDashboard } from "@/components/tindereo/organizer-dashboard";
import {
  executePlatformAction,
  extractPlatformData,
  fetchPlatformData,
  resetPlatformData,
  subscribeToPlatformStream
} from "@/lib/tindereo-api";
import { APP_NAME, APP_TAGLINE, EVENT_CATEGORY_OPTIONS } from "@/lib/tindereo-data";
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
  PlatformAction,
  PlatformDataEnvelope,
  PersistedState,
  PlatformUser,
  RegisterUserInput,
  SocialPost,
  StoryItem
} from "@/lib/tindereo-types";
import {
  areFriends,
  formatEventDateRange,
  formatRelativeTime,
  formatTime,
  getActiveStories,
  getCategoryMeta,
  getChatPartner,
  getCurrentUser,
  getDiscoverFeedEvents,
  getEventAccessState,
  getEventAttendanceRatio,
  getEventById,
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
  getPendingEventInvitesForUser,
  getProfilePosts,
  getProfileStories,
  getPrivateChatsForUser,
  getPrivateMessages,
  getPrivateRequestsForUser,
  getUserById,
  hasEventAccess,
  normalizeState
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
  return `Te paso ${event.title} en Tindereo. ${event.summary} Únete aquí: ${shareUrl}`;
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

const INITIAL_REGISTER_FORM: RegisterUserInput = {
  name: "",
  handle: "",
  city: "Madrid",
  bio: ""
};

type MediaDraft = {
  imageUrl: string;
  caption: string;
};

export function TindereoApp() {
  const [state, setState] = useState<PersistedState | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [requestDrafts, setRequestDrafts] = useState<Record<string, string>>({});
  const [selectedAttendeeByEvent, setSelectedAttendeeByEvent] = useState<Record<string, string>>({});
  const [privateDraft, setPrivateDraft] = useState("");
  const [profileMediaDraft, setProfileMediaDraft] = useState({ imageUrl: "", caption: "" });
  const [profileStoryDraft, setProfileStoryDraft] = useState({ imageUrl: "", caption: "" });
  const [eventMediaDrafts, setEventMediaDrafts] = useState<
    Record<string, { imageUrl: string; caption: string }>
  >({});
  const [registerForm, setRegisterForm] = useState<RegisterUserInput>(INITIAL_REGISTER_FORM);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
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
    if (revision > 0 && revision <= latestRevisionRef.current) {
      return;
    }

    if (revision > latestRevisionRef.current) {
      latestRevisionRef.current = revision;
    }

    const data = extractPlatformData(payload);
    const sharedEventId = data.events.find((event) => event.slug === readSharedEventSlug())?.id;
    const metaSessionPatch: Partial<PersistedState["session"]> = {};

    if (payload.meta?.currentUserId) {
      metaSessionPatch.currentUserId = payload.meta.currentUserId;
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
  }, []);

  useEffect(() => {
    if (!state || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state.session));
    writeSharedEventSlug(
      state.events.find((event) => event.id === state.session.selectedEventId)?.slug ?? null
    );
  }, [state]);

  if (!state) {
    return <LoadingScreen error={syncError} onRetry={() => void loadPlatform()} />;
  }

  const handleLogin = (userId: string) => {
    setSyncError(null);
    setState((current) =>
      current
        ? normalizeState({
            ...current,
            session: {
              ...current.session,
              isAuthenticated: true,
              currentUserId: userId,
              activeTab: "discover",
              selectedEventView: "overview",
              selectedPrivateChatId: null
            }
          })
        : current
    );
  };

  const handleRegister = async () => {
    const payload = await runPlatformMutation(
      {
        type: "register-user",
        input: registerForm
      },
      {
        isAuthenticated: true,
        activeTab: "discover",
        selectedEventView: "overview",
        selectedPrivateChatId: null
      }
    );

    if (payload) {
      setRegisterForm(INITIAL_REGISTER_FORM);
    }
  };

  if (!state.session.isAuthenticated) {
    return (
      <AuthScreen
        error={syncError}
        form={registerForm}
        isSubmitting={isSyncing}
        onChangeForm={(patch) =>
          setRegisterForm((current) => ({
            ...current,
            ...patch
          }))
        }
        onLogin={handleLogin}
        onRegister={() => void handleRegister()}
        users={state.users}
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
  };

  const openPrivateChat = (chatId: string) => {
    updateSession({
      activeTab: "inbox",
      selectedPrivateChatId: chatId
    });
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
    if (!message.trim()) {
      return;
    }

    const payload = await runPlatformMutation({
      type: "send-group-message",
      actorId: state.session.currentUserId,
      eventId,
      text: message
    });

    if (payload) {
      setGroupDrafts((current) => ({ ...current, [eventId]: "" }));
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

  const handleSendPrivateMessage = async () => {
    if (!selectedPrivateChat || !privateDraft.trim()) {
      return;
    }

    const payload = await runPlatformMutation({
      type: "send-private-message",
      actorId: state.session.currentUserId,
      chatId: selectedPrivateChat.id,
      text: privateDraft
    });

    if (payload) {
      setPrivateDraft("");
    }
  };

  const handleCreateUserPost = async () => {
    if (!profileMediaDraft.imageUrl.trim()) {
      return;
    }

    const payload = await runPlatformMutation({
      type: "create-user-post",
      actorId: state.session.currentUserId,
      imageUrl: profileMediaDraft.imageUrl,
      caption: profileMediaDraft.caption
    });

    if (payload) {
      setProfileMediaDraft({ imageUrl: "", caption: "" });
    }
  };

  const handleCreateUserStory = async () => {
    if (!profileStoryDraft.imageUrl.trim()) {
      return;
    }

    const payload = await runPlatformMutation({
      type: "create-user-story",
      actorId: state.session.currentUserId,
      imageUrl: profileStoryDraft.imageUrl,
      caption: profileStoryDraft.caption
    });

    if (payload) {
      setProfileStoryDraft({ imageUrl: "", caption: "" });
    }
  };

  const handleCreateEventPost = async (eventId: string) => {
    const draft = eventMediaDrafts[eventId];
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

    if (payload) {
      setEventMediaDrafts((current) => ({
        ...current,
        [eventId]: { imageUrl: "", caption: "" }
      }));
    }
  };

  const handleCreateEventStory = async (eventId: string) => {
    const draft = eventMediaDrafts[eventId];
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

    if (payload) {
      setEventMediaDrafts((current) => ({
        ...current,
        [eventId]: { imageUrl: "", caption: "" }
      }));
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
  };

  const handleLogout = () => {
    updateSession({
      isAuthenticated: false,
      activeTab: "discover",
      selectedEventView: "overview",
      selectedPrivateChatId: null
    });
  };

  const handleCreateEvent = async (input: CreateEventInput) => {
    const payload = await runPlatformMutation({
      type: "create-event",
      actorId: state.session.currentUserId,
      input
    });

    if (payload) {
      applyPlatformPayload(payload, {
        activeTab: "host",
        selectedEventId: payload.meta?.selectedEventId ?? null,
        selectedEventView: "chat"
      });
    }
  };

  const handleResetDemo = async () => {
    setSyncError(null);
    setIsSyncing(true);

    try {
      const payload = await resetPlatformData();
      applyPlatformPayload(payload, {
        isAuthenticated: state.session.isAuthenticated,
        currentUserId: state.session.currentUserId,
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
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "No se pudo reiniciar la demo en backend."
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6efe7] text-[#1d160f]">
      <main className="mx-auto max-w-[1240px] px-4 pb-32 pt-5 md:px-6 md:pb-10 md:pt-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandMark />
          {/*
          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-[#eadfd3] bg-white/88 px-4 py-2 text-sm text-[#6d5749] md:block">
              <span>
                {joinedCount} grupos - {hostedCount} creados - {pendingApprovalsCount} por revisar
              <span>{hostedCount} creados · {pendingApprovalsCount} por revisar</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white/88 px-4 py-2 text-sm font-semibold text-[#5f4b3f] shadow-[0_10px_24px_rgba(52,34,22,0.06)]"
              onClick={() => void handleResetDemo()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Reiniciar demo
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
              Reiniciar demo
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
                onSendPrivateRequest={(targetUserId) =>
                  handleSendPrivateRequest(discoverSelection.id, targetUserId)
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
                  onSendPrivateRequest={(targetUserId) =>
                    handleSendPrivateRequest(agendaSelection.id, targetUserId)
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
                copy="Solicita acceso a un evento publico o crea el tuyo propio desde la pestaña Crear."
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
            onOpenChat={openPrivateChat}
            onRespondPrivateRequest={handleRespondPrivateRequest}
            onSendMessage={handleSendPrivateMessage}
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
            onLogout={handleLogout}
            onResetDemo={handleResetDemo}
            onSwitchUser={handleSwitchUser}
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
            onCreateEvent={handleCreateEvent}
            onRespondToAccess={handleRespondEventAccess}
            onSelectEvent={(eventId) => openEvent(eventId, "discover")}
            state={state}
          />
        ) : null}
      </main>

      <MobileNavigation activeTab={state.session.activeTab} onChange={navigateToTab} />
    </div>
  );
}

function AuthScreen({
  error,
  form,
  isSubmitting,
  onChangeForm,
  onLogin,
  onRegister,
  users
}: {
  error: string | null;
  form: RegisterUserInput;
  isSubmitting: boolean;
  onChangeForm: (patch: Partial<RegisterUserInput>) => void;
  onLogin: (userId: string) => void;
  onRegister: () => void;
  users: PlatformUser[];
}) {
  return (
    <div className="min-h-screen bg-[#f6efe7] px-4 py-5 text-[#1d160f] md:px-6 md:py-8">
      <main className="mx-auto max-w-[1120px] space-y-5">
        <BrandMark />

        <div className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
          <section className="overflow-hidden rounded-[34px] border border-[#eadfd3] bg-white/88 shadow-[0_24px_60px_rgba(52,34,22,0.08)]">
            <div className="bg-[radial-gradient(circle_at_top_left,#ffd8c7,transparent_38%),linear-gradient(135deg,#1d160f,#463126_52%,#ff8d66_140%)] px-5 py-6 text-white md:px-7 md:py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                Acceso
              </p>
              <h1 className="mt-3 max-w-xl text-3xl font-black tracking-tight md:text-5xl">
                Descubre eventos y entra a su grupo antes de llegar.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/76 md:text-base">
                Esta demo ya entra con la nueva idea del producto: te apuntas a un evento, accedes
                al chat general y desde ahi decides con quien abrir privado.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <InfoChip icon={<Ticket className="h-4 w-4" />} value="Eventos publicos o privados" />
                <InfoChip icon={<MessageCircle className="h-4 w-4" />} value="Chats de grupo por evento" />
                <InfoChip icon={<Users className="h-4 w-4" />} value="Privados solo si aceptan" />
              </div>
            </div>

            <div className="grid gap-3 px-5 py-5 md:grid-cols-3 md:px-7">
              <MetricTile label="Perfiles demo" value={String(users.length)} />
              <MetricTile label="Sin password" value="Demo" />
              <MetricTile label="Registro" value="Local" />
            </div>
          </section>

          <div className="space-y-5">
            <SectionCard>
              <SectionLabel>Entrar con un perfil demo</SectionLabel>
              <p className="mt-3 text-sm text-[#5f4b3f]">
                Elige un usuario para revisar el producto desde dentro al instante.
              </p>
              <div className="mt-4 grid gap-3">
                {users.map((user) => (
                  <button
                    key={user.id}
                    className="flex items-center gap-3 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4 text-left transition hover:border-[#ffb493] hover:bg-[#fff0e8]"
                    onClick={() => onLogin(user.id)}
                    type="button"
                  >
                    <AvatarChip user={user} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#1d160f]">{user.name}</p>
                      <p className="truncate text-sm text-[#6d5749]">
                        {user.title} - {user.city}
                      </p>
                      <p className="mt-1 truncate text-xs text-[#8f6f59]">{user.handle}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#8f6f59]" />
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard>
              <SectionLabel>Crear cuenta para la demo</SectionLabel>
              <p className="mt-3 text-sm text-[#5f4b3f]">
                De momento el acceso va sin password. Creamos tu perfil local y entras directamente.
              </p>

              {error ? (
                <div className="mt-4 rounded-[22px] border border-[#ffcfbb] bg-[#fff4ed] px-4 py-3 text-sm text-[#b14a20]">
                  {error}
                </div>
              ) : null}

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
                      Handle
                    </span>
                    <input
                      className="rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                      onChange={(event) => onChangeForm({ handle: event.target.value })}
                      placeholder="@anagoesout"
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
                  {isSubmitting ? "Creando perfil..." : "Crear cuenta y entrar"}
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
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
                  {lastMessage?.text ?? event.summary}
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
  onChange
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const items = buildNavItems();

  return (
    <div className="md:hidden">
      <div className="h-[92px]" />
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#eadfd3] bg-[rgba(249,244,238,0.96)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[520px] items-center justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-3">
          {items.map((item) => {
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 text-[11px] font-semibold ${
                  active ? "text-[#ff6b57]" : "text-[#7a6455]"
                }`}
                onClick={() => onChange(item.id)}
                type="button"
              >
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                    active ? "bg-[#fff0e8]" : "bg-transparent"
                  }`}
                >
                  {item.icon}
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
          <div className="relative h-20 w-20 overflow-hidden rounded-[26px] border border-white/80 bg-[#f4e3d8] shadow-[0_14px_24px_rgba(52,34,22,0.08)]">
            <img alt={currentUser.name} className="h-full w-full object-cover" src={currentUser.avatar} />
          </div>
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight md:text-[2rem]">{currentUser.name}</h2>
              {currentUser.verified ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#e7dacd] bg-[#fff7f2] px-3 py-1 text-xs font-semibold text-[#c86730]">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Perfil verificado
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-semibold text-[#8f6f59]">
              {currentUser.title}
              {currentUser.company ? ` · ${currentUser.company}` : ""}
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
  onRespondEventInvite,
  pendingEventInvites,
  posts,
  state,
  stories
}: {
  currentUser: PlatformUser;
  onOpenEvent: (eventId: string) => void;
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
              Hola, {currentUser.name.split(" ")[0]}
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
                          {sender.name} te ha invitado personalmente a este evento.
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
        const label = isUserStory ? user?.name ?? "Perfil" : event?.title ?? "Evento";
        const subtitle = isUserStory
          ? user?.handle ?? "Story"
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
            <div className="rounded-[24px] bg-[linear-gradient(135deg,#ff6b57,#f08a24)] p-[2px]">
              <div className="h-[92px] overflow-hidden rounded-[22px] border border-white/50 bg-[#f7e7dc]">
                <img alt={label} className="h-full w-full object-cover" src={story.imageUrl} />
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
  post,
  state
}: {
  onOpenEvent: (eventId: string) => void;
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
      <div className="flex items-center gap-3">
        <AvatarChip user={author} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#1d160f]">{author.name}</p>
          <p className="text-sm text-[#6d5749]">{formatRelativeTime(post.createdAt)}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8f6f59]">
          <Heart className="h-3.5 w-3.5" />
          Perfil
        </div>
      </div>
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
  onOpenPrivateChat,
  onRequestEventAccess,
  onRespondEventAccess,
  onRespondEventInvite,
  onSendEventInvite,
  onRespondPrivateRequest,
  onSelectAttendee,
  onSendGroupMessage,
  onSendPrivateRequest,
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
  onOpenPrivateChat: (chatId: string) => void;
  onRequestEventAccess: (eventId: string) => void;
  onRespondEventAccess: (membershipId: string, accept: boolean) => void;
  onRespondEventInvite: (inviteId: string, accept: boolean) => void;
  onSendEventInvite: (targetUserId: string) => void;
  onRespondPrivateRequest: (requestId: string, accept: boolean) => void;
  onSelectAttendee: (userId: string) => void;
  onSendGroupMessage: () => void;
  onSendPrivateRequest: (targetUserId: string) => void;
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
              <p className="mt-2 text-sm font-semibold text-[#1d160f]">{host.name}</p>
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
                Crea {host.name}
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
                            {sender.name} te ha invitado personalmente. Si aceptas, entras
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
                                <p className="font-semibold text-[#1d160f]">{friend.name}</p>
                                <p className="text-sm text-[#6d5749]">{friend.title}</p>
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
                  </div>
                  <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                    {messages.length} mensajes
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {messages.map((message) => {
                    if (message.authorId === "system") {
                      return (
                        <div
                          key={message.id}
                          className="rounded-[20px] border border-dashed border-[#f0d8ca] bg-[#fff3ec] px-4 py-3 text-sm text-[#c86730]"
                        >
                          {message.text}
                        </div>
                      );
                    }

                    const author = getUserById(state, message.authorId);
                    const mine = message.authorId === currentUser.id;

                    if (mine) {
                      return (
                        <div key={message.id} className="flex justify-end">
                          <div className="max-w-[560px] rounded-[24px] bg-[#1d160f] px-4 py-3 text-sm text-white shadow-[0_18px_34px_rgba(29,22,15,0.14)]">
                            <p>{message.text}</p>
                            <p className="mt-2 text-[11px] text-white/64">
                              {formatTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={message.id} className="flex gap-3">
                        <AvatarChip user={author} />
                        <div className="max-w-[620px] rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm text-[#5f4b3f]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold text-[#1d160f]">{author.name}</p>
                            <span className="text-xs text-[#8f6f59]">{formatTime(message.createdAt)}</span>
                          </div>
                          <p className="mt-1">{message.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                      Escribe al grupo
                    </span>
                    <textarea
                      className="w-full resize-none rounded-[18px] border border-[#e7d8cb] bg-white px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                      onChange={(eventValue) => onChangeGroupDraft(eventValue.target.value)}
                      placeholder={event.conversationPrompt}
                      rows={3}
                      value={groupDraft}
                    />
                  </label>
                  <div className="mt-3 flex justify-end">
                    <button
                      className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
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
                                    <p className="font-semibold text-[#1d160f]">{applicant.name}</p>
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
                              <p className="truncate font-semibold text-[#1d160f]">{member.name}</p>
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
                        <div className="h-20 w-20 overflow-hidden rounded-[26px] border border-[#eadfd3] bg-[#f5e4d6]">
                          <img alt={attendee.name} className="h-full w-full object-cover" src={attendee.avatar} />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-2xl font-black tracking-tight text-[#1d160f]">
                              {attendee.name}
                            </h3>
                            {attendee.id === event.hostId ? (
                              <span className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-1 text-xs font-semibold text-[#6d5749]">
                                Creador del evento
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm font-semibold text-[#8f6f59]">
                            {attendee.title}
                            {attendee.company ? ` · ${attendee.company}` : ""}
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
                              placeholder={`Hola ${attendee.name.split(" ")[0]}, me encantaria conocerte mejor antes del evento.`}
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
                              {getUserById(state, connectionState.request.fromUserId).name} quiere hablar
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
                                <p className="truncate font-semibold text-[#1d160f]">{member.name}</p>
                                <p className="truncate text-sm text-[#6d5749]">{member.title}</p>
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
                        <div className="h-20 w-20 overflow-hidden rounded-[26px] border border-[#eadfd3] bg-[#f5e4d6]">
                          <img alt={attendee.name} className="h-full w-full object-cover" src={attendee.avatar} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black tracking-tight text-[#1d160f]">
                            {attendee.name}
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
                    <p className="font-semibold text-[#1d160f]">{host.name}</p>
                    <p className="text-sm text-[#6d5749]">
                      {host.title}
                      {host.company ? ` · ${host.company}` : ""}
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
  onOpenChat,
  onRespondPrivateRequest,
  onSendMessage,
  privateChats,
  privateDraft,
  selectedChatId,
  state
}: {
  currentUser: PlatformUser;
  onChangePrivateDraft: (value: string) => void;
  onOpenChat: (chatId: string) => void;
  onRespondPrivateRequest: (requestId: string, accept: boolean) => void;
  onSendMessage: () => void;
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
  const selectedPartner = selectedChat ? getChatPartner(state, selectedChat, currentUser.id) : null;
  const selectedMessages = selectedChat ? getPrivateMessages(state, selectedChat.id) : [];

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Inbox</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
          Solicitudes de acceso y conversaciones privadas
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
                          <p className="font-semibold text-[#1d160f]">{sender.name}</p>
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
            <div className="mt-4 space-y-3">
              {privateChats.length === 0 ? (
                <p className="rounded-[22px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-5 text-sm text-[#7a6455]">
                  Todavia no has abierto ningun chat privado.
                </p>
              ) : (
                privateChats.map((chat) => {
                  const partner = getChatPartner(state, chat, currentUser.id);
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
                      <AvatarChip user={partner} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-semibold text-[#1d160f]">{partner.name}</p>
                          <span className="text-xs text-[#8f6f59]">
                            {lastMessage ? formatTime(lastMessage.createdAt) : ""}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-[#6d5749]">
                          {lastMessage?.text ?? "Chat listo para empezar"}
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
          {selectedChat && selectedPartner ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AvatarChip user={selectedPartner} />
                  <div>
                    <p className="font-semibold text-[#1d160f]">{selectedPartner.name}</p>
                    <p className="text-sm text-[#6d5749]">{selectedPartner.title}</p>
                  </div>
                </div>
                <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                  Origen: {getEventById(state, selectedChat.originEventId)?.title}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {selectedMessages.map((message) => {
                  const mine = message.authorId === currentUser.id;
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
                        <p>{message.text}</p>
                        <p className={`mt-2 text-[11px] ${mine ? "text-white/64" : "text-[#8f6f59]"}`}>
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                <textarea
                  className="w-full resize-none rounded-[18px] border border-[#e7d8cb] bg-white px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                  onChange={(eventValue) => onChangePrivateDraft(eventValue.target.value)}
                  placeholder={`Escribe a ${selectedPartner.name.split(" ")[0]}...`}
                  rows={3}
                  value={privateDraft}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                    onClick={onSendMessage}
                    type="button"
                  >
                    <Send className="h-4 w-4" />
                    Enviar
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
  onSwitchUser,
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
  onSwitchUser: (userId: string) => void;
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
            <div className="h-24 w-24 overflow-hidden rounded-[30px] border-4 border-[#f6efe7] bg-white shadow-[0_16px_30px_rgba(29,22,15,0.12)]">
              <img alt={currentUser.name} className="h-full w-full object-cover" src={currentUser.avatar} />
            </div>
            <div className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight">{currentUser.name}</h1>
                {currentUser.verified ? (
                  <span className="rounded-full bg-[#1d160f] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                    Verificado
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-semibold text-[#8f6f59]">
                {currentUser.title}
                {currentUser.company ? ` · ${currentUser.company}` : ""}
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
                      <p className="font-semibold text-[#1d160f]">{friend.name}</p>
                      <p className="text-sm text-[#6d5749]">{friend.title}</p>
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
                      <p className="font-semibold text-[#1d160f]">{user.name}</p>
                      <p className="text-sm text-[#6d5749]">{user.title}</p>
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
                          Invitacion de {sender.name}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
              <SectionLabel>Cuenta y demo</SectionLabel>
              <p className="mt-3 text-sm text-[#5f4b3f]">
                Puedes cerrar sesion o resetear los datos demo para volver al estado inicial.
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

      <SectionCard>
        <SectionLabel>Cambiar de perfil demo</SectionLabel>
        <p className="mt-3 text-sm text-[#5f4b3f]">
          Esto sigue aqui para probar rapido aprobaciones, rechazos, amistades y privados desde
          distintos lados del flujo.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.users.map((user) => {
            const active = user.id === currentUser.id;
            return (
              <button
                key={user.id}
                className={`flex items-center gap-3 rounded-[24px] border p-4 text-left transition ${
                  active ? "border-[#ffb493] bg-[#fff0e8]" : "border-[#eadfd3] bg-[#fffaf6]"
                }`}
                onClick={() => onSwitchUser(user.id)}
                type="button"
              >
                <AvatarChip user={user} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-[#1d160f]">{user.name}</p>
                  </div>
                  <p className="truncate text-sm text-[#6d5749]">{user.title}</p>
                  <p className="mt-1 truncate text-xs text-[#8f6f59]">{user.handle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>
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
          {error ?? "Cargando la demo social de eventos..."}
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
      <div className="h-11 w-11 overflow-hidden rounded-2xl border border-[#eadfd3] bg-[#f5e4d6]">
        {user.avatar ? (
          <img alt={user.name} className="h-full w-full object-cover" src={user.avatar} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-black text-[#1d160f]">
            {getInitials(user.name)}
          </div>
        )}
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
