"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  BarChart2,
  Bell,
  ChevronRight,
  Download,
  Heart,
  LogOut,
  MessageCircle,
  QrCode,
  RefreshCw,
  Settings,
  Users,
  Zap
} from "lucide-react";
import { ACTIVITY_CURVE, EVENT_INFO, EVENT_ZONES } from "@/lib/tindereo-data";
import { buildCommunityUsers, buildDashboardMetrics, buildGenderDistribution, buildTopInterests, formatTimeAgo, getMatchPartner, getZoneById } from "@/lib/tindereo-utils";
import type { ChatMessage, MatchItem, UserProfile } from "@/lib/tindereo-types";

interface OrganizerDashboardProps {
  currentUser: UserProfile | null;
  matches: MatchItem[];
  messages: Record<string, ChatMessage[]>;
  onExit: () => void;
}

type AdminSection = "overview" | "users" | "matches" | "qr" | "settings";

function DashboardTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#EDE8E0] bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-[#1A1410]">{label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {item.value}
        </p>
      ))}
    </div>
  );
}

export function OrganizerDashboard({
  currentUser,
  matches,
  messages,
  onExit
}: OrganizerDashboardProps) {
  const [section, setSection] = useState<AdminSection>("overview");
  const users = buildCommunityUsers(currentUser);
  const metrics = buildDashboardMetrics(currentUser, matches, messages);
  const topInterests = buildTopInterests(currentUser);
  const genderDistribution = buildGenderDistribution(currentUser);
  const activityCurve = ACTIVITY_CURVE.slice();
  activityCurve[activityCurve.length - 1] = {
    ...activityCurve[activityCurve.length - 1],
    users: metrics.registeredUsers,
    matches: metrics.matchesGenerated
  };

  const recentMatches = matches
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((match) => {
      const partner = currentUser
        ? getMatchPartner(match, currentUser.id, currentUser)
        : getMatchPartner(match, "sofia-demo", currentUser);
      return {
        match,
        partner,
        lastMessage: messages[match.id]?.[messages[match.id].length - 1]
      };
    });

  return (
    <div className="min-h-screen bg-[#FAF7F3] text-[#1A1410]">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-[#EDE8E0] bg-white lg:flex lg:flex-col">
          <div className="border-b border-[#EDE8E0] px-6 pb-6 pt-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] shadow-lg shadow-[#FF5A5F]/20">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-tight">tindereo</p>
                <p className="text-xs text-[#B8AFA4]">Panel del organizador</p>
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-[#FF5A5F]/20 bg-[#FF5A5F]/6 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#FF5A5F]" />
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF5A5F]">En directo</span>
              </div>
              <p className="font-bold">{EVENT_INFO.name}</p>
              <p className="text-sm text-[#7A7068]">{EVENT_INFO.dateLabel}</p>
              <p className="mt-1 text-xs text-[#B8AFA4]">{EVENT_INFO.location}</p>
            </div>
          </div>

          <nav className="flex-1 px-4 py-5">
            {[
              { id: "overview", label: "Resumen general", icon: BarChart2 },
              { id: "users", label: "Usuarios", icon: Users },
              { id: "matches", label: "Matches y chats", icon: Heart },
              { id: "qr", label: "Accesos y QR", icon: QrCode },
              { id: "settings", label: "Ajustes", icon: Settings }
            ].map(({ id, label, icon: Icon }) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  onClick={() => setSection(id as AdminSection)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    active ? "bg-[#FF5A5F]/10 text-[#FF5A5F]" : "text-[#7A7068] hover:bg-[#FAF7F3]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                  {active ? <span className="ml-auto h-2 w-2 rounded-full bg-[#FF5A5F]" /> : null}
                </button>
              );
            })}
          </nav>

          <div className="px-4 pb-6">
            <button
              onClick={onExit}
              className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-[#B8AFA4] transition hover:bg-[#FAF7F3] hover:text-[#FF5A5F]"
            >
              <LogOut className="h-4 w-4" />
              <span>Salir del panel</span>
            </button>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#EDE8E0] bg-white/95 px-5 py-4 backdrop-blur lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                <h1 className="text-xl font-extrabold">Control del evento</h1>
                <p className="text-sm text-[#B8AFA4]">
                  {EVENT_INFO.name} · Actualizado en esta demo local
                </p>
                </div>
                <button
                  onClick={onExit}
                  className="flex items-center gap-2 rounded-2xl border border-[#EDE8E0] bg-[#FAF7F3] px-3 py-2 text-sm font-semibold text-[#7A7068] lg:hidden"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Salir</span>
                </button>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button className="hidden items-center gap-2 rounded-2xl border border-[#EDE8E0] px-4 py-2 text-sm font-semibold text-[#7A7068] sm:flex">
                  <RefreshCw className="h-4 w-4" />
                  <span>Refrescar</span>
                </button>
                <button className="hidden items-center gap-2 rounded-2xl bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[#FF5A5F]/20 sm:flex">
                  <Download className="h-4 w-4" />
                  <span>Exportar</span>
                </button>
                <button className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#EDE8E0] bg-[#FAF7F3]">
                  <Bell className="h-4 w-4 text-[#7A7068]" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#FF5A5F]" />
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 lg:px-8">
            {section === "overview" ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Usuarios registrados", value: metrics.registeredUsers, icon: Users, color: "#FF5A5F", delta: "+24" },
                    { label: "Usuarios activos", value: metrics.activeUsers, icon: Zap, color: "#FF8C42", delta: "+12" },
                    { label: "Matches generados", value: metrics.matchesGenerated, icon: Heart, color: "#FF5A5F", delta: "+19" },
                    { label: "Chats iniciados", value: metrics.chatsStarted, icon: MessageCircle, color: "#FF8C42", delta: "+8" }
                  ].map(({ label, value, icon: Icon, color, delta }) => (
                    <div key={label} className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                      <div className="mb-5 flex items-start justify-between">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-2xl"
                          style={{ backgroundColor: `${color}15` }}
                        >
                          <Icon className="h-5 w-5" style={{ color }} />
                        </div>
                        <span className="rounded-full bg-[#4ADE80]/10 px-2 py-1 text-xs font-bold text-[#4ADE80]">
                          {delta}
                        </span>
                      </div>
                      <p className="text-3xl font-extrabold">{value}</p>
                      <p className="mt-1 text-xs text-[#B8AFA4]">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h2 className="font-bold">Actividad por hora</h2>
                        <p className="text-xs text-[#B8AFA4]">Usuarios activos frente a matches</p>
                      </div>
                      <div className="flex gap-4 text-xs text-[#7A7068]">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-4 rounded-full bg-[#FF5A5F]" />
                          Usuarios
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-4 rounded-full bg-[#FF8C42]" />
                          Matches
                        </span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={activityCurve}>
                        <defs>
                          <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF5A5F" stopOpacity={0.24} />
                            <stop offset="95%" stopColor="#FF5A5F" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="matchesFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF8C42" stopOpacity={0.22} />
                            <stop offset="95%" stopColor="#FF8C42" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#B8AFA4", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#B8AFA4", fontSize: 12 }} width={34} />
                        <Tooltip content={<DashboardTooltip />} />
                        <Area type="monotone" dataKey="users" name="Usuarios" stroke="#FF5A5F" fill="url(#usersFill)" strokeWidth={2.2} />
                        <Area type="monotone" dataKey="matches" name="Matches" stroke="#FF8C42" fill="url(#matchesFill)" strokeWidth={2.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                    <h2 className="font-bold">Distribucion de genero</h2>
                    <p className="mb-4 text-xs text-[#B8AFA4]">Sobre los asistentes visibles en la demo</p>
                    <div className="flex justify-center">
                      <PieChart width={180} height={180}>
                        <Pie
                          data={genderDistribution}
                          cx={90}
                          cy={90}
                          innerRadius={52}
                          outerRadius={76}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {genderDistribution.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </div>
                    <div className="mt-2 space-y-2">
                      {genderDistribution.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}
                          </span>
                          <span className="font-semibold">{entry.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-bold">Intereses mas populares</h2>
                      <span className="text-xs text-[#B8AFA4]">Auto calculado</span>
                    </div>
                    <div className="space-y-3">
                      {topInterests.map((interest) => (
                        <div key={interest.name}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span>{interest.name}</span>
                            <span className="font-semibold text-[#7A7068]">{interest.value}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#EDE8E0]">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-[#FF5A5F] to-[#FF8C42]"
                              style={{ width: `${interest.value}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-bold">Ultimos registros</h2>
                      <button
                        onClick={() => setSection("users")}
                        className="text-sm font-semibold text-[#FF5A5F]"
                      >
                        Ver todos
                      </button>
                    </div>
                    <div className="space-y-3">
                      {users
                        .slice()
                        .sort((left, right) => right.joinedAt.localeCompare(left.joinedAt))
                        .slice(0, 5)
                        .map((user) => (
                          <div key={user.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-[#FAF7F3]">
                            <div className="h-12 w-12 overflow-hidden rounded-full border border-[#EDE8E0]">
                              <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{user.name}</p>
                              <p className="text-xs text-[#B8AFA4]">
                                {user.age} anos · {getZoneById(user.zoneId).label}
                              </p>
                            </div>
                            <span className="text-xs text-[#B8AFA4]">{formatTimeAgo(user.joinedAt)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {section === "users" ? (
              <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold">Usuarios del evento</h2>
                    <p className="text-sm text-[#B8AFA4]">Listado hardcodeado para probar la experiencia</p>
                  </div>
                  <div className="rounded-full border border-[#EDE8E0] px-3 py-1 text-xs font-semibold text-[#7A7068]">
                    {users.length} visibles
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-[24px] border border-[#EDE8E0] p-4">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-3xl border border-[#EDE8E0]">
                          <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-bold">{user.name}</p>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                                user.status === "online"
                                  ? "bg-[#4ADE80]/10 text-[#4ADE80]"
                                  : user.status === "chatting"
                                    ? "bg-[#FF5A5F]/10 text-[#FF5A5F]"
                                    : "bg-[#EDE8E0] text-[#7A7068]"
                              }`}
                            >
                              {user.status}
                            </span>
                          </div>
                          <p className="text-sm text-[#7A7068]">
                            {user.age} anos · {user.city}
                          </p>
                          <p className="text-xs text-[#B8AFA4]">{user.occupation}</p>
                        </div>
                      </div>
                      <p className="mb-3 text-sm text-[#3D3630]">{user.headline}</p>
                      <div className="mb-3 flex flex-wrap gap-2">
                        {user.interests.slice(0, 3).map((interest) => (
                          <span
                            key={interest}
                            className="rounded-full border border-[#FF5A5F]/20 bg-[#FF5A5F]/5 px-2 py-1 text-xs font-semibold text-[#FF5A5F]"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#B8AFA4]">
                        <span>{getZoneById(user.zoneId).label}</span>
                        <span>{user.points} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "matches" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                  <h2 className="mb-4 font-bold">Ultimos matches</h2>
                  <div className="space-y-3">
                    {recentMatches.length > 0 ? (
                      recentMatches.map(({ match, partner, lastMessage }) => (
                        <div key={match.id} className="rounded-[24px] border border-[#EDE8E0] p-4">
                          <div className="mb-3 flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-full border border-[#EDE8E0]">
                              <img src={partner.photo} alt={partner.name} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{partner.name}</p>
                                {match.superLike ? (
                                  <span className="rounded-full bg-[#FFB347]/15 px-2 py-1 text-[10px] font-bold text-[#FF8C42]">
                                    super like
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-[#B8AFA4]">
                                {match.commonInterests.join(", ") || "Sin intereses en comun visibles"}
                              </p>
                            </div>
                            <span className="text-xs text-[#B8AFA4]">{formatTimeAgo(match.createdAt)}</span>
                          </div>
                          <div className="rounded-2xl bg-[#FAF7F3] p-3 text-sm text-[#3D3630]">
                            {lastMessage?.text ?? "Sin mensajes todavia"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-[#EDE8E0] p-8 text-center text-sm text-[#B8AFA4]">
                        Aun no hay matches generados en esta sesion.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                  <h2 className="mb-4 font-bold">Zonas calientes</h2>
                  <div className="space-y-3">
                    {EVENT_ZONES.map((zone) => (
                      <div key={zone.id} className="rounded-[22px] border border-[#EDE8E0] p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-2xl text-lg"
                              style={{ backgroundColor: `${zone.color}15` }}
                            >
                              {zone.emoji}
                            </div>
                            <div>
                              <p className="font-semibold">{zone.label}</p>
                              <p className="text-xs text-[#B8AFA4]">{zone.people} personas aprox.</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold" style={{ color: zone.color }}>
                            {Math.round((zone.people / EVENT_INFO.liveAttendees) * 100)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#EDE8E0]">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.round((zone.people / EVENT_INFO.liveAttendees) * 100)}%`,
                              background: `linear-gradient(90deg, ${zone.color}, #FF8C42)`
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {section === "qr" ? (
              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                  <h2 className="font-bold">QR y accesos de demo</h2>
                  <p className="mt-1 text-sm text-[#B8AFA4]">
                    De momento todo esta hardcodeado para probar UX y flujos.
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-[#EDE8E0] bg-[#FAF7F3] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B8AFA4]">Codigo del evento</p>
                      <p className="mt-3 text-2xl font-extrabold tracking-tight text-[#1A1410]">
                        {EVENT_INFO.eventCode}
                      </p>
                      <p className="mt-2 text-sm text-[#7A7068]">Acceso para asistentes al tardeo</p>
                    </div>
                    <div className="rounded-[24px] border border-[#EDE8E0] bg-[#FAF7F3] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B8AFA4]">Credenciales del organizador</p>
                      <p className="mt-3 text-sm font-semibold">{EVENT_INFO.organizerEmail}</p>
                      <p className="mt-1 text-sm text-[#7A7068]">{EVENT_INFO.organizerPassword}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button className="rounded-2xl border border-[#EDE8E0] px-4 py-3 text-sm font-semibold text-[#7A7068]">
                      Regenerar QR
                    </button>
                    <button className="rounded-2xl bg-gradient-to-br from-[#FF5A5F] to-[#FF8C42] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#FF5A5F]/20">
                      Descargar PNG
                    </button>
                  </div>
                </div>
                <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B8AFA4]">Preview QR</p>
                  <div className="mt-4 flex items-center justify-center rounded-[32px] bg-[#111111] p-6">
                    <div className="rounded-[28px] bg-white p-5 shadow-xl">
                      <div className="grid grid-cols-5 gap-2">
                        {Array.from({ length: 25 }).map((_, index) => (
                          <span
                            key={index}
                            className={`h-5 w-5 rounded-sm ${index % 3 === 0 || index % 7 === 0 ? "bg-[#111111]" : "bg-transparent"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-[24px] bg-[#FAF7F3] p-4">
                    <p className="font-semibold">Consejo</p>
                    <p className="mt-1 text-sm text-[#7A7068]">
                      En el despliegue real, aqui conectaremos QR unico por evento y tracking de accesos.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {section === "settings" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                  <h2 className="font-bold">Ajustes del evento</h2>
                  <div className="mt-4 space-y-3">
                    {[
                      {
                        title: "Matching en vivo",
                        description: "Permite descubrir asistentes durante todo el evento",
                        enabled: true
                      },
                      {
                        title: "Compartir zona",
                        description: "Solo zonas generales, nunca posicion exacta",
                        enabled: true
                      },
                      {
                        title: "Modo networking",
                        description: "Destacar perfiles con objetivo profesional",
                        enabled: true
                      }
                    ].map((setting) => (
                      <div key={setting.title} className="flex items-center gap-4 rounded-[24px] border border-[#EDE8E0] p-4">
                        <div
                          className={`h-3 w-3 rounded-full ${setting.enabled ? "bg-[#4ADE80]" : "bg-[#B8AFA4]"}`}
                        />
                        <div className="flex-1">
                          <p className="font-semibold">{setting.title}</p>
                          <p className="text-sm text-[#7A7068]">{setting.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[#B8AFA4]" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[28px] border border-[#EDE8E0] bg-white p-5 shadow-sm">
                  <h2 className="font-bold">Siguiente paso recomendado</h2>
                  <div className="mt-4 rounded-[24px] border border-[#FF5A5F]/20 bg-[#FF5A5F]/5 p-5">
                    <p className="font-semibold text-[#FF5A5F]">Conectar Supabase</p>
                    <p className="mt-2 text-sm text-[#7A7068]">
                      Esta demo ya esta preparada para migrar la logica hardcodeada a perfiles, swipes,
                      matches y chat en tiempo real sin rehacer la UX.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
