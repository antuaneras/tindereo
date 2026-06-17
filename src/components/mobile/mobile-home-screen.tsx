"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, Camera, Search } from "lucide-react";
import { fetchMobileBootstrap, subscribeToMobileStream } from "@/lib/mobile-api";
import { formatMobileDateTime } from "@/lib/mobile-shared";
import { PostCard, StoryStrip } from "@/components/mobile/mobile-feed";
import type { MobileBootstrapPayload } from "@/lib/mobile-types";

const HOME_CACHE_KEY = "mobile-cache:home";

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
  const [gestureStart, setGestureStart] = useState<{ x: number; y: number; ignore: boolean } | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isGestureActive, setIsGestureActive] = useState(false);
  const createNavigationTimeoutRef = useRef<number | null>(null);

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
    if (data) {
      return;
    }

    void fetchMobileBootstrap().then(setData).catch(() => undefined);
  }, [data]);

  useEffect(() => {
    const unsubscribe = subscribeToMobileStream((event) => {
      if (
        event.type === "feed" ||
        event.type === "stories" ||
        event.type === "bootstrap" ||
        event.type === "notifications"
      ) {
        void fetchMobileBootstrap().then(setData).catch(() => undefined);
      }
    });
    return unsubscribe;
  }, []);

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

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex w-full items-center">
        <div className="ml-1 flex h-[78%] w-[78%] max-w-[320px] flex-col justify-between rounded-[2.4rem] bg-[linear-gradient(160deg,#ff8d43_0%,#ff6b57_56%,#2a1712_100%)] px-5 py-6 text-white shadow-[0_24px_56px_rgba(240,107,87,0.32)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-white/14 backdrop-blur">
            <Camera className="h-7 w-7" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
              {dragOffsetX > 92 ? "Suelta para abrir" : "Arrastra a la derecha"}
            </div>
            <div className="mt-3 text-2xl font-black tracking-[-0.05em]">
              Camara lista para historia o publicacion
            </div>
            <p className="mt-3 text-sm leading-6 text-white/78">
              Entras directo a la camara y abajo eliges el modo, como en una app nativa.
            </p>
          </div>
        </div>
      </div>

      <div
        className="relative space-y-5 will-change-transform"
        onTouchCancel={() => {
          setGestureStart(null);
          setIsGestureActive(false);
          setDragOffsetX(0);
        }}
        onTouchEnd={(event) => {
          if (!gestureStart || gestureStart.ignore) {
            setGestureStart(null);
            setIsGestureActive(false);
            setDragOffsetX(0);
            return;
          }

          const touch = event.changedTouches[0];
          if (!touch) {
            setGestureStart(null);
            setIsGestureActive(false);
            setDragOffsetX(0);
            return;
          }

          const deltaX = touch.clientX - gestureStart.x;
          const deltaY = touch.clientY - gestureStart.y;

          if (deltaX > 96 && Math.abs(deltaY) < 72) {
            setDragOffsetX(148);
            setIsGestureActive(false);
            createNavigationTimeoutRef.current = window.setTimeout(() => {
              router.push("/crear");
            }, 110);
          } else {
            setDragOffsetX(0);
            setIsGestureActive(false);
          }

          setGestureStart(null);
        }}
        onTouchMove={(event) => {
          if (!gestureStart || gestureStart.ignore) {
            return;
          }

          const touch = event.touches[0];
          if (!touch) {
            return;
          }

          const deltaX = touch.clientX - gestureStart.x;
          const deltaY = touch.clientY - gestureStart.y;

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
          setGestureStart({
            x: touch?.clientX ?? 0,
            y: touch?.clientY ?? 0,
            ignore
          });
          setIsGestureActive(!ignore);
        }}
        style={{
          transform: `translateX(${dragOffsetX}px)`,
          transition: isGestureActive ? "none" : "transform 180ms ease-out"
        }}
      >
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
            Inicio
          </div>
          <Link href="/buscar" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
            <Search className="h-5 w-5" />
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

        <section className="rounded-[2rem] border border-[var(--line-soft)] bg-white/88 px-5 py-5 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
            <CalendarDays className="h-4 w-4" />
            Tus eventos activos
          </div>
          <div className="mt-4 space-y-3">
            {data.joinedEvents.slice(0, 3).map((event) => (
              <Link
                key={event.id}
                href={`/evento/${event.slug}`}
                className="flex items-center gap-3 rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4"
              >
                <div className="flex-1">
                  <div className="text-base font-bold">{event.title}</div>
                  <div className="mt-1 text-sm text-[var(--text-soft)]">{formatMobileDateTime(event.startsAt)}</div>
                </div>
                <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--coral)]">
                  {event.experienceState === "live" ? "En vivo" : "Abrir"}
                </div>
              </Link>
            ))}
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
