"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, X } from "lucide-react";
import {
  clearNotifications,
  deleteNotification,
  fetchNotifications,
  markNotificationsRead,
  respondToConversationRequest,
  respondToFollowRequest,
  subscribeToMobileStream
} from "@/lib/mobile-api";
import { formatRelativeMobileTime } from "@/lib/mobile-shared";
import type { MobileNotification } from "@/lib/mobile-types";

type NotificationCard = {
  id: string;
  ids: string[];
  notification: MobileNotification;
  title: string;
  body: string;
  createdAt: string;
  count: number;
};

function extractActorHandle(notification: MobileNotification) {
  const actorHandle = typeof notification.data.actorHandle === "string" ? notification.data.actorHandle.trim() : "";
  if (actorHandle) {
    return actorHandle.startsWith("@") ? actorHandle : `@${actorHandle}`;
  }

  const requesterHandle =
    typeof notification.data.requesterHandle === "string" ? notification.data.requesterHandle.trim() : "";
  if (requesterHandle) {
    return requesterHandle.startsWith("@") ? requesterHandle : `@${requesterHandle}`;
  }

  if (notification.title.startsWith("@")) {
    return notification.title.split(" ")[0] ?? "";
  }

  return "";
}

function buildNotificationCards(notifications: MobileNotification[]) {
  const groups = new Map<string, MobileNotification[]>();

  for (const notification of notifications) {
    const requestId = typeof notification.data.requestId === "string" ? notification.data.requestId : null;
    const conversationId = typeof notification.data.conversationId === "string" ? notification.data.conversationId : null;
    const postId = typeof notification.data.postId === "string" ? notification.data.postId : null;
    const storyId = typeof notification.data.storyId === "string" ? notification.data.storyId : null;

    const key =
      notification.kind === "follow-request" || notification.kind === "chat-request" || requestId
        ? notification.id
        : notification.kind === "post-like" && (postId || notification.entityId)
          ? `post-like:${postId ?? notification.entityId}`
          : notification.kind === "mention" && (postId || notification.entityId)
            ? `mention:${postId ?? notification.entityId}`
            : notification.kind === "message" && (conversationId || notification.entityId)
              ? `message:${conversationId ?? notification.entityId}`
              : (notification.kind === "story-reaction" || notification.kind === "story-reply") && storyId
                ? `${notification.kind}:${storyId}`
                : notification.id;

    const current = groups.get(key) ?? [];
    current.push(notification);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group): NotificationCard => {
      const ordered = [...group].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const representative = ordered[0]!;
      const actorHandles = [...new Set(ordered.map(extractActorHandle).filter(Boolean))];
      const actorLead = actorHandles[0] ?? "Alguien";
      const others = Math.max(0, ordered.length - 1);

      let title = representative.title;
      let body = representative.body;

      if (representative.kind === "post-like") {
        title = others > 0 ? `${actorLead} y ${others} mas dieron like a tu publicacion` : `${actorLead} le ha dado like a tu publicacion`;
        body = others > 0 ? "Tu publicacion esta generando interaccion." : "Tu publicacion ha recibido un nuevo like.";
      } else if (representative.kind === "mention") {
        title = others > 0 ? `${actorLead} y ${others} mas comentaron tu publicacion` : `${actorLead} comento tu publicacion`;
        body = representative.body;
      } else if (representative.kind === "message") {
        title = ordered.length > 1 ? `${ordered.length} mensajes nuevos` : representative.title;
        body = representative.body;
      } else if (representative.kind === "story-reaction") {
        title = others > 0 ? `${actorLead} y ${others} mas reaccionaron a tu historia` : "Nueva reaccion a una historia";
      } else if (representative.kind === "story-reply") {
        title = others > 0 ? `${actorLead} y ${others} mas respondieron a tu historia` : "Nueva respuesta a una historia";
      }

      return {
        id: representative.id,
        ids: ordered.map((notification) => notification.id),
        notification: representative,
        title,
        body,
        createdAt: representative.createdAt,
        count: ordered.length
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function MobileNotificationsScreen({ initialNotifications }: { initialNotifications: MobileNotification[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ mode: "single"; notificationIds: string[] } | { mode: "all" } | null>(null);
  const [deleteBusyKey, setDeleteBusyKey] = useState<string | "all" | null>(null);
  const notificationCards = useMemo(() => buildNotificationCards(notifications), [notifications]);

  async function refresh() {
    const payload = await fetchNotifications();
    setNotifications(payload.notifications);
  }

  useEffect(() => {
    void markNotificationsRead().catch(() => undefined);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMobileStream((event) => {
      if (event.type === "notifications" || event.type === "profile" || event.type === "bootstrap") {
        void refresh().catch(() => undefined);
      }
    });

    return unsubscribe;
  }, []);

  function openNotification(notification: MobileNotification) {
    const eventSlug = typeof notification.data.eventSlug === "string" ? notification.data.eventSlug : null;
    const targetHandle = typeof notification.data.targetHandle === "string" ? notification.data.targetHandle : null;
    const requesterHandle = typeof notification.data.requesterHandle === "string" ? notification.data.requesterHandle : null;
    const conversationId = typeof notification.data.conversationId === "string" ? notification.data.conversationId : null;

    if (eventSlug) {
      router.push(`/evento/${eventSlug}`);
      return;
    }
    if (targetHandle) {
      router.push(`/perfil/${targetHandle}`);
      return;
    }
    if (requesterHandle) {
      router.push(`/perfil/${requesterHandle}`);
      return;
    }
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
      return;
    }
    if (notification.entityType === "post" || notification.kind === "post-like" || notification.kind === "mention") {
      router.push("/perfil");
      return;
    }
    if (notification.kind === "story-reaction" || notification.kind === "story-reply") {
      router.push("/perfil");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteBusyKey) {
      return;
    }

    const previous = notifications;
    const busyKey = deleteTarget.mode === "all" ? "all" : deleteTarget.notificationIds[0] ?? "all";
    setDeleteBusyKey(busyKey);

    if (deleteTarget.mode === "all") {
      setNotifications([]);
    } else {
      const idsToDelete = new Set(deleteTarget.notificationIds);
      setNotifications((current) => current.filter((notification) => !idsToDelete.has(notification.id)));
    }

    try {
      if (deleteTarget.mode === "all") {
        await clearNotifications();
      } else {
        await Promise.all(deleteTarget.notificationIds.map((notificationId) => deleteNotification(notificationId)));
      }
      setDeleteTarget(null);
    } catch {
      setNotifications(previous);
    } finally {
      setDeleteBusyKey(null);
    }
  }

  return (
    <>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-[var(--bg-main)] px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <Link href="/inicio" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">Actividad</div>
          <button
            type="button"
            disabled={!notificationCards.length || deleteBusyKey === "all"}
            onClick={() => setDeleteTarget({ mode: "all" })}
            className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            Borrar todo
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {notificationCards.length ? (
            notificationCards.map((card) => {
              const notification = card.notification;
              const requestId = typeof notification.data.requestId === "string" ? notification.data.requestId : null;
              const isFollowRequest = notification.kind === "follow-request" && requestId;
              const isChatRequest = notification.kind === "chat-request" && requestId;

              return (
                <div key={card.id} className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => openNotification(notification)} className="min-w-0 flex-1 text-left">
                      <div className="text-sm font-semibold">{card.title}</div>
                      <div className="mt-1 text-sm leading-6 text-[var(--text-soft)]">{card.body}</div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-soft)]">
                        <span>{formatRelativeMobileTime(card.createdAt)}</span>
                        {card.count > 1 ? (
                          <span className="rounded-full bg-[var(--bg-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--coral)]">
                            {card.count}
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={deleteBusyKey === card.ids[0]}
                      onClick={() => setDeleteTarget({ mode: "single", notificationIds: card.ids })}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[var(--text-soft)] disabled:opacity-50"
                      aria-label="Borrar notificacion"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {isFollowRequest || isChatRequest ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyRequestId === requestId}
                        onClick={async () => {
                          setBusyRequestId(requestId);
                          try {
                            if (isChatRequest) {
                              const response = await respondToConversationRequest(requestId, true);
                              await refresh();
                              if (response.conversationId) {
                                router.push(`/chat/${response.conversationId}`);
                              }
                              return;
                            }

                            await respondToFollowRequest(requestId, true);
                            await refresh();
                          } finally {
                            setBusyRequestId(null);
                          }
                        }}
                        className="rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        disabled={busyRequestId === requestId}
                        onClick={async () => {
                          setBusyRequestId(requestId);
                          try {
                            if (isChatRequest) {
                              await respondToConversationRequest(requestId, false);
                            } else {
                              await respondToFollowRequest(requestId, false);
                            }
                            await refresh();
                          } finally {
                            setBusyRequestId(null);
                          }
                        }}
                        className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                      {isChatRequest ? (
                        <button
                          type="button"
                          disabled={busyRequestId === requestId}
                          onClick={async () => {
                            setBusyRequestId(requestId);
                            try {
                              await respondToConversationRequest(requestId, false, { block: true });
                              await refresh();
                            } finally {
                              setBusyRequestId(null);
                            }
                          }}
                          className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold text-[var(--coral)] disabled:opacity-60"
                        >
                          Bloquear
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-10 text-center text-sm text-[var(--text-soft)]">
              Cuando te sigan, te pidan acceso o pase algo importante, te aparecera aqui.
            </div>
          )}
        </div>
      </div>
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 bg-black/30 px-4" onClick={() => setDeleteTarget(null)}>
          <div className="flex min-h-full items-end justify-center py-6">
            <div
              className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-[0_24px_80px_rgba(27,19,10,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-soft)] text-[var(--coral)]">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-semibold text-[var(--text-main)]">
                    {deleteTarget.mode === "all" ? "Borrar toda la actividad" : "Borrar esta notificacion"}
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-soft)]">
                    Solo desaparecera de tu actividad.
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-full border border-[var(--line-warm)] px-4 py-3 text-sm font-semibold text-[var(--text-main)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={Boolean(deleteBusyKey)}
                  onClick={() => void handleConfirmDelete()}
                  className="flex-1 rounded-full bg-[var(--text-main)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {deleteBusyKey ? "Borrando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
