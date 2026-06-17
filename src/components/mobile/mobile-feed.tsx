"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { likePost } from "@/lib/mobile-api";
import { formatRelativeMobileTime } from "@/lib/mobile-shared";
import { MobilePostCarousel } from "@/components/mobile/mobile-post-carousel";
import { MobileStoryOverlay } from "@/components/mobile/mobile-story-overlay";
import type { MobilePost, MobileProfile, MobileStoryCluster } from "@/lib/mobile-types";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Avatar({ src, label }: { src: string | null; label: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} className="h-12 w-12 rounded-full object-cover" />
    );
  }

  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-semibold text-[var(--text-main)]">
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function StoryStrip({
  clusters,
  viewer
}: {
  clusters: MobileStoryCluster[];
  viewer: MobileProfile;
}) {
  const router = useRouter();
  const [activeClusterIndex, setActiveClusterIndex] = useState<number | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [sessionSeenIds, setSessionSeenIds] = useState<string[]>([]);

  const normalizedClusters = useMemo(
    () =>
      clusters.map((cluster) => ({
        ...cluster,
        stories: [...cluster.stories].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      })),
    [clusters]
  );

  const activeCluster = activeClusterIndex === null ? null : normalizedClusters[activeClusterIndex] ?? null;
  const isStorySeen = (story: MobileStoryCluster["stories"][number]) => story.hasSeen || sessionSeenIds.includes(story.id);

  const getStartIndexForCluster = (cluster: MobileStoryCluster) => {
    const firstPendingIndex = cluster.stories.findIndex((story) => !isStorySeen(story));
    return firstPendingIndex >= 0 ? firstPendingIndex : Math.max(0, cluster.stories.length - 1);
  };

  const getPendingCount = (cluster: MobileStoryCluster) => cluster.stories.filter((story) => !isStorySeen(story)).length;

  const closeViewer = () => {
    setActiveClusterIndex(null);
    setStoryIndex(0);
  };

  return (
    <>
      <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => router.push("/crear")}
          className="flex shrink-0 flex-col items-center gap-2"
        >
          <span className="relative block">
            <span className="block rounded-full bg-white/85 p-[2px] shadow-sm">
              <Avatar src={viewer.avatarUrl} label={`@${viewer.handle}`} />
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--coral)] text-white ring-4 ring-[var(--bg-main)]">
              <Plus className="h-3.5 w-3.5" />
            </span>
          </span>
          <span className="max-w-[74px] truncate text-[11px] font-medium text-[var(--text-soft)]">
            Tu historia
          </span>
        </button>

        {clusters.map((cluster, index) => {
          const pendingCount = getPendingCount(cluster);

          return (
            <button
              key={`${cluster.ownerType}:${cluster.ownerId}`}
              type="button"
              onClick={() => {
                const nextCluster = normalizedClusters[index] ?? cluster;
                setActiveClusterIndex(index);
                setStoryIndex(getStartIndexForCluster(nextCluster));
              }}
              className="flex shrink-0 flex-col items-center gap-2"
            >
              <span
                className={cn(
                  "rounded-full p-[2px]",
                  pendingCount > 0
                    ? "bg-gradient-to-br from-[var(--coral)] to-[var(--orange)]"
                    : "bg-[var(--line-soft)]"
                )}
              >
                <span className="block rounded-full bg-[var(--bg-main)] p-[2px]">
                  <Avatar src={cluster.ownerAvatarUrl} label={cluster.ownerLabel} />
                </span>
              </span>
              <span className="max-w-[74px] truncate text-[11px] font-medium text-[var(--text-soft)]">
                {cluster.ownerLabel}
              </span>
              {pendingCount > 0 ? (
                <span className="-mt-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--coral)] shadow-sm">
                  {pendingCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {activeCluster && activeClusterIndex !== null ? (
        <MobileStoryOverlay
          clusters={normalizedClusters}
          initialClusterIndex={activeClusterIndex}
          initialStoryIndex={storyIndex}
          onClose={closeViewer}
          seenStoryIds={sessionSeenIds}
          viewer={viewer}
          onStorySeen={(storyId) => {
            setSessionSeenIds((current) => (current.includes(storyId) ? current : [...current, storyId]));
          }}
        />
      ) : null}
    </>
  );
}

export function PostCard({ post }: { post: MobilePost }) {
  const [liked, setLiked] = useState(post.hasLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likePending, setLikePending] = useState(false);
  const likedRef = useRef(post.hasLiked);
  const authorHref = `/perfil/${post.authorHandle}`;
  const ownerHref = post.ownerType === "event" && post.eventSlug ? `/evento/${post.eventSlug}` : authorHref;

  useEffect(() => {
    setLiked(post.hasLiked);
    setLikeCount(post.likeCount);
    likedRef.current = post.hasLiked;
  }, [post.hasLiked, post.id, post.likeCount]);

  const syncLikeState = async (mode: "toggle" | "ensure-liked") => {
    const wasLiked = likedRef.current;
    const nextLiked = mode === "ensure-liked" ? true : !wasLiked;
    const delta = nextLiked === wasLiked ? 0 : nextLiked ? 1 : -1;

    if ((mode === "ensure-liked" && wasLiked) || likePending) {
      return;
    }

    if (delta !== 0) {
      likedRef.current = nextLiked;
      setLiked(nextLiked);
      setLikeCount((current) => Math.max(0, current + delta));
    }

    setLikePending(true);
    try {
      await likePost(post.id);
    } catch {
      likedRef.current = wasLiked;
      setLiked(wasLiked);
      if (delta !== 0) {
        setLikeCount((current) => Math.max(0, current - delta));
      }
    } finally {
      setLikePending(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-[2rem] border border-[var(--line-soft)] bg-white/92 shadow-[0_24px_56px_rgba(29,22,15,0.08)]">
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={post.ownerAvatarUrl || post.authorAvatarUrl} label={post.ownerLabel} />
          <div className="min-w-0">
            <Link href={authorHref} className="block truncate text-sm font-semibold">
              @{post.authorHandle}
            </Link>
            <Link href={ownerHref} className="block truncate text-xs text-[var(--text-soft)]">
              {post.ownerLabel}
            </Link>
          </div>
        </div>
        <span className="shrink-0 text-xs text-[var(--text-soft)]">{formatRelativeMobileTime(post.createdAt)}</span>
      </div>
      <MobilePostCarousel
        items={post.mediaItems}
        label={post.caption || post.ownerLabel}
        aspectClassName="aspect-[4/5]"
        onDoubleLike={() => {
          void syncLikeState("ensure-liked");
        }}
      />
      <div className="space-y-3 px-4 py-4">
        <button
          type="button"
          onClick={() => {
            void syncLikeState("toggle");
          }}
          className={cn(
            "flex items-center gap-2 text-sm font-semibold transition-opacity",
            likePending && "opacity-70"
          )}
        >
          <Heart className={liked ? "h-5 w-5 fill-[var(--coral)] text-[var(--coral)]" : "h-5 w-5"} />
          {likeCount} likes
        </button>
        {post.caption ? <p className="text-sm leading-6">{post.caption}</p> : null}
      </div>
    </article>
  );
}
