"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart } from "lucide-react";
import { fetchNotifications, markNotificationsRead, respondToFollowRequest, subscribeToMobileStream } from "@/lib/mobile-api";
import { formatRelativeMobileTime } from "@/lib/mobile-shared";
import type { MobileNotification } from "@/lib/mobile-types";

export function MobileNotificationsScreen({ initialNotifications }: { initialNotifications: MobileNotification[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

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

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-[var(--bg-main)] px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <Link href="/inicio" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">Actividad</div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm text-[var(--coral)]">
          <Heart className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {notifications.length ? (
          notifications.map((notification) => {
            const requestId = typeof notification.data.requestId === "string" ? notification.data.requestId : null;
            const isFollowRequest = notification.kind === "follow-request" && requestId;

            return (
              <div key={notification.id} className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 shadow-sm">
                <button type="button" onClick={() => openNotification(notification)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{notification.title}</div>
                      <div className="mt-1 text-sm leading-6 text-[var(--text-soft)]">{notification.body}</div>
                    </div>
                    <div className="shrink-0 text-xs text-[var(--text-soft)]">{formatRelativeMobileTime(notification.createdAt)}</div>
                  </div>
                </button>

                {isFollowRequest ? (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={busyRequestId === requestId}
                      onClick={async () => {
                        setBusyRequestId(requestId);
                        try {
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
                          await respondToFollowRequest(requestId, false);
                          await refresh();
                        } finally {
                          setBusyRequestId(null);
                        }
                      }}
                      className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      Rechazar
                    </button>
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
  );
}
