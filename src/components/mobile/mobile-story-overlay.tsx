"use client";

import { createPortal } from "react-dom";
import { Heart, MoreHorizontal, Play, Send, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createConversation, markStoryAsViewed, sendConversationMessage } from "@/lib/mobile-api";
import { formatRelativeMobileTime } from "@/lib/mobile-shared";
import type { MobileProfile, MobileStory, MobileStoryCluster } from "@/lib/mobile-types";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function StoryAvatar({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} className="h-10 w-10 rounded-full object-cover" />
    );
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--text-main)]">
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}

type MobileStoryOverlayProps = {
  clusters: MobileStoryCluster[];
  initialClusterIndex: number;
  initialStoryIndex: number;
  onClose: () => void;
  seenStoryIds?: string[];
  showOwnStoryStats?: boolean;
  viewer: MobileProfile;
  onStorySeen?: (storyId: string) => void;
};

export function MobileStoryOverlay({
  clusters,
  initialClusterIndex,
  initialStoryIndex,
  onClose,
  seenStoryIds = [],
  showOwnStoryStats = false,
  viewer,
  onStorySeen
}: MobileStoryOverlayProps) {
  const normalizedClusters = useMemo(
    () =>
      clusters.map((cluster) => ({
        ...cluster,
        stories: [...cluster.stories].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      })),
    [clusters]
  );

  const [activeClusterIndex, setActiveClusterIndex] = useState(initialClusterIndex);
  const [storyIndex, setStoryIndex] = useState(initialStoryIndex);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(true);

  const progressFrameRef = useRef<number | null>(null);
  const elapsedMsRef = useRef(0);
  const lastFrameAtRef = useRef<number | null>(null);
  const gestureRef = useRef<{ pointerId: number; x: number; startedAt: number; width: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const activeCluster = normalizedClusters[activeClusterIndex] ?? null;
  const activeStory = activeCluster?.stories[storyIndex] ?? null;
  const isPaused = isHolding || isReplyFocused || isSendingReply;
  const canReply = Boolean(activeStory && activeStory.authorId !== viewer.id);
  const isActiveStoryVideo = Boolean(activeStory?.media?.mimeType?.startsWith("video/"));

  const isSeen = (story: MobileStory) => story.hasSeen || seenStoryIds.includes(story.id);

  const findNextClusterWithPending = (fromIndex: number) => {
    for (let index = fromIndex + 1; index < normalizedClusters.length; index += 1) {
      const cluster = normalizedClusters[index];
      const pendingIndex = cluster.stories.findIndex((story) => !isSeen(story));
      if (pendingIndex >= 0) {
        return { clusterIndex: index, storyIndex: pendingIndex };
      }
    }

    return null;
  };

  const moveToNextStory = () => {
    if (!activeCluster) {
      onClose();
      return;
    }

    if (storyIndex < activeCluster.stories.length - 1) {
      setStoryIndex((current) => current + 1);
      return;
    }

    const nextPending = findNextClusterWithPending(activeClusterIndex);
    if (!nextPending) {
      onClose();
      return;
    }

    setActiveClusterIndex(nextPending.clusterIndex);
    setStoryIndex(nextPending.storyIndex);
  };

  const moveToPreviousStory = () => {
    if (!activeCluster) {
      return;
    }

    if (storyIndex > 0) {
      setStoryIndex((current) => current - 1);
      return;
    }

    const previousClusterIndex = activeClusterIndex - 1;
    if (previousClusterIndex < 0) {
      return;
    }

    const previousCluster = normalizedClusters[previousClusterIndex];
    if (!previousCluster) {
      return;
    }

    setActiveClusterIndex(previousClusterIndex);
    setStoryIndex(Math.max(0, previousCluster.stories.length - 1));
  };

  useEffect(() => {
    setReplyDraft("");
    setReplyError(null);
    setIsReplyFocused(false);
    setStoryProgress(0);
    elapsedMsRef.current = 0;
    lastFrameAtRef.current = null;
  }, [activeStory?.id]);

  useEffect(() => {
    if (!activeStory) {
      return;
    }

    onStorySeen?.(activeStory.id);
    if (!isSeen(activeStory) && activeStory.authorId !== viewer.id) {
      void markStoryAsViewed(activeStory.id).catch(() => undefined);
    }
  }, [activeStory, onStorySeen, seenStoryIds, viewer.id]);

  useEffect(() => {
    if (!activeStory || isPaused) {
      return;
    }

    const duration = Math.max(1200, activeStory.durationMs || 5000);

    const step = (now: number) => {
      if (lastFrameAtRef.current === null) {
        lastFrameAtRef.current = now;
      }

      const delta = now - lastFrameAtRef.current;
      lastFrameAtRef.current = now;
      elapsedMsRef.current += delta;

      const nextProgress = Math.min(1, elapsedMsRef.current / duration);
      setStoryProgress(nextProgress);

      if (nextProgress >= 1) {
        progressFrameRef.current = null;
        elapsedMsRef.current = 0;
        lastFrameAtRef.current = null;
        moveToNextStory();
        return;
      }

      progressFrameRef.current = window.requestAnimationFrame(step);
    };

    progressFrameRef.current = window.requestAnimationFrame(step);

    return () => {
      if (progressFrameRef.current !== null) {
        window.cancelAnimationFrame(progressFrameRef.current);
        progressFrameRef.current = null;
      }
      lastFrameAtRef.current = null;
    };
  }, [activeStory, isPaused]);

  useEffect(() => {
    if (!isActiveStoryVideo || !videoRef.current) {
      return;
    }

    if (isPaused) {
      videoRef.current.pause();
      return;
    }

    void videoRef.current.play().catch(() => undefined);
  }, [activeStory?.id, isActiveStoryVideo, isPaused]);

  async function handleSendReply(overrideBody?: string) {
    const bodyToSend = (overrideBody ?? replyDraft).trim();

    if (!activeStory || !bodyToSend || isSendingReply || !canReply) {
      return;
    }

    setIsSendingReply(true);
    setReplyError(null);

    try {
      if (activeStory.ownerType === "event") {
        await sendConversationMessage(`event-chat-${activeStory.ownerId}`, {
          body: bodyToSend
        });
      } else {
        const created = await createConversation({
          kind: "direct",
          title: null,
          participantIds: [activeStory.authorId]
        });

        await sendConversationMessage(created.conversationId, {
          body: bodyToSend
        });
      }

      setReplyDraft("");
      setIsReplyFocused(false);
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "No pude enviar la respuesta.");
    } finally {
      setIsSendingReply(false);
    }
  }

  if (!activeStory || !activeCluster || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black">
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black">
        <div className="absolute left-0 right-0 top-0 z-30 flex gap-1 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          {activeCluster.stories.map((story, index) => (
            <span key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <span
                className="block h-full rounded-full bg-white transition-all"
                style={{
                  width:
                    index < storyIndex
                      ? "100%"
                      : index === storyIndex
                        ? `${Math.max(0, Math.min(100, storyProgress * 100))}%`
                        : "0%"
                }}
              />
            </span>
          ))}
        </div>

        <div
          className="absolute inset-0 z-10"
          onPointerCancel={() => {
            gestureRef.current = null;
            setIsHolding(false);
          }}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-story-ui='true']")) {
              return;
            }

            gestureRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              startedAt: window.performance.now(),
              width: event.currentTarget.clientWidth
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setIsHolding(true);
          }}
          onPointerUp={(event) => {
            const gesture = gestureRef.current;
            if (!gesture || gesture.pointerId !== event.pointerId) {
              return;
            }

            event.currentTarget.releasePointerCapture?.(event.pointerId);
            gestureRef.current = null;
            setIsHolding(false);

            const duration = window.performance.now() - gesture.startedAt;
            if (duration > 220) {
              return;
            }

            if (gesture.x <= gesture.width * 0.34) {
              moveToPreviousStory();
            } else {
              moveToNextStory();
            }
          }}
        />

        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[calc(1rem+env(safe-area-inset-top)+0.75rem)]">
          <div data-story-ui="true" className="flex items-center gap-3">
            <StoryAvatar src={activeCluster.ownerAvatarUrl} label={activeCluster.ownerLabel} />
            <div className="text-white">
              <div className="text-sm font-semibold">{activeCluster.ownerLabel}</div>
              <div className="text-xs text-white/70">{formatRelativeMobileTime(activeStory.createdAt)}</div>
            </div>
          </div>

          <div data-story-ui="true" className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white"
              aria-label="Mas opciones"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {isActiveStoryVideo ? (
              <button
                type="button"
                onClick={() => setIsVideoMuted((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white"
              >
                {isVideoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            ) : null}
            {showOwnStoryStats && activeStory.authorId === viewer.id ? (
              <div className="rounded-full bg-black/35 px-3 py-2 text-xs font-semibold text-white">
                {activeStory.viewCount} vista{activeStory.viewCount === 1 ? "" : "s"}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isActiveStoryVideo && activeStory.media?.previewUrl ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isVideoMuted}
            src={activeStory.media.previewUrl}
            className="h-full w-full object-cover"
          />
        ) : activeStory.media?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeStory.media.previewUrl}
            alt={activeCluster.ownerLabel}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/70">
            <Play className="h-10 w-10" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/88 via-black/24 to-transparent px-5 pb-[calc(5.4rem+env(safe-area-inset-bottom))] pt-20 text-white">
          {activeStory.caption ? <p className="text-sm leading-6">{activeStory.caption}</p> : null}
        </div>

        {canReply ? (
          <div data-story-ui="true" className="absolute inset-x-0 bottom-0 z-20 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-14">
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center rounded-full border border-white/25 bg-black/26 px-4 py-3 backdrop-blur">
                <input
                  value={replyDraft}
                  onBlur={() => setIsReplyFocused(false)}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  onFocus={() => setIsReplyFocused(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendReply();
                    }
                  }}
                  placeholder={
                    activeStory.ownerType === "event"
                      ? "Enviar mensaje..."
                      : "Enviar mensaje..."
                  }
                  className="h-7 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/58"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleSendReply("\u2764\uFE0F");
                }}
                disabled={isSendingReply}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/26 text-white backdrop-blur disabled:opacity-50"
                aria-label="Reaccionar con corazon"
              >
                <Heart className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSendReply();
                }}
                disabled={!replyDraft.trim() || isSendingReply}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/26 text-white backdrop-blur disabled:opacity-55"
                aria-label="Enviar respuesta"
              >
                <Send className="h-6 w-6" />
              </button>
            </div>
            {replyError ? <p className="mt-2 px-1 text-xs text-[#ffd1c4]">{replyError}</p> : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
