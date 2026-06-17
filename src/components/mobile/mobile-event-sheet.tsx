"use client";

import { useMemo, useState } from "react";
import { Link2, MapPin, QrCode, Shield, Users, X } from "lucide-react";
import { addEventCohost, fetchCheckInToken, joinEvent, moderateEventMember, setArrivalStatus, setEventChatMode } from "@/lib/mobile-api";
import { StoryStrip, PostCard } from "@/components/mobile/mobile-feed";
import { formatMobileDateTime, getArrivalStatusLabel, getMapLink } from "@/lib/mobile-shared";
import type { MobileConversationDetail, MobileEventDetail, MobileProfile } from "@/lib/mobile-types";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Avatar({ profile }: { profile: MobileProfile }) {
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatarUrl} alt={`@${profile.handle}`} className="h-11 w-11 rounded-full object-cover" />
    );
  }

  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-main)]">
      {profile.handle.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function EventInfoSheet({
  conversation,
  eventDetail,
  onClose,
  onRefresh
}: {
  conversation: MobileConversationDetail;
  eventDetail: MobileEventDetail | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"live" | "info" | "people" | "stories" | "faq">("live");
  const [qr, setQr] = useState<{ expiresAt: string; qrImageUrl: string; token: string; url: string } | null>(null);
  const canManage = Boolean(
    eventDetail &&
      (eventDetail.event.hostId === conversation.viewerId ||
        eventDetail.cohosts.some((cohost) => cohost.id === conversation.viewerId))
  );
  const myMembership = eventDetail?.myMembership ?? null;
  const isInside = myMembership?.arrivalStatus === "inside";
  const storyClusters = useMemo(
    () =>
      eventDetail?.stories.length
        ? [
            {
              ownerId: eventDetail.event.id,
              ownerType: "event" as const,
              ownerLabel: eventDetail.event.title,
              ownerAvatarUrl: eventDetail.event.coverImage,
              unseenCount: eventDetail.stories.filter((story) => !story.hasSeen).length,
              stories: eventDetail.stories
            }
          ]
        : [],
    [eventDetail]
  );

  if (!eventDetail) {
    return null;
  }

  const mapLink = getMapLink(
    eventDetail.event.meetingPointAddress,
    eventDetail.event.meetingPointLat,
    eventDetail.event.meetingPointLng
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div
        className="absolute bottom-0 left-1/2 flex h-[88dvh] w-full max-w-[480px] -translate-x-1/2 flex-col rounded-t-[2rem] bg-[var(--bg-main)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pb-4 pt-4">
          <div>
            <div className="text-lg font-black tracking-[-0.03em]">{eventDetail.event.title}</div>
            <div className="text-sm text-[var(--text-soft)]">{eventDetail.event.city}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-2">
          {[
            ["live", "En vivo"],
            ["info", "Info"],
            ["people", "Miembros"],
            ["stories", "Historias"],
            ["faq", "FAQ"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as typeof tab)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold",
                tab === value ? "bg-[var(--text-main)] text-white" : "bg-white text-[var(--text-soft)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {tab === "live" ? (
            <div className="space-y-4">
              <section className="grid grid-cols-3 gap-3">
                {[
                  ["Dentro", `${eventDetail.event.insideCount}`],
                  ["Confirmados", `${eventDetail.event.approvedCount}`],
                  ["Cola", `${eventDetail.event.waitlistCount}`]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1.6rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-soft)]">{label}</div>
                    <div className="mt-3 text-2xl font-black tracking-[-0.04em]">{value}</div>
                  </div>
                ))}
              </section>
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Estado de llegada</div>
                <div className="mt-3 text-sm text-[var(--text-soft)]">{getArrivalStatusLabel(myMembership?.arrivalStatus ?? "none")}</div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ["going", "Voy saliendo"],
                    ["eta20", "Llego en 20"],
                    ["inside", "Ya estoy dentro"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={async () => {
                        await setArrivalStatus(eventDetail.event.slug, value);
                        await onRefresh();
                      }}
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-xs font-semibold",
                        myMembership?.arrivalStatus === value
                          ? "border-[rgba(255,107,87,0.26)] bg-[rgba(255,107,87,0.08)] text-[var(--coral)]"
                          : "border-[var(--line-warm)] bg-[var(--bg-soft)] text-[var(--text-main)]"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Punto de encuentro</div>
                    <div className="mt-2 text-base font-bold">{eventDetail.event.meetingPointLabel || eventDetail.event.venue}</div>
                    <div className="mt-1 text-sm text-[var(--text-soft)]">{eventDetail.event.meetingPointAddress || eventDetail.event.venue}</div>
                  </div>
                  <MapPin className="h-5 w-5 text-[var(--coral)]" />
                </div>
                {mapLink ? (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Abrir en Mapas
                  </a>
                ) : null}
              </section>
              {canManage ? (
                <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Check-in QR</div>
                      <div className="mt-2 text-sm text-[var(--text-soft)]">Escanean, pasan a dentro y se confirma asistencia real.</div>
                    </div>
                    <QrCode className="h-5 w-5 text-[var(--coral)]" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setQr(await fetchCheckInToken(eventDetail.event.slug));
                      }}
                      className="rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Generar QR
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await setEventChatMode(
                          eventDetail.event.slug,
                          eventDetail.event.chatMode === "open" ? "announcements" : "open"
                        );
                        await onRefresh();
                      }}
                      className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold"
                    >
                      Chat {eventDetail.event.chatMode === "open" ? "abierto" : "solo staff"}
                    </button>
                  </div>
                  {qr ? (
                    <div className="mt-4 rounded-[1.6rem] bg-[var(--bg-soft)] p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr.qrImageUrl} alt="QR check-in" className="mx-auto h-48 w-48 rounded-2xl bg-white p-2" />
                      <div className="mt-3 text-center text-xs text-[var(--text-soft)]">
                        Caduca {formatMobileDateTime(qr.expiresAt)}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
              {!myMembership ? (
                <button
                  type="button"
                  onClick={async () => {
                    await joinEvent(eventDetail.event.slug);
                    await onRefresh();
                  }}
                  className="tindereo-gradient w-full rounded-[1.6rem] px-4 py-4 text-base font-bold text-white"
                >
                  Pedir acceso
                </button>
              ) : null}
              {isInside ? (
                <div className="rounded-[1.6rem] border border-[rgba(42,168,118,0.22)] bg-[rgba(42,168,118,0.08)] px-4 py-4 text-sm text-[var(--green)]">
                  Check-in hecho. Ya sales como dentro.
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "info" ? (
            <div className="space-y-4">
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Cuando</div>
                <div className="mt-2 text-base font-bold">{formatMobileDateTime(eventDetail.event.startsAt)}</div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">{eventDetail.event.description}</p>
              </section>
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Normas</div>
                <div className="mt-3 space-y-2">
                  {eventDetail.event.rules.length ? eventDetail.event.rules.map((rule) => (
                    <div key={rule} className="rounded-2xl bg-[var(--bg-soft)] px-4 py-3 text-sm leading-6">{rule}</div>
                  )) : <div className="text-sm text-[var(--text-soft)]">Aún sin normas cargadas.</div>}
                </div>
              </section>
              {eventDetail.event.playlistUrl ? (
                <a href={eventDetail.event.playlistUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white">
                  <Link2 className="h-4 w-4" />
                  Abrir playlist
                </a>
              ) : null}
            </div>
          ) : null}

          {tab === "people" ? (
            <div className="space-y-3">
              <div className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 text-sm text-[var(--text-soft)]">
                <div className="mb-2 flex items-center gap-2 text-[var(--text-main)]">
                  <Users className="h-4 w-4" />
                  {eventDetail.members.length} personas con acceso
                </div>
                {!eventDetail.members.length ? "Hasta que no estés dentro no se expone la lista completa." : "Host, cohosts y gente confirmada."}
              </div>
              {eventDetail.members.map((member) => (
                <div key={member.id} className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar profile={member} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">@{member.handle}</div>
                      <div className="truncate text-xs text-[var(--text-soft)]">{member.city}</div>
                    </div>
                    {canManage && member.id !== conversation.viewerId && member.id !== eventDetail.event.hostId ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={async () => { await addEventCohost(eventDetail.event.slug, member.id); await onRefresh(); }} className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold">
                          Cohost
                        </button>
                        <button type="button" onClick={async () => { await moderateEventMember(eventDetail.event.slug, member.id, "mute"); await onRefresh(); }} className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold">
                          <Shield className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "stories" ? (
            <div className="space-y-4">
              {storyClusters.length ? <StoryStrip clusters={storyClusters} /> : null}
              {eventDetail.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {!storyClusters.length && !eventDetail.posts.length ? (
                <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
                  Cuando el evento empiece a moverse, aquí aparecerán historias y publicaciones.
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "faq" ? (
            <div className="space-y-3">
              {eventDetail.event.faq.length ? eventDetail.event.faq.map((item) => (
                <div key={item.question} className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="text-sm font-bold">{item.question}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{item.answer}</div>
                </div>
              )) : (
                <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
                  Este evento todavía no ha cargado preguntas frecuentes.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
