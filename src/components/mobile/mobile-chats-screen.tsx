"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreHorizontal, Pin, PinOff, Plus, Search, Trash2, Users } from "lucide-react";
import {
  createConversation,
  deleteConversationFromList,
  fetchConversations,
  searchMobile,
  subscribeToMobileStream,
  updateConversationState
} from "@/lib/mobile-api";
import { formatRelativeMobileTime } from "@/lib/mobile-shared";
import type { MobileConversationSummary, MobileProfile } from "@/lib/mobile-types";

const CHATS_CACHE_KEY = "mobile-cache:chats";

type MobileChatTab = "events" | "people";

function readChatsCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(CHATS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as MobileConversationSummary[]) : null;
  } catch {
    return null;
  }
}

function writeChatsCache(chats: MobileConversationSummary[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(chats));
}

function sortChats(chats: MobileConversationSummary[]) {
  return [...chats].sort((left, right) => {
    if (left.isPinned !== right.isPinned) {
      return left.isPinned ? -1 : 1;
    }

    return (right.lastMessageAt ?? "").localeCompare(left.lastMessageAt ?? "");
  });
}

export function MobileChatsScreen({ initialChats }: { initialChats?: MobileConversationSummary[] | null }) {
  const router = useRouter();
  const [chats, setChats] = useState<MobileConversationSummary[]>(() => initialChats ?? []);
  const [activeTab, setActiveTab] = useState<MobileChatTab>("events");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MobileProfile[]>([]);
  const [menuChat, setMenuChat] = useState<MobileConversationSummary | null>(null);
  const [archiveOpen, setArchiveOpen] = useState<Record<MobileChatTab, boolean>>({
    events: false,
    people: false
  });
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (initialChats?.length) {
      writeChatsCache(initialChats);
      return;
    }

    const cached = readChatsCache();
    if (cached?.length) {
      setChats(cached);
    }
  }, [initialChats]);

  useEffect(() => {
    void fetchConversations().then(setChats).catch(() => undefined);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMobileStream((event) => {
      if (event.type === "conversation" || event.type === "notifications" || event.type === "bootstrap") {
        void fetchConversations().then(setChats).catch(() => undefined);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    writeChatsCache(chats);
  }, [chats]);

  useEffect(() => {
    if (!pickerOpen || !query.trim()) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const payload = await searchMobile(query);
      setResults(payload.profiles);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [pickerOpen, query]);

  const eventChats = useMemo(() => chats.filter((chat) => chat.kind === "event"), [chats]);
  const peopleChats = useMemo(() => chats.filter((chat) => chat.kind !== "event"), [chats]);
  const visibleChats = activeTab === "events" ? eventChats : peopleChats;
  const activeChats = useMemo(() => sortChats(visibleChats.filter((chat) => !chat.isArchived)), [visibleChats]);
  const archivedChats = useMemo(() => sortChats(visibleChats.filter((chat) => chat.isArchived)), [visibleChats]);

  useEffect(() => {
    if (!eventChats.length && peopleChats.length) {
      setActiveTab("people");
      return;
    }

    if (!peopleChats.length && eventChats.length) {
      setActiveTab("events");
    }
  }, [eventChats.length, peopleChats.length]);

  async function syncConversations() {
    const next = await fetchConversations();
    setChats(next);
  }

  async function handleTogglePinned(chat: MobileConversationSummary) {
    const nextPinned = !chat.isPinned;
    setActionBusyId(`${chat.id}:pin`);
    setChats((current) =>
      current.map((item) => (item.id === chat.id ? { ...item, isPinned: nextPinned } : item))
    );

    try {
      await updateConversationState(chat.id, { pinned: nextPinned });
      await syncConversations();
    } catch {
      await syncConversations().catch(() => undefined);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleToggleArchived(chat: MobileConversationSummary) {
    const nextArchived = !chat.isArchived;
    setActionBusyId(`${chat.id}:archive`);
    setChats((current) =>
      current.map((item) => (item.id === chat.id ? { ...item, isArchived: nextArchived, isPinned: nextArchived ? false : item.isPinned } : item))
    );

    try {
      await updateConversationState(chat.id, { archived: nextArchived, pinned: nextArchived ? false : undefined });
      await syncConversations();
    } catch {
      await syncConversations().catch(() => undefined);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDelete(chat: MobileConversationSummary) {
    setActionBusyId(`${chat.id}:delete`);
    setChats((current) => current.filter((item) => item.id !== chat.id));

    try {
      await deleteConversationFromList(chat.id);
      await syncConversations();
    } catch {
      await syncConversations().catch(() => undefined);
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
            Chats
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <section className="space-y-3">
          <div className="inline-flex rounded-full bg-white/92 p-1 shadow-sm">
            {[
              { id: "events", label: "Eventos" },
              { id: "people", label: "Personas" }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as MobileChatTab)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id ? "bg-[var(--text-main)] text-white" : "text-[var(--text-soft)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeChats.map((chat) => (
            <div
              key={chat.id}
              className="flex items-center gap-3 rounded-[2rem] border border-[var(--line-soft)] bg-white/92 px-4 py-4 shadow-[0_18px_40px_rgba(29,22,15,0.06)]"
            >
              <button
                type="button"
                onClick={() => router.push(chat.eventSlug ? `/evento/${chat.eventSlug}` : `/chat/${chat.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                {chat.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={chat.avatarUrl} alt={chat.title} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-soft)]">
                    <Users className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold">{chat.title}</div>
                    {chat.isPinned ? <Pin className="h-3.5 w-3.5 text-[var(--coral)]" /> : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-[var(--text-soft)]">{chat.lastMessagePreview}</div>
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <div className="text-xs text-[var(--text-soft)]">
                    {chat.lastMessageAt ? formatRelativeMobileTime(chat.lastMessageAt) : ""}
                  </div>
                  {chat.unreadCount > 0 ? (
                    <div className="mt-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[var(--coral)] px-1.5 text-[10px] font-semibold text-white">
                      {chat.unreadCount}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setMenuChat(chat)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[var(--text-soft)]"
                  aria-label={`Opciones de ${chat.title}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {archivedChats.length ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() =>
                  setArchiveOpen((current) => ({
                    ...current,
                    [activeTab]: !current[activeTab]
                  }))
                }
                className="inline-flex rounded-full border border-[var(--line-warm)] bg-white/88 px-4 py-2 text-sm font-semibold text-[var(--text-soft)]"
              >
                Archivados ({archivedChats.length})
              </button>

              {archiveOpen[activeTab]
                ? archivedChats.map((chat) => (
                    <div
                      key={`${chat.id}-archived`}
                      className="flex items-center gap-3 rounded-[2rem] border border-[var(--line-soft)] bg-white/70 px-4 py-4 opacity-90 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(chat.eventSlug ? `/evento/${chat.eventSlug}` : `/chat/${chat.id}`)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        {chat.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={chat.avatarUrl} alt={chat.title} className="h-12 w-12 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-soft)]">
                            <Users className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold">{chat.title}</div>
                            <Archive className="h-3.5 w-3.5 text-[var(--text-soft)]" />
                          </div>
                          <div className="mt-1 truncate text-xs text-[var(--text-soft)]">{chat.lastMessagePreview}</div>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs text-[var(--text-soft)]">
                            {chat.lastMessageAt ? formatRelativeMobileTime(chat.lastMessageAt) : ""}
                          </div>
                          {chat.unreadCount > 0 ? (
                            <div className="mt-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[var(--coral)] px-1.5 text-[10px] font-semibold text-white">
                              {chat.unreadCount}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMenuChat(chat)}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[var(--text-soft)]"
                          aria-label={`Opciones de ${chat.title}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                : null}
            </div>
          ) : null}

          {!activeChats.length && !archivedChats.length ? (
            <div className="rounded-[2rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
              {activeTab === "events"
                ? "Aun no tienes chats de eventos. Cuando entres en uno, te apareceran aqui."
                : "Aun no tienes chats personales. Puedes abrir uno nuevo desde el +."}
            </div>
          ) : null}
        </section>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setPickerOpen(false)}>
          <div
            className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 text-lg font-black tracking-[-0.03em]">Nuevo chat</div>
            <label className="flex items-center gap-3 rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4">
              <Search className="h-5 w-5 text-[var(--text-soft)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca a alguien"
                className="w-full border-0 bg-transparent text-base outline-none"
              />
            </label>
            <div className="mt-4 space-y-3">
              {results.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={async () => {
                    const created = await createConversation({
                      kind: "direct",
                      title: null,
                      participantIds: [profile.id]
                    });
                    setPickerOpen(false);
                    router.push(`/chat/${created.conversationId}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-[1.6rem] border border-[var(--line-soft)] px-4 py-4 text-left"
                >
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt={`@${profile.handle}`} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-soft)] text-sm font-semibold">
                      {profile.handle.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <div className="text-sm font-semibold">@{profile.handle}</div>
                    <div className="text-xs text-[var(--text-soft)]">{profile.city}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {menuChat ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setMenuChat(null)}>
          <div
            className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-1 text-lg font-black tracking-[-0.03em]">{menuChat.title}</div>
            <div className="mb-4 text-sm text-[var(--text-soft)]">
              Organiza este chat como prefieras.
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={actionBusyId !== null}
                onClick={async () => {
                  const current = menuChat;
                  setMenuChat(null);
                  await handleTogglePinned(current);
                }}
                className="flex w-full items-center gap-3 rounded-[1.4rem] border border-[var(--line-soft)] px-4 py-4 text-left disabled:opacity-60"
              >
                {menuChat.isPinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
                <div>
                  <div className="text-sm font-semibold">{menuChat.isPinned ? "Desfijar" : "Fijar arriba"}</div>
                  <div className="text-xs text-[var(--text-soft)]">Lo muevo en tu lista de chats.</div>
                </div>
              </button>

              <button
                type="button"
                disabled={actionBusyId !== null}
                onClick={async () => {
                  const current = menuChat;
                  setMenuChat(null);
                  await handleToggleArchived(current);
                }}
                className="flex w-full items-center gap-3 rounded-[1.4rem] border border-[var(--line-soft)] px-4 py-4 text-left disabled:opacity-60"
              >
                {menuChat.isArchived ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                <div>
                  <div className="text-sm font-semibold">{menuChat.isArchived ? "Sacar de archivados" : "Archivar"}</div>
                  <div className="text-xs text-[var(--text-soft)]">Solo afecta a tu bandeja.</div>
                </div>
              </button>

              <button
                type="button"
                disabled={actionBusyId !== null}
                onClick={async () => {
                  const current = menuChat;
                  setMenuChat(null);
                  await handleDelete(current);
                }}
                className="flex w-full items-center gap-3 rounded-[1.4rem] border border-[rgba(184,64,49,0.18)] px-4 py-4 text-left text-[#b84031] disabled:opacity-60"
              >
                <Trash2 className="h-5 w-5" />
                <div>
                  <div className="text-sm font-semibold">Borrar de mi lista</div>
                  <div className="text-xs text-[var(--text-soft)]">No borra la conversación para los demás.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
