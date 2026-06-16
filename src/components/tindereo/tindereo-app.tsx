"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Inbox,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Ticket,
  User,
  Users,
  X
} from "lucide-react";
import { OrganizerDashboard } from "@/components/tindereo/organizer-dashboard";
import {
  APP_NAME,
  APP_TAGLINE,
  EVENT_CATEGORY_OPTIONS,
  ORGANIZER_CONTACT_EMAIL
} from "@/lib/tindereo-data";
import type {
  AppTab,
  CreateEventInput,
  EventCategory,
  EventDetailTab,
  OrganizerLeadInput,
  PersistedState,
  PlatformUser
} from "@/lib/tindereo-types";
import {
  createEvent,
  createInitialState,
  formatEventDate,
  formatEventDateRange,
  formatRelativeTime,
  formatTime,
  getCategoryMeta,
  getChatPartner,
  getCurrentUser,
  getDiscoverFeedEvents,
  getEventAttendanceRatio,
  getEventById,
  getEventConnectionState,
  getEventGuestCount,
  getEventMembers,
  getEventMessages,
  getHostedEvents,
  getIncomingPendingRequests,
  getInitials,
  getJoinedEvents,
  getLatestPrivateMessage,
  getPrivateChatsForUser,
  getPrivateMessages,
  getPrivateRequestsForUser,
  getUserById,
  hasJoinedEvent,
  joinEvent,
  leaveEvent,
  postEventMessage,
  readPersistedState,
  respondToPrivateChatRequest,
  sendPrivateChatRequest,
  sendPrivateMessage,
  submitOrganizerLead
} from "@/lib/tindereo-utils";

const STORAGE_KEY = "tindereo-events-demo-v1";

const EMPTY_LEAD_FORM: OrganizerLeadInput = {
  companyName: "",
  concept: "",
  message: ""
};

export function TindereoApp() {
  const [state, setState] = useState<PersistedState | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [requestDrafts, setRequestDrafts] = useState<Record<string, string>>({});
  const [selectedAttendeeByEvent, setSelectedAttendeeByEvent] = useState<Record<string, string>>({});
  const [privateDraft, setPrivateDraft] = useState("");
  const [leadForm, setLeadForm] = useState<OrganizerLeadInput>(EMPTY_LEAD_FORM);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setState(readPersistedState(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  useEffect(() => {
    if (!state || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  if (!state) {
    return <LoadingScreen />;
  }

  const currentUser = getCurrentUser(state);
  const discoverEvents = getDiscoverFeedEvents(state);
  const joinedEvents = getJoinedEvents(state, currentUser.id);
  const filteredEvents = discoverEvents.filter((event) => {
    const matchesCategory = categoryFilter === "all" || event.category === categoryFilter;
    const haystack = `${event.title} ${event.city} ${event.venue} ${event.tags.join(" ")}`.toLowerCase();
    const matchesSearch = searchTerm.trim() === "" || haystack.includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });
  const discoverSelection = pickEvent(filteredEvents, state.session.selectedEventId) ??
    pickEvent(discoverEvents, state.session.selectedEventId) ??
    discoverEvents[0] ??
    null;
  const agendaSelection = pickEvent(joinedEvents, state.session.selectedEventId) ?? joinedEvents[0] ?? null;
  const activeEvent =
    (state.session.activeTab === "agenda" ? agendaSelection : discoverSelection) ??
    getEventById(state, state.session.selectedEventId);
  const incomingRequests = getIncomingPendingRequests(state, currentUser.id);
  const privateChats = getPrivateChatsForUser(state, currentUser.id);
  const selectedPrivateChat =
    privateChats.find((chat) => chat.id === state.session.selectedPrivateChatId) ??
    privateChats[0] ??
    null;
  const joinedCount = joinedEvents.length;
  const requestCount = incomingRequests.length;
  const chatCount = privateChats.length;

  const updateSession = (patch: Partial<PersistedState["session"]>) => {
    setState((current) =>
      current
        ? {
            ...current,
            session: {
              ...current.session,
              ...patch
            }
          }
        : current
    );
  };

  const openEvent = (eventId: string, tab?: AppTab) => {
    updateSession({
      selectedEventId: eventId,
      selectedEventView: "overview",
      ...(tab ? { activeTab: tab } : {})
    });
  };

  const openPrivateChat = (chatId: string) => {
    updateSession({
      activeTab: "inbox",
      selectedPrivateChatId: chatId
    });
  };

  const handleJoinEvent = (eventId: string) => {
    setState((current) => {
      if (!current) {
        return current;
      }

      const next = joinEvent(current, eventId, current.session.currentUserId);
      return {
        ...next,
        session: {
          ...next.session,
          activeTab: "agenda",
          selectedEventId: eventId,
          selectedEventView: "chat"
        }
      };
    });
  };

  const handleLeaveEvent = (eventId: string) => {
    setState((current) => {
      if (!current) {
        return current;
      }

      const next = leaveEvent(current, eventId, current.session.currentUserId);
      const nextJoined = getJoinedEvents(next, next.session.currentUserId);
      return {
        ...next,
        session: {
          ...next.session,
          activeTab: nextJoined.length > 0 ? "agenda" : "discover",
          selectedEventId: nextJoined[0]?.id ?? discoverEvents[0]?.id ?? next.events[0]?.id ?? null,
          selectedEventView: "overview"
        }
      };
    });
  };

  const handleSendGroupMessage = (eventId: string) => {
    const message = groupDrafts[eventId] ?? "";
    if (!message.trim()) {
      return;
    }

    setState((current) =>
      current ? postEventMessage(current, eventId, current.session.currentUserId, message) : current
    );
    setGroupDrafts((current) => ({ ...current, [eventId]: "" }));
  };

  const handleSendPrivateRequest = (eventId: string, targetUserId: string) => {
    const draftKey = `${eventId}:${targetUserId}`;
    const message =
      requestDrafts[draftKey] ||
      `Hola. Me apetece conocerte mejor antes de ${getEventById(state, eventId)?.title}. Si te cuadra, abrimos chat privado.`;

    setState((current) => {
      if (!current) {
        return current;
      }

      return sendPrivateChatRequest(
        current,
        eventId,
        current.session.currentUserId,
        targetUserId,
        message
      );
    });
    setRequestDrafts((current) => ({ ...current, [draftKey]: "" }));
  };

  const handleRespondRequest = (requestId: string, accept: boolean) => {
    setState((current) => {
      if (!current) {
        return current;
      }

      const next = respondToPrivateChatRequest(
        current,
        requestId,
        current.session.currentUserId,
        accept
      );
      const latestChat = getPrivateChatsForUser(next, next.session.currentUserId)[0] ?? null;

      return {
        ...next,
        session: {
          ...next.session,
          activeTab: accept ? "inbox" : next.session.activeTab,
          selectedPrivateChatId: accept
            ? latestChat?.id ?? next.session.selectedPrivateChatId
            : next.session.selectedPrivateChatId
        }
      };
    });
  };

  const handleSendPrivateMessage = () => {
    if (!selectedPrivateChat || !privateDraft.trim()) {
      return;
    }

    setState((current) =>
      current
        ? sendPrivateMessage(
            current,
            selectedPrivateChat.id,
            current.session.currentUserId,
            privateDraft
          )
        : current
    );
    setPrivateDraft("");
  };

  const handleSwitchUser = (userId: string) => {
    setState((current) => {
      if (!current) {
        return current;
      }

      const nextChats = getPrivateChatsForUser(
        {
          ...current,
          session: {
            ...current.session,
            currentUserId: userId
          }
        },
        userId
      );

      return {
        ...current,
        session: {
          ...current.session,
          currentUserId: userId,
          selectedPrivateChatId: nextChats[0]?.id ?? null
        }
      };
    });
  };

  const handleCreateEvent = (input: CreateEventInput) => {
    setState((current) => {
      if (!current) {
        return current;
      }

      const next = createEvent(current, current.session.currentUserId, input);
      return {
        ...next,
        session: {
          ...next.session,
          activeTab: "host"
        }
      };
    });
  };

  const handleSubmitOrganizerLead = () => {
    if (!leadForm.companyName.trim() || !leadForm.concept.trim() || !leadForm.message.trim()) {
      return;
    }

    setState((current) =>
      current ? submitOrganizerLead(current, current.session.currentUserId, leadForm) : current
    );
    setLeadForm(EMPTY_LEAD_FORM);
  };

  const handleResetDemo = () => {
    setState(createInitialState());
    setSearchTerm("");
    setCategoryFilter("all");
    setGroupDrafts({});
    setRequestDrafts({});
    setSelectedAttendeeByEvent({});
    setPrivateDraft("");
    setLeadForm(EMPTY_LEAD_FORM);
  };

  return (
    <div className="min-h-screen bg-[#f6efe7] text-[#1d160f]">
      <main className="mx-auto max-w-[1240px] px-4 pb-32 pt-5 md:px-6 md:pb-10 md:pt-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-[#eadfd3] bg-white/88 px-4 py-2 text-sm text-[#6d5749] md:flex md:items-center md:gap-2">
              <AvatarChip user={currentUser} />
              <span>{currentUser.role === "organizer" ? "Organizador aprobado" : "Modo asistente"}</span>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white/88 px-4 py-2 text-sm font-semibold text-[#5f4b3f] shadow-[0_10px_24px_rgba(52,34,22,0.06)]"
              onClick={handleResetDemo}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Reiniciar demo
            </button>
          </div>
        </header>

        <DesktopNavigation
          activeTab={state.session.activeTab}
          onChange={updateSession}
          organizerMode={currentUser.role === "organizer"}
        />

        <SummaryBanner
          currentUser={currentUser}
          joinedCount={joinedCount}
          requestCount={requestCount}
          chatCount={chatCount}
        />

        {state.session.activeTab === "discover" ? (
          <div className="space-y-5">
            <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                    Descubrir eventos
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                    Encuentra el plan y entra en la conversacion antes de llegar
                  </h1>
                </div>
                <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                  {filteredEvents.length} eventos visibles
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
                        onClick={() =>
                          setCategoryFilter(option.value as EventCategory | "all")
                        }
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
                collection={filteredEvents.length > 0 ? filteredEvents : discoverEvents}
                currentUser={currentUser}
                currentView={state.session.selectedEventView}
                event={discoverSelection}
                groupDraft={groupDrafts[discoverSelection.id] ?? ""}
                mode="discover"
                onChangeEvent={openEvent}
                onChangeGroupDraft={(value) =>
                  setGroupDrafts((current) => ({ ...current, [discoverSelection.id]: value }))
                }
                onChangeRequestDraft={(targetUserId, value) =>
                  setRequestDrafts((current) => ({
                    ...current,
                    [`${discoverSelection.id}:${targetUserId}`]: value
                  }))
                }
                onChangeView={(view) => updateSession({ selectedEventView: view })}
                onJoinEvent={handleJoinEvent}
                onLeaveEvent={handleLeaveEvent}
                onOpenPrivateChat={openPrivateChat}
                onRespondRequest={handleRespondRequest}
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
                copy="Prueba con otra ciudad o limpia la busqueda para volver a ver el feed."
              />
            )}
          </div>
        ) : null}

        {state.session.activeTab === "agenda" ? (
          <div className="space-y-5">
            <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                Mi agenda
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                Tus eventos confirmados y sus chats listos para usar
              </h1>
              <p className="mt-2 text-sm text-[#6d5749]">
                Cada vez que te unes a un evento entras tambien en el chat general. Desde ahi puedes
                conocer gente y abrir privados solo con aceptacion.
              </p>
            </section>

            {agendaSelection ? (
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
                onChangeRequestDraft={(targetUserId, value) =>
                  setRequestDrafts((current) => ({
                    ...current,
                    [`${agendaSelection.id}:${targetUserId}`]: value
                  }))
                }
                onChangeView={(view) => updateSession({ selectedEventView: view })}
                onJoinEvent={handleJoinEvent}
                onLeaveEvent={handleLeaveEvent}
                onOpenPrivateChat={openPrivateChat}
                onRespondRequest={handleRespondRequest}
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
                requestDraft={
                  requestDrafts[
                    `${agendaSelection.id}:${selectedAttendeeByEvent[agendaSelection.id] ?? ""}`
                  ] ?? ""
                }
                selectedAttendeeId={selectedAttendeeByEvent[agendaSelection.id] ?? null}
                state={state}
              />
            ) : (
              <EmptyState
                title="Todavia no te has unido a ningun evento"
                copy="Vuelve a Descubrir, elige un evento y se abrira automaticamente tu acceso al chat general."
                action={
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white"
                    onClick={() => updateSession({ activeTab: "discover" })}
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
            onRespondRequest={handleRespondRequest}
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
            joinedCount={joinedCount}
            onResetDemo={handleResetDemo}
            onSwitchUser={handleSwitchUser}
            requestCount={requestCount}
            state={state}
          />
        ) : null}

        {state.session.activeTab === "host" ? (
          currentUser.role === "organizer" ? (
            <OrganizerDashboard
              currentUser={currentUser}
              onCreateEvent={handleCreateEvent}
              onSelectEvent={(eventId) => openEvent(eventId, "discover")}
              state={state}
            />
          ) : (
            <OrganizerAccessSection
              currentUser={currentUser}
              leadForm={leadForm}
              onChangeLeadForm={setLeadForm}
              onSubmitLead={handleSubmitOrganizerLead}
              state={state}
            />
          )
        ) : null}
      </main>

      <MobileNavigation
        activeTab={state.session.activeTab}
        onChange={updateSession}
        organizerMode={currentUser.role === "organizer"}
      />
    </div>
  );
}

function DesktopNavigation({
  activeTab,
  onChange,
  organizerMode
}: {
  activeTab: AppTab;
  onChange: (patch: Partial<PersistedState["session"]>) => void;
  organizerMode: boolean;
}) {
  const items = buildNavItems(organizerMode);

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
            onClick={() => onChange({ activeTab: item.id })}
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
  onChange,
  organizerMode
}: {
  activeTab: AppTab;
  onChange: (patch: Partial<PersistedState["session"]>) => void;
  organizerMode: boolean;
}) {
  const items = buildNavItems(organizerMode);

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
                onClick={() => onChange({ activeTab: item.id })}
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

function SummaryBanner({
  currentUser,
  joinedCount,
  requestCount,
  chatCount
}: {
  currentUser: PlatformUser;
  joinedCount: number;
  requestCount: number;
  chatCount: number;
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
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <MetricTile label="Eventos" value={String(joinedCount)} />
          <MetricTile label="Solicitudes" value={String(requestCount)} />
          <MetricTile
            label={currentUser.role === "organizer" ? "Panel" : "Privados"}
            value={currentUser.role === "organizer" ? "Admin" : String(chatCount)}
          />
        </div>
      </div>
    </section>
  );
}

function EventWorkspace({
  collection,
  currentUser,
  currentView,
  event,
  groupDraft,
  mode,
  onChangeEvent,
  onChangeGroupDraft,
  onChangeRequestDraft,
  onChangeView,
  onJoinEvent,
  onLeaveEvent,
  onOpenPrivateChat,
  onRespondRequest,
  onSelectAttendee,
  onSendGroupMessage,
  onSendPrivateRequest,
  requestDraft,
  selectedAttendeeId,
  state
}: {
  collection: ReturnType<typeof getDiscoverFeedEvents>;
  currentUser: PlatformUser;
  currentView: EventDetailTab;
  event: NonNullable<ReturnType<typeof getEventById>>;
  groupDraft: string;
  mode: "discover" | "agenda";
  onChangeEvent: (eventId: string) => void;
  onChangeGroupDraft: (value: string) => void;
  onChangeRequestDraft: (targetUserId: string, value: string) => void;
  onChangeView: (view: EventDetailTab) => void;
  onJoinEvent: (eventId: string) => void;
  onLeaveEvent: (eventId: string) => void;
  onOpenPrivateChat: (chatId: string) => void;
  onRespondRequest: (requestId: string, accept: boolean) => void;
  onSelectAttendee: (userId: string) => void;
  onSendGroupMessage: () => void;
  onSendPrivateRequest: (targetUserId: string) => void;
  requestDraft: string;
  selectedAttendeeId: string | null;
  state: PersistedState;
}) {
  const joined = hasJoinedEvent(state, event.id, currentUser.id);
  const host = getUserById(state, event.hostId);
  const guestCount = getEventGuestCount(state, event.id);
  const fill = Math.round(getEventAttendanceRatio(state, event.id) * 100);
  const messages = getEventMessages(state, event.id);
  const members = getEventMembers(state, event.id);
  const attendee =
    members.find((user) => user.id === selectedAttendeeId) ??
    members.find((user) => user.id !== currentUser.id) ??
    members[0] ??
    null;
  const connectionState = attendee
    ? getEventConnectionState(state, event.id, currentUser.id, attendee.id)
    : null;
  const categoryMeta = getCategoryMeta(event.category);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[38px] border border-[#eadfd3] text-white shadow-[0_34px_90px_rgba(20,17,16,0.18)]">
        <img alt={event.title} className="absolute inset-0 h-full w-full object-cover" src={event.coverImage} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,12,9,0.28),rgba(16,12,9,0.86))]" />
        <div className="relative p-5 md:p-7">
          <div className="flex flex-wrap gap-2">
            <Pill tone="dark">{categoryMeta.label}</Pill>
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
            {joined ? (
              <>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(240,138,36,0.28)]"
                  onClick={() => onChangeView("chat")}
                  type="button"
                >
                  Abrir chat general
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
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(240,138,36,0.28)]"
                onClick={() => onJoinEvent(event.id)}
                type="button"
              >
                Unirme y abrir chat general
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <div className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/72">
              Organiza {host.name}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "overview", label: "Resumen" },
              { id: "chat", label: "Chat general" },
              { id: "people", label: "Asistentes" }
            ].map((item) => {
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
              <SectionCard>
                <SectionLabel>Que pasa en este evento</SectionLabel>
                <p className="mt-3 text-sm leading-6 text-[#5f4b3f]">{event.description}</p>
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
              </SectionCard>

              <SectionCard>
                <SectionLabel>Como se conecta la gente aqui</SectionLabel>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                      Conversacion inicial
                    </p>
                    <p className="mt-3 text-sm text-[#5f4b3f]">{event.conversationPrompt}</p>
                  </div>
                  <div className="rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                      Invitados visibles
                    </p>
                    <p className="mt-3 text-sm text-[#5f4b3f]">
                      Hay {members.length} perfiles demo visibles dentro de un total de {guestCount}{" "}
                      confirmados. Desde estos perfiles puedes mandar solicitud de privado.
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {currentView === "chat" ? (
            joined ? (
              <SectionCard>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <SectionLabel>Chat general del evento</SectionLabel>
                    <p className="mt-2 text-sm text-[#6d5749]">
                      Este espacio se abre al unirte. Sirve para presentarte y llegar con menos frio
                      social.
                    </p>
                  </div>
                  <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                    {messages.length} mensajes
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {messages.map((message) =>
                    message.authorId === "system" ? (
                      <div
                        key={message.id}
                        className="rounded-[20px] border border-dashed border-[#f0d8ca] bg-[#fff3ec] px-4 py-3 text-sm text-[#c86730]"
                      >
                        {message.text}
                      </div>
                    ) : (
                      <div key={message.id} className="flex gap-3 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                        <AvatarChip user={getUserById(state, message.authorId)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[#1d160f]">
                              {getUserById(state, message.authorId).name}
                            </p>
                            <span className="text-xs text-[#8f6f59]">{formatTime(message.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-sm text-[#5f4b3f]">{message.text}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
                <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                      Escribe al grupo
                    </span>
                    <textarea
                      className="w-full resize-none rounded-[18px] border border-[#e7d8cb] bg-white px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                      onChange={(event) => onChangeGroupDraft(event.target.value)}
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
                title="Unete para activar el chat general"
                copy="La conversacion del evento se abre en cuanto confirmas tu asistencia."
                action={
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white"
                    onClick={() => onJoinEvent(event.id)}
                    type="button"
                  >
                    Unirme ahora
                    <ArrowRight className="h-4 w-4" />
                  </button>
                }
              />
            )
          ) : null}

          {currentView === "people" ? (
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <SectionLabel>Asistentes visibles</SectionLabel>
                  <div className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-2 text-sm text-[#6d5749]">
                    {members.length} perfiles
                  </div>
                </div>
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
                            {member.role === "organizer" ? (
                              <span className="rounded-full bg-[#1d160f] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                                Host
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
                          {attendee.role === "organizer" ? (
                            <span className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-3 py-1 text-xs font-semibold text-[#6d5749]">
                              Organiza este evento
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
                          Este eres tu. Cambia de perfil desde la pestaña Perfil si quieres probar el
                          otro lado del flujo.
                        </p>
                      ) : null}

                      {connectionState?.kind === "available" ? (
                        <div className="mt-3">
                          <textarea
                            className="w-full resize-none rounded-[18px] border border-[#e7d8cb] bg-white px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
                            onChange={(event) => onChangeRequestDraft(attendee.id, event.target.value)}
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
                              onClick={() => onRespondRequest(connectionState.request.id, true)}
                              type="button"
                            >
                              Aceptar
                            </button>
                            <button
                              className="rounded-full border border-[#eadfd3] bg-[#fffaf6] px-4 py-3 text-sm font-semibold text-[#6d5749]"
                              onClick={() => onRespondRequest(connectionState.request.id, false)}
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
                    copy="Aqui podras revisar su perfil y gestionar la solicitud de chat privado."
                  />
                )}
              </SectionCard>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <SectionCard>
            <SectionLabel>{mode === "agenda" ? "Tus proximos eventos" : "Mas eventos"}</SectionLabel>
            <div className="mt-4 space-y-3">
              {collection.map((item) => {
                const active = item.id === event.id;
                const joinedItem = hasJoinedEvent(state, item.id, currentUser.id);
                const itemGuests = getEventGuestCount(state, item.id);
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
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                          {getCategoryMeta(item.category).label}
                        </p>
                        <h3 className="mt-1 text-base font-bold text-[#1d160f]">{item.title}</h3>
                        <p className="mt-2 text-sm text-[#6d5749]">{formatEventDateRange(item)}</p>
                      </div>
                      {joinedItem ? (
                        <span className="rounded-full border border-[#eadfd3] bg-white px-3 py-1 text-[11px] font-semibold text-[#6d5749]">
                          Unido
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-[#6d5749]">
                      <span>{itemGuests} confirmados</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard>
            <SectionLabel>Señales del evento</SectionLabel>
            <div className="mt-4 space-y-4">
              <div className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
                  Host
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
                  {guestCount} confirmados, {event.waitlistCount} en espera.
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
      </div>
    </div>
  );
}

function InboxSection({
  currentUser,
  onChangePrivateDraft,
  onOpenChat,
  onRespondRequest,
  onSendMessage,
  privateChats,
  privateDraft,
  selectedChatId,
  state
}: {
  currentUser: PlatformUser;
  onChangePrivateDraft: (value: string) => void;
  onOpenChat: (chatId: string) => void;
  onRespondRequest: (requestId: string, accept: boolean) => void;
  onSendMessage: () => void;
  privateChats: ReturnType<typeof getPrivateChatsForUser>;
  privateDraft: string;
  selectedChatId: string | null;
  state: PersistedState;
}) {
  const requests = getPrivateRequestsForUser(state, currentUser.id);
  const incoming = requests.filter((request) => request.toUserId === currentUser.id && request.status === "pending");
  const selectedChat = privateChats.find((chat) => chat.id === selectedChatId) ?? privateChats[0] ?? null;
  const selectedPartner = selectedChat ? getChatPartner(state, selectedChat, currentUser.id) : null;
  const selectedMessages = selectedChat ? getPrivateMessages(state, selectedChat.id) : [];

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">Inbox</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
          Solicitudes y conversaciones privadas
        </h1>
        <p className="mt-2 text-sm text-[#6d5749]">
          El chat privado solo existe si la otra persona acepta. Una vez abierto, permanece activo
          aunque el evento ya haya terminado.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard>
            <SectionLabel>Solicitudes pendientes</SectionLabel>
            <div className="mt-4 space-y-3">
              {incoming.length === 0 ? (
                <p className="rounded-[22px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-5 text-sm text-[#7a6455]">
                  Ahora mismo no tienes solicitudes pendientes.
                </p>
              ) : (
                incoming.map((request) => {
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
                              onClick={() => onRespondRequest(request.id, true)}
                              type="button"
                            >
                              Aceptar
                            </button>
                            <button
                              className="rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]"
                              onClick={() => onRespondRequest(request.id, false)}
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
                  onChange={(event) => onChangePrivateDraft(event.target.value)}
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
  joinedCount,
  onResetDemo,
  onSwitchUser,
  requestCount,
  state
}: {
  currentUser: PlatformUser;
  joinedCount: number;
  onResetDemo: () => void;
  onSwitchUser: (userId: string) => void;
  requestCount: number;
  state: PersistedState;
}) {
  const privateChats = getPrivateChatsForUser(state, currentUser.id);
  const hostedEvents = getHostedEvents(state, currentUser.id);

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
                {currentUser.role === "organizer" ? (
                  <span className="rounded-full bg-[#1d160f] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                    Organizador
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
            <MetricTile label="Eventos" value={String(joinedCount)} />
            <MetricTile label="Solicitudes" value={String(requestCount)} />
            <MetricTile label="Privados" value={String(privateChats.length)} />
            <MetricTile label="Publicados" value={String(hostedEvents.length)} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard>
          <SectionLabel>Modo demo</SectionLabel>
          <p className="mt-3 text-sm text-[#5f4b3f]">
            Cambia entre perfiles para probar ambos lados del producto: asistentes, solicitudes
            pendientes y cuentas organizadoras ya aprobadas.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
              onClick={onResetDemo}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Reiniciar todo
            </button>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionLabel>Cambiar de perfil</SectionLabel>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                      {user.role === "organizer" ? (
                        <span className="rounded-full border border-[#eadfd3] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6d5749]">
                          Host
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-[#6d5749]">{user.title}</p>
                    <p className="mt-1 truncate text-xs text-[#8f6f59]">{user.handle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function OrganizerAccessSection({
  currentUser,
  leadForm,
  onChangeLeadForm,
  onSubmitLead,
  state
}: {
  currentUser: PlatformUser;
  leadForm: OrganizerLeadInput;
  onChangeLeadForm: (value: OrganizerLeadInput) => void;
  onSubmitLead: () => void;
  state: PersistedState;
}) {
  const myLead = state.organizerLeads.find(
    (lead) => lead.fromUserId === currentUser.id && lead.status === "pending"
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[36px] border border-[#eadfd3] bg-[#141110] p-5 text-white shadow-[0_34px_90px_rgba(20,17,16,0.18)] md:p-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/72">
          <Shield className="h-3.5 w-3.5" />
          Acceso organizador
        </div>
        <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
          Crear eventos no esta abierto a cualquiera
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/72 md:text-base">
          Queremos que los eventos mantengan calidad, moderacion y buen contexto social. Por eso el
          perfil organizador se activa solo despues de revisar el proyecto contigo.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard>
          <SectionLabel>Que revisamos antes de aprobar</SectionLabel>
          <div className="mt-4 space-y-3">
            {[
              "Que el concepto del evento tenga encaje con comunidad y socializacion previa.",
              "Que haya alguien responsable del ritmo del chat general y de la experiencia en sala.",
              "Que el anfitrion quiera cuidar perfiles, aforo y conversaciones utiles."
            ].map((item) => (
              <div
                key={item}
                className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4 text-sm text-[#5f4b3f]"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-4 text-sm text-[#5f4b3f]">
            Contacto directo:{" "}
            <a className="font-semibold text-[#c86730]" href={`mailto:${ORGANIZER_CONTACT_EMAIL}`}>
              {ORGANIZER_CONTACT_EMAIL}
            </a>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionLabel>Solicitar acceso</SectionLabel>
          {myLead ? (
            <div className="mt-4 rounded-[24px] border border-[#eadfd3] bg-[#fffaf6] p-5">
              <p className="text-sm font-semibold text-[#1d160f]">Solicitud enviada</p>
              <p className="mt-2 text-sm text-[#5f4b3f]">
                Tenemos registrada tu propuesta y queda pendiente de contacto.
              </p>
              <p className="mt-3 text-xs text-[#8f6f59]">
                Enviada {formatRelativeTime(myLead.createdAt)}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              <FormField
                label="Proyecto o marca"
                value={leadForm.companyName}
                onChange={(value) => onChangeLeadForm({ ...leadForm, companyName: value })}
              />
              <FormField
                label="Concepto del evento"
                value={leadForm.concept}
                onChange={(value) => onChangeLeadForm({ ...leadForm, concept: value })}
              />
              <FormTextArea
                label="Por que encaja en la plataforma"
                rows={5}
                value={leadForm.message}
                onChange={(value) => onChangeLeadForm({ ...leadForm, message: value })}
              />
              <button
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white"
                onClick={onSubmitLead}
                type="button"
              >
                Enviar solicitud
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6efe7] px-4">
      <div className="rounded-[34px] border border-[#eadfd3] bg-white/88 px-6 py-8 text-center shadow-[0_24px_60px_rgba(52,34,22,0.08)]">
        <BrandMark />
        <p className="mt-4 text-sm text-[#6d5749]">Cargando la demo social de eventos...</p>
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

function FormField({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
        {label}
      </span>
      <input
        className="w-full rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function FormTextArea({
  label,
  onChange,
  rows,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
        {label}
      </span>
      <textarea
        className="w-full resize-none rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );
}

function buildNavItems(organizerMode: boolean) {
  return [
    {
      id: "discover" as const,
      label: "Descubrir",
      icon: <Compass className="h-4 w-4" />
    },
    {
      id: "agenda" as const,
      label: "Agenda",
      icon: <Ticket className="h-4 w-4" />
    },
    {
      id: "inbox" as const,
      label: "Inbox",
      icon: <Inbox className="h-4 w-4" />
    },
    {
      id: "profile" as const,
      label: "Perfil",
      icon: <User className="h-4 w-4" />
    },
    {
      id: "host" as const,
      label: organizerMode ? "Admin" : "Organiza",
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
