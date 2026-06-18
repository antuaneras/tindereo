"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Camera, Heart, RefreshCw } from "lucide-react";
import { fetchMobileBootstrap, respondToEventInvite, subscribeToMobileStream } from "@/lib/mobile-api";
import { formatMobileDateTime } from "@/lib/mobile-shared";
import { PostCard, StoryStrip } from "@/components/mobile/mobile-feed";
import type { MobileBootstrapPayload, MobileEventInvite } from "@/lib/mobile-types";

const HOME_CACHE_KEY = "mobile-cache:home";
const HOME_PULL_REFRESH_TRIGGER = 88;

function getScrollTop() {
  if (typeof window === "undefined") {
    return 0;
  }

  const scrollingElement = document.scrollingElement ?? document.documentElement;
  return Math.max(window.scrollY, scrollingElement?.scrollTop ?? 0);
}

function clampPullDistance(distance: number) {
  return Math.max(0, Math.min(112, distance * 0.42));
}

function readHomeCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(HOME_CACHE_KEY);
    return raw ? (JSON.parse(raw) as MobileBootstrapPayload) : null;
  } catch {
    return null;
  }
}

function writeHomeCache(data: MobileBootstrapPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(HOME_CACHE_KEY, JSON.stringify(data));
}

export function MobileHomeScreen({ initialData }: { initialData?: MobileBootstrapPayload | null }) {
  const router = useRouter();
  const [data, setData] = useState<MobileBootstrapPayload | null>(() => initialData ?? null);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [joinedEventIndex, setJoinedEventIndex] = useState(0);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [pullOffsetY, setPullOffsetY] = useState(0);
  const [isGestureActive, setIsGestureActive] = useState(false);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
  const createNavigationTimeoutRef = useRef<number | null>(null);
  const gestureSessionRef = useRef<{ x: number; y: number; ignore: boolean; mode: "pending" | "horizontal" | "vertical" } | null>(null);
  const refreshRequestRef = useRef<Promise<MobileBootstrapPayload> | null>(null);
  const dataRef = useRef<MobileBootstrapPayload | null>(initialData ?? null);

  useEffect(() => {
    return () => {
      if (createNavigationTimeoutRef.current !== null) {
        window.clearTimeout(createNavigationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialData) {
      writeHomeCache(initialData);
      return;
    }

    const cached = readHomeCache();
    if (cached) {
      setData(cached);
    }
  }, [initialData]);

  useEffect(() => {
    if (data) {
      writeHomeCache(data);
    }
  }, [data]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const total = data?.joinedEvents.length ?? 0;
    setJoinedEventIndex((current) => Math.min(current, Math.max(0, total - 1)));
  }, [data?.joinedEvents.length]);

  useEffect(() => {
    if (data) {
      return;
    }

    void refreshHome().catch(() => undefined);
  }, [data]);

  useEffect(() => {
    const unsubscribe = subscribeToMobileStream((event) => {
      if (
        event.type === "feed" ||
        event.type === "stories" ||
        event.type === "bootstrap" ||
        event.type === "notifications"
      ) {
        void refreshHome().catch(() => undefined);
      }
    });
    return unsubscribe;
  }, []);

  async function refreshHome() {
    if (refreshRequestRef.current) {
      return refreshRequestRef.current;
    }

    const request = fetchMobileBootstrap()
      .then((nextData) => {
        setData(nextData);
        return nextData;
      })
      .finally(() => {
        refreshRequestRef.current = null;
      });

    refreshRequestRef.current = request;
    return request;
  }

  async function handlePullRefresh() {
    if (isRefreshingFeed) {
      return;
    }

    setIsRefreshingFeed(true);
    setPullOffsetY(68);

    try {
      await refreshHome();
    } finally {
      setIsRefreshingFeed(false);
      setPullOffsetY(0);
    }
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-12 w-24 rounded-full bg-white/80 shadow-sm" />
          <div className="h-12 w-12 rounded-2xl bg-white/80 shadow-sm" />
        </div>
        <div className="h-28 rounded-[2rem] border border-dashed border-[var(--line-warm)] bg-white/75" />
        <div className="h-36 rounded-[2rem] bg-white/80 shadow-sm" />
        <div className="h-[420px] rounded-[2rem] bg-white/80 shadow-sm" />
      </div>
    );
  }

  async function handleInviteResponse(invite: MobileEventInvite, accept: boolean) {
    setInviteActionId(invite.id);
    try {
      await respondToEventInvite(invite.id, accept);
      const nextData = await fetchMobileBootstrap();
      setData(nextData);
      if (accept) {
        router.push(`/evento/${invite.eventSlug}`);
      }
    } finally {
      setInviteActionId(null);
    }
  }

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
        style={{
          opacity: pullOffsetY > 0 || isRefreshingFeed ? 1 : 0,
          transform: `translateY(${Math.max(10, pullOffsetY * 0.45)}px)`
        }}
      >
        <div className="flex items-center gap-2 rounded-full bg-white/94 px-4 py-2 text-xs font-semibold text-[var(--text-soft)] shadow-[0_14px_32px_rgba(29,22,15,0.12)] backdrop-blur">
          <RefreshCw className={isRefreshingFeed ? "h-4 w-4 animate-spin text-[var(--coral)]" : "h-4 w-4 text-[var(--coral)]"} />
          <span>
            {isRefreshingFeed
              ? "Buscando publicaciones nuevas..."
              : pullOffsetY >= HOME_PULL_REFRESH_TRIGGER
                ? "Suelta para actualizar"
                : "Desliza hacia abajo para actualizar"}
          </span>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: Math.min(1, dragOffsetX / 132) }}
      >
        <div className="absolute inset-0 bg-[#090706]" />
        <div className="absolute inset-y-0 left-0 flex w-full items-center px-6">
          <div
            className="max-w-[220px] text-white"
            style={{
              transform: `translateX(${Math.max(-18, -26 + dragOffsetX * 0.12)}px)`,
              opacity: Math.min(1, dragOffsetX / 112)
            }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-white/10 backdrop-blur">
              <Camera className="h-7 w-7" />
            </div>
            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-white/58">
              {dragOffsetX > 92 ? "Suelta para abrir" : "Arrastra a la derecha"}
            </div>
            <div className="mt-3 text-[1.75rem] font-black leading-8 tracking-[-0.05em]">
              Camara lista
            </div>
            <p className="mt-3 text-sm leading-6 text-white/72">
              Se abre directa para historia o publicacion, como una pantalla nueva.
            </p>
          </div>
        </div>
      </div>

      <div
        className="relative space-y-5 overflow-hidden bg-[var(--bg-main)] will-change-transform"
        onTouchCancel={() => {
          gestureSessionRef.current = null;
          setIsGestureActive(false);
          setDragOffsetX(0);
          if (!isRefreshingFeed) {
            setPullOffsetY(0);
          }
        }}
        onTouchEnd={(event) => {
          const gestureSession = gestureSessionRef.current;

          if (!gestureSession || gestureSession.ignore) {
            gestureSessionRef.current = null;
            setIsGestureActive(false);
            setDragOffsetX(0);
            if (!isRefreshingFeed) {
              setPullOffsetY(0);
            }
            return;
          }

          const touch = event.changedTouches[0];
          if (!touch) {
            gestureSessionRef.current = null;
            setIsGestureActive(false);
            setDragOffsetX(0);
            if (!isRefreshingFeed) {
              setPullOffsetY(0);
            }
            return;
          }

          const deltaX = touch.clientX - gestureSession.x;
          const deltaY = touch.clientY - gestureSession.y;

          if (gestureSession.mode === "vertical") {
            setDragOffsetX(0);
            setIsGestureActive(false);
            if (pullOffsetY >= HOME_PULL_REFRESH_TRIGGER) {
              void handlePullRefresh();
            } else {
              setPullOffsetY(0);
            }
            gestureSessionRef.current = null;
            return;
          }

          if (deltaX > 96 && Math.abs(deltaY) < 72) {
            setDragOffsetX(148);
            setPullOffsetY(0);
            setIsGestureActive(false);
            createNavigationTimeoutRef.current = window.setTimeout(() => {
              router.push("/crear");
            }, 110);
          } else {
            setDragOffsetX(0);
            setPullOffsetY(0);
            setIsGestureActive(false);
          }

          gestureSessionRef.current = null;
        }}
        onTouchMove={(event) => {
          const gestureSession = gestureSessionRef.current;
          if (!gestureSession || gestureSession.ignore) {
            return;
          }

          const touch = event.touches[0];
          if (!touch) {
            return;
          }

          const deltaX = touch.clientX - gestureSession.x;
          const deltaY = touch.clientY - gestureSession.y;
          const atTop = getScrollTop() <= 0;

          if (gestureSession.mode === "pending") {
            if (deltaY > 10 && Math.abs(deltaY) > Math.abs(deltaX) && atTop) {
              gestureSession.mode = "vertical";
            } else if (deltaX > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
              gestureSession.mode = "horizontal";
            } else if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX) && !atTop) {
              gestureSession.ignore = true;
              setIsGestureActive(false);
              return;
            } else {
              return;
            }
          }

          if (gestureSession.mode === "vertical") {
            if (!atTop || deltaY <= 0) {
              setPullOffsetY(0);
              return;
            }

            event.preventDefault();
            setDragOffsetX(0);
            setPullOffsetY(clampPullDistance(deltaY));
            return;
          }

          if (Math.abs(deltaY) > 72) {
            setDragOffsetX(0);
            return;
          }

          setDragOffsetX(Math.max(0, Math.min(148, deltaX)));
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          const target = event.target as HTMLElement | null;
          const ignore = Boolean(target?.closest("[data-story-strip='true'],a,button,input,textarea,select"));
          gestureSessionRef.current = {
            x: touch?.clientX ?? 0,
            y: touch?.clientY ?? 0,
            ignore,
            mode: "pending"
          };
          setIsGestureActive(!ignore);
        }}
        style={{
          transform:
            dragOffsetX > 0 || pullOffsetY > 0
              ? `translate3d(${dragOffsetX}px, ${pullOffsetY}px, 0)`
              : undefined,
          transition: isGestureActive ? "none" : "transform 180ms ease-out, border-radius 180ms ease-out, box-shadow 180ms ease-out",
          borderRadius: dragOffsetX > 0 || pullOffsetY > 0 ? "2rem" : "0rem",
          boxShadow:
            dragOffsetX > 0 || pullOffsetY > 0
              ? "0 22px 60px rgba(0,0,0,0.18)"
              : "0 0 0 rgba(0,0,0,0)"
        }}
      >
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
            Inicio
          </div>
          <Link href="/notificaciones" className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
            <Heart className="h-5 w-5" />
            {data.viewer.unreadNotificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[10px] font-semibold text-white">
                {data.viewer.unreadNotificationCount}
              </span>
            ) : null}
          </Link>
        </div>

        <section className="space-y-3">
          <div data-story-strip="true">
            <StoryStrip clusters={data.storyClusters} viewer={data.viewer.profile} />
          </div>
          {!data.storyClusters.length ? (
            <div className="rounded-[2rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-6 text-center text-sm text-[var(--text-soft)]">
              Tu burbuja ya esta lista. Tocala o desliza a la derecha para abrir la camara al instante.
            </div>
          ) : null}
        </section>

        {data.pendingEventInvites.length ? (
          <section className="rounded-[2rem] border border-[rgba(255,107,87,0.16)] bg-white/92 px-5 py-5 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                  Invitaciones directas
                </div>
                <div className="mt-2 text-2xl font-black tracking-[-0.04em]">
                  {data.pendingEventInvites.length} pendiente{data.pendingEventInvites.length === 1 ? "" : "s"}
                </div>
              </div>
              <span className="rounded-full bg-[rgba(255,107,87,0.1)] px-3 py-2 text-xs font-semibold text-[var(--coral)]">
                Un toque
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {data.pendingEventInvites.map((invite) => {
                const isBusy = inviteActionId === invite.id;
                return (
                  <div
                    key={invite.id}
                    className="rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                          Invitacion directa
                        </div>
                        <div className="mt-2 text-xl font-black tracking-[-0.04em]">{invite.eventTitle}</div>
                        <div className="mt-1 text-sm text-[var(--text-soft)]">
                          @{invite.fromProfile.handle} te ha invitado personalmente a este evento.
                        </div>
                        <div className="mt-2 text-xs text-[var(--text-soft)]">
                          {formatMobileDateTime(invite.createdAt)} · {invite.eventCity}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/evento/${invite.eventSlug}`)}
                        className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold"
                      >
                        Ver evento
                      </button>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleInviteResponse(invite, true)}
                        className="rounded-full bg-[var(--text-main)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {isBusy ? "Entrando..." : "Aceptar en un toque"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleInviteResponse(invite, false)}
                        className="rounded-full border border-[var(--line-warm)] px-4 py-3 text-sm font-semibold disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-[var(--line-soft)] bg-white/88 px-5 py-5 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
            <CalendarDays className="h-4 w-4" />
            Tus eventos activos
          </div>
          <div className="mt-4">
            {data.joinedEvents.length ? (
              <div
                className="scrollbar-hide -mx-1 flex snap-x snap-mandatory overflow-x-auto px-1 pb-1"
                onScroll={(event) => {
                  const node = event.currentTarget;
                  const width = node.clientWidth || 1;
                  setJoinedEventIndex(
                    Math.max(0, Math.min(data.joinedEvents.length - 1, Math.round(node.scrollLeft / width)))
                  );
                }}
              >
                {data.joinedEvents.map((event) => (
                  <div key={event.id} className="w-full min-w-full shrink-0 snap-center px-1">
                    <Link
                      href={`/evento/${event.slug}`}
                      className="block rounded-[1.8rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-bold">{event.title}</div>
                          <div className="mt-1 text-sm text-[var(--text-soft)]">{event.city}</div>
                          <div className="mt-3 text-sm text-[var(--text-soft)]">{formatMobileDateTime(event.startsAt)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--coral)]">
                            {event.experienceState === "live" ? "En vivo" : "Abrir"}
                          </div>
                          {event.visibility === "private" ? (
                            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                              Privado
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
            {data.joinedEvents.length > 1 ? (
              <div className="mt-3 flex items-center justify-center gap-2">
                {data.joinedEvents.map((event, index) => (
                  <span
                    key={event.id}
                    className={
                      index === joinedEventIndex
                        ? "h-2 w-2 rounded-full bg-[var(--coral)]"
                        : "h-2 w-2 rounded-full bg-[var(--line-warm)]"
                    }
                  />
                ))}
              </div>
            ) : null}
            {!data.joinedEvents.length ? (
              <div className="rounded-[1.6rem] border border-dashed border-[var(--line-warm)] px-4 py-6 text-sm text-[var(--text-soft)]">
                Todavia no te has unido a ningun evento.
              </div>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          {data.feedPosts.length ? (
            data.feedPosts.map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <div className="rounded-[2rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-10 text-center text-sm text-[var(--text-soft)]">
              Todavia no hay publicaciones. Usa Crear para subir historias, fotos o lanzar un evento.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
