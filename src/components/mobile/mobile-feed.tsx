"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Play, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { likePost, markStoryAsViewed } from "@/lib/mobile-api";
import { formatRelativeMobileTime } from "@/lib/mobile-shared";
import { MobilePostCarousel } from "@/components/mobile/mobile-post-carousel";
import type { MobilePost, MobileProfile, MobileStoryCluster } from "@/lib/mobile-types";

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

  const activeCluster = activeClusterIndex === null ? null : clusters[activeClusterIndex] ?? null;
  const activeStory = activeCluster?.stories[storyIndex] ?? null;

  useEffect(() => {
    if (!activeStory) {
      return;
    }

    void markStoryAsViewed(activeStory.id).catch(() => undefined);
    const timer = window.setTimeout(() => {
      const cluster = activeCluster;
      if (!cluster) {
        return;
      }
      if (storyIndex < cluster.stories.length - 1) {
        setStoryIndex((current) => current + 1);
        return;
      }
      if (activeClusterIndex !== null && activeClusterIndex < clusters.length - 1) {
        setActiveClusterIndex((current) => (current === null ? null : current + 1));
        setStoryIndex(0);
        return;
      }
      setActiveClusterIndex(null);
      setStoryIndex(0);
    }, activeStory.durationMs || 5000);

    return () => window.clearTimeout(timer);
  }, [activeCluster, activeClusterIndex, activeStory, clusters.length, storyIndex]);

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
        {clusters.map((cluster, index) => (
          <button
            key={`${cluster.ownerType}:${cluster.ownerId}`}
            type="button"
            onClick={() => {
              setActiveClusterIndex(index);
              setStoryIndex(0);
            }}
            className="flex shrink-0 flex-col items-center gap-2"
          >
            <span className="rounded-full bg-gradient-to-br from-[var(--coral)] to-[var(--orange)] p-[2px]">
              <span className="block rounded-full bg-[var(--bg-main)] p-[2px]">
                <Avatar src={cluster.ownerAvatarUrl} label={cluster.ownerLabel} />
              </span>
            </span>
            <span className="max-w-[74px] truncate text-[11px] font-medium text-[var(--text-soft)]">
              {cluster.ownerLabel}
            </span>
            {cluster.unseenCount > 0 ? (
              <span className="-mt-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--coral)] shadow-sm">
                {cluster.unseenCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {activeStory && activeCluster ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#140f0bcc] p-4">
          <div className="relative flex h-[calc(100dvh-2rem)] w-full max-w-[420px] flex-col overflow-hidden rounded-[2rem] bg-black">
            <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))]">
              {activeCluster.stories.map((story, index) => (
                <span key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                  <span
                    className="block h-full rounded-full bg-white transition-all"
                    style={{
                      width: index < storyIndex ? "100%" : index === storyIndex ? "100%" : "0%"
                    }}
                  />
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setActiveClusterIndex(null)}
              className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {activeStory.media?.previewUrl ? (
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
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/15 to-transparent px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-16 text-white">
              <div className="mb-3 flex items-center gap-3">
                <Avatar src={activeCluster.ownerAvatarUrl} label={activeCluster.ownerLabel} />
                <div>
                  <div className="text-sm font-semibold">{activeCluster.ownerLabel}</div>
                  <div className="text-xs text-white/70">{formatRelativeMobileTime(activeStory.createdAt)}</div>
                </div>
              </div>
              {activeStory.caption ? <p className="text-sm leading-6">{activeStory.caption}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PostCard({ post }: { post: MobilePost }) {
  const [liked, setLiked] = useState(post.hasLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const authorHref = `/perfil/${post.authorHandle}`;
  const ownerHref = post.ownerType === "event" && post.eventSlug ? `/evento/${post.eventSlug}` : authorHref;

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
      />
      <div className="space-y-3 px-4 py-4">
        <button
          type="button"
          onClick={async () => {
            setLiked((current) => !current);
            setLikeCount((current) => current + (liked ? -1 : 1));
            try {
              await likePost(post.id);
            } catch {
              setLiked(post.hasLiked);
              setLikeCount(post.likeCount);
            }
          }}
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <Heart className={liked ? "h-5 w-5 fill-[var(--coral)] text-[var(--coral)]" : "h-5 w-5"} />
          {likeCount} likes
        </button>
        {post.caption ? <p className="text-sm leading-6">{post.caption}</p> : null}
      </div>
    </article>
  );
}
