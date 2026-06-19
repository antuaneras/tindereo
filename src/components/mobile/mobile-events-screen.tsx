"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { buildMobileCacheKey, readMobilePersistentCache, writeMobilePersistentCache } from "@/lib/mobile-client-cache";
import { fetchEvents } from "@/lib/mobile-api";
import { formatMobileDateTime } from "@/lib/mobile-shared";
import type { MobileEvent } from "@/lib/mobile-types";

function getEventsCacheKey(viewerId: string) {
  return buildMobileCacheKey(viewerId, "events");
}

function readEventsCache(viewerId: string) {
  return readMobilePersistentCache<MobileEvent[]>(getEventsCacheKey(viewerId));
}

function writeEventsCache(viewerId: string, events: MobileEvent[]) {
  writeMobilePersistentCache(getEventsCacheKey(viewerId), events);
}

export function MobileEventsScreen({
  initialEvents,
  viewerId
}: {
  initialEvents?: MobileEvent[] | null;
  viewerId: string;
}) {
  const [events, setEvents] = useState<MobileEvent[]>(() => initialEvents ?? readEventsCache(viewerId) ?? []);

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents);
      writeEventsCache(viewerId, initialEvents);
      return;
    }

    const cached = readEventsCache(viewerId);
    if (cached) {
      setEvents(cached);
    }
  }, [initialEvents, viewerId]);

  useEffect(() => {
    void fetchEvents().then(setEvents).catch(() => undefined);
  }, []);

  useEffect(() => {
    writeEventsCache(viewerId, events);
  }, [events, viewerId]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
          Eventos
        </div>
        <Link href="/crear" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
          <Plus className="h-5 w-5" />
        </Link>
      </div>

      <section className="space-y-3">
        {events.map((event) => (
          <Link key={event.id} href={`/evento/${event.slug}`} className="rounded-[2rem] border border-[var(--line-soft)] bg-white/92 p-4 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-black tracking-[-0.04em]">{event.title}</div>
                <div className="mt-1 text-sm text-[var(--text-soft)]">{event.summary}</div>
              </div>
              <span className="rounded-full bg-[var(--bg-soft)] px-3 py-2 text-xs font-semibold text-[var(--coral)]">
                {event.experienceState === "live" ? "En vivo" : event.visibility === "private" ? "Privado" : "Público"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-soft)]">
              <span>{event.city}</span>
              <span>·</span>
              <span>{formatMobileDateTime(event.startsAt)}</span>
              <span>·</span>
              <span>{event.approvedCount}/{event.capacity}</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
