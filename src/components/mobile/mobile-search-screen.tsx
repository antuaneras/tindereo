"use client";

import { type FormEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, X } from "lucide-react";
import { searchMobile } from "@/lib/mobile-api";
import type {
  MobileEvent,
  MobilePost,
  MobileProfile,
  MobileSearchFilters,
  MobileSearchPayload,
  MobileSuggestedProfile
} from "@/lib/mobile-types";

const SEARCH_HISTORY_KEY = "mobile-search-history:v1";
const EMPTY_RESULTS: MobileSearchPayload = {
  profiles: [],
  events: [],
  suggestedProfiles: [],
  suggestedPosts: [],
  facets: {
    cities: [],
    categories: []
  }
};

const DEFAULT_FILTERS: MobileSearchFilters = {
  city: "",
  when: "all",
  visibility: "all",
  category: ""
};

type SearchHistoryEntry = {
  id: string;
  kind: "profile" | "event" | "query";
  label: string;
  subtitle: string;
  href: string | null;
  avatarUrl: string | null;
  query: string;
};

function readHistory() {
  if (typeof window === "undefined") {
    return [] as SearchHistoryEntry[];
  }

  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) {
      return [] as SearchHistoryEntry[];
    }

    const parsed = JSON.parse(raw) as SearchHistoryEntry[] | null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as SearchHistoryEntry[];
  }
}

function writeHistory(entries: SearchHistoryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries.slice(0, 12)));
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function profileHistoryEntry(profile: MobileProfile | MobileSuggestedProfile): SearchHistoryEntry {
  return {
    id: `profile:${profile.id}`,
    kind: "profile",
    label: `@${profile.handle}`,
    subtitle: profile.city || profile.displayName,
    href: `/perfil/${profile.handle}`,
    avatarUrl: profile.avatarUrl,
    query: profile.handle
  };
}

function eventHistoryEntry(event: MobileEvent): SearchHistoryEntry {
  return {
    id: `event:${event.id}`,
    kind: "event",
    label: event.title,
    subtitle: `${event.city} · ${event.summary}`.trim(),
    href: `/evento/${event.slug}`,
    avatarUrl: event.coverImage,
    query: event.title
  };
}

function queryHistoryEntry(value: string): SearchHistoryEntry {
  return {
    id: `query:${value.trim().toLowerCase()}`,
    kind: "query",
    label: value.trim(),
    subtitle: "Busqueda reciente",
    href: null,
    avatarUrl: null,
    query: value.trim()
  };
}

function Avatar({
  avatarUrl,
  fallback,
  small
}: {
  avatarUrl: string | null;
  fallback: string;
  small?: boolean;
}) {
  const sizeClassName = small ? "h-8 w-8 text-[10px]" : "h-12 w-12 text-sm";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={fallback}
        className={cn(sizeClassName, "rounded-full object-cover")}
      />
    );
  }

  return (
    <span
      className={cn(
        sizeClassName,
        "flex items-center justify-center rounded-full bg-[var(--bg-soft)] font-semibold text-[var(--text-main)]"
      )}
    >
      {fallback.slice(0, 2).toUpperCase()}
    </span>
  );
}

function FilterChip({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-xs font-semibold transition",
        active
          ? "border-[rgba(255,107,87,0.26)] bg-[rgba(255,107,87,0.1)] text-[var(--coral)]"
          : "border-[var(--line-soft)] bg-white/88 text-[var(--text-soft)]"
      )}
    >
      {label}
    </button>
  );
}

function SuggestedProfileCard({
  profile,
  onOpen
}: {
  profile: MobileSuggestedProfile;
  onOpen: (profile: MobileSuggestedProfile) => void;
}) {
  const mutualLabel =
    profile.mutualFriendCount > 1
      ? `${profile.mutualFriendCount} amigos en comun`
      : profile.mutualFriendCount === 1
        ? "1 amigo en comun"
        : profile.city || "Nuevo por descubrir";

  return (
    <button
      type="button"
      onClick={() => onOpen(profile)}
      className="flex w-full items-center gap-3 rounded-[1.7rem] border border-[var(--line-soft)] bg-white/92 px-4 py-4 text-left shadow-[0_14px_32px_rgba(29,22,15,0.06)]"
    >
      <Avatar avatarUrl={profile.avatarUrl} fallback={profile.handle} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">@{profile.handle}</div>
        <div className="truncate text-xs text-[var(--text-soft)]">
          {profile.displayName || profile.city}
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-soft)]">
          {profile.mutualFriends.length ? (
            <span className="flex -space-x-2">
              {profile.mutualFriends.map((friend) => (
                <span key={friend.id} className="rounded-full ring-2 ring-white">
                  <Avatar avatarUrl={friend.avatarUrl} fallback={friend.handle} small />
                </span>
              ))}
            </span>
          ) : null}
          <span className="truncate">{mutualLabel}</span>
        </div>
      </div>
      <span className="rounded-full bg-[var(--bg-soft)] px-3 py-2 text-xs font-semibold text-[var(--coral)]">
        Ver
      </span>
    </button>
  );
}

function RecentSearchItem({
  entry,
  onOpen,
  onRemove
}: {
  entry: SearchHistoryEntry;
  onOpen: (entry: SearchHistoryEntry) => void;
  onRemove: (entryId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1.6rem] bg-white/90 px-3 py-3 shadow-sm">
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {entry.kind === "query" ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[var(--text-soft)]">
            <Search className="h-5 w-5" />
          </span>
        ) : (
          <Avatar avatarUrl={entry.avatarUrl} fallback={entry.label} />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{entry.label}</div>
          <div className="truncate text-xs text-[var(--text-soft)]">{entry.subtitle}</div>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onRemove(entry.id)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-soft)]"
        aria-label="Eliminar busqueda"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SearchResultEmpty({ query }: { query: string }) {
  return (
    <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
      No hay resultados aun para "{query}".
    </div>
  );
}

export function MobileSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<MobileSearchFilters>(DEFAULT_FILTERS);
  const deferredQuery = useDeferredValue(query.trim());
  const [results, setResults] = useState<MobileSearchPayload>(EMPTY_RESULTS);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const isSearching = deferredQuery.length > 0;

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const payload = await searchMobile(deferredQuery, filters);
        if (!cancelled) {
          setResults(payload);
        }
      } catch {
        if (!cancelled) {
          setResults(EMPTY_RESULTS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, deferredQuery ? 180 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredQuery, filters]);

  const suggestedGridPosts = useMemo(
    () => results.suggestedPosts.filter((post) => post.mediaItems[0]?.previewUrl).slice(0, 18),
    [results.suggestedPosts]
  );

  const pushHistory = (entry: SearchHistoryEntry) => {
    setHistory((current) => {
      const nextEntries = [
        entry,
        ...current.filter(
          (item) =>
            item.id !== entry.id &&
            (!entry.href || item.href !== entry.href) &&
            item.query.toLowerCase() !== entry.query.toLowerCase()
        )
      ].slice(0, 12);

      writeHistory(nextEntries);
      return nextEntries;
    });
  };

  const removeHistory = (entryId: string) => {
    setHistory((current) => {
      const nextEntries = current.filter((entry) => entry.id !== entryId);
      writeHistory(nextEntries);
      return nextEntries;
    });
  };

  const clearHistory = () => {
    writeHistory([]);
    setHistory([]);
  };

  const openHistoryEntry = (entry: SearchHistoryEntry) => {
    pushHistory(entry);
    if (entry.href) {
      router.push(entry.href);
      return;
    }

    setQuery(entry.query);
  };

  const openProfile = (profile: MobileProfile | MobileSuggestedProfile) => {
    const entry = profileHistoryEntry(profile);
    pushHistory(entry);
    router.push(entry.href ?? "/perfil");
  };

  const openEvent = (event: MobileEvent) => {
    const entry = eventHistoryEntry(event);
    pushHistory(entry);
    router.push(entry.href ?? "/eventos");
  };

  const openSuggestedPost = (post: MobilePost) => {
    pushHistory({
      id: `profile:${post.authorId}`,
      kind: "profile",
      label: `@${post.authorHandle}`,
      subtitle: post.authorDisplayName || post.ownerLabel,
      href: `/perfil/${post.authorHandle}`,
      avatarUrl: post.authorAvatarUrl,
      query: post.authorHandle
    });
    router.push(`/perfil/${post.authorHandle}`);
  };

  const submitQuery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }

    pushHistory(queryHistoryEntry(query));
    setQuery(query.trim());
  };

  const hasActiveFilters =
    Boolean(filters.city) ||
    Boolean(filters.category) ||
    filters.when !== "all" ||
    filters.visibility !== "all";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
          Buscar
        </div>
      </div>

      <form onSubmit={submitQuery}>
        <label className="flex items-center gap-3 rounded-[1.8rem] border border-[var(--line-soft)] bg-white/88 px-4 py-4 shadow-sm">
          <Search className="h-5 w-5 text-[var(--text-soft)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca gente, eventos o ciudad"
            className="w-full border-0 bg-transparent text-base outline-none placeholder:text-[var(--text-soft)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[var(--text-soft)]"
              aria-label="Limpiar busqueda"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
      </form>

      <section className="space-y-3">
        <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1">
          <FilterChip
            active={filters.when === "live"}
            label="En vivo"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                when: current.when === "live" ? "all" : "live"
              }))
            }
          />
          <FilterChip
            active={filters.when === "week"}
            label="Esta semana"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                when: current.when === "week" ? "all" : "week"
              }))
            }
          />
          <FilterChip
            active={filters.when === "month"}
            label="Este mes"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                when: current.when === "month" ? "all" : "month"
              }))
            }
          />
          <FilterChip
            active={filters.visibility === "public"}
            label="Publicos"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                visibility: current.visibility === "public" ? "all" : "public"
              }))
            }
          />
          <FilterChip
            active={filters.visibility === "private"}
            label="Privados"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                visibility: current.visibility === "private" ? "all" : "private"
              }))
            }
          />
        </div>

        {results.facets.cities.length ? (
          <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1">
            {results.facets.cities.slice(0, 8).map((city) => (
              <FilterChip
                key={city}
                active={filters.city === city}
                label={city}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    city: current.city === city ? "" : city
                  }))
                }
              />
            ))}
          </div>
        ) : null}

        {results.facets.categories.length ? (
          <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1">
            {results.facets.categories.slice(0, 8).map((category) => (
              <FilterChip
                key={category}
                active={filters.category.toLowerCase() === category.toLowerCase()}
                label={category}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    category: current.category.toLowerCase() === category.toLowerCase() ? "" : category
                  }))
                }
              />
            ))}
          </div>
        ) : null}

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-xs font-semibold text-[var(--coral)]"
          >
            Limpiar filtros
          </button>
        ) : null}
      </section>

      {loading ? (
        <div className="rounded-[1.7rem] bg-white/70 px-4 py-3 text-sm text-[var(--text-soft)]">
          {isSearching ? "Buscando..." : "Cargando sugerencias..."}
        </div>
      ) : null}

      {!isSearching ? (
        <>
          {history.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Recientes</div>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs font-semibold text-[var(--coral)]"
                >
                  Borrar todo
                </button>
              </div>
              <div className="space-y-2">
                {history.map((entry) => (
                  <RecentSearchItem
                    key={entry.id}
                    entry={entry}
                    onOpen={openHistoryEntry}
                    onRemove={removeHistory}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-[var(--coral)]" />
              Sugerencias para ti
            </div>
            <div className="space-y-3">
              {results.suggestedProfiles.map((profile) => (
                <SuggestedProfileCard
                  key={profile.id}
                  profile={profile}
                  onOpen={openProfile}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold">Fotos que te pueden gustar</div>
            {suggestedGridPosts.length ? (
              <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-[1.8rem]">
                {suggestedGridPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => openSuggestedPost(post)}
                    className="group relative aspect-[3/4] overflow-hidden bg-[var(--bg-soft)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.mediaItems[0]?.previewUrl ?? ""}
                      alt={post.caption || post.authorHandle}
                      className="h-full w-full object-cover transition duration-300 group-active:scale-[0.98]"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent px-2 pb-2 pt-8 text-left text-[10px] font-semibold text-white">
                      @{post.authorHandle}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
                Cuando haya mas fotos reales en la comunidad, apareceran aqui.
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="space-y-3">
          {results.profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => openProfile(profile)}
              className="flex w-full items-center gap-3 rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 text-left"
            >
              <Avatar avatarUrl={profile.avatarUrl} fallback={profile.handle} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">@{profile.handle}</div>
                <div className="truncate text-xs text-[var(--text-soft)]">
                  {profile.displayName || profile.city}
                </div>
              </div>
            </button>
          ))}

          {results.events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => openEvent(event)}
              className="w-full rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 text-left"
            >
              <div className="text-sm font-semibold">{event.title}</div>
              <div className="mt-1 text-xs text-[var(--text-soft)]">
                {event.city} · {event.summary}
              </div>
            </button>
          ))}

          {!results.profiles.length && !results.events.length && !loading ? (
            <SearchResultEmpty query={deferredQuery} />
          ) : null}
        </section>
      )}
    </div>
  );
}
