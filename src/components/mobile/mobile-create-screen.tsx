"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { createEvent } from "@/lib/mobile-api";
import { MobileMediaCreator } from "@/components/mobile/mobile-media-creator";
import type { MobileEventVisibility } from "@/lib/mobile-types";

const initialFaq = [{ question: "", answer: "" }];

function makeLocalDateTimeValue(offsetMinutes: number) {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function toIsoString(value: string) {
  return new Date(value).toISOString();
}

function normalizeOptional(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function MobileCreateScreen() {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<"media" | "event">("media");
  const [pendingEvent, setPendingEvent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faq, setFaq] = useState(initialFaq);
  const [eventForm, setEventForm] = useState<{
    title: string;
    summary: string;
    description: string;
    category: string;
    visibility: MobileEventVisibility;
    city: string;
    venue: string;
    startsAt: string;
    endsAt: string;
    capacity: number;
    priceLabel: string;
    dressCode: string;
    tags: string;
    rules: string;
    playlistUrl: string;
    meetingPointLabel: string;
    meetingPointAddress: string;
  }>({
    title: "",
    summary: "",
    description: "",
    category: "social",
    visibility: "public",
    city: "Madrid",
    venue: "",
    startsAt: makeLocalDateTimeValue(120),
    endsAt: makeLocalDateTimeValue(360),
    capacity: 20,
    priceLabel: "Gratis",
    dressCode: "",
    tags: "",
    rules: "",
    playlistUrl: "",
    meetingPointLabel: "",
    meetingPointAddress: ""
  });

  const canSubmit = useMemo(
    () =>
      Boolean(
        eventForm.title.trim() &&
          eventForm.summary.trim() &&
          eventForm.description.trim() &&
          eventForm.city.trim() &&
          eventForm.venue.trim() &&
          eventForm.startsAt &&
          eventForm.endsAt
      ),
    [eventForm]
  );

  if (activePanel === "media") {
    return <MobileMediaCreator onOpenEvent={() => setActivePanel("event")} />;
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line-soft)] bg-white/92 p-5 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setActivePanel("media")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-soft)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-base font-bold">Nuevo evento</div>
          <div className="text-xs text-[var(--text-soft)]">Vuelves a la camara en un toque</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(240,138,36,0.14)] text-[var(--orange)]">
          <CalendarDays className="h-5 w-5" />
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
            Evento nuevo
          </div>
          <h2 className="mt-2 text-xl font-black tracking-[-0.04em]">Lanzalo sin scroll infinito</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
            Primero lo esencial. Lo demas queda en ajustes avanzados para no romper el flujo en movil.
          </p>
        </div>
      </div>

      <form
        className="mt-4 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setPendingEvent(true);
          setError(null);

          try {
            const startsAtIso = toIsoString(eventForm.startsAt);
            const endsAtIso = toIsoString(eventForm.endsAt);

            if (Number.isNaN(new Date(startsAtIso).getTime()) || Number.isNaN(new Date(endsAtIso).getTime())) {
              throw new Error("Pon una fecha de inicio y fin validas.");
            }

            if (new Date(endsAtIso).getTime() <= new Date(startsAtIso).getTime()) {
              throw new Error("La hora de fin tiene que ir despues del inicio.");
            }

            const created = await createEvent({
              ...eventForm,
              startsAt: startsAtIso,
              endsAt: endsAtIso,
              tags: eventForm.tags
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              rules: eventForm.rules
                .split("\n")
                .map((item) => item.trim())
                .filter(Boolean),
              faq: faq.filter((item) => item.question.trim() && item.answer.trim()),
              playlistUrl: normalizeOptional(eventForm.playlistUrl),
              dressCode: eventForm.dressCode.trim(),
              priceLabel: eventForm.priceLabel.trim() || "Gratis",
              meetingPointLabel: normalizeOptional(eventForm.meetingPointLabel),
              meetingPointAddress: normalizeOptional(eventForm.meetingPointAddress),
              meetingPointLat: null,
              meetingPointLng: null,
              coverImage: null
            });

            router.push(`/evento/${created.slug}`);
            router.refresh();
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "No se pudo crear el evento.");
          } finally {
            setPendingEvent(false);
          }
        }}
      >
        <div className="space-y-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Titulo</span>
            <input
              value={eventForm.title}
              onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Sunset rooftop, brunch, after..."
              className="h-14 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Resumen corto</span>
            <textarea
              value={eventForm.summary}
              onChange={(event) => setEventForm((current) => ({ ...current, summary: event.target.value }))}
              placeholder="Que es, para quien y por que merece entrar."
              className="min-h-24 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 py-3 text-base outline-none"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Descripcion</span>
            <textarea
              value={eventForm.description}
              onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Cuenta el plan, el tono y lo que se espera de la gente."
              className="min-h-28 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 py-3 text-base outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Ciudad</span>
            <input
              value={eventForm.city}
              onChange={(event) => setEventForm((current) => ({ ...current, city: event.target.value }))}
              className="h-14 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Venue</span>
            <input
              value={eventForm.venue}
              onChange={(event) => setEventForm((current) => ({ ...current, venue: event.target.value }))}
              placeholder="La terraza, local, playa..."
              className="h-14 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Empieza</span>
            <input
              type="datetime-local"
              value={eventForm.startsAt}
              onChange={(event) => setEventForm((current) => ({ ...current, startsAt: event.target.value }))}
              className="h-14 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Termina</span>
            <input
              type="datetime-local"
              value={eventForm.endsAt}
              onChange={(event) => setEventForm((current) => ({ ...current, endsAt: event.target.value }))}
              className="h-14 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Visibilidad</span>
            <select
              value={eventForm.visibility}
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  visibility: event.target.value as MobileEventVisibility
                }))
              }
              className="h-14 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none"
            >
              <option value="public">Publico</option>
              <option value="private">Privado</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Cupo</span>
            <input
              type="number"
              min={4}
              value={eventForm.capacity}
              onChange={(event) =>
                setEventForm((current) => ({
                  ...current,
                  capacity: Number(event.target.value) || 4
                }))
              }
              className="h-14 rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none"
            />
          </label>
        </div>

        <details className="rounded-[1.8rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4">
          <summary className="cursor-pointer text-sm font-bold">Ajustes avanzados</summary>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Categoria</span>
                <input
                  value={eventForm.category}
                  onChange={(event) => setEventForm((current) => ({ ...current, category: event.target.value }))}
                  className="h-14 rounded-2xl border border-[var(--line-warm)] bg-white px-4 text-base outline-none"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Precio</span>
                <input
                  value={eventForm.priceLabel}
                  onChange={(event) => setEventForm((current) => ({ ...current, priceLabel: event.target.value }))}
                  className="h-14 rounded-2xl border border-[var(--line-warm)] bg-white px-4 text-base outline-none"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Dress code</span>
              <input
                value={eventForm.dressCode}
                onChange={(event) => setEventForm((current) => ({ ...current, dressCode: event.target.value }))}
                className="h-14 rounded-2xl border border-[var(--line-warm)] bg-white px-4 text-base outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Playlist</span>
              <input
                value={eventForm.playlistUrl}
                onChange={(event) => setEventForm((current) => ({ ...current, playlistUrl: event.target.value }))}
                placeholder="https://open.spotify.com/..."
                className="h-14 rounded-2xl border border-[var(--line-warm)] bg-white px-4 text-base outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Punto de encuentro</span>
              <input
                value={eventForm.meetingPointLabel}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    meetingPointLabel: event.target.value
                  }))
                }
                className="h-14 rounded-2xl border border-[var(--line-warm)] bg-white px-4 text-base outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Direccion</span>
              <input
                value={eventForm.meetingPointAddress}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    meetingPointAddress: event.target.value
                  }))
                }
                className="h-14 rounded-2xl border border-[var(--line-warm)] bg-white px-4 text-base outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Tags</span>
              <input
                value={eventForm.tags}
                onChange={(event) => setEventForm((current) => ({ ...current, tags: event.target.value }))}
                placeholder="networking, sunset, techno"
                className="h-14 rounded-2xl border border-[var(--line-warm)] bg-white px-4 text-base outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Normas</span>
              <textarea
                value={eventForm.rules}
                onChange={(event) => setEventForm((current) => ({ ...current, rules: event.target.value }))}
                className="min-h-24 rounded-2xl border border-[var(--line-warm)] bg-white px-4 py-3 text-base outline-none"
              />
            </label>

            <div className="space-y-3 rounded-[1.6rem] border border-[var(--line-soft)] bg-white px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">FAQ</div>
              {faq.map((item, index) => (
                <div key={`${index}-${item.question}`} className="space-y-2">
                  <input
                    value={item.question}
                    onChange={(event) =>
                      setFaq((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, question: event.target.value } : row
                        )
                      )
                    }
                    placeholder="Pregunta"
                    className="h-12 w-full rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 text-base outline-none"
                  />
                  <textarea
                    value={item.answer}
                    onChange={(event) =>
                      setFaq((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, answer: event.target.value } : row
                        )
                      )
                    }
                    placeholder="Respuesta"
                    className="min-h-20 w-full rounded-2xl border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 py-3 text-base outline-none"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFaq((current) => [...current, { question: "", answer: "" }])}
                className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold"
              >
                Anadir FAQ
              </button>
            </div>
          </div>
        </details>

        {error ? <p className="text-sm text-[#b84031]">{error}</p> : null}

        <button
          type="submit"
          disabled={pendingEvent || !canSubmit}
          className="tindereo-gradient h-14 w-full rounded-2xl text-base font-bold text-white disabled:opacity-60"
        >
          {pendingEvent ? "Creando evento..." : "Crear evento y abrir chat"}
        </button>
      </form>
    </section>
  );
}
