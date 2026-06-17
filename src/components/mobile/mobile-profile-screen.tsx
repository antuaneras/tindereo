"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Heart,
  LogOut,
  MessageCircle,
  Send,
  Sparkles,
  X
} from "lucide-react";
import {
  createPostComment,
  fetchProfileDetail,
  likePost,
  mobileLogout,
  subscribeToMobileStream,
  updateViewerProfile
} from "@/lib/mobile-api";
import { MobilePostCarousel } from "@/components/mobile/mobile-post-carousel";
import { formatRelativeMobileTime } from "@/lib/mobile-shared";
import { uploadManagedMediaFromClient } from "@/lib/tindereo-api";
import type { MobilePost, MobilePostComment, MobileProfile, MobileProfileDetail, MobileStory } from "@/lib/mobile-types";

type MobileProfileScreenProps = {
  backHref?: string;
  initialProfile: MobileProfileDetail;
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function ProfileAvatar({
  profile,
  ring = false,
  size = "lg"
}: {
  profile: MobileProfile;
  ring?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions =
    size === "sm" ? "h-8 w-8 text-[11px]" : size === "md" ? "h-11 w-11 text-sm" : "h-24 w-24 text-2xl";

  const content = profile.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatarUrl} alt={`@${profile.handle}`} className={cn(dimensions, "rounded-full object-cover")} />
  ) : (
    <span className={cn("flex items-center justify-center rounded-full bg-[var(--bg-soft)] font-black text-[var(--text-main)]", dimensions)}>
      {profile.handle.slice(0, 2).toUpperCase()}
    </span>
  );

  if (!ring) {
    return content;
  }

  return (
    <span className="inline-flex rounded-full bg-gradient-to-br from-[var(--coral)] to-[var(--orange)] p-[3px] shadow-[0_14px_28px_rgba(240,138,36,0.22)]">
      <span className="rounded-full bg-[var(--bg-main)] p-[3px]">{content}</span>
    </span>
  );
}

function EmptyPostTile() {
  return (
    <div className="flex aspect-square items-center justify-center bg-[var(--bg-soft)] text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">
      Sin foto
    </div>
  );
}

function StoryViewer({
  onClose,
  owner,
  stories
}: {
  onClose: () => void;
  owner: MobileProfile;
  stories: MobileStory[];
}) {
  const orderedStories = useMemo(
    () => [...stories].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [stories]
  );
  const [storyIndex, setStoryIndex] = useState(0);
  const activeStory = orderedStories[storyIndex] ?? null;

  useEffect(() => {
    if (!activeStory) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (storyIndex < orderedStories.length - 1) {
        setStoryIndex((current) => current + 1);
        return;
      }

      onClose();
    }, activeStory.durationMs || 5000);

    return () => window.clearTimeout(timer);
  }, [activeStory, onClose, orderedStories.length, storyIndex]);

  if (!activeStory) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-4 pt-[calc(0.8rem+env(safe-area-inset-top))]">
        {orderedStories.map((story, index) => (
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

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[calc(1.2rem+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <ProfileAvatar profile={owner} size="md" />
          <div className="text-white">
            <div className="text-sm font-semibold">@{owner.handle}</div>
            <div className="text-xs text-white/70">{formatRelativeMobileTime(activeStory.createdAt)}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative h-full w-full">
        {activeStory.media?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeStory.media.previewUrl} alt={`Story de @${owner.handle}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/70">Historia sin vista previa</div>
        )}

        <button
          type="button"
          onClick={() => setStoryIndex((current) => (current > 0 ? current - 1 : current))}
          className="absolute inset-y-0 left-0 w-1/2"
          aria-label="Historia anterior"
        />
        <button
          type="button"
          onClick={() => {
            if (storyIndex < orderedStories.length - 1) {
              setStoryIndex((current) => current + 1);
              return;
            }
            onClose();
          }}
          className="absolute inset-y-0 right-0 w-1/2"
          aria-label="Historia siguiente"
        />

        {activeStory.caption ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-16 text-white">
            <p className="text-sm leading-6">{activeStory.caption}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MobileProfileScreen({ backHref, initialProfile }: MobileProfileScreenProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [pendingAvatar, setPendingAvatar] = useState(false);
  const [activeStoryOpen, setActiveStoryOpen] = useState(false);
  const [postViewerOpenId, setPostViewerOpenId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [pendingComments, setPendingComments] = useState<Record<string, boolean>>({});
  const [commentError, setCommentError] = useState<string | null>(null);
  const [postViewerVisible, setPostViewerVisible] = useState(false);
  const postListRef = useRef<HTMLDivElement | null>(null);
  const postCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeStories = useMemo(
    () => [...profile.stories].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [profile.stories]
  );
  const hasStories = activeStories.length > 0;
  const currentOverlayIndex = useMemo(
    () => Math.max(0, profile.posts.findIndex((post) => post.id === activePostId)),
    [activePostId, profile.posts]
  );

  useEffect(() => {
    const unsubscribe = subscribeToMobileStream((event) => {
      if (event.type === "feed" || event.type === "stories" || event.type === "profile") {
        void fetchProfileDetail(profile.profile.handle)
          .then(setProfile)
          .catch(() => undefined);
      }
    });

    return unsubscribe;
  }, [profile.profile.handle]);

  useEffect(() => {
    if (!postViewerOpenId || !postListRef.current) {
      return;
    }

    const node = postCardRefs.current[postViewerOpenId];
    if (!node) {
      return;
    }

    requestAnimationFrame(() => {
      node.scrollIntoView({ block: "start" });
      setPostViewerVisible(true);
    });
  }, [postViewerOpenId]);

  function updatePost(postId: string, updater: (post: MobilePost) => MobilePost) {
    setProfile((current) => ({
      ...current,
      posts: current.posts.map((post) => (post.id === postId ? updater(post) : post))
    }));
  }

  async function handleLike(postId: string) {
    const current = profile.posts.find((post) => post.id === postId);
    if (!current) {
      return;
    }

    updatePost(postId, (post) => ({
      ...post,
      hasLiked: !post.hasLiked,
      likeCount: post.likeCount + (post.hasLiked ? -1 : 1)
    }));

    try {
      await likePost(postId);
    } catch {
      updatePost(postId, () => current);
    }
  }

  async function handleCommentSubmit(postId: string) {
    const draft = commentDrafts[postId]?.trim() ?? "";
    if (!draft || pendingComments[postId]) {
      return;
    }

    setCommentError(null);
    setPendingComments((current) => ({ ...current, [postId]: true }));

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticComment: MobilePostComment = {
      id: optimisticId,
      postId,
      authorId: profile.viewer.id,
      authorHandle: profile.viewer.handle,
      authorDisplayName: profile.viewer.displayName,
      authorAvatarUrl: profile.viewer.avatarUrl,
      body: draft,
      createdAt: new Date().toISOString()
    };

    updatePost(postId, (post) => ({
      ...post,
      commentCount: post.commentCount + 1,
      comments: [...post.comments, optimisticComment]
    }));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));

    try {
      const created = await createPostComment(postId, draft);
      updatePost(postId, (post) => ({
        ...post,
        comments: post.comments.map((comment) => (comment.id === optimisticId ? created : comment))
      }));
    } catch (error) {
      updatePost(postId, (post) => ({
        ...post,
        commentCount: Math.max(0, post.commentCount - 1),
        comments: post.comments.filter((comment) => comment.id !== optimisticId)
      }));
      setCommentDrafts((current) => ({ ...current, [postId]: draft }));
      setCommentError(error instanceof Error ? error.message : "No se pudo publicar el comentario.");
    } finally {
      setPendingComments((current) => ({ ...current, [postId]: false }));
    }
  }

  const headerAction = backHref ? (
    <Link href={backHref} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
      <ArrowLeft className="h-5 w-5" />
    </Link>
  ) : (
    <button
      type="button"
      onClick={async () => {
        await mobileLogout();
        router.replace("/login");
        router.refresh();
      }}
      className="flex h-12 items-center gap-2 rounded-2xl bg-white/90 px-4 text-sm font-semibold shadow-sm"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="rounded-full bg-white/90 px-4 py-3 text-sm font-semibold shadow-sm">
            {profile.isViewer ? "Perfil" : `@${profile.profile.handle}`}
          </div>
          {headerAction}
        </div>

        <section className="rounded-[2rem] border border-[var(--line-soft)] bg-white/94 p-5 shadow-[0_18px_40px_rgba(29,22,15,0.06)]">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <button
                type="button"
                disabled={!hasStories}
                onClick={() => {
                  if (hasStories) {
                    setActiveStoryOpen(true);
                  }
                }}
                className={cn(!hasStories && "cursor-default")}
              >
                <ProfileAvatar profile={profile.profile} ring={hasStories} />
              </button>

              {profile.isViewer ? (
                <label className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[var(--text-main)] text-white shadow-lg">
                  <Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }

                      setPendingAvatar(true);
                      try {
                        const upload = await uploadManagedMediaFromClient(file, "avatar");
                        const next = await updateViewerProfile({
                          displayName: profile.profile.displayName,
                          city: profile.profile.city,
                          bio: profile.profile.bio,
                          avatarUrl: upload.assetRef,
                          coverUrl: profile.profile.coverUrl
                        });

                        setProfile((current) => ({
                          ...current,
                          viewer: { ...current.viewer, avatarUrl: next.avatarUrl },
                          profile: { ...current.profile, avatarUrl: next.avatarUrl }
                        }));
                      } finally {
                        setPendingAvatar(false);
                        event.currentTarget.value = "";
                      }
                    }}
                  />
                </label>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-2xl font-black tracking-[-0.05em]">@{profile.profile.handle}</div>
              <div className="mt-1 text-sm font-semibold">{profile.profile.displayName}</div>
              <div className="mt-1 text-sm text-[var(--text-soft)]">{profile.profile.city}</div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ["Publicaciones", profile.posts.length],
                  ["Creados", profile.createdEvents.length],
                  ["Amigos", profile.friendCount]
                ].map(([label, value]) => (
                  <div key={label} className="text-center">
                    <div className="text-xl font-black tracking-[-0.04em]">{value}</div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--text-soft)]">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {profile.profile.bio ? (
              <p className="text-sm leading-6 text-[var(--text-main)]">{profile.profile.bio}</p>
            ) : (
              <p className="text-sm text-[var(--text-soft)]">Sin bio todavia.</p>
            )}
            {hasStories ? (
              <button
                type="button"
                onClick={() => setActiveStoryOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,107,87,0.08)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--coral)]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {activeStories.length} historia{activeStories.length === 1 ? "" : "s"} activa{activeStories.length === 1 ? "" : "s"}
              </button>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Publicaciones</div>
            <div className="text-xs font-semibold text-[var(--text-soft)]">{profile.posts.length}</div>
          </div>

          {profile.posts.length ? (
            <div className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-[1.8rem] bg-[var(--line-soft)]">
              {profile.posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => {
                    setPostViewerVisible(false);
                    setPostViewerOpenId(post.id);
                    setActivePostId(post.id);
                  }}
                  className="bg-[var(--bg-soft)]"
                >
                  {post.mediaItems.length ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.mediaItems[0]?.previewUrl ?? ""}
                      alt={post.caption || `Post de @${post.authorHandle}`}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <EmptyPostTile />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-10 text-center text-sm text-[var(--text-soft)]">
              Aun no hay publicaciones en este perfil.
            </div>
          )}
        </section>

        {pendingAvatar ? <div className="text-sm text-[var(--text-soft)]">Guardando foto de perfil...</div> : null}
        {commentError ? <div className="text-sm text-[#b84031]">{commentError}</div> : null}
      </div>

      {activeStoryOpen && hasStories ? (
        <StoryViewer owner={profile.profile} stories={activeStories} onClose={() => setActiveStoryOpen(false)} />
      ) : null}

      {postViewerOpenId ? (
        <div className="fixed inset-0 z-50 bg-black/90 text-[var(--text-main)]">
          <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-[var(--bg-main)]">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--line-soft)] bg-[rgba(246,239,231,0.96)] px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => {
                  setPostViewerOpenId(null);
                  setActivePostId(null);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="text-center">
                <div className="text-base font-black tracking-[-0.03em]">Publicaciones</div>
                <div className="text-xs text-[var(--text-soft)]">@{profile.profile.handle}</div>
              </div>
              <div className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--text-soft)] shadow-sm">
                {profile.posts.length ? `${currentOverlayIndex + 1}/${profile.posts.length}` : "0/0"}
              </div>
            </div>

            <div
              ref={postListRef}
              className={cn("flex-1 overflow-y-auto", !postViewerVisible && "opacity-0")}
              onScroll={(event) => {
                const containerTop = event.currentTarget.getBoundingClientRect().top;
                let closestId = activePostId;
                let smallestDistance = Number.POSITIVE_INFINITY;

                for (const post of profile.posts) {
                  const node = postCardRefs.current[post.id];
                  if (!node) {
                    continue;
                  }

                  const distance = Math.abs(node.getBoundingClientRect().top - containerTop);
                  if (distance < smallestDistance) {
                    smallestDistance = distance;
                    closestId = post.id;
                  }
                }

                if (closestId && closestId !== activePostId) {
                  setActivePostId(closestId);
                }
              }}
            >
              {profile.posts.map((post) => (
                <div
                  key={post.id}
                  ref={(node) => {
                    postCardRefs.current[post.id] = node;
                  }}
                >
                  <article data-post-id={post.id} className="border-b border-[var(--line-soft)] bg-white">
                    <div className="flex items-center justify-between gap-3 px-4 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          setPostViewerOpenId(null);
                          setActivePostId(null);
                          router.push(`/perfil/${post.authorHandle}`);
                        }}
                        className="flex min-w-0 items-center gap-3 text-left"
                      >
                        <ProfileAvatar
                          profile={{
                            id: post.authorId,
                            handle: post.authorHandle,
                            displayName: post.authorDisplayName,
                            city: "",
                            bio: "",
                            avatarUrl: post.authorAvatarUrl,
                            coverUrl: null,
                            createdAt: post.createdAt
                          }}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">@{post.authorHandle}</div>
                          <div className="truncate text-xs text-[var(--text-soft)]">{post.ownerLabel}</div>
                        </div>
                      </button>
                      <div className="text-xs text-[var(--text-soft)]">{formatRelativeMobileTime(post.createdAt)}</div>
                    </div>

                    <MobilePostCarousel
                      items={post.mediaItems}
                      label={post.caption || `Post de @${post.authorHandle}`}
                      aspectClassName="aspect-[4/5]"
                    />

                    <div className="space-y-3 px-4 py-4">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => void handleLike(post.id)}
                          className="inline-flex items-center gap-2 text-sm font-semibold"
                        >
                          <Heart className={post.hasLiked ? "h-6 w-6 fill-[var(--coral)] text-[var(--coral)]" : "h-6 w-6"} />
                          {post.likeCount}
                        </button>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                          <MessageCircle className="h-5 w-5" />
                          {post.commentCount}
                        </div>
                      </div>

                      {post.caption ? (
                        <p className="text-sm leading-6">
                          <button
                            type="button"
                            onClick={() => {
                              setPostViewerOpenId(null);
                              setActivePostId(null);
                              router.push(`/perfil/${post.authorHandle}`);
                            }}
                            className="mr-2 font-semibold"
                          >
                            @{post.authorHandle}
                          </button>
                          {post.caption}
                        </p>
                      ) : null}

                      <div className="space-y-2">
                        {post.comments.length ? (
                          post.comments.map((comment) => (
                            <div key={comment.id} className="text-sm leading-6">
                              <button
                                type="button"
                                onClick={() => {
                                  setPostViewerOpenId(null);
                                  setActivePostId(null);
                                  router.push(`/perfil/${comment.authorHandle}`);
                                }}
                                className="mr-2 font-semibold"
                              >
                                @{comment.authorHandle}
                              </button>
                              {comment.body}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-[var(--text-soft)]">Todavia no hay comentarios.</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-2">
                        <input
                          value={commentDrafts[post.id] ?? ""}
                          onChange={(event) =>
                            setCommentDrafts((current) => ({
                              ...current,
                              [post.id]: event.target.value
                            }))
                          }
                          placeholder="Añade un comentario..."
                          className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-[var(--text-soft)]"
                        />
                        <button
                          type="button"
                          disabled={pendingComments[post.id] || !(commentDrafts[post.id] ?? "").trim()}
                          onClick={() => void handleCommentSubmit(post.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--text-main)] text-white disabled:opacity-45"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
