"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { fetchMobileBootstrap, subscribeToMobileStream } from "@/lib/mobile-api";
import { formatMobileDateTime } from "@/lib/mobile-shared";
import { PostCard, StoryStrip } from "@/components/mobile/mobile-feed";
import type { MobileBootstrapPayload } from "@/lib/mobile-types";

export function MobileHomeScreen({ initialData }: { initialData: MobileBootstrapPayload }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [gestureStart, setGestureStart] = useState<{ x: number; y: number; ignore: boolean } | null>(null);

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

  return (
    <div
      className="space-y-5"
      onTouchEnd={(event) => {
        if (!gestureStart || gestureStart.ignore) {
          setGestureStart(null);
          return;
        }

        const touch = event.changedTouches[0];
        if (!touch) {
          setGestureStart(null);
          return;
        }

        const deltaX = touch.clientX - gestureStart.x;
        const deltaY = touch.clientY - gestureStart.y;

        if (deltaX < -90 && Math.abs(deltaY) < 72) {
          router.push("/crear");
        }

        setGestureStart(null);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        const target = event.target as HTMLElement | null;
        setGestureStart({
          x: touch?.clientX ?? 0,
          y: touch?.clientY ?? 0,
          ignore: Boolean(target?.closest("[data-story-strip='true'],a,button,input,textarea,select"))
        });
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
            Tu burbuja ya esta lista. Tocala o desliza a la izquierda para subir una historia o una publicacion.
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
  );
}
