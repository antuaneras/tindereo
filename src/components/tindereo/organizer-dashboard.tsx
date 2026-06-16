"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Plus,
  Shield,
  Sparkles,
  Users,
  X
} from "lucide-react";
import type { CreateEventInput, PersistedState, PlatformUser } from "@/lib/tindereo-types";
import {
  formatEventDateRange,
  formatRelativeTime,
  getCategoryMeta,
  getEventAttendanceRatio,
  getEventById,
  getEventDeadlineLabel,
  getEventGuestCount,
  getEventHealth,
  getEventPendingCount,
  getEventRequirementSummary,
  getHostedEvents,
  getHostMetrics,
  getHostPendingRequests,
  getUserById
} from "@/lib/tindereo-utils";

interface OrganizerDashboardProps {
  state: PersistedState;
  currentUser: PlatformUser;
  onCreateEvent: (input: CreateEventInput) => void;
  onRespondToAccess: (membershipId: string, accept: boolean) => void;
  onSelectEvent: (eventId: string) => void;
}

const EMPTY_DRAFT: CreateEventInput = {
  title: "",
  category: "networking",
  visibility: "public",
  city: "Madrid",
  venue: "",
  startsAt: "2026-07-03T20:00",
  endsAt: "2026-07-03T23:30",
  priceLabel: "Desde 20 EUR",
  capacity: 40,
  summary: "",
  description: "",
  dressCode: "Smart casual",
  tags: [],
  highlights: []
};

export function OrganizerDashboard({
  state,
  currentUser,
  onCreateEvent,
  onRespondToAccess,
  onSelectEvent
}: OrganizerDashboardProps) {
  const [draft, setDraft] = useState<CreateEventInput>(EMPTY_DRAFT);
  const [tagsInput, setTagsInput] = useState("Networking, comunidad, Madrid");
  const [highlightsInput, setHighlightsInput] = useState(
    "Aprobacion manual, chat general para confirmados, objetivo minimo de 4 asistentes"
  );

  const hostedEvents = getHostedEvents(state, currentUser.id);
  const metrics = getHostMetrics(state, currentUser.id);
  const pendingRequests = getHostPendingRequests(state, currentUser.id);

  const handleSubmit = () => {
    onCreateEvent({
      ...draft,
      tags: tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      highlights: highlightsInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    });

    setDraft(EMPTY_DRAFT);
    setTagsInput("Networking, comunidad, Madrid");
    setHighlightsInput("Aprobacion manual, chat general para confirmados, objetivo minimo de 4 asistentes");
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-white/65 bg-[#141110] px-5 py-5 text-white shadow-[0_32px_80px_rgba(20,17,16,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/72">
              <Shield className="h-3.5 w-3.5" />
              Crear y moderar eventos
            </div>
            <h2 className="text-3xl font-black tracking-tight">Cualquier usuario puede montar un plan</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/72">
              Lo importante ahora es la calidad del acceso: el creador decide si el evento es publico
              o privado, aprueba a quien entra y puede vigilar si alcanza el minimo de 4 asistentes
              durante la primera semana.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/72">
            <p className="font-semibold text-white">{currentUser.name}</p>
            <p>{currentUser.title}</p>
            <p className="mt-2 text-xs text-white/54">{hostedEvents.length} eventos creados</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Eventos creados" value={String(metrics.publishedEvents)} />
        <MetricCard label="Confirmados" value={String(metrics.confirmedGuests)} />
        <MetricCard label="Pendientes" value={String(metrics.pendingApprovals)} />
        <MetricCard label="En riesgo" value={String(metrics.atRiskEvents)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4 rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                Tus eventos
              </p>
              <h3 className="mt-1 text-xl font-black text-[#1d160f]">Cartelera y salud de cada plan</h3>
            </div>
            <div className="rounded-full border border-[#eadfd3] px-3 py-1 text-xs text-[#7a6455]">
              {hostedEvents.length} activos
            </div>
          </div>

          {hostedEvents.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-6 text-sm text-[#7a6455]">
              Todavia no has creado eventos. Usa el formulario y publica el primero.
            </div>
          ) : (
            <div className="space-y-3">
              {hostedEvents.map((event) => {
                const category = getCategoryMeta(event.category);
                const health = getEventHealth(state, event.id);
                const requirements = getEventRequirementSummary(state, event.id);
                const fill = Math.round(getEventAttendanceRatio(state, event.id) * 100);
                const pendingCount = getEventPendingCount(state, event.id);

                return (
                  <button
                    key={event.id}
                    className="w-full rounded-[26px] border border-[#eadfd3] bg-[#fffaf6] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(52,34,22,0.08)]"
                    onClick={() => onSelectEvent(event.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-xl">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              backgroundColor: category.softAccent,
                              color: category.accent
                            }}
                          >
                            {category.label}
                          </span>
                          <StatusBadge health={health} />
                          <VisibilityBadge visibility={event.visibility} />
                        </div>
                        <h4 className="mt-3 text-lg font-black text-[#1d160f]">{event.title}</h4>
                        <p className="mt-2 text-sm text-[#6d5749]">{event.summary}</p>
                        <p className="mt-2 text-sm text-[#8f6f59]">{formatEventDateRange(event)}</p>
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 text-[#8f6f59]" />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <MiniStat
                        label="Confirmados"
                        value={`${getEventGuestCount(state, event.id)}/${event.capacity}`}
                      />
                      <MiniStat label="Pendientes" value={String(pendingCount)} />
                      <MiniStat
                        label="Objetivo"
                        value={`${requirements.confirmedCount}/${event.minimumGuestsRequired}`}
                      />
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-[#7a6455]">
                        <span>Ocupacion actual</span>
                        <span>{fill}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#efe5db]">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24]"
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-[#eadfd3] bg-white px-3 py-3 text-sm text-[#6d5749]">
                      <span className="font-semibold text-[#1d160f]">
                        Objetivo minimo en 7 dias:
                      </span>{" "}
                      {health === "confirmed"
                        ? "cumplido"
                        : requirements.remainingCount > 0
                          ? `faltan ${requirements.remainingCount} antes del ${getEventDeadlineLabel(event)}`
                          : `revision hasta el ${getEventDeadlineLabel(event)}`}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
              <Plus className="h-4 w-4" />
              Crear nuevo evento
            </div>
            <div className="mt-4 grid gap-3">
              <Input
                label="Titulo"
                value={draft.title}
                onChange={(value) => setDraft((current) => ({ ...current, title: value }))}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="Categoria"
                  value={draft.category}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      category: value as CreateEventInput["category"]
                    }))
                  }
                  options={[
                    { value: "networking", label: "Networking" },
                    { value: "music", label: "Musica" },
                    { value: "creative", label: "Creativo" },
                    { value: "food", label: "Food" },
                    { value: "wellness", label: "Wellness" }
                  ]}
                />
                <Select
                  label="Visibilidad"
                  value={draft.visibility}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      visibility: value as CreateEventInput["visibility"]
                    }))
                  }
                  options={[
                    { value: "public", label: "Publico" },
                    { value: "private", label: "Privado" }
                  ]}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Ciudad"
                  value={draft.city}
                  onChange={(value) => setDraft((current) => ({ ...current, city: value }))}
                />
                <Input
                  label="Venue"
                  value={draft.venue}
                  onChange={(value) => setDraft((current) => ({ ...current, venue: value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Inicio"
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(value) => setDraft((current) => ({ ...current, startsAt: value }))}
                />
                <Input
                  label="Fin"
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(value) => setDraft((current) => ({ ...current, endsAt: value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Precio"
                  value={draft.priceLabel}
                  onChange={(value) => setDraft((current) => ({ ...current, priceLabel: value }))}
                />
                <Input
                  label="Capacidad"
                  type="number"
                  value={String(draft.capacity)}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      capacity: Number(value) || 0
                    }))
                  }
                />
              </div>
              <TextArea
                label="Resumen corto"
                rows={3}
                value={draft.summary}
                onChange={(value) => setDraft((current) => ({ ...current, summary: value }))}
              />
              <TextArea
                label="Descripcion"
                rows={4}
                value={draft.description}
                onChange={(value) => setDraft((current) => ({ ...current, description: value }))}
              />
              <Input
                label="Dress code"
                value={draft.dressCode}
                onChange={(value) => setDraft((current) => ({ ...current, dressCode: value }))}
              />
              <Input label="Tags separadas por coma" value={tagsInput} onChange={setTagsInput} />
              <Input
                label="Highlights separados por coma"
                value={highlightsInput}
                onChange={setHighlightsInput}
              />
              <button
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff6b57] to-[#f08a24] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(240,138,36,0.25)]"
                onClick={handleSubmit}
                type="button"
              >
                Publicar evento
              </button>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
              <Clock3 className="h-4 w-4" />
              Solicitudes pendientes
            </div>
            <div className="mt-4 space-y-3">
              {pendingRequests.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-5 text-sm text-[#7a6455]">
                  No tienes solicitudes de acceso pendientes ahora mismo.
                </div>
              ) : (
                pendingRequests.map((membership) => {
                  const applicant = getUserById(state, membership.userId);
                  const event = getEventById(state, membership.eventId);

                  return (
                    <div
                      key={membership.id}
                      className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#1d160f]">{applicant.name}</p>
                          <p className="text-sm text-[#6d5749]">{event?.title}</p>
                        </div>
                        <div className="rounded-full border border-[#eadfd3] px-3 py-1 text-xs text-[#7a6455]">
                          {formatRelativeTime(membership.requestedAt)}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-full bg-[#1d160f] px-4 py-3 text-sm font-semibold text-white"
                          onClick={() => onRespondToAccess(membership.id, true)}
                          type="button"
                        >
                          <Check className="h-4 w-4" />
                          Aprobar
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-[#eadfd3] bg-white px-4 py-3 text-sm font-semibold text-[#6d5749]"
                          onClick={() => onRespondToAccess(membership.id, false)}
                          type="button"
                        >
                          <X className="h-4 w-4" />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.06)]">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#ff6b57]">
        <Sparkles className="h-4 w-4" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#8f6f59]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-[#1d160f]">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[#eadfd3] bg-white px-3 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-[#8f6f59]">{label}</p>
      <p className="mt-1 text-base font-bold text-[#1d160f]">{value}</p>
    </div>
  );
}

function StatusBadge({ health }: { health: ReturnType<typeof getEventHealth> }) {
  const config =
    health === "confirmed"
      ? { label: "Confirmado", className: "bg-[#e8fbf2] text-[#1f8d60]" }
      : health === "at-risk"
        ? { label: "En riesgo", className: "bg-[#fff0e8] text-[#d45d28]" }
        : { label: "Construyendo", className: "bg-[#f7f1ea] text-[#8f6f59]" };

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility: "public" | "private" }) {
  return (
    <span className="rounded-full bg-[#1d160f] px-3 py-1 text-[11px] font-semibold text-white">
      {visibility === "public" ? "Publico" : "Privado"}
    </span>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
        {label}
      </span>
      <input
        className="w-full rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none transition focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
        {label}
      </span>
      <select
        className="w-full rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none transition focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8f6f59]">
        {label}
      </span>
      <textarea
        className="w-full rounded-[18px] border border-[#e7d8cb] bg-[#fffaf6] px-4 py-3 text-sm text-[#1d160f] outline-none transition focus:border-[#ff8d66] focus:ring-2 focus:ring-[#ffd4c5]"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );
}
