"use client";

import { createPortal } from "react-dom";
import { Heart, MoreHorizontal, Play, Send, Volume2, VolumeX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createConversation, deleteStory, markStoryAsViewed, sendConversationMessage } from "@/lib/mobile-api";
import { buildStoryMessageText, formatRelativeMobileTime } from "@/lib/mobile-shared";
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
  const router = useRouter();
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
  const [dismissOffsetY, setDismissOffsetY] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeletingStory, setIsDeletingStory] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [browserBottomInset, setBrowserBottomInset] = useState(0);
  const [replyNotice, setReplyNotice] = useState<string | null>(null);
  const [reactedStoryIds, setReactedStoryIds] = useState<string[]>([]);

  const progressFrameRef = useRef<number | null>(null);
  const replyNoticeTimeoutRef = useRef<number | null>(null);
  const elapsedMsRef = useRef(0);
  const lastFrameAtRef = useRef<number | null>(null);
  const gestureRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    startedAt: number;
    width: number;
    mode: "tap" | "dismiss";
  } | null>(null);
  const progressBarRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const flatStoryQueue = useMemo(
    () =>
      normalizedClusters.flatMap((cluster) =>
        cluster.stories.map((story, normalizedStoryIndex) => ({
          clusterIndex: normalizedClusters.findIndex((item) => item.ownerId === cluster.ownerId && item.ownerType === cluster.ownerType),
          storyIndex: normalizedStoryIndex,
          story
        }))
      ),
    [normalizedClusters]
  );

  const activeCluster = normalizedClusters[activeClusterIndex] ?? null;
  const activeStory = activeCluster?.stories[storyIndex] ?? null;
  const isPaused = isHolding || isReplyFocused || isSendingReply || viewersOpen || menuOpen || isDeletingStory;
  const canReply = Boolean(activeStory && activeStory.authorId !== viewer.id);
  const isActiveStoryVideo = Boolean(activeStory?.media?.mimeType?.startsWith("video/"));
  const isOwnStory = Boolean(activeStory && activeStory.authorId === viewer.id);
  const hasReactedToActiveStory = Boolean(activeStory && reactedStoryIds.includes(activeStory.id));

  const isSeen = (story: MobileStory) => story.hasSeen || seenStoryIds.includes(story.id);
  const dismissProgress = Math.min(1, dismissOffsetY / 220);

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
    setReplyNotice(null);
    setIsReplyFocused(false);
    setDismissOffsetY(0);
    setViewersOpen(false);
    setMenuOpen(false);
    elapsedMsRef.current = 0;
    lastFrameAtRef.current = null;
    Object.values(progressBarRefs.current).forEach((progressBar) => {
      if (progressBar) {
        progressBar.style.transform = "scaleX(0)";
      }
    });
  }, [activeStory?.id]);

  useEffect(() => {
    return () => {
      if (replyNoticeTimeoutRef.current !== null) {
        window.clearTimeout(replyNoticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewportMetrics = () => {
      const nextViewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const layoutHeight = window.innerHeight;
      const nextBottomInset = Math.max(
        0,
        Math.round(layoutHeight - nextViewportHeight - (window.visualViewport?.offsetTop ?? 0))
      );

      setViewportHeight(Math.round(nextViewportHeight));
      setBrowserBottomInset(nextBottomInset);
    };

    updateViewportMetrics();
    window.visualViewport?.addEventListener("resize", updateViewportMetrics);
    window.visualViewport?.addEventListener("scroll", updateViewportMetrics);
    window.addEventListener("resize", updateViewportMetrics);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewportMetrics);
      window.visualViewport?.removeEventListener("scroll", updateViewportMetrics);
      window.removeEventListener("resize", updateViewportMetrics);
    };
  }, []);

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
    if (typeof window === "undefined" || !activeStory) {
      return;
    }

    const activeFlatIndex = flatStoryQueue.findIndex((item) => item.story.id === activeStory.id);
    const nearbyStories = flatStoryQueue.slice(
      Math.max(0, activeFlatIndex - 1),
      Math.min(flatStoryQueue.length, activeFlatIndex + 4)
    );

    for (const candidate of nearbyStories) {
      const previewUrl = candidate.story.media?.previewUrl;
      if (!previewUrl || preloadedUrlsRef.current.has(previewUrl)) {
        continue;
      }

      preloadedUrlsRef.current.add(previewUrl);
      if (candidate.story.media?.mimeType?.startsWith("video/")) {
        const video = document.createElement("video");
        video.preload = "auto";
        video.src = previewUrl;
        video.load();
        continue;
      }

      const image = new window.Image();
      image.decoding = "async";
      image.src = previewUrl;
    }
  }, [activeStory, flatStoryQueue]);

  useEffect(() => {
    if (!activeStory || isPaused) {
      return;
    }

    const duration = Math.max(1200, activeStory.durationMs || 5000);
    const activeProgressBar = progressBarRefs.current[activeStory.id];

    const step = (now: number) => {
      if (lastFrameAtRef.current === null) {
        lastFrameAtRef.current = now;
      }

      const delta = now - lastFrameAtRef.current;
      lastFrameAtRef.current = now;
      elapsedMsRef.current += delta;

      const nextProgress = Math.min(1, elapsedMsRef.current / duration);
      if (activeProgressBar) {
        activeProgressBar.style.transform = `scaleX(${nextProgress})`;
      }

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

  function setTransientReplyNotice(message: string) {
    setReplyNotice(message);
    if (replyNoticeTimeoutRef.current !== null) {
      window.clearTimeout(replyNoticeTimeoutRef.current);
    }

    replyNoticeTimeoutRef.current = window.setTimeout(() => {
      setReplyNotice(null);
      replyNoticeTimeoutRef.current = null;
    }, 1800);
  }

  async function handleSendReply(overrideBody?: string) {
    const rawBody = (overrideBody ?? replyDraft).trim();
    const isReaction = overrideBody === "\u2764\uFE0F";

    if (!activeStory || !rawBody || isSendingReply || !canReply) {
      return;
    }

    if (isReaction && reactedStoryIds.includes(activeStory.id)) {
      setTransientReplyNotice("Ya reaccionaste a esta historia.");
      return;
    }

    const encodedBody = buildStoryMessageText(activeStory.id, isReaction ? "reaction" : "comment", rawBody);
    const previousDraft = replyDraft;
    setIsSendingReply(true);
    setReplyError(null);
    setReplyNotice(isReaction ? "Enviando reaccion..." : "Enviando respuesta...");
    if (!isReaction) {
      setReplyDraft("");
    }

    try {
      if (activeStory.ownerType === "event") {
        await sendConversationMessage(`event-chat-${activeStory.ownerId}`, {
          body: encodedBody
        });
      } else {
        const created = await createConversation({
          kind: "direct",
          title: null,
          participantIds: [activeStory.authorId]
        });

        await sendConversationMessage(created.conversationId, {
          body: encodedBody
        });
      }

      setIsReplyFocused(false);
      if (isReaction) {
        setReactedStoryIds((current) => (current.includes(activeStory.id) ? current : [...current, activeStory.id]));
      }
      setTransientReplyNotice(isReaction ? "Reaccion enviada." : "Mensaje enviado.");
    } catch (error) {
      if (!isReaction) {
        setReplyDraft(previousDraft);
      }
      setReplyNotice(null);
      setReplyError(error instanceof Error ? error.message : "No pude enviar la respuesta.");
    } finally {
      setIsSendingReply(false);
    }
  }

  async function handleDeleteActiveStory() {
    if (!activeStory || !isOwnStory || isDeletingStory) {
      return;
    }

    setIsDeletingStory(true);
    setReplyError(null);

    try {
      await deleteStory(activeStory.id);
      setMenuOpen(false);
      setViewersOpen(false);
      onClose();
      router.refresh();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "No pude borrar la historia.");
    } finally {
      setIsDeletingStory(false);
    }
  }

  if (!activeStory || !activeCluster || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120]"
      style={{
        backgroundColor: `rgba(0, 0, 0, ${Math.max(0.22, 1 - dismissProgress * 0.82)})`,
        overscrollBehavior: "none"
      }}
    >
      <div
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black"
        style={{
          height: viewportHeight ? `${viewportHeight}px` : "100dvh",
          transform: dismissOffsetY
            ? `translate3d(0, ${dismissOffsetY}px, 0) scale(${1 - dismissProgress * 0.06})`
            : undefined,
          transition: gestureRef.current?.mode === "dismiss" ? "none" : "transform 180ms ease",
          borderRadius: dismissOffsetY > 0 ? "1.75rem" : "0px",
          willChange: dismissOffsetY ? "transform" : undefined
        }}
      >
        <div className="absolute left-0 right-0 top-0 z-30 flex gap-1 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
          {activeCluster.stories.map((story, index) => (
            <span key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              <span
                ref={(node) => {
                  progressBarRefs.current[story.id] = node;
                }}
                className="block h-full rounded-full bg-white"
                style={{
                  transform: "scaleX(0)",
                  transformOrigin: "left center",
                  willChange: "transform"
                }}
              />
            </span>
          ))}
        </div>

        <div
          className="absolute inset-0 z-10"
          style={{ touchAction: "none" }}
          onPointerCancel={() => {
            gestureRef.current = null;
            setIsHolding(false);
            setDismissOffsetY(0);
          }}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-story-ui='true']")) {
              return;
            }

            gestureRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              startedAt: window.performance.now(),
              width: event.currentTarget.clientWidth,
              mode: "tap"
            };
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setIsHolding(true);
          }}
          onPointerMove={(event) => {
            const gesture = gestureRef.current;
            if (!gesture || gesture.pointerId !== event.pointerId) {
              return;
            }

            const deltaX = event.clientX - gesture.x;
            const deltaY = Math.max(0, event.clientY - gesture.y);

            if (
              gesture.mode === "tap" &&
              deltaY > 12 &&
              deltaY > Math.abs(deltaX)
            ) {
              gesture.mode = "dismiss";
            }

            if (gesture.mode === "dismiss") {
              setDismissOffsetY(deltaY);
            }
          }}
          onPointerUp={(event) => {
            const gesture = gestureRef.current;
            if (!gesture || gesture.pointerId !== event.pointerId) {
              return;
            }

            event.currentTarget.releasePointerCapture?.(event.pointerId);
            gestureRef.current = null;
            setIsHolding(false);

            if (dismissOffsetY > 120 || (gesture.mode === "dismiss" && event.clientY - gesture.y > 110)) {
              onClose();
              return;
            }

            if (gesture.mode === "dismiss") {
              setDismissOffsetY(0);
              return;
            }

            setDismissOffsetY(0);
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

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[calc(1rem+env(safe-area-inset-top)+0.75rem)]">
          <div data-story-ui="true" className="pointer-events-auto flex items-center gap-3">
            <StoryAvatar src={activeCluster.ownerAvatarUrl} label={activeCluster.ownerLabel} />
            <div className="text-white">
              <div className="text-sm font-semibold">{activeCluster.ownerLabel}</div>
              <div className="text-xs text-white/70">{formatRelativeMobileTime(activeStory.createdAt)}</div>
            </div>
          </div>

          <div data-story-ui="true" className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white"
              aria-label="Mas opciones"
              style={{ touchAction: "manipulation" }}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {isActiveStoryVideo ? (
              <button
                type="button"
                onClick={() => setIsVideoMuted((current) => !current)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white"
                style={{ touchAction: "manipulation" }}
              >
                {isVideoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            ) : null}
            {showOwnStoryStats && activeStory.authorId === viewer.id ? (
              <button
                type="button"
                onClick={() => setViewersOpen((current) => !current)}
                className="rounded-full bg-black/35 px-3 py-2 text-xs font-semibold text-white"
                style={{ touchAction: "manipulation" }}
              >
                {activeStory.viewCount} vista{activeStory.viewCount === 1 ? "" : "s"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white"
              style={{ touchAction: "manipulation" }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div
            data-story-ui="true"
            className="absolute inset-0 z-30 bg-black/28"
            onClick={() => setMenuOpen(false)}
          >
            <div
              className="absolute right-4 top-[calc(4.5rem+env(safe-area-inset-top))] min-w-[190px] rounded-[1.5rem] border border-white/10 bg-[#120d0a]/96 p-2 text-white shadow-2xl backdrop-blur"
              onClick={(event) => event.stopPropagation()}
            >
              {isOwnStory ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteActiveStory()}
                  disabled={isDeletingStory}
                  className="flex w-full items-center justify-between rounded-[1rem] px-4 py-3 text-left text-sm font-semibold hover:bg-white/6 disabled:opacity-50"
                >
                  <span>{isDeletingStory ? "Borrando..." : "Borrar historia"}</span>
                </button>
              ) : null}
              {showOwnStoryStats && isOwnStory ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setViewersOpen(true);
                  }}
                  className="flex w-full items-center justify-between rounded-[1rem] px-4 py-3 text-left text-sm font-semibold hover:bg-white/6"
                >
                  <span>Ver vistas</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center justify-between rounded-[1rem] px-4 py-3 text-left text-sm font-semibold text-white/72 hover:bg-white/6"
              >
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        ) : null}

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
            className="pointer-events-none h-full w-full select-none object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-white/70">
            <Play className="h-10 w-10" />
          </div>
        )}

        <div
          className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/88 via-black/24 to-transparent px-5 pt-20 text-white"
          style={{
            paddingBottom: `calc(env(safe-area-inset-bottom) + ${Math.max(browserBottomInset + 86, 86)}px)`
          }}
        >
          {activeStory.caption ? <p className="text-sm leading-6">{activeStory.caption}</p> : null}
        </div>

        {canReply ? (
          <div
            data-story-ui="true"
            className="absolute inset-x-0 bottom-0 z-20 px-4 pt-14"
            style={{
              paddingBottom: `calc(env(safe-area-inset-bottom) + ${Math.max(browserBottomInset + 14, 14)}px)`
            }}
          >
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
                  placeholder="Responder historia..."
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
                <Heart className={cn("h-7 w-7 transition-colors", hasReactedToActiveStory && "fill-[var(--coral)] text-[var(--coral)]")} />
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
            {!replyError && replyNotice ? <p className="mt-2 px-1 text-xs text-white/72">{replyNotice}</p> : null}
          </div>
        ) : isOwnStory ? (
          <div
            data-story-ui="true"
            className="absolute inset-x-0 bottom-0 z-20 px-4 pt-14"
            style={{
              paddingBottom: `calc(env(safe-area-inset-bottom) + ${Math.max(browserBottomInset + 14, 14)}px)`
            }}
          >
            <button
              type="button"
              onClick={() => setViewersOpen(true)}
              className="flex w-full items-center justify-between rounded-full border border-white/18 bg-black/26 px-4 py-3 text-sm font-semibold text-white/92 backdrop-blur"
              style={{ touchAction: "manipulation" }}
            >
              <span>Actividad</span>
              <span className="text-xs font-medium text-white/68">
                {activeStory.viewCount} vista{activeStory.viewCount === 1 ? "" : "s"}
              </span>
            </button>
            {replyError ? <p className="mt-2 px-1 text-xs text-[#ffd1c4]">{replyError}</p> : null}
          </div>
        ) : null}

        {showOwnStoryStats && activeStory.authorId === viewer.id && viewersOpen ? (
          <div
            data-story-ui="true"
            className="absolute inset-0 z-30 flex items-end bg-black/42"
            onClick={() => setViewersOpen(false)}
          >
            <div
              className="w-full rounded-t-[2rem] bg-[#120d0a] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 text-white"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-white/18" />
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Vistas</div>
                  <div className="text-xs text-white/65">
                    {activeStory.viewCount} persona{activeStory.viewCount === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewersOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 max-h-[38dvh] space-y-3 overflow-y-auto pb-2">
                {activeStory.viewers.length ? (
                  activeStory.viewers.map((storyViewer) => (
                    <div key={`${storyViewer.id}-${storyViewer.seenAt}`} className="flex items-center gap-3">
                      <StoryAvatar src={storyViewer.avatarUrl} label={`@${storyViewer.handle}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">@{storyViewer.handle}</div>
                        <div className="truncate text-xs text-white/65">
                          {storyViewer.displayName} · {formatRelativeMobileTime(storyViewer.seenAt)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/68">
                    Todavia nadie ha visto esta historia.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
