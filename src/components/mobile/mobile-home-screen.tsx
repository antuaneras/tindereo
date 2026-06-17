"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { fetchMobileBootstrap, subscribeToMobileStream } from "@/lib/mobile-api";
import { formatMobileDateTime } from "@/lib/mobile-shared";
import { PostCard, StoryStrip } from "@/components/mobile/mobile-feed";
import type { MobileBootstrapPayload } from "@/lib/mobile-types";

export function MobileHomeScreen({ initialData }: { initialData: MobileBootstrapPayload }) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    const unsubscribe = subscribeToMobileStream((event) => {
      if (event.type === "feed" || event.type === "stories" || event.type === "bootstrap" || event.type === "notifications") {
        void fetchMobileBootstrap().then(setData).catch(() => undefined);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
          Inicio
        </div>
        <Link href="/buscar" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
          <Search className="h-5 w-5" />
        </Link>
      </div>

      <section className="space-y-3">
        {data.storyClusters.length ? (
          <StoryStrip clusters={data.storyClusters} />
        ) : (
          <div className="rounded-[2rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
            Aún no hay historias. Cuando tú o tus eventos empecéis a subir contenido, aparecerá aquí arriba.
          </div>
        )}
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
              Todavía no te has unido a ningún evento.
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        {data.feedPosts.length ? (
          data.feedPosts.map((post) => <PostCard key={post.id} post={post} />)
        ) : (
          <div className="rounded-[2rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-10 text-center text-sm text-[var(--text-soft)]">
            Todavía no hay publicaciones. Usa Crear para subir historias, fotos o lanzar un evento.
          </div>
        )}
      </section>
    </div>
  );
}
