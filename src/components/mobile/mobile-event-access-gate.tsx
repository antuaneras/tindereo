"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Lock, Send, Users } from "lucide-react";
import { joinEvent, respondToEventInvite } from "@/lib/mobile-api";
import { formatMobileDateTime } from "@/lib/mobile-shared";
import type { MobileEventDetail } from "@/lib/mobile-types";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function MobileEventAccessGate({ initialDetail }: { initialDetail: MobileEventDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [invitePending, setInvitePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(initialDetail.myMembership?.status ?? null);
  const [localInviteStatus, setLocalInviteStatus] = useState(initialDetail.myInvite?.status ?? null);

  const status = localStatus ?? initialDetail.myMembership?.status ?? null;
  const inviteStatus = localInviteStatus ?? initialDetail.myInvite?.status ?? null;
  const statusCopy = useMemo(() => {
    if (status === "pending") {
      return {
        title: "Tu acceso esta pendiente",
        body: "El creador o staff del evento tiene que aprobarte antes de abrir el chat."
      };
    }
    if (status === "waitlisted") {
      return {
        title: "Estas en lista de espera",
        body: "En cuanto se libere un hueco o el staff te suba, entraras al grupo principal."
      };
    }
    if (inviteStatus === "pending") {
      return {
        title: "Tienes una invitacion directa",
        body: "Si aceptas, entraras al evento en un toque y se abrira el chat directamente."
      };
    }
    if (status === "rejected") {
      return {
        title: "Solicitud rechazada",
        body: "Ahora mismo no tienes acceso al chat de este evento."
      };
    }
    return {
      title: "Todavia no estas dentro",
      body: "Cuando entres al evento, este espacio se convierte en el chat principal a pantalla completa."
    };
  }, [status]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col px-4 pb-8 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Link href="/eventos" className="mb-5 inline-flex w-fit rounded-full bg-white px-4 py-3 text-sm font-semibold shadow-sm">
        Volver
      </Link>

      <section className="rounded-[2rem] border border-[var(--line-soft)] bg-white/92 p-6 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
              {initialDetail.event.visibility === "private" ? "Evento privado" : "Evento publico"}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em]">{initialDetail.event.title}</h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(255,107,87,0.12)] text-[var(--coral)]">
            {initialDetail.event.visibility === "private" ? <Lock className="h-5 w-5" /> : <Users className="h-5 w-5" />}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">{initialDetail.event.summary}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-soft)]">Empieza</div>
            <div className="mt-2 text-sm font-semibold">{formatMobileDateTime(initialDetail.event.startsAt)}</div>
          </div>
          <div className="rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-soft)]">Confirmados</div>
            <div className="mt-2 text-sm font-semibold">
              {initialDetail.event.approvedCount} / {initialDetail.event.capacity}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
            <Clock3 className="h-4 w-4" />
            Estado
          </div>
          <div className="mt-3 text-base font-bold">{statusCopy.title}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{statusCopy.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {status ? (
              <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--text-main)]">
                {status === "pending"
                  ? "Pendiente"
                  : status === "waitlisted"
                    ? "Lista de espera"
                    : status === "rejected"
                      ? "Rechazado"
                      : "Dentro"}
              </span>
            ) : null}
            {inviteStatus === "pending" ? (
              <span className="rounded-full bg-[rgba(255,107,87,0.1)] px-3 py-2 text-xs font-semibold text-[var(--coral)]">
                Invitacion directa
              </span>
            ) : null}
            {initialDetail.event.visibility === "private" ? (
              <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--text-soft)]">
                Evento privado
              </span>
            ) : null}
          </div>
        </div>

        {inviteStatus === "pending" && initialDetail.myInvite ? (
          <div className="mt-5 rounded-[1.6rem] border border-[rgba(255,107,87,0.16)] bg-[rgba(255,107,87,0.06)] px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--coral)]">
                <Send className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  @{initialDetail.myInvite.fromProfile.handle} te ha invitado personalmente
                </div>
                <div className="mt-1 text-sm text-[var(--text-soft)]">
                  Puedes aceptar en un toque o rechazarla sin entrar en la cola.
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={invitePending}
                onClick={async () => {
                  setInvitePending(true);
                  setError(null);
                  try {
                    await respondToEventInvite(initialDetail.myInvite!.id, true);
                    setLocalInviteStatus("accepted");
                    setLocalStatus("approved");
                    router.push(`/evento/${initialDetail.event.slug}`);
                  } catch (inviteError) {
                    setError(inviteError instanceof Error ? inviteError.message : "No se pudo aceptar la invitacion.");
                  } finally {
                    setInvitePending(false);
                  }
                }}
                className="tindereo-gradient flex-1 rounded-[1.4rem] px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
              >
                {invitePending ? "Entrando..." : "Aceptar invitacion"}
              </button>
              <button
                type="button"
                disabled={invitePending}
                onClick={async () => {
                  setInvitePending(true);
                  setError(null);
                  try {
                    await respondToEventInvite(initialDetail.myInvite!.id, false);
                    setLocalInviteStatus("rejected");
                    router.refresh();
                  } catch (inviteError) {
                    setError(inviteError instanceof Error ? inviteError.message : "No se pudo rechazar la invitacion.");
                  } finally {
                    setInvitePending(false);
                  }
                }}
                className="rounded-[1.4rem] border border-[var(--line-warm)] px-4 py-3 text-sm font-semibold disabled:opacity-70"
              >
                Rechazar
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-[#b84031]">{error}</p> : null}

        {!status && inviteStatus !== "pending" || status === "rejected" ? (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                const response = await joinEvent(initialDetail.event.slug);
                setLocalStatus(response.membership?.status ?? "pending");
                router.refresh();
              } catch (joinError) {
                setError(joinError instanceof Error ? joinError.message : "No se pudo pedir acceso.");
              } finally {
                setPending(false);
              }
            }}
            className={cn(
              "tindereo-gradient mt-5 w-full rounded-[1.6rem] px-4 py-4 text-base font-bold text-white",
              pending && "opacity-70"
            )}
          >
            {pending
              ? "Pidiendo acceso..."
              : initialDetail.event.visibility === "private"
                ? "Solicitar acceso"
                : "Entrar al evento"}
          </button>
        ) : null}

        {status === "pending" ? (
          <div className="mt-4 rounded-[1.4rem] border border-dashed border-[var(--line-warm)] px-4 py-4 text-sm text-[var(--text-soft)]">
            En cuanto el creador o un coorganizador te acepte, el evento aparecera en tus grupos y podras entrar al chat.
          </div>
        ) : null}

        {status === "waitlisted" ? (
          <div className="mt-4 rounded-[1.4rem] border border-dashed border-[var(--line-warm)] px-4 py-4 text-sm text-[var(--text-soft)]">
            Si alguien cancela o el staff libera una plaza, subiras automaticamente desde la lista de espera.
          </div>
        ) : null}
      </section>
    </main>
  );
}
