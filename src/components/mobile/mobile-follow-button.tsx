"use client";

import { useEffect, useState } from "react";
import { cancelFollowRequest, requestFollow, unfollowProfile } from "@/lib/mobile-api";
import type { MobileProfileRelationship } from "@/lib/mobile-types";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function MobileFollowButton({
  handle,
  isPrivate,
  relationship,
  disabled,
  compact,
  onChange
}: {
  handle: string;
  isPrivate: boolean;
  relationship: MobileProfileRelationship;
  disabled?: boolean;
  compact?: boolean;
  onChange?: (next: MobileProfileRelationship) => void;
}) {
  const [current, setCurrent] = useState(relationship);
  const [busy, setBusy] = useState(false);
  const [confirmingUnfollow, setConfirmingUnfollow] = useState(false);

  useEffect(() => {
    setCurrent(relationship);
  }, [relationship]);

  const label = current.followsProfile
    ? "Siguiendo"
    : current.outgoingFollowRequestId
      ? "Solicitado"
      : isPrivate
        ? "Solicitar"
        : "Seguir";

  async function handlePress() {
    if (busy || disabled) {
      return;
    }

    if (current.followsProfile) {
      setConfirmingUnfollow(true);
      return;
    }

    const previous = current;
    setBusy(true);

    try {
      if (current.outgoingFollowRequestId) {
        setCurrent({
          ...current,
          outgoingFollowRequestId: null
        });
        await cancelFollowRequest(handle);
        onChange?.({
          ...current,
          outgoingFollowRequestId: null
        });
        return;
      }

      const next = {
        ...current,
        followsProfile: !isPrivate,
        outgoingFollowRequestId: isPrivate ? `pending-${handle}` : null
      };
      setCurrent(next);
      await requestFollow(handle);
      onChange?.(next);
    } catch {
      setCurrent(previous);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmUnfollow() {
    if (busy || disabled) {
      return;
    }

    const previous = current;
    const next = {
      ...current,
      followsProfile: false
    };

    setConfirmingUnfollow(false);
    setCurrent(next);
    setBusy(true);

    try {
      await unfollowProfile(handle);
      onChange?.(next);
    } catch {
      setCurrent(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => void handlePress()}
        className={cn(
          "rounded-full font-semibold transition disabled:opacity-60",
          compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
          current.followsProfile || current.outgoingFollowRequestId
            ? "border border-[var(--line-warm)] bg-white text-[var(--text-main)]"
            : "bg-[var(--text-main)] text-white"
        )}
      >
        {busy ? "..." : label}
      </button>
      {confirmingUnfollow ? (
        <div
          className="fixed inset-0 z-[140] bg-black/35 px-4"
          onClick={() => setConfirmingUnfollow(false)}
        >
          <div className="flex min-h-full items-end justify-center py-6">
            <div
              className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-[0_24px_80px_rgba(27,19,10,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="text-lg font-semibold text-[var(--text-main)]">
                Dejar de seguir a @{handle}
              </div>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Si cambias de idea, tendras que volver a seguirle o enviar otra solicitud.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingUnfollow(false)}
                  className="flex-1 rounded-full border border-[var(--line-warm)] px-4 py-3 text-sm font-semibold text-[var(--text-main)] transition hover:bg-[var(--surface-muted)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleConfirmUnfollow()}
                  className="flex-1 rounded-full bg-[var(--text-main)] px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60"
                >
                  Dejar de seguir
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
