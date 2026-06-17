"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ImagePlus, Info, MessageSquareReply, Send, Shield, Users, X } from "lucide-react";
import {
  fetchConversation,
  fetchEventDetail,
  markConversationAsRead,
  sendConversationMessage,
  subscribeToMobileStream,
  updateConversationCover
} from "@/lib/mobile-api";
import { formatMobileDateTime, formatMobileTime } from "@/lib/mobile-shared";
import { uploadManagedMediaFromClient } from "@/lib/tindereo-api";
import type { MobileConversationDetail, MobileEventDetail, MobileMessage, MobileProfile } from "@/lib/mobile-types";
import { EventInfoSheet } from "@/components/mobile/mobile-event-sheet";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function ProfileDot({ profile }: { profile: MobileProfile | undefined }) {
  if (profile?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatarUrl} alt={`@${profile.handle}`} className="h-8 w-8 rounded-full object-cover" />
    );
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[11px] font-semibold text-[var(--text-main)]">
      {(profile?.handle ?? "?").slice(0, 2).toUpperCase()}
    </span>
  );
}

function ConversationAvatar({
  src,
  label
}: {
  src: string | null;
  label: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} className="h-11 w-11 rounded-full object-cover shadow-sm" />
    );
  }

  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-soft)] text-sm font-semibold text-[var(--text-main)] shadow-sm">
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}

type ConversationScreenProps = {
  initialConversation: MobileConversationDetail;
  initialEvent?: MobileEventDetail | null;
};

export function MobileConversationScreen({
  initialConversation,
  initialEvent = null
}: ConversationScreenProps) {
  const [conversation, setConversation] = useState(initialConversation);
  const [eventDetail, setEventDetail] = useState(initialEvent);
  const [draft, setDraft] = useState("");
  const [replyRoot, setReplyRoot] = useState<MobileMessage | null>(null);
  const [pendingMessages, setPendingMessages] = useState<MobileMessage[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [threadRoot, setThreadRoot] = useState<MobileMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [updatingConversationAvatar, setUpdatingConversationAvatar] = useState(false);
  const participantsById = useMemo(
    () => new Map(conversation.participants.map((participant) => [participant.id, participant])),
    [conversation.participants]
  );
  const messages = useMemo(
    () => [...conversation.messages, ...pendingMessages].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [conversation.messages, pendingMessages]
  );
  const rootMessages = useMemo(
    () => messages.filter((message) => !message.threadRootId),
    [messages]
  );
  const threadMessages = useMemo(
    () => messages.filter((message) => message.threadRootId === threadRoot?.id),
    [messages, threadRoot]
  );
  const viewer = participantsById.get(conversation.viewerId);
  const conversationAvatarLabel = conversation.summary.title.replace(/^@/, "") || "Chat";
  const canWrite =
    !eventDetail ||
    eventDetail.event.chatMode === "open" ||
    eventDetail.event.hostId === conversation.viewerId ||
    eventDetail.cohosts.some((cohost) => cohost.id === conversation.viewerId);

  async function refreshConversation() {
    const nextConversation = await fetchConversation(conversation.summary.id);
    setConversation(nextConversation);
  }

  async function refreshEvent() {
    if (!conversation.summary.eventSlug) {
      return;
    }

    const nextEventDetail = await fetchEventDetail(conversation.summary.eventSlug);
    setEventDetail(nextEventDetail);
  }

  useEffect(() => {
    void markConversationAsRead(conversation.summary.id).catch(() => undefined);
  }, [conversation.summary.id]);

  useEffect(() => {
    const unsubscribe = subscribeToMobileStream((event) => {
      if (event.type === "conversation" && event.conversationId === conversation.summary.id) {
        void refreshConversation();
        void markConversationAsRead(conversation.summary.id).catch(() => undefined);
      }
      if (event.type === "event" && conversation.summary.eventId && event.eventId === conversation.summary.eventId) {
        void refreshEvent();
      }
    });

    return unsubscribe;
  }, [conversation.summary.eventId, conversation.summary.id, conversation.summary.eventSlug]);

  async function handleSendMedia(file: File) {
    setSending(true);
    try {
      const uploaded = await uploadManagedMediaFromClient(file, "chat");
      const optimisticId = `pending-${Date.now()}`;
      const optimistic: MobileMessage = {
        id: optimisticId,
        conversationId: conversation.summary.id,
        authorId: viewer?.id ?? null,
        body: file.name,
        kind: "media",
        createdAt: new Date().toISOString(),
        threadRootId: replyRoot?.id ?? null,
        media: {
          id: optimisticId,
          ownerId: viewer?.id ?? "",
          storageRef: uploaded.assetRef,
          previewUrl: uploaded.previewUrl,
          mimeType: file.type || "image/jpeg",
          purpose: "chat",
          createdAt: new Date().toISOString(),
          expiresAt: null
        },
        deletedAt: null,
        deletedForEveryone: false,
        ephemeralExpiresAt: null,
        deliveryStatus: "sending",
        receipts: []
      };
      setPendingMessages((current) => [...current, optimistic]);
      await sendConversationMessage(conversation.summary.id, {
        body: "",
        threadRootId: replyRoot?.id ?? null,
        media: {
          assetRef: uploaded.assetRef,
          previewUrl: uploaded.previewUrl,
          mimeType: file.type || "image/jpeg"
        }
      });
      setPendingMessages((current) => current.filter((message) => message.id !== optimisticId));
      setReplyRoot(null);
      await refreshConversation();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-[var(--bg-main)]">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--line-soft)] bg-[rgba(246,239,231,0.94)] px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl">
          <Link
            href={conversation.summary.eventSlug ? "/eventos" : "/chats"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {conversation.summary.kind === "group" ? (
            <label className="relative block cursor-pointer">
              <ConversationAvatar src={conversation.summary.avatarUrl} label={conversationAvatarLabel} />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--coral)] text-[10px] font-bold text-white shadow-sm">
                +
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={updatingConversationAvatar}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }

                  setUpdatingConversationAvatar(true);
                  try {
                    const upload = await uploadManagedMediaFromClient(file, "avatar");
                    const next = await updateConversationCover(conversation.summary.id, upload.assetRef);
                    setConversation((current) => ({
                      ...current,
                      summary: {
                        ...current.summary,
                        avatarUrl: next.avatarUrl
                      }
                    }));
                  } finally {
                    setUpdatingConversationAvatar(false);
                    event.currentTarget.value = "";
                  }
                }}
              />
            </label>
          ) : (
            <ConversationAvatar src={conversation.summary.avatarUrl} label={conversationAvatarLabel} />
          )}
          <div className="min-w-0 flex-1">
            <button type="button" onClick={() => setInfoOpen(true)} className="w-full text-left">
              <div className="truncate text-lg font-black tracking-[-0.03em]">{conversation.summary.title}</div>
              <div className="truncate text-sm text-[var(--text-soft)]">{conversation.summary.subtitle}</div>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm"
          >
            {conversation.summary.eventId ? <Info className="h-5 w-5" /> : <Users className="h-5 w-5" />}
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5 pb-36">
          {rootMessages.map((message) => {
            const author = message.authorId ? participantsById.get(message.authorId) : undefined;
            const mine = message.authorId === conversation.viewerId;
            const replies = messages.filter((item) => item.threadRootId === message.id);
            return (
              <article
                key={message.id}
                className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}
              >
                {!mine ? <ProfileDot profile={author} /> : null}
                <div className={cn("max-w-[78%]", mine && "items-end")}>
                  {!mine && author && conversation.summary.kind !== "direct" ? (
                    <Link href={`/perfil/${author.handle}`} className="mb-1 block text-xs font-semibold text-[var(--coral)]">
                      @{author.handle}
                    </Link>
                  ) : null}
                  <div
                    className={cn(
                      "rounded-[1.6rem] px-4 py-3 shadow-sm",
                      mine
                        ? "bg-[rgba(202,255,185,0.88)] text-[var(--text-main)]"
                        : "border border-[var(--line-soft)] bg-white"
                    )}
                  >
                    {message.media?.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.media.previewUrl}
                        alt={message.body || "media"}
                        className="mb-3 max-h-72 w-full rounded-2xl object-cover"
                      />
                    ) : null}
                    {message.body ? <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p> : null}
                    <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-[var(--text-soft)]">
                      <span>{formatMobileTime(message.createdAt)}</span>
                      {mine ? <span>{message.deliveryStatus === "read" ? "✓✓" : message.deliveryStatus === "delivered" ? "✓✓" : "✓"}</span> : null}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 px-2 text-xs text-[var(--text-soft)]">
                    <button type="button" onClick={() => setReplyRoot(message)} className="inline-flex items-center gap-1">
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      Responder
                    </button>
                    {replies.length > 0 ? (
                      <button type="button" onClick={() => setThreadRoot(message)} className="inline-flex items-center gap-1 font-semibold text-[var(--coral)]">
                        {replies.length} respuestas
                      </button>
                    ) : null}
                  </div>
                </div>
                {mine ? <ProfileDot profile={author ?? viewer} /> : null}
              </article>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-1/2 z-30 flex w-full max-w-[480px] -translate-x-1/2 items-end gap-2 border-t border-[var(--line-soft)] bg-[rgba(246,239,231,0.96)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
          <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--line-soft)] bg-white">
            <ImagePlus className="h-5 w-5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleSendMedia(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>
          <div className="min-w-0 flex-1 rounded-[1.6rem] border border-[var(--line-warm)] bg-white px-4 py-3">
            {replyRoot ? (
              <div className="mb-2 flex items-center justify-between rounded-2xl bg-[var(--bg-soft)] px-3 py-2 text-xs text-[var(--text-soft)]">
                <span className="truncate">
                  Respondiendo a: {replyRoot.body || "mensaje"}
                </span>
                <button type="button" onClick={() => setReplyRoot(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={canWrite ? "Escribe aquí..." : "Este chat está en modo anuncios"}
              disabled={!canWrite || sending}
              className="max-h-32 min-h-6 w-full resize-none border-0 bg-transparent p-0 text-base outline-none placeholder:text-[var(--text-soft)]"
            />
          </div>
          <button
            type="button"
            disabled={sending || (!draft.trim() && !replyRoot) || !canWrite}
            onClick={async () => {
              if (!draft.trim()) {
                return;
              }
              const optimisticId = `pending-${Date.now()}`;
              const optimistic: MobileMessage = {
                id: optimisticId,
                conversationId: conversation.summary.id,
                authorId: viewer?.id ?? null,
                body: draft,
                kind: "text",
                createdAt: new Date().toISOString(),
                threadRootId: replyRoot?.id ?? null,
                media: null,
                deletedAt: null,
                deletedForEveryone: false,
                ephemeralExpiresAt: null,
                deliveryStatus: "sending",
                receipts: []
              };
              setDraft("");
              setPendingMessages((current) => [...current, optimistic]);
              setSending(true);
              try {
                await sendConversationMessage(conversation.summary.id, {
                  body: optimistic.body,
                  threadRootId: replyRoot?.id ?? null
                });
                setPendingMessages((current) => current.filter((message) => message.id !== optimisticId));
                setReplyRoot(null);
                await refreshConversation();
              } catch {
                setPendingMessages((current) =>
                  current.map((message) =>
                    message.id === optimisticId
                      ? { ...message, deliveryStatus: "failed" }
                      : message
                  )
                );
              } finally {
                setSending(false);
              }
            }}
            className="flex h-12 w-12 shrink-0 self-end items-center justify-center rounded-full bg-[var(--text-main)] text-white disabled:opacity-50"
            aria-label="Enviar mensaje"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>

      {threadRoot ? (
        <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setThreadRoot(null)}>
          <div
            className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-black tracking-[-0.03em]">Hilo del mensaje</div>
              <button type="button" onClick={() => setThreadRoot(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-[1.4rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Raíz</div>
                <p className="mt-2 text-sm leading-6">{threadRoot.body || "Mensaje"}</p>
              </div>
              {threadMessages.map((message) => {
                const author = message.authorId ? participantsById.get(message.authorId) : undefined;
                return (
                  <div key={message.id} className="rounded-[1.4rem] border border-[var(--line-soft)] px-4 py-3">
                    <div className="mb-1 text-xs font-semibold text-[var(--coral)]">
                      {author ? `@${author.handle}` : "Sistema"}
                    </div>
                    <p className="text-sm leading-6">{message.body}</p>
                    <div className="mt-2 text-xs text-[var(--text-soft)]">{formatMobileDateTime(message.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {infoOpen ? (
        <EventInfoSheet
          conversation={conversation}
          eventDetail={eventDetail}
          onClose={() => setInfoOpen(false)}
          onRefresh={async () => {
            await refreshConversation();
            await refreshEvent();
          }}
        />
      ) : null}
    </>
  );
}
