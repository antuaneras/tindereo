"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { searchMobile } from "@/lib/mobile-api";
import type { MobileSearchPayload } from "@/lib/mobile-types";

export function MobileSearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MobileSearchPayload>({ profiles: [], events: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ profiles: [], events: [] });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const nextResults = await searchMobile(query);
        if (!controller.signal.aborted) {
          setResults(nextResults);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
          Buscar
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-[1.8rem] border border-[var(--line-soft)] bg-white/88 px-4 py-4 shadow-sm">
        <Search className="h-5 w-5 text-[var(--text-soft)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Busca gente, eventos o ciudad"
          className="w-full border-0 bg-transparent text-base outline-none placeholder:text-[var(--text-soft)]"
        />
      </label>

      {loading ? <div className="text-sm text-[var(--text-soft)]">Buscando...</div> : null}

      <section className="space-y-3">
        {results.profiles.map((profile) => (
          <Link key={profile.id} href={`/perfil/${profile.handle}`} className="flex items-center gap-3 rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={`@${profile.handle}`} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-soft)] text-sm font-semibold">{profile.handle.slice(0, 2).toUpperCase()}</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">@{profile.handle}</div>
              <div className="truncate text-xs text-[var(--text-soft)]">{profile.city}</div>
            </div>
          </Link>
        ))}

        {results.events.map((event) => (
          <Link key={event.id} href={`/evento/${event.slug}`} className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
            <div className="text-sm font-semibold">{event.title}</div>
            <div className="mt-1 text-xs text-[var(--text-soft)]">{event.city} · {event.summary}</div>
          </Link>
        ))}

        {!results.profiles.length && !results.events.length && query.trim() ? (
          <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
            No hay resultados aún para “{query}”.
          </div>
        ) : null}
      </section>
    </div>
  );
}
