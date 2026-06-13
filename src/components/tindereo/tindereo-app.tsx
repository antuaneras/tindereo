"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Camera,
  ChevronDown,
  ChevronLeft,
  Filter,
  Heart,
  Instagram,
  MapPin,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  X,
  Zap
} from "lucide-react";
import { OrganizerDashboard } from "@/components/tindereo/organizer-dashboard";
import {
  AVATAR_CHOICES,
  BASE_ATTENDEES,
  DEFAULT_REGISTRATION,
  DEMO_MATCHES,
  DEMO_MESSAGES,
  DEMO_SWIPES,
  DEMO_USER,
  EVENT_INFO,
  EVENT_ZONES,
  GOAL_OPTIONS,
  INTEREST_OPTIONS,
  RELATIONSHIP_OPTIONS
} from "@/lib/tindereo-data";
import type {
  ChatMessage,
  MatchItem,
  PersistedState,
  RegistrationDraft,
  Screen,
  SwipeDirection,
  SwipeRecord,
  UserProfile
} from "@/lib/tindereo-types";
import {
  buildCommunityUsers,
  buildLeaderboard,
  buildMatchMessagePreview,
  createProfileFromDraft,
  formatClock,
  formatTimeAgo,
  getAutoReply,
  getCommonInterests,
  getCompatibilityScore,
  getMatchPartner,
  getMyRank,
  getSwipeReward,
  getZoneById,
  shouldCreateMatch
} from "@/lib/tindereo-utils";

const STORAGE_KEY = "tindereo-demo-state-v2";
const PROTECTED_SCREENS: Screen[] = ["home", "match", "matches", "chat", "map", "ranking", "profile"];

const GOAL_COPY: Record<string, string> = {
  "Conocer gente nueva": "Siempre abierto a ampliar el circulo.",
  "Hacer amigos": "Conexiones genuinas que duran mas de una noche.",
  "Networking profesional": "Colaboraciones, ideas y oportunidades.",
  "Encontrar pareja": "Quimica real entre copa y copa.",
  "Tomar algo con gente afin": "Buenas conversaciones por encima de todo.",
  "Lo que surja": "Sin etiquetas, solo buena energia."
};

function buildDefaultState(): PersistedState {
  return {
    screen: "qr",
    currentUser: null,
    registration: DEFAULT_REGISTRATION,
    swipes: [],
    matches: [],
    messages: {},
    visitedZones: [],
    selectedChatId: null,
    activeMatchId: null
  };
}

function buildDemoState(): PersistedState {
  return {
    screen: "home",
    currentUser: { ...DEMO_USER },
    registration: DEFAULT_REGISTRATION,
    swipes: DEMO_SWIPES.slice(),
    matches: DEMO_MATCHES.slice(),
    messages: { ...DEMO_MESSAGES },
    visitedZones: ["dj", "terraza", "barra"],
    selectedChatId: DEMO_MATCHES[0]?.id ?? null,
    activeMatchId: null
  };
}

export function TindereoApp() {
  const [screen, setScreen] = useState<Screen>("qr");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [registration, setRegistration] = useState<RegistrationDraft>(DEFAULT_REGISTRATION);
  const [swipes, setSwipes] = useState<SwipeRecord[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [visitedZones, setVisitedZones] = useState<string[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const fallback = buildDefaultState();
      setScreen(parsed.screen ?? fallback.screen);
      setCurrentUser(parsed.currentUser ?? fallback.currentUser);
      setRegistration({ ...fallback.registration, ...parsed.registration });
      setSwipes(parsed.swipes ?? fallback.swipes);
      setMatches(parsed.matches ?? fallback.matches);
      setMessages(parsed.messages ?? fallback.messages);
      setVisitedZones(parsed.visitedZones ?? fallback.visitedZones);
      setSelectedChatId(parsed.selectedChatId ?? fallback.selectedChatId);
      setActiveMatchId(parsed.activeMatchId ?? fallback.activeMatchId);
    } catch {
      const fallback = buildDefaultState();
      setScreen(fallback.screen);
      setCurrentUser(fallback.currentUser);
      setRegistration(fallback.registration);
      setSwipes(fallback.swipes);
      setMatches(fallback.matches);
      setMessages(fallback.messages);
      setVisitedZones(fallback.visitedZones);
      setSelectedChatId(fallback.selectedChatId);
      setActiveMatchId(fallback.activeMatchId);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const payload: PersistedState = {
      screen,
      currentUser,
      registration,
      swipes,
      matches,
      messages,
      visitedZones,
      selectedChatId,
      activeMatchId
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [activeMatchId, currentUser, hydrated, matches, messages, registration, screen, selectedChatId, swipes, visitedZones]);

  useEffect(() => {
    if (!currentUser && PROTECTED_SCREENS.includes(screen)) {
      setScreen("qr");
    }
  }, [currentUser, screen]);

  const availableCards = currentUser
    ? BASE_ATTENDEES.filter((attendee) => {
        const hasSwipe = swipes.some(
          (swipe) => swipe.fromUserId === currentUser.id && swipe.toUserId === attendee.id
        );
        const hasMatch = matches.some((match) => match.userIds.includes(attendee.id));
        return !hasSwipe && !hasMatch;
      })
    : [];
  const leaderboard = buildLeaderboard(currentUser);
  const myRank = getMyRank(currentUser);
  const currentChat = selectedChatId ? matches.find((match) => match.id === selectedChatId) ?? null : null;
  const activeMatch = activeMatchId ? matches.find((match) => match.id === activeMatchId) ?? null : null;
  const sentMessagesCount = Object.values(messages)
    .flat()
    .filter((message) => message.senderId === currentUser?.id).length;

  function applyState(nextState: PersistedState) {
    setScreen(nextState.screen);
    setCurrentUser(nextState.currentUser);
    setRegistration(nextState.registration);
    setSwipes(nextState.swipes);
    setMatches(nextState.matches);
    setMessages(nextState.messages);
    setVisitedZones(nextState.visitedZones);
    setSelectedChatId(nextState.selectedChatId);
    setActiveMatchId(nextState.activeMatchId);
  }

  function resetApp() {
    applyState(buildDefaultState());
    window.localStorage.removeItem(STORAGE_KEY);
  }

  function startDemoMode() {
    applyState(buildDemoState());
  }

  function handleRegistrationComplete() {
    const nextUser = createProfileFromDraft(registration);
    setCurrentUser(nextUser);
    setSwipes([]);
    setMatches([]);
    setMessages({});
    setVisitedZones([nextUser.zoneId]);
    setSelectedChatId(null);
    setActiveMatchId(null);
    setScreen("home");
  }

  function updateRegistration(patch: Partial<RegistrationDraft>) {
    setRegistration((previous) => ({ ...previous, ...patch }));
  }

  function handleSwipe(targetUser: UserProfile, direction: SwipeDirection) {
    if (!currentUser) return;

    const swipeRecord: SwipeRecord = {
      id: `swipe-${Date.now()}`,
      fromUserId: currentUser.id,
      toUserId: targetUser.id,
      direction,
      createdAt: new Date().toISOString()
    };

    setSwipes((previous) => [swipeRecord, ...previous]);
    setCurrentUser((previous) =>
      previous
        ? {
            ...previous,
            points: previous.points + getSwipeReward(direction),
            superLikes: direction === "super" ? previous.superLikes + 1 : previous.superLikes
          }
        : previous
    );

    if (direction === "left") {
      return;
    }

    if (!shouldCreateMatch(currentUser, targetUser, direction)) {
      return;
    }

    const matchId = `match-${currentUser.id}-${targetUser.id}`;
    const alreadyMatched = matches.some((match) => match.id === matchId);
    if (alreadyMatched) return;

    const newMatch: MatchItem = {
      id: matchId,
      userIds: [currentUser.id, targetUser.id],
      createdAt: new Date().toISOString(),
      zoneId: targetUser.zoneId,
      commonInterests: getCommonInterests(currentUser, targetUser),
      superLike: direction === "super",
      unreadCount: 0
    };

    setMatches((previous) => [newMatch, ...previous]);
    setMessages((previous) => ({
      ...previous,
      [matchId]: [
        {
          id: `msg-${matchId}-1`,
          matchId,
          senderId: targetUser.id,
          text:
            direction === "super"
              ? "Vaya, ese super like me lo guardo. Donde te pillo?"
              : "Buenas. Justo me saliste y me dio curiosidad hablarte.",
          createdAt: new Date().toISOString(),
          kind: "text"
        }
      ]
    }));
    setCurrentUser((previous) =>
      previous
        ? {
            ...previous,
            points: previous.points + 100,
            matches: previous.matches + 1
          }
        : previous
    );
    setSelectedChatId(matchId);
    setActiveMatchId(matchId);
    setScreen("match");
  }

  function openChat(matchId: string) {
    setMatches((previous) =>
      previous.map((match) =>
        match.id === matchId
          ? {
              ...match,
              unreadCount: 0
            }
          : match
      )
    );
    setSelectedChatId(matchId);
    setScreen("chat");
  }

  function sendMessage(text: string, kind: ChatMessage["kind"] = "text") {
    if (!currentUser || !selectedChatId || !text.trim()) return;

    const activeConversation = matches.find((match) => match.id === selectedChatId);
    if (!activeConversation) return;

    const partner = getMatchPartner(activeConversation, currentUser.id, currentUser);
    const outgoingMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      matchId: selectedChatId,
      senderId: currentUser.id,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      kind
    };

    setMessages((previous) => ({
      ...previous,
      [selectedChatId]: [...(previous[selectedChatId] ?? []), outgoingMessage]
    }));
    setCurrentUser((previous) =>
      previous
        ? {
            ...previous,
            points: previous.points + 15
          }
        : previous
    );

    window.setTimeout(() => {
      const reply: ChatMessage = {
        id: `msg-${Date.now()}-reply`,
        matchId: selectedChatId,
        senderId: partner.id,
        text: getAutoReply(currentUser, partner, (messages[selectedChatId] ?? []).length + 1),
        createdAt: new Date().toISOString(),
        kind: "text"
      };

      setMessages((previous) => ({
        ...previous,
        [selectedChatId]: [...(previous[selectedChatId] ?? []), reply]
      }));
    }, 900);
  }

  function shareZone(zoneId: string) {
    if (!currentUser) return;
    const zone = getZoneById(zoneId);
    setCurrentUser((previous) => (previous ? { ...previous, zoneId } : previous));
    setVisitedZones((previous) => (previous.includes(zoneId) ? previous : [...previous, zoneId]));
    sendMessage(`Estoy ahora por ${zone.label}. Si te encaja, nos cruzamos por alli.`, "zone");
  }

  function shareInstagram() {
    if (!currentUser) return;
    sendMessage(`Te dejo mi Instagram: ${currentUser.instagram}`, "instagram");
  }

  function markZoneVisited(zoneId: string) {
    setVisitedZones((previous) => (previous.includes(zoneId) ? previous : [...previous, zoneId]));
  }

  function updateAdminAccess(email: string, password: string) {
    if (email === EVENT_INFO.organizerEmail && password === EVENT_INFO.organizerPassword) {
      setScreen("organizer");
      return true;
    }

    return false;
  }

  function renderScreen() {
    switch (screen) {
      case "qr":
        return (
          <QRLandingScreen
            onEnter={() => setScreen("welcome")}
            onUseDemo={startDemoMode}
            onAdminAccess={updateAdminAccess}
          />
        );
      case "welcome":
        return (
          <WelcomeScreen
            onStart={() => setScreen("register")}
            onUseDemo={startDemoMode}
          />
        );
      case "register":
        return (
          <RegistrationScreen
            draft={registration}
            onChange={updateRegistration}
            onBack={() => setScreen("welcome")}
            onComplete={() => setScreen("interests")}
          />
        );
      case "interests":
        return (
          <InterestSelectionScreen
            selected={registration.interests}
            onBack={() => setScreen("register")}
            onChange={(interests) => updateRegistration({ interests })}
            onComplete={() => setScreen("goal")}
          />
        );
      case "goal":
        return (
          <GoalSelectionScreen
            selected={registration.goal}
            onBack={() => setScreen("interests")}
            onChange={(goal) => updateRegistration({ goal })}
            onComplete={handleRegistrationComplete}
          />
        );
      case "home":
        return currentUser ? (
          <SwipeHomeScreen
            currentUser={currentUser}
            candidates={availableCards}
            onSwipe={handleSwipe}
            onNavigate={setScreen}
          />
        ) : null;
      case "match":
        return currentUser && activeMatch ? (
          <MatchScreen
            currentUser={currentUser}
            match={activeMatch}
            onChat={() => {
              setActiveMatchId(null);
              if (activeMatch.id) openChat(activeMatch.id);
            }}
            onKeepSwiping={() => {
              setActiveMatchId(null);
              setScreen("home");
            }}
          />
        ) : null;
      case "matches":
        return currentUser ? (
          <ChatInboxScreen
            currentUser={currentUser}
            matches={matches}
            messages={messages}
            onOpenChat={openChat}
            onNavigate={setScreen}
          />
        ) : null;
      case "chat":
        return currentUser && currentChat ? (
          <ChatConversationScreen
            currentUser={currentUser}
            match={currentChat}
            messages={messages[currentChat.id] ?? []}
            onBack={() => setScreen("matches")}
            onSend={sendMessage}
            onShareZone={shareZone}
            onShareInstagram={shareInstagram}
          />
        ) : null;
      case "map":
        return currentUser ? (
          <EventMapScreen
            currentUser={currentUser}
            matches={matches}
            onNavigate={setScreen}
            onVisitZone={markZoneVisited}
          />
        ) : null;
      case "ranking":
        return currentUser ? (
          <RankingScreen
            currentUser={currentUser}
            leaderboard={leaderboard}
            rankInfo={myRank}
            matches={matches}
            visitedZones={visitedZones}
            sentMessagesCount={sentMessagesCount}
            onNavigate={setScreen}
          />
        ) : null;
      case "profile":
        return currentUser ? (
          <ProfileScreen
            currentUser={currentUser}
            matches={matches}
            onNavigate={setScreen}
            onReset={resetApp}
          />
        ) : null;
      case "organizer":
        return (
          <OrganizerDashboard
            currentUser={currentUser}
            matches={matches}
            messages={messages}
            onExit={() => setScreen("qr")}
          />
        );
      default:
        return null;
    }
  }

  if (screen === "organizer") {
    return renderScreen();
  }

  return (
    <div className="min-h-[100dvh] md:px-6 md:py-4 lg:px-10">
      <div className="mx-auto flex min-h-[100dvh] max-w-7xl items-stretch gap-8 md:min-h-[calc(100dvh-2rem)] md:items-center">
        <aside className="hidden w-[360px] shrink-0 space-y-5 text-white lg:block">
          <div className="rounded-[36px] border border-white/10 bg-white/5 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-tight">tindereo</p>
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">{EVENT_INFO.subtitle}</p>
              </div>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight">
              Matching en vivo
              <span className="block tindereo-text-gradient">para tu tardeo</span>
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Ya esta montado el flujo completo para demo: acceso, onboarding, swipe izquierda /
              derecha / arriba, match, chat, mapa, ranking social y panel administrador.
            </p>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Demo rapido</p>
            <div className="mt-4 space-y-3">
              <InfoLine label="Evento" value={EVENT_INFO.eventCode} />
              <InfoLine label="Organizador" value={EVENT_INFO.organizerEmail} />
              <InfoLine label="Password" value={EVENT_INFO.organizerPassword} />
              <InfoLine label="Perfil demo" value="Sofia M. lista para testear swipes" />
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Gestos activos</p>
            <div className="mt-4 grid gap-3">
              <GestureRow icon="←" title="Izquierda" description="Pasar tarjeta" />
              <GestureRow icon="→" title="Derecha" description="Like y posible match" />
              <GestureRow icon="↑" title="Arriba" description="Super like" />
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Estado de sesion</p>
            {currentUser ? (
              <div className="mt-4 flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-3xl border border-white/15">
                  <img src={currentUser.photo} alt={currentUser.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{currentUser.name}</p>
                  <p className="text-sm text-white/60">
                    {currentUser.matches} matches · {currentUser.points} pts
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/60">
                Aun sin login. Puedes entrar como asistente, usar Sofia demo o abrir el panel del organizador.
              </p>
            )}
            <button
              onClick={resetApp}
              className="mt-5 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Reiniciar demo
            </button>
          </div>
        </aside>

        <div className="flex flex-1 justify-center">
          <div className="w-full md:max-w-[430px]">
            <div className="relative min-h-[100dvh] overflow-hidden bg-[#111111] shadow-none md:min-h-0 md:rounded-[42px] md:border-[8px] md:border-[#2A231E] md:shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
              {renderScreen()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
      <span className="text-white/45">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function GestureRow({
  icon,
  title,
  description
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF5A5F]/25 to-[#FF8C42]/25 text-lg font-bold">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-white/50">{description}</p>
      </div>
    </div>
  );
}

function QRLandingScreen({
  onEnter,
  onUseDemo,
  onAdminAccess
}: {
  onEnter: () => void;
  onUseDemo: () => void;
  onAdminAccess: (email: string, password: string) => boolean;
}) {
  const [email, setEmail] = useState(EVENT_INFO.organizerEmail);
  const [password, setPassword] = useState(EVENT_INFO.organizerPassword);
  const [showAdmin, setShowAdmin] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#111111]">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1506157786151-b8491531f063?w=900&h=1400&fit=crop&auto=format"
          alt="Publico del evento"
          className="h-full w-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-[#111111]/70 to-[#111111]" />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] flex-col justify-between px-6 pb-10 pt-12">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 backdrop-blur">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-white">tindereo</p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{EVENT_INFO.subtitle}</p>
            </div>
          </div>

          <div className="mt-10 rounded-[36px] border border-white/10 bg-white/10 p-6 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5A5F]" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF8C42]">
                Evento en vivo
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white">
              {EVENT_INFO.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/65">{EVENT_INFO.dateLabel}</p>
            <p className="text-sm leading-6 text-white/65">{EVENT_INFO.location}</p>
            <div className="mt-5 rounded-[28px] border border-white/15 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white/40">Codigo del evento</p>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-white">
                {EVENT_INFO.eventCode}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onEnter}
            className="w-full rounded-[26px] bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-5 py-4 text-lg font-bold text-white shadow-lg shadow-[#FF5A5F]/30"
          >
            Entrar como asistente
          </button>
          <button
            onClick={onUseDemo}
            className="w-full rounded-[26px] border border-white/15 bg-white/10 px-5 py-4 text-base font-semibold text-white backdrop-blur"
          >
            Probar con Sofia demo
          </button>
          <button
            onClick={() => setShowAdmin((visible) => !visible)}
            className="w-full rounded-[24px] border border-white/10 px-5 py-3.5 text-sm font-semibold text-white/70"
          >
            {showAdmin ? "Ocultar acceso organizador" : "Acceso organizador"}
          </button>

          {showAdmin ? (
            <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                Login del panel
              </p>
              <div className="space-y-3">
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/30"
                  placeholder="Email"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/30"
                  placeholder="Password"
                />
                {error ? <p className="text-sm text-[#FF8C42]">{error}</p> : null}
                <button
                  onClick={() => {
                    const allowed = onAdminAccess(email, password);
                    if (!allowed) {
                      setError("Credenciales incorrectas para esta demo.");
                    } else {
                      setError("");
                    }
                  }}
                  className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                >
                  Abrir dashboard
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({
  onStart,
  onUseDemo
}: {
  onStart: () => void;
  onUseDemo: () => void;
}) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#111111]">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&h=1400&fit=crop&auto=format"
          alt="Escenario del evento"
          className="h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#111111]/72 to-[#111111]" />
      </div>
      <div className="relative z-10 flex min-h-[100dvh] flex-col px-6 pb-10 pt-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-[#FF5A5F]" />
          {EVENT_INFO.name} · en vivo ahora
        </div>
        <div className="mt-10">
          <h1 className="text-4xl font-extrabold leading-tight text-white">
            La noche mas
            <span className="block tindereo-text-gradient">conectada de tu vida</span>
          </h1>
          <p className="mt-4 text-base leading-7 text-white/65">
            Conoce personas que estan en este mismo tardeo, en este mismo momento, con el tipo
            de vibra que tu buscas.
          </p>
        </div>
        <div className="mt-8 space-y-3">
          {[
            "Haz match con gente afin",
            "Desliza tarjetas como en Tinder",
            "Abre chat y comparte zona del evento"
          ].map((item) => (
            <div
              key={item}
              className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-3 text-sm text-white/85 backdrop-blur"
            >
              {item}
            </div>
          ))}
        </div>
        <div className="mt-auto space-y-3">
          <button
            onClick={onStart}
            className="w-full rounded-[26px] bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-5 py-4 text-lg font-bold text-white shadow-lg shadow-[#FF5A5F]/30"
          >
            Crear mi perfil
          </button>
          <button
            onClick={onUseDemo}
            className="w-full rounded-[24px] border border-white/15 px-5 py-3.5 text-sm font-semibold text-white/70"
          >
            Entrar directo con Sofia demo
          </button>
        </div>
      </div>
    </div>
  );
}

function RegistrationScreen({
  draft,
  onChange,
  onBack,
  onComplete
}: {
  draft: RegistrationDraft;
  onChange: (patch: Partial<RegistrationDraft>) => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  function nextStep() {
    if (step < totalSteps) {
      setStep((previous) => previous + 1);
      return;
    }
    onComplete();
  }

  function previousStep() {
    if (step === 1) {
      onBack();
      return;
    }
    setStep((previous) => previous - 1);
  }

  return (
    <div className="min-h-screen bg-[#FAF7F3] text-[#1A1410]">
      <div className="px-5 pb-4 pt-12">
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={previousStep}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/8 bg-white shadow-sm"
          >
            <ChevronLeft className="h-5 w-5 text-[#3D3630]" />
          </button>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-[#EDE8E0]">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#FF5A5F] to-[#FF8C42]"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-[#7A7068]">
            {step}/{totalSteps}
          </span>
        </div>

        {step === 1 ? (
          <>
            <h2 className="text-[29px] font-extrabold">Como quieres aparecer?</h2>
            <p className="mt-2 text-sm text-[#7A7068]">Nombre, edad y una foto para que la app tenga cara.</p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              {AVATAR_CHOICES.map((choice) => {
                const selected = draft.photo === choice.photo;
                return (
                  <button
                    key={choice.photo}
                    onClick={() =>
                      onChange({
                        photo: choice.photo,
                        coverPhoto: choice.coverPhoto
                      })
                    }
                    className={`overflow-hidden rounded-[26px] border-2 ${selected ? "border-[#FF5A5F]" : "border-transparent"}`}
                  >
                    <img src={choice.photo} alt="Avatar" className="h-28 w-full object-cover" />
                  </button>
                );
              })}
            </div>
            <div className="mt-6 space-y-4">
              <FieldLabel label="Nombre o apodo *" />
              <input
                value={draft.name}
                onChange={(event) => onChange({ name: event.target.value })}
                className="w-full rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-4 text-base text-[#1A1410] placeholder:text-[#B8AFA4]"
                placeholder="ej. Sofia, DJ Mike, La Guera..."
              />
              <FieldLabel label="Edad *" />
              <select
                value={draft.age}
                onChange={(event) => onChange({ age: event.target.value })}
                className="w-full rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-4 text-base"
              >
                {Array.from({ length: 33 }, (_, index) => index + 18).map((age) => (
                  <option key={age} value={String(age)}>
                    {age} anos
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-[29px] font-extrabold">Danos un poco de contexto</h2>
            <p className="mt-2 text-sm text-[#7A7068]">Todo esto ayuda a conectar mejor dentro del evento.</p>
            <div className="mt-7 space-y-4">
              <FieldLabel label="Instagram" />
              <input
                value={draft.instagram}
                onChange={(event) => onChange({ instagram: event.target.value })}
                className="w-full rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-4 text-base"
                placeholder="@tuinstagram"
              />
              <FieldLabel label="Ciudad" />
              <input
                value={draft.city}
                onChange={(event) => onChange({ city: event.target.value })}
                className="w-full rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-4 text-base"
                placeholder="ej. Madrid"
              />
              <FieldLabel label="Ocupacion" />
              <input
                value={draft.occupation}
                onChange={(event) => onChange({ occupation: event.target.value })}
                className="w-full rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-4 text-base"
                placeholder="ej. Product designer, founder, DJ..."
              />
              <FieldLabel label="Estado sentimental" />
              <select
                value={draft.relationship}
                onChange={(event) => onChange({ relationship: event.target.value })}
                className="w-full rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-4 text-base"
              >
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="text-[29px] font-extrabold">Tu frase para esta noche</h2>
            <p className="mt-2 text-sm text-[#7A7068]">
              Escribe algo que te represente en este tardeo.
            </p>
            <div className="mt-7">
              <textarea
                value={draft.bio}
                onChange={(event) => onChange({ bio: event.target.value })}
                rows={5}
                className="w-full resize-none rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-4 text-base"
                placeholder="ej. Aqui por la musica, las conexiones sin postureo y una buena charla despues del drop."
              />
            </div>
            <div className="mt-5 rounded-[24px] border border-[#FF5A5F]/20 bg-[#FF5A5F]/5 p-4">
              <p className="text-sm font-semibold text-[#FF5A5F]">Privacidad cuidada</p>
              <p className="mt-2 text-sm leading-6 text-[#7A7068]">
                Nunca mostramos la ubicacion exacta de nadie, solo zonas del evento.
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="px-5 pb-10 pt-4">
        <button
          onClick={nextStep}
          disabled={step === 1 && !draft.name.trim()}
          className="w-full rounded-[26px] bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-5 py-4 text-lg font-bold text-white shadow-lg shadow-[#FF5A5F]/20 disabled:opacity-40"
        >
          {step < totalSteps ? "Continuar" : "Seguir con mis intereses"}
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3D3630]">{label}</p>;
}

function InterestSelectionScreen({
  selected,
  onChange,
  onBack,
  onComplete
}: {
  selected: string[];
  onChange: (interests: string[]) => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  function toggle(interest: string) {
    if (selected.includes(interest)) {
      onChange(selected.filter((value) => value !== interest));
      return;
    }
    if (selected.length >= 8) return;
    onChange([...selected, interest]);
  }

  return (
    <div className="min-h-screen bg-[#FAF7F3] text-[#1A1410]">
      <div className="px-5 pb-4 pt-12">
        <button
          onClick={onBack}
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-black/8 bg-white shadow-sm"
        >
          <ChevronLeft className="h-5 w-5 text-[#3D3630]" />
        </button>
        <h2 className="text-[29px] font-extrabold">Que te mueve?</h2>
        <p className="mt-2 text-sm text-[#7A7068]">Elige hasta 8 intereses para encontrar a tu gente.</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-[#EDE8E0]">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-[#FF5A5F] to-[#FF8C42]"
              style={{ width: `${(selected.length / 8) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-[#B8AFA4]">{selected.length}/8</span>
        </div>
      </div>
      <div className="scrollbar-hide flex-1 overflow-y-auto px-5 pb-5">
        <div className="flex flex-wrap gap-3">
          {INTEREST_OPTIONS.map((interest) => {
            const active = selected.includes(interest);
            return (
              <button
                key={interest}
                onClick={() => toggle(interest)}
                className={`rounded-full border-2 px-4 py-2.5 text-sm font-semibold transition ${
                  active
                    ? "border-transparent bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] text-white"
                    : "border-[#EDE8E0] bg-white text-[#3D3630]"
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pb-10 pt-4">
        <button
          onClick={onComplete}
          disabled={selected.length === 0}
          className="w-full rounded-[26px] bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-5 py-4 text-lg font-bold text-white disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

function GoalSelectionScreen({
  selected,
  onChange,
  onBack,
  onComplete
}: {
  selected: string;
  onChange: (goal: string) => void;
  onBack: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#FAF7F3] text-[#1A1410]">
      <div className="px-5 pb-6 pt-12">
        <button
          onClick={onBack}
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-black/8 bg-white shadow-sm"
        >
          <ChevronLeft className="h-5 w-5 text-[#3D3630]" />
        </button>
        <h2 className="text-[29px] font-extrabold">Que buscas hoy?</h2>
        <p className="mt-2 text-sm text-[#7A7068]">Solo tu lo ves. Nos sirve para afinar el matching.</p>
      </div>
      <div className="space-y-3 px-5 pb-4">
        {GOAL_OPTIONS.map((goal) => {
          const active = selected === goal;
          return (
            <button
              key={goal}
              onClick={() => onChange(goal)}
              className={`flex w-full items-center gap-4 rounded-[24px] border-2 p-4 text-left transition ${
                active ? "border-[#FF5A5F] bg-[#FF5A5F]/5" : "border-[#EDE8E0] bg-white"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  active ? "bg-[#FF5A5F]/10 text-[#FF5A5F]" : "bg-[#F5EFE6] text-[#7A7068]"
                }`}
              >
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{goal}</p>
                <p className="text-xs text-[#B8AFA4]">{GOAL_COPY[goal]}</p>
              </div>
              <div
                className={`h-5 w-5 rounded-full border-2 ${
                  active ? "border-[#FF5A5F] bg-[#FF5A5F]" : "border-[#EDE8E0]"
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="px-5 pb-10 pt-4">
        <button
          onClick={onComplete}
          disabled={!selected}
          className="w-full rounded-[26px] bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-5 py-4 text-lg font-bold text-white disabled:opacity-40"
        >
          Entrar a descubrir gente
        </button>
      </div>
    </div>
  );
}

function SwipeHomeScreen({
  currentUser,
  candidates,
  onSwipe,
  onNavigate
}: {
  currentUser: UserProfile;
  candidates: UserProfile[];
  onSwipe: (user: UserProfile, direction: SwipeDirection) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const topCandidate = candidates[0] ?? null;
  const gestureHints = [
    {
      id: "left",
      symbol: "←",
      label: "Paso",
      tone: "text-[#FF5A5F] bg-[#FF5A5F]/8 border-[#FF5A5F]/15"
    },
    {
      id: "up",
      symbol: "↑",
      label: "Super like",
      tone: "text-[#FF8C42] bg-[#FF8C42]/8 border-[#FF8C42]/15"
    },
    {
      id: "right",
      symbol: "→",
      label: "Like",
      tone: "text-[#14B86E] bg-[#14B86E]/8 border-[#14B86E]/15"
    }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F3] text-[#1A1410]">
      <div className="px-5 pb-4 pt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] shadow-md shadow-[#FF5A5F]/20">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-tight">tindereo</p>
              <p className="text-xs text-[#B8AFA4]">Hola, {currentUser.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE8E0] bg-white shadow-sm">
              <Filter className="h-4 w-4 text-[#7A7068]" />
            </button>
            <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE8E0] bg-white shadow-sm">
              <Bell className="h-4 w-4 text-[#7A7068]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF5A5F]" />
            </button>
          </div>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#EDE8E0] bg-white px-3 py-2 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#FF5A5F]" />
          <span className="text-xs font-semibold text-[#3D3630]">
            {EVENT_INFO.name} · {EVENT_INFO.liveAttendees} personas conectadas
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {gestureHints.map((hint) => (
            <div
              key={hint.id}
              className={`rounded-[18px] border px-3 py-2 text-center ${hint.tone}`}
            >
              <p className="text-lg font-black leading-none">{hint.symbol}</p>
              <p className="mt-1 text-[11px] font-semibold">{hint.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex-1 px-4">
        <div className="relative mx-auto h-[min(56vh,520px)] min-h-[380px] w-full max-h-[520px]">
          {topCandidate ? (
            <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-center shadow-lg backdrop-blur">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF5A5F]">
                Prueba el gesto
              </p>
              <p className="mt-1 text-xs font-medium text-[#5F544B]">
                Arrastra la tarjeta o usa los botones de abajo
              </p>
            </div>
          ) : null}
          {candidates.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-[32px] border border-dashed border-[#EDE8E0] bg-white/70 px-6 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#FF5A5F]/10">
                <Sparkles className="h-8 w-8 text-[#FF5A5F]" />
              </div>
              <h3 className="text-2xl font-extrabold">Ya viste a todo el mundo</h3>
              <p className="mt-3 text-sm leading-6 text-[#7A7068]">
                Puedes ir al mapa, revisar tus chats o reiniciar la demo desde el lateral.
              </p>
              <button
                onClick={() => onNavigate("matches")}
                className="mt-6 rounded-2xl bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-4 py-3 text-sm font-semibold text-white"
              >
                Ver mis chats
              </button>
            </div>
          ) : (
            candidates
              .slice(0, 3)
              .reverse()
              .map((candidate, index, array) => {
                const depth = array.length - 1 - index;
                return (
                  <div
                    key={candidate.id}
                    className="absolute inset-0"
                    style={{
                      transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`,
                      zIndex: index + 1
                    }}
                  >
                    <SwipeCard
                      candidate={candidate}
                      currentUser={currentUser}
                      isTop={candidate.id === topCandidate?.id}
                      onSwipe={(direction) => onSwipe(candidate, direction)}
                    />
                  </div>
                );
              })
          )}
        </div>
      </div>

      <div className="px-8 pb-5 pt-4">
        <div className="flex items-center justify-center gap-5">
          <ActionButton
            disabled={!topCandidate}
            onClick={() => topCandidate && onSwipe(topCandidate, "left")}
            className="border-2 border-[#EDE8E0] bg-white text-[#FF5A5F]"
          >
            <X className="h-7 w-7" />
          </ActionButton>
          <ActionButton
            disabled={!topCandidate}
            onClick={() => topCandidate && onSwipe(topCandidate, "super")}
            className="bg-gradient-to-br from-[#FFB347] to-[#FF8C42] text-white shadow-lg shadow-[#FFB347]/30"
          >
            <Star className="h-6 w-6 fill-white" />
          </ActionButton>
          <ActionButton
            disabled={!topCandidate}
            onClick={() => topCandidate && onSwipe(topCandidate, "right")}
            className="bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] text-white shadow-lg shadow-[#FF5A5F]/30"
          >
            <Heart className="h-7 w-7 fill-white" />
          </ActionButton>
        </div>
        <p className="mt-3 text-center text-xs text-[#B8AFA4]">
          Desliza izquierda para pasar, derecha para like y arriba para super like.
        </p>
      </div>

      <BottomNav active="home" onNavigate={onNavigate} />
    </div>
  );
}

function ActionButton({
  className,
  children,
  disabled,
  onClick
}: {
  className: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-16 w-16 items-center justify-center rounded-full ${className} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function SwipeCard({
  candidate,
  currentUser,
  isTop,
  onSwipe
}: {
  candidate: UserProfile;
  currentUser: UserProfile;
  isTop: boolean;
  onSwipe: (direction: SwipeDirection) => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const leaving = useRef(false);
  const compatibility = getCompatibilityScore(currentUser, candidate);
  const commonInterests = getCommonInterests(currentUser, candidate);
  const zone = getZoneById(candidate.zoneId);

  function decideDirection() {
    if (offset.y < -110 && Math.abs(offset.y) > Math.abs(offset.x) * 1.15) {
      return "super" as const;
    }
    if (offset.x > 120) return "right" as const;
    if (offset.x < -120) return "left" as const;
    return null;
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!isTop || leaving.current) return;
    startPoint.current = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y
    };
    setTransitionEnabled(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!isTop || !startPoint.current || leaving.current) return;
    setOffset({
      x: event.clientX - startPoint.current.x,
      y: event.clientY - startPoint.current.y
    });
  }

  function endDrag() {
    if (!isTop || !startPoint.current || leaving.current) return;
    startPoint.current = null;
    const direction = decideDirection();

    if (!direction) {
      setTransitionEnabled(true);
      setOffset({ x: 0, y: 0 });
      return;
    }

    leaving.current = true;
    setTransitionEnabled(true);
    setOffset(
      direction === "left"
        ? { x: -420, y: 30 }
        : direction === "right"
          ? { x: 420, y: 30 }
          : { x: 0, y: -420 }
    );
    window.setTimeout(() => {
      onSwipe(direction);
      leaving.current = false;
      setOffset({ x: 0, y: 0 });
    }, 180);
  }

  const showLike = offset.x > 32 && Math.abs(offset.x) > Math.abs(offset.y);
  const showNope = offset.x < -32 && Math.abs(offset.x) > Math.abs(offset.y);
  const showSuper = offset.y < -36 && Math.abs(offset.y) > Math.abs(offset.x);

  return (
    <div
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`h-full w-full ${isTop ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{
        touchAction: isTop ? "none" : "auto",
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x / 16}deg)`,
        transition: transitionEnabled ? "transform 180ms ease" : "none"
      }}
    >
      <div className="relative h-full overflow-hidden rounded-[34px] shadow-2xl">
        <img src={candidate.photo} alt={candidate.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
        <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 backdrop-blur">
          <MapPin className="h-3 w-3 text-white/80" />
          <span className="text-xs font-semibold text-white/90">{zone.label}</span>
        </div>
        <div className="absolute right-5 top-5 flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 backdrop-blur">
          <Zap className="h-3 w-3 text-[#FFB347]" />
          <span className="text-xs font-bold text-white">{compatibility}% afin</span>
        </div>

        <div
          className="absolute left-6 top-24 rounded-xl border-4 border-[#4ADE80] px-4 py-1 text-2xl font-black text-[#4ADE80]"
          style={{ opacity: showLike ? 1 : 0 }}
        >
          LIKE
        </div>
        <div
          className="absolute right-6 top-24 rounded-xl border-4 border-[#FF5A5F] px-4 py-1 text-2xl font-black text-[#FF5A5F]"
          style={{ opacity: showNope ? 1 : 0 }}
        >
          PASO
        </div>
        <div
          className="absolute left-1/2 top-20 -translate-x-1/2 rounded-xl border-4 border-[#FFB347] px-4 py-1 text-2xl font-black text-[#FFB347]"
          style={{ opacity: showSuper ? 1 : 0 }}
        >
          SUPER LIKE
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h3 className="text-[31px] font-extrabold leading-none text-white">
            {candidate.name}, {candidate.age}
          </h3>
          <p className="mt-2 text-sm leading-6 text-white/75">{candidate.bio}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {candidate.interests.slice(0, 4).map((interest) => (
              <span
                key={interest}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  commonInterests.includes(interest)
                    ? "border border-[#FF8C42]/40 bg-[#FF8C42]/20 text-[#FFB347]"
                    : "border border-white/20 bg-white/10 text-white/85"
                }`}
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchScreen({
  currentUser,
  match,
  onChat,
  onKeepSwiping
}: {
  currentUser: UserProfile;
  match: MatchItem;
  onChat: () => void;
  onKeepSwiping: () => void;
}) {
  const partner = getMatchPartner(match, currentUser.id, currentUser);
  const zone = getZoneById(partner.zoneId);

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#111111] px-6 pb-12 pt-16 text-white">
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[#FF5A5F]/25 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-[#FF8C42]/18 blur-3xl" />
      </div>
      <div className="relative z-10 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#FF8C42]">Es un match</p>
        <h1 className="mt-4 text-[42px] font-extrabold leading-tight">
          Tu y {partner.name}
          <span className="block tindereo-text-gradient">os gustasteis</span>
        </h1>
      </div>

      <div className="relative z-10">
        <div className="relative mx-auto mb-8 flex h-40 w-[270px] items-center justify-center">
          <div className="absolute left-0 h-36 w-36 overflow-hidden rounded-full border-4 border-[#FF5A5F] shadow-lg shadow-[#FF5A5F]/30">
            <img src={currentUser.photo} alt={currentUser.name} className="h-full w-full object-cover" />
          </div>
          <div className="absolute right-0 h-36 w-36 overflow-hidden rounded-full border-4 border-[#FF8C42] shadow-lg shadow-[#FF8C42]/30">
            <img src={partner.photo} alt={partner.name} className="h-full w-full object-cover" />
          </div>
          <div className="absolute bottom-0 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] text-xl shadow-lg">
            ❤
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 text-center backdrop-blur">
          <p className="text-sm text-white/55">Os unen</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {(match.commonInterests.length > 0 ? match.commonInterests : ["Buena energia"]).map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-[#FF8C42]/30 bg-[#FF8C42]/15 px-3 py-1 text-sm font-semibold text-[#FFB347]"
              >
                {interest}
              </span>
            ))}
          </div>
          <div className="mt-5 rounded-[22px] bg-black/20 px-4 py-3 text-sm text-white/78">
            {partner.name} esta ahora en {zone.label}. Solo mostramos la zona, nunca la posicion exacta.
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-3">
        <button
          onClick={onChat}
          className="w-full rounded-[26px] bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-5 py-4 text-lg font-bold text-white shadow-lg shadow-[#FF5A5F]/30"
        >
          Escribir ahora
        </button>
        <button
          onClick={onKeepSwiping}
          className="w-full rounded-[24px] border border-white/15 px-5 py-3.5 text-base font-semibold text-white/70"
        >
          Seguir descubriendo
        </button>
      </div>
    </div>
  );
}

function ChatInboxScreen({
  currentUser,
  matches,
  messages,
  onOpenChat,
  onNavigate
}: {
  currentUser: UserProfile;
  matches: MatchItem[];
  messages: Record<string, ChatMessage[]>;
  onOpenChat: (matchId: string) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const [query, setQuery] = useState("");

  const items = matches
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((match) => {
      const partner = getMatchPartner(match, currentUser.id, currentUser);
      const thread = messages[match.id] ?? [];
      return {
        match,
        partner,
        lastMessage: buildMatchMessagePreview(thread),
        time: thread.length ? formatTimeAgo(thread[thread.length - 1].createdAt) : formatTimeAgo(match.createdAt)
      };
    })
    .filter((item) => item.partner.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F3] text-[#1A1410]">
      <div className="bg-[#FAF7F3] px-5 pb-4 pt-12">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-[28px] font-extrabold">Conexiones</h1>
          <div className="flex items-center gap-1 rounded-full border border-[#FF5A5F]/20 bg-[#FF5A5F]/7 px-3 py-1 text-xs font-bold text-[#FF5A5F]">
            <Zap className="h-3 w-3" />
            {matches.length} matches
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B8AFA4]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-[24px] border border-[#EDE8E0] bg-white py-3 pl-10 pr-4 text-sm"
            placeholder="Buscar conversacion..."
          />
        </div>
      </div>

      <div className="px-5 pb-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#B8AFA4]">Nuevos matches</p>
        <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-2">
          {items
            .filter((item) => item.match.unreadCount > 0 || item.partner.status === "online")
            .map((item) => (
              <button
                key={item.match.id}
                onClick={() => onOpenChat(item.match.id)}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <div className="relative">
                  <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-[#FF5A5F]">
                    <img src={item.partner.photo} alt={item.partner.name} className="h-full w-full object-cover" />
                  </div>
                  {item.partner.status === "online" ? (
                    <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-[#4ADE80]" />
                  ) : null}
                  {item.match.unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF5A5F] text-[10px] font-bold text-white">
                      {item.match.unreadCount}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-[#3D3630]">{item.partner.name}</span>
              </button>
            ))}
        </div>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto px-5 pb-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#B8AFA4]">Conversaciones</p>
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.match.id}
              onClick={() => onOpenChat(item.match.id)}
              className="flex w-full items-center gap-3 rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-3.5 text-left transition hover:border-[#FF5A5F]/30"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#EDE8E0]">
                <img src={item.partner.photo} alt={item.partner.name} className="h-full w-full object-cover" />
                {item.partner.status === "online" ? (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#4ADE80]" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">{item.partner.name}</span>
                  <span className="text-xs text-[#B8AFA4]">{item.time}</span>
                </div>
                <p className={`truncate text-sm ${item.match.unreadCount > 0 ? "font-semibold text-[#3D3630]" : "text-[#B8AFA4]"}`}>
                  {item.lastMessage}
                </p>
                <p className="mt-1 text-[11px] text-[#B8AFA4]">📍 {getZoneById(item.partner.zoneId).label}</p>
              </div>
              {item.match.unreadCount > 0 ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] text-[10px] font-bold text-white">
                  {item.match.unreadCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <BottomNav active="matches" onNavigate={onNavigate} />
    </div>
  );
}

function ChatConversationScreen({
  currentUser,
  match,
  messages,
  onBack,
  onSend,
  onShareZone,
  onShareInstagram
}: {
  currentUser: UserProfile;
  match: MatchItem;
  messages: ChatMessage[];
  onBack: () => void;
  onSend: (text: string, kind?: ChatMessage["kind"]) => void;
  onShareZone: (zoneId: string) => void;
  onShareInstagram: () => void;
}) {
  const [input, setInput] = useState("");
  const [showZones, setShowZones] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const partner = getMatchPartner(match, currentUser.id, currentUser);
  const compatibility = getCompatibilityScore(currentUser, partner);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showZones]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F3] text-[#1A1410]">
      <div className="border-b border-[#EDE8E0] bg-white px-4 pb-3 pt-12">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full">
            <ChevronLeft className="h-5 w-5 text-[#3D3630]" />
          </button>
          <div className="relative h-11 w-11 overflow-hidden rounded-full border-2 border-[#FF5A5F]/40">
            <img src={partner.photo} alt={partner.name} className="h-full w-full object-cover" />
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#4ADE80]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{partner.name}</p>
            <p className="text-xs text-[#B8AFA4]">
              En linea · {getZoneById(partner.zoneId).label}
            </p>
          </div>
          <div className="rounded-full border border-[#FF5A5F]/20 bg-[#FF5A5F]/6 px-3 py-1 text-xs font-bold text-[#FF5A5F]">
            {compatibility}% afin
          </div>
        </div>
        <div className="ml-12 mt-3 flex flex-wrap gap-2">
          {match.commonInterests.slice(0, 3).map((interest) => (
            <span
              key={interest}
              className="rounded-full border border-[#FF8C42]/20 bg-[#FF8C42]/10 px-2.5 py-1 text-xs font-semibold text-[#FF8C42]"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>

      <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-3">
          {messages.map((message) => {
            const mine = message.senderId === currentUser.id;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                {!mine ? (
                  <div className="mr-2 mt-1 h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <img src={partner.photo} alt={partner.name} className="h-full w-full object-cover" />
                  </div>
                ) : null}
                <div className="max-w-[76%]">
                  <div
                    className={`rounded-[22px] px-4 py-2.5 text-sm leading-6 ${
                      mine
                        ? "rounded-br-md bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] text-white"
                        : "rounded-bl-md border border-[#EDE8E0] bg-white text-[#1A1410]"
                    }`}
                  >
                    {message.text}
                  </div>
                  <p className={`mt-1 text-[10px] text-[#B8AFA4] ${mine ? "text-right" : "text-left"}`}>
                    {formatClock(message.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      {showZones ? (
        <div className="mx-4 mb-2 rounded-[24px] border border-[#EDE8E0] bg-white shadow-lg">
          <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#B8AFA4]">
            Compartir mi zona
          </p>
          <div className="space-y-1 p-2">
            {EVENT_ZONES.map((zone) => (
              <button
                key={zone.id}
                onClick={() => {
                  onShareZone(zone.id);
                  setShowZones(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-[#FAF7F3]"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-2xl text-sm"
                  style={{ backgroundColor: `${zone.color}18`, color: zone.color }}
                >
                  {zone.emoji}
                </div>
                <span className="text-sm font-medium text-[#3D3630]">{zone.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-[#EDE8E0] bg-white px-4 pb-8 pt-3">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setShowZones((previous) => !previous)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE8E0] bg-[#FAF7F3]"
            title="Compartir zona"
          >
            <MapPin className="h-4 w-4 text-[#FF5A5F]" />
          </button>
          <button
            onClick={onShareInstagram}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE8E0] bg-[#FAF7F3]"
            title="Compartir Instagram"
          >
            <Instagram className="h-4 w-4 text-[#7A7068]" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSend(input, "text");
                  setInput("");
                }
              }}
              placeholder="Escribe un mensaje..."
              className="w-full rounded-[24px] border border-[#EDE8E0] bg-[#FAF7F3] px-4 py-3 pr-10 text-sm"
            />
          </div>
          <button
            onClick={() => {
              onSend(input, "text");
              setInput("");
            }}
            disabled={!input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] text-white shadow-lg shadow-[#FF5A5F]/20 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EventMapScreen({
  currentUser,
  matches,
  onNavigate,
  onVisitZone
}: {
  currentUser: UserProfile;
  matches: MatchItem[];
  onNavigate: (screen: Screen) => void;
  onVisitZone: (zoneId: string) => void;
}) {
  const [selectedZoneId, setSelectedZoneId] = useState(currentUser.zoneId);
  const selectedZone = getZoneById(selectedZoneId);
  const highlightedUsers = matches
    .slice(0, 3)
    .map((match) => getMatchPartner(match, currentUser.id, currentUser));

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F3] text-[#1A1410]">
      <div className="px-5 pb-4 pt-12">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-[28px] font-extrabold">Mapa del evento</h1>
          <div className="flex items-center gap-2 rounded-full border border-[#EDE8E0] bg-white px-3 py-1.5 shadow-sm">
            <Users className="h-3.5 w-3.5 text-[#FF5A5F]" />
            <span className="text-xs font-bold text-[#3D3630]">{EVENT_INFO.liveAttendees} aqui</span>
          </div>
        </div>
        <p className="text-sm text-[#B8AFA4]">Solo mostramos zonas generales, nunca ubicacion exacta.</p>
      </div>

      <div className="mx-5 mb-4 overflow-hidden rounded-[32px] border border-[#EDE8E0] bg-white shadow-soft">
        <div className="relative h-[320px] bg-[#F5EFE6]">
          <svg className="absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#B8AFA4" strokeWidth="0.6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
          {EVENT_ZONES.map((zone) => (
            <button
              key={zone.id}
              onClick={() => {
                setSelectedZoneId(zone.id);
                onVisitZone(zone.id);
              }}
              className="absolute flex flex-col items-center justify-center rounded-[22px] border-2 text-center transition"
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.w}%`,
                height: `${zone.h}%`,
                backgroundColor: selectedZoneId === zone.id ? `${zone.color}28` : `${zone.color}12`,
                borderColor: selectedZoneId === zone.id ? zone.color : `${zone.color}55`,
                boxShadow: selectedZoneId === zone.id ? `0 0 16px ${zone.color}40` : "none"
              }}
            >
              <span className="text-xl">{zone.emoji}</span>
              <span className="text-[10px] font-bold" style={{ color: zone.color }}>
                {zone.label}
              </span>
              <span className="text-[9px] font-semibold" style={{ color: `${zone.color}AA` }}>
                {zone.people}
              </span>
            </button>
          ))}
          {highlightedUsers.map((user, index) => {
            const zone = getZoneById(user.zoneId);
            return (
              <div
                key={user.id}
                className="absolute h-8 w-8 overflow-hidden rounded-full border-2 border-[#FF5A5F] shadow-md"
                style={{
                  left: `${zone.x + 6 + index * 4}%`,
                  top: `${zone.y + 6 + index * 3}%`,
                  transform: "translate(-50%, -50%)"
                }}
              >
                <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
              </div>
            );
          })}
          <div
            className="absolute h-4 w-4 rounded-full border-2 border-white bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] shadow-md"
            style={{ left: "48%", top: "50%", transform: "translate(-50%, -50%)" }}
          />
          <span className="absolute text-[10px] font-bold text-[#FF5A5F]" style={{ left: "50%", top: "44%" }}>
            Tu
          </span>
        </div>
      </div>

      <div className="mx-5 mb-4 rounded-[28px] border border-[#EDE8E0] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
            style={{ backgroundColor: `${selectedZone.color}18` }}
          >
            {selectedZone.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{selectedZone.label}</p>
            <p className="text-xs text-[#B8AFA4]">{selectedZone.people} personas aproximadas</p>
          </div>
        </div>
        <p className="mt-3 rounded-[22px] bg-[#FAF7F3] px-4 py-3 text-sm leading-6 text-[#7A7068]">
          Si ves una tarjeta con esta zona, podeis cruzaros sin exponer la ubicacion exacta de nadie.
        </p>
      </div>

      <div className="scrollbar-hide mb-4 flex gap-2 overflow-x-auto px-5">
        {EVENT_ZONES.map((zone) => (
          <button
            key={zone.id}
            onClick={() => {
              setSelectedZoneId(zone.id);
              onVisitZone(zone.id);
            }}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${
              selectedZoneId === zone.id ? "text-white" : "border-[#EDE8E0] bg-white text-[#7A7068]"
            }`}
            style={selectedZoneId === zone.id ? { backgroundColor: zone.color, borderColor: zone.color } : {}}
          >
            {zone.emoji} {zone.label}
          </button>
        ))}
      </div>

      <BottomNav active="map" onNavigate={onNavigate} />
    </div>
  );
}

function RankingScreen({
  currentUser,
  leaderboard,
  rankInfo,
  matches,
  visitedZones,
  sentMessagesCount,
  onNavigate
}: {
  currentUser: UserProfile;
  leaderboard: { rank: number; user: UserProfile }[];
  rankInfo: { rank: number; points: number; progress: number; nextMilestone: number };
  matches: MatchItem[];
  visitedZones: string[];
  sentMessagesCount: number;
  onNavigate: (screen: Screen) => void;
}) {
  const podium = leaderboard.slice(0, 3);
  const followingUsers = leaderboard.slice(3, 6);
  const achievements = [
    { label: "First Match", description: "Tu primer match de la noche", done: matches.length > 0, icon: "🔥" },
    { label: "Chatter", description: "Inicia 3 mensajes", done: sentMessagesCount >= 3, icon: "💬" },
    { label: "Super Liker", description: "Da 2 super likes", done: currentUser.superLikes >= 2, icon: "⭐" },
    { label: "Explorer", description: "Pisa 4 zonas del evento", done: visitedZones.length >= 4, icon: "🗺" }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F3] text-[#1A1410]">
      <div className="relative overflow-hidden bg-[#111111] px-5 pb-6 pt-12 text-white">
        <div className="absolute inset-0 opacity-20">
          <img
            src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&h=500&fit=crop&auto=format"
            alt="Escenario"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="relative z-10">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-[28px] font-extrabold">Ranking social</h1>
            <div className="flex items-center gap-2 rounded-full border border-[#FF8C42]/25 bg-[#FF8C42]/20 px-3 py-1 text-xs font-bold text-[#FF8C42]">
              <Trophy className="h-3.5 w-3.5" />
              {EVENT_INFO.name}
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Tu posicion</p>
                <p className="mt-2 text-4xl font-extrabold">#{rankInfo.rank}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.18em] text-white/45">Puntos</p>
                <div className="mt-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#FFB347]" />
                  <span className="text-3xl font-extrabold">{rankInfo.points}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/15">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-[#FF5A5F] to-[#FF8C42]"
                style={{ width: `${rankInfo.progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-white/40">
              {rankInfo.nextMilestone - rankInfo.points} pts para el siguiente nivel
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5">
        {podium.length === 3 ? (
          <div className="mb-6 flex items-end justify-center gap-3">
            <PodiumCard entry={podium[1]} size="small" />
            <PodiumCard entry={podium[0]} size="large" />
            <PodiumCard entry={podium[2]} size="small" />
          </div>
        ) : null}

        <div className="space-y-2">
          {followingUsers.map((entry) => (
            <div key={entry.user.id} className="flex items-center gap-3 rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-3">
              <span className="w-6 text-sm font-bold text-[#B8AFA4]">#{entry.rank}</span>
              <div className="h-10 w-10 overflow-hidden rounded-full border border-[#EDE8E0]">
                <img src={entry.user.photo} alt={entry.user.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{entry.user.name}</p>
                <p className="text-xs text-[#B8AFA4]">{entry.user.matches} matches</p>
              </div>
              <div className="flex items-center gap-1 text-sm font-bold text-[#3D3630]">
                <Zap className="h-3.5 w-3.5 text-[#FF8C42]" />
                {entry.user.points}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h2 className="mb-3 font-bold">Tus logros</h2>
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.label}
                className={`rounded-[24px] border p-4 ${
                  achievement.done
                    ? "border-[#FF5A5F]/20 bg-[#FF5A5F]/5"
                    : "border-[#EDE8E0] bg-white opacity-70"
                }`}
              >
                <div className="text-2xl">{achievement.icon}</div>
                <p className="mt-2 text-sm font-bold">{achievement.label}</p>
                <p className="mt-1 text-xs leading-5 text-[#B8AFA4]">{achievement.description}</p>
                {achievement.done ? (
                  <p className="mt-2 text-xs font-semibold text-[#FF5A5F]">Completado</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav active="ranking" onNavigate={onNavigate} />
    </div>
  );
}

function PodiumCard({
  entry,
  size
}: {
  entry: { rank: number; user: UserProfile };
  size: "small" | "large";
}) {
  const isLarge = size === "large";
  return (
    <div className={`flex flex-col items-center ${isLarge ? "-mb-2" : ""}`}>
      <div
        className={`overflow-hidden rounded-full border-4 ${
          isLarge ? "h-20 w-20 border-[#FF8C42]" : "h-16 w-16 border-[#B8AFA4]"
        }`}
      >
        <img src={entry.user.photo} alt={entry.user.name} className="h-full w-full object-cover" />
      </div>
      <div
        className={`mt-2 flex items-end justify-center rounded-t-[22px] ${
          isLarge
            ? "h-20 w-16 bg-gradient-to-b from-[#FF5A5F] to-[#FF8C42] text-white"
            : "h-14 w-14 bg-[#B8AFA4]/18 text-[#B8AFA4]"
        }`}
      >
        <span className={`pb-2 font-black ${isLarge ? "text-xl" : "text-lg"}`}>{entry.rank}</span>
      </div>
      <p className={`mt-2 ${isLarge ? "text-sm font-bold" : "text-xs font-semibold"}`}>{entry.user.name}</p>
      <p className="text-[10px] text-[#B8AFA4]">{entry.user.points} pts</p>
    </div>
  );
}

function ProfileScreen({
  currentUser,
  matches,
  onNavigate,
  onReset
}: {
  currentUser: UserProfile;
  matches: MatchItem[];
  onNavigate: (screen: Screen) => void;
  onReset: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"profile" | "settings">("profile");

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F3] text-[#1A1410]">
      <div className="relative overflow-hidden bg-[#111111] text-white">
        <div className="relative h-48">
          <img src={currentUser.coverPhoto} alt={currentUser.name} className="h-full w-full object-cover opacity-65" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#111111]/85" />
          <button className="absolute right-5 top-12 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur">
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="-mt-12 flex items-end gap-4">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-[28px] border-4 border-[#FAF7F3] shadow-xl">
                <img src={currentUser.photo} alt={currentUser.name} className="h-full w-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42]">
                <Camera className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-extrabold">{currentUser.name}</h2>
              <p className="text-sm text-white/60">
                {currentUser.age} · {currentUser.city}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Matches", value: matches.length, icon: Heart, color: "#FF5A5F" },
              { label: "Super Likes", value: currentUser.superLikes, icon: Star, color: "#FFB347" },
              { label: "Puntos", value: currentUser.points, icon: Zap, color: "#FF8C42" }
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-[22px] border border-white/12 bg-white/10 py-3 text-center backdrop-blur">
                <Icon className="mx-auto h-4 w-4" style={{ color }} />
                <p className="mt-2 text-lg font-black">{value}</p>
                <p className="text-[10px] text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex border-b border-[#EDE8E0] bg-white">
        {[
          { id: "profile", label: "Mi perfil" },
          { id: "settings", label: "Ajustes" }
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "profile" | "settings")}
              className={`relative flex-1 py-3.5 text-sm font-semibold ${
                active ? "text-[#FF5A5F]" : "text-[#B8AFA4]"
              }`}
            >
              {tab.label}
              {active ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF5A5F]" /> : null}
            </button>
          );
        })}
      </div>

      <div className="flex-1 px-5 py-5">
        {activeTab === "profile" ? (
          <div className="space-y-5">
            <ProfileCard title="Sobre mi">
              <p className="text-sm leading-6 text-[#7A7068]">{currentUser.bio}</p>
            </ProfileCard>
            <ProfileCard title="Mis intereses">
              <div className="flex flex-wrap gap-2">
                {currentUser.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full border border-[#FF5A5F]/20 bg-[#FF5A5F]/6 px-3 py-1 text-xs font-semibold text-[#FF5A5F]"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </ProfileCard>
            <ProfileCard title="Buscando esta noche">
              <div className="rounded-[18px] bg-[#FAF7F3] px-4 py-3 text-sm font-medium text-[#3D3630]">
                {currentUser.goal}
              </div>
            </ProfileCard>
            <ProfileCard title="Instagram">
              <div className="flex items-center gap-2 text-sm text-[#7A7068]">
                <Instagram className="h-4 w-4 text-[#E1306C]" />
                {currentUser.instagram}
              </div>
            </ProfileCard>
          </div>
        ) : (
          <div className="space-y-3">
            {[
              {
                icon: Shield,
                title: "Privacidad y seguridad",
                description: "Controla lo que muestras y a quien."
              },
              {
                icon: Settings,
                title: "Preferencias de descubrimiento",
                description: "Filtros y estilo de matching."
              },
              {
                icon: Instagram,
                title: "Redes conectadas",
                description: "Instagram listo para compartir desde el chat."
              }
            ].map(({ icon: Icon, title, description }) => (
              <button
                key={title}
                className="flex w-full items-center gap-4 rounded-[24px] border border-[#EDE8E0] bg-white px-4 py-4 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FAF7F3]">
                  <Icon className="h-4 w-4 text-[#7A7068]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-[#B8AFA4]">{description}</p>
                </div>
                <ChevronDown className="h-4 w-4 -rotate-90 text-[#B8AFA4]" />
              </button>
            ))}
            <button
              onClick={onReset}
              className="w-full rounded-[24px] border border-[#FF5A5F]/20 bg-[#FF5A5F]/6 px-4 py-4 text-left"
            >
              <p className="text-sm font-semibold text-[#FF5A5F]">Salir del evento</p>
              <p className="mt-1 text-xs text-[#B8AFA4]">Limpia la sesion y vuelve al QR.</p>
            </button>
          </div>
        )}
      </div>

      <BottomNav active="profile" onNavigate={onNavigate} />
    </div>
  );
}

function ProfileCard({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-[#EDE8E0] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">{title}</p>
        <button className="text-xs font-semibold text-[#FF5A5F]">Editar</button>
      </div>
      {children}
    </div>
  );
}

function BottomNav({
  active,
  onNavigate
}: {
  active: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  const tabs: { id: Screen; label: string; icon: string }[] = [
    { id: "home", label: "Discover", icon: "🔥" },
    { id: "matches", label: "Chats", icon: "💬" },
    { id: "map", label: "Mapa", icon: "🗺" },
    { id: "ranking", label: "Ranking", icon: "🏆" },
    { id: "profile", label: "Perfil", icon: "👤" }
  ];

  return (
    <div className="border-t border-[#EDE8E0] bg-white/95 backdrop-blur">
      <div className="flex items-center justify-around px-2 py-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className="flex min-w-[52px] flex-col items-center gap-1 py-1"
          >
            <span className="text-xl">{tab.icon}</span>
            <span
              className={`text-[10px] font-semibold ${
                active === tab.id ? "text-[#FF5A5F]" : "text-[#B8AFA4]"
              }`}
            >
              {tab.label}
            </span>
            {active === tab.id ? <span className="h-1 w-1 rounded-full bg-[#FF5A5F]" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
