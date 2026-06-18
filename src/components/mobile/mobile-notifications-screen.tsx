"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

export function MobileNotificationsScreen({ initialNotifications }: { initialNotifications: MobileNotification[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ mode: "single"; notificationId: string } | { mode: "all" } | null>(null);
  const [deleteBusyKey, setDeleteBusyKey] = useState<string | "all" | null>(null);

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
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleteBusyKey) {
      return;
    }

    const previous = notifications;
    const busyKey = deleteTarget.mode === "all" ? "all" : deleteTarget.notificationId;
    setDeleteBusyKey(busyKey);

    if (deleteTarget.mode === "all") {
      setNotifications([]);
    } else {
      setNotifications((current) => current.filter((notification) => notification.id !== deleteTarget.notificationId));
    }

    try {
      if (deleteTarget.mode === "all") {
        await clearNotifications();
      } else {
        await deleteNotification(deleteTarget.notificationId);
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
            disabled={!notifications.length || deleteBusyKey === "all"}
            onClick={() => setDeleteTarget({ mode: "all" })}
            className="rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            Borrar todo
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {notifications.length ? (
            notifications.map((notification) => {
              const requestId = typeof notification.data.requestId === "string" ? notification.data.requestId : null;
              const isFollowRequest = notification.kind === "follow-request" && requestId;
              const isChatRequest = notification.kind === "chat-request" && requestId;

              return (
                <div key={notification.id} className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => openNotification(notification)} className="min-w-0 flex-1 text-left">
                      <div className="text-sm font-semibold">{notification.title}</div>
                      <div className="mt-1 text-sm leading-6 text-[var(--text-soft)]">{notification.body}</div>
                      <div className="mt-3 text-xs text-[var(--text-soft)]">{formatRelativeMobileTime(notification.createdAt)}</div>
                    </button>
                    <button
                      type="button"
                      disabled={deleteBusyKey === notification.id}
                      onClick={() => setDeleteTarget({ mode: "single", notificationId: notification.id })}
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
