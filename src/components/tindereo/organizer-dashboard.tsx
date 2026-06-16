"use client";

import { useState } from "react";
import {
  BarChart2,
  CalendarDays,
  ChevronRight,
  MessageCircle,
  Plus,
  Shield,
  Sparkles,
  Users
} from "lucide-react";
import { ORGANIZER_CONTACT_EMAIL } from "@/lib/tindereo-data";
import type { CreateEventInput, PersistedState, PlatformUser } from "@/lib/tindereo-types";
import {
  formatEventDateRange,
  formatRelativeTime,
  getEventAttendanceRatio,
  getEventGuestCount,
  getEventMessages,
  getHostedEvents,
  getOrganizerMetrics,
  getUserById
} from "@/lib/tindereo-utils";

interface OrganizerDashboardProps {
  state: PersistedState;
  currentUser: PlatformUser;
  onCreateEvent: (input: CreateEventInput) => void;
  onSelectEvent: (eventId: string) => void;
}

const EMPTY_DRAFT: CreateEventInput = {
  title: "",
  category: "networking",
  city: "Madrid",
  venue: "",
  startsAt: "2026-07-03T20:00",
  endsAt: "2026-07-03T23:30",
  priceLabel: "Desde 20 EUR",
  capacity: 80,
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
  onSelectEvent
}: OrganizerDashboardProps) {
  const [draft, setDraft] = useState<CreateEventInput>(EMPTY_DRAFT);
  const [tagsInput, setTagsInput] = useState("Networking, comunidad, Madrid");
  const [highlightsInput, setHighlightsInput] = useState(
    "Chat general desde el alta, lista de asistentes visible, conexiones privadas"
  );

  const hostedEvents = getHostedEvents(state, currentUser.id);
  const metrics = getOrganizerMetrics(state, currentUser.id);
  const pendingLeads = state.organizerLeads
    .filter((lead) => lead.status === "pending")
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

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
    setHighlightsInput("Chat general desde el alta, lista de asistentes visible, conexiones privadas");
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-white/65 bg-[#141110] px-5 py-5 text-white shadow-[0_32px_80px_rgba(20,17,16,0.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/72">
              <Shield className="h-3.5 w-3.5" />
              Panel organizador
            </div>
            <h2 className="text-3xl font-black tracking-tight">Eventos listos para comunidad real</h2>
            <p className="mt-2 max-w-xl text-sm text-white/72">
              Aqui controlas publicacion, aforo, conversacion previa y nuevas solicitudes de
              organizadores. Todo esta mockeado para demo, pero el flujo ya queda preparado para
              backend real.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/72">
            <p className="font-semibold text-white">{currentUser.company}</p>
            <p>{currentUser.city}</p>
            <p className="mt-2 text-xs text-white/54">{ORGANIZER_CONTACT_EMAIL}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Eventos publicados"
          value={String(metrics.publishedEvents)}
          copy="Calendario activo"
        />
        <MetricCard
          icon={<Users className="h-4 w-4" />}
          label="Invitados confirmados"
          value={String(metrics.totalGuests)}
          copy="Entre visibles y base importada"
        />
        <MetricCard
          icon={<MessageCircle className="h-4 w-4" />}
          label="Mensajes en grupo"
          value={String(metrics.totalMessages)}
          copy="Actividad previa al evento"
        />
        <MetricCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Conexiones privadas"
          value={String(metrics.privateConnections)}
          copy={`${metrics.openLeads} solicitudes pendientes`}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                Tu cartelera
              </p>
              <h3 className="mt-1 text-xl font-black text-[#1d160f]">Eventos publicados</h3>
            </div>
            <div className="rounded-full border border-[#eadfd3] px-3 py-1 text-xs text-[#7a6455]">
              {hostedEvents.length} activos
            </div>
          </div>

          {hostedEvents.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-6 text-sm text-[#7a6455]">
              Todavia no has creado eventos. Usa el formulario de la derecha para publicar el
              primero.
            </div>
          ) : (
            <div className="space-y-3">
              {hostedEvents.map((event) => {
                const fill = Math.round(getEventAttendanceRatio(state, event.id) * 100);
                const guestCount = getEventGuestCount(state, event.id);
                const chatCount = getEventMessages(state, event.id).length;

                return (
                  <button
                    key={event.id}
                    className="w-full rounded-[26px] border border-[#eadfd3] bg-[#fffaf6] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(52,34,22,0.08)]"
                    onClick={() => onSelectEvent(event.id)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
                          {event.city} · {formatEventDateRange(event)}
                        </p>
                        <h4 className="mt-1 text-lg font-black text-[#1d160f]">{event.title}</h4>
                        <p className="mt-2 text-sm text-[#6d5749]">{event.summary}</p>
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 text-[#8f6f59]" />
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <MiniStat label="Confirmados" value={`${guestCount}/${event.capacity}`} />
                      <MiniStat label="Espera" value={String(event.waitlistCount)} />
                      <MiniStat label="Mensajes" value={String(chatCount)} />
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
                <Input
                  label="Ciudad"
                  value={draft.city}
                  onChange={(value) => setDraft((current) => ({ ...current, city: value }))}
                />
              </div>
              <Input
                label="Venue"
                value={draft.venue}
                onChange={(value) => setDraft((current) => ({ ...current, venue: value }))}
              />
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
                value={draft.summary}
                onChange={(value) => setDraft((current) => ({ ...current, summary: value }))}
                rows={3}
              />
              <TextArea
                label="Descripcion"
                value={draft.description}
                onChange={(value) => setDraft((current) => ({ ...current, description: value }))}
                rows={4}
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
                Publicar evento demo
              </button>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_24px_60px_rgba(52,34,22,0.08)] md:p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8f6f59]">
              <BarChart2 className="h-4 w-4" />
              Solicitudes de acceso organizador
            </div>
            <div className="mt-4 space-y-3">
              {pendingLeads.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#e1d4c7] bg-[#fbf7f2] px-4 py-5 text-sm text-[#7a6455]">
                  No hay nuevas solicitudes ahora mismo.
                </div>
              ) : (
                pendingLeads.map((lead) => {
                  const applicant = getUserById(state, lead.fromUserId);

                  return (
                    <div
                      key={lead.id}
                      className="rounded-[22px] border border-[#eadfd3] bg-[#fffaf6] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#1d160f]">{applicant.name}</p>
                          <p className="text-sm text-[#6d5749]">
                            {lead.companyName} · {lead.concept}
                          </p>
                        </div>
                        <div className="rounded-full border border-[#eadfd3] px-3 py-1 text-xs text-[#7a6455]">
                          {formatRelativeTime(lead.createdAt)}
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-[#6d5749]">{lead.message}</p>
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

function MetricCard({
  icon,
  label,
  value,
  copy
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  copy: string;
}) {
  return (
    <div className="rounded-[28px] border border-[#eadfd3] bg-white/88 p-4 shadow-[0_20px_40px_rgba(52,34,22,0.06)]">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[#fff0e8] text-[#ff6b57]">
        {icon}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#8f6f59]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-[#1d160f]">{value}</p>
      <p className="mt-1 text-sm text-[#6d5749]">{copy}</p>
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
