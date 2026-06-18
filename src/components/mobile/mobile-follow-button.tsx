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

    const previous = current;
    setBusy(true);

    try {
      if (current.followsProfile) {
        setCurrent({
          ...current,
          followsProfile: false
        });
        await unfollowProfile(handle);
        onChange?.({
          ...current,
          followsProfile: false
        });
        return;
      }

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

  return (
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
  );
}
