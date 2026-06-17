"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { createConversation, fetchConversations, searchMobile, subscribeToMobileStream } from "@/lib/mobile-api";
import { formatRelativeMobileTime } from "@/lib/mobile-shared";
import type { MobileConversationSummary, MobileProfile } from "@/lib/mobile-types";

export function MobileChatsScreen({ initialChats }: { initialChats: MobileConversationSummary[] }) {
  const router = useRouter();
  const [chats, setChats] = useState(initialChats);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MobileProfile[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToMobileStream((event) => {
      if (event.type === "conversation" || event.type === "notifications" || event.type === "bootstrap") {
        void fetchConversations().then(setChats).catch(() => undefined);
      }
    });
    return unsubscribe;
  }, []);

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

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
            Chats
          </div>
          <button onClick={() => setPickerOpen(true)} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <section className="space-y-3">
          {chats.map((chat) => (
            <Link key={chat.id} href={chat.eventSlug ? `/evento/${chat.eventSlug}` : `/chat/${chat.id}`} className="flex items-center gap-3 rounded-[2rem] border border-[var(--line-soft)] bg-white/92 px-4 py-4 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
              {chat.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chat.avatarUrl} alt={chat.title} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-soft)]">
                  <Users className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{chat.title}</div>
                <div className="mt-1 truncate text-xs text-[var(--text-soft)]">{chat.lastMessagePreview}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[var(--text-soft)]">{chat.lastMessageAt ? formatRelativeMobileTime(chat.lastMessageAt) : ""}</div>
                {chat.unreadCount > 0 ? (
                  <div className="mt-2 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-[var(--coral)] px-1.5 text-[10px] font-semibold text-white">
                    {chat.unreadCount}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
          {!chats.length ? (
            <div className="rounded-[2rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
              Aún no tienes conversaciones. Abre un evento o empieza un chat directo desde el +.
            </div>
          ) : null}
        </section>
      </div>

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setPickerOpen(false)}>
          <div className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 text-lg font-black tracking-[-0.03em]">Nuevo chat</div>
            <label className="flex items-center gap-3 rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4">
              <Search className="h-5 w-5 text-[var(--text-soft)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca a alguien" className="w-full border-0 bg-transparent text-base outline-none" />
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
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-soft)] text-sm font-semibold">{profile.handle.slice(0, 2).toUpperCase()}</span>
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
    </>
  );
}
