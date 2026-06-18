"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CornerUpLeft,
  Heart,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Settings,
  Send
} from "lucide-react";
import {
  blockProfile,
  createConversation,
  createPostComment,
  fetchProfileDetail,
  likePost,
  mobileLogout,
  subscribeToMobileStream,
  unblockProfile,
  updateViewerProfile
} from "@/lib/mobile-api";
import { MobileFollowButton } from "@/components/mobile/mobile-follow-button";
import { MobilePostCarousel } from "@/components/mobile/mobile-post-carousel";
import { MobileStoryOverlay } from "@/components/mobile/mobile-story-overlay";
import { formatMobileDateTime, formatRelativeMobileTime } from "@/lib/mobile-shared";
import { uploadManagedMediaFromClient } from "@/lib/tindereo-api";
import type { MobilePost, MobilePostComment, MobileProfile, MobileProfileDetail, MobileStoryCluster } from "@/lib/mobile-types";

type MobileProfileScreenProps = {
  backHref?: string;
  initialProfile: MobileProfileDetail;
};

const PROFILE_CACHE_PREFIX = "mobile-cache:profile:";
const COMMENT_REPLY_PREFIX = "[reply:";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function readProfileCache(handle: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(`${PROFILE_CACHE_PREFIX}${handle.toLowerCase()}`);
    return raw ? (JSON.parse(raw) as MobileProfileDetail) : null;
  } catch {
    return null;
  }
}

function writeProfileCache(profile: MobileProfileDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(`${PROFILE_CACHE_PREFIX}${profile.profile.handle.toLowerCase()}`, JSON.stringify(profile));
}

type ParsedPostCommentReply = {
  commentId: string;
  authorHandle: string;
  snippet: string;
} | null;

function parsePostCommentBody(body: string) {
  const trimmed = body.trim();
  if (!trimmed.startsWith(COMMENT_REPLY_PREFIX)) {
    return { body: trimmed, reply: null as ParsedPostCommentReply };
  }

  const closingIndex = trimmed.indexOf("]");
  if (closingIndex < 0) {
    return { body: trimmed, reply: null as ParsedPostCommentReply };
  }

  const payload = trimmed.slice(COMMENT_REPLY_PREFIX.length, closingIndex);
  const [commentId, encodedHandle, encodedSnippet] = payload.split("|");
  return {
    body: trimmed.slice(closingIndex + 1).trim(),
    reply:
      commentId && encodedHandle
        ? {
            commentId,
            authorHandle: decodeURIComponent(encodedHandle),
            snippet: decodeURIComponent(encodedSnippet ?? "")
          }
        : null
  };
}

function getPostCommentSnippet(comment: MobilePostComment) {
  const parsed = parsePostCommentBody(comment.body);
  return parsed.body || "comentario";
}

function buildPostCommentBody(body: string, replyTarget: MobilePostComment | null) {
  const trimmed = body.trim();
  if (!replyTarget) {
    return trimmed;
  }

  const encodedHandle = encodeURIComponent(replyTarget.authorHandle);
  const encodedSnippet = encodeURIComponent(getPostCommentSnippet(replyTarget).slice(0, 80));
  return `${COMMENT_REPLY_PREFIX}${replyTarget.id}|${encodedHandle}|${encodedSnippet}] ${trimmed}`;
}

function ProfileAvatar({
  profile,
  ring = false,
  ringTone = "active",
  size = "lg"
}: {
  profile: MobileProfile;
  ring?: boolean;
  ringTone?: "active" | "seen";
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
    <span
      className={cn(
        "inline-flex rounded-full p-[3px]",
        ringTone === "active"
          ? "bg-gradient-to-br from-[var(--coral)] to-[var(--orange)] shadow-[0_14px_28px_rgba(240,138,36,0.22)]"
          : "bg-[var(--line-soft)]"
      )}
    >
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

function ProfileMiniAvatar({ profile }: { profile: { handle: string; avatarUrl: string | null } }) {
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatarUrl} alt={`@${profile.handle}`} className="h-11 w-11 rounded-full object-cover" />
    );
  }

  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-main)]">
      {profile.handle.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function MobileProfileScreen({ backHref, initialProfile }: MobileProfileScreenProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [pendingAvatar, setPendingAvatar] = useState(false);
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);
  const [activeStoryOpen, setActiveStoryOpen] = useState(false);
  const [storyStartIndex, setStoryStartIndex] = useState<number | null>(null);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);
  const [postViewerOpenId, setPostViewerOpenId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentReplyTargets, setCommentReplyTargets] = useState<Record<string, MobilePostComment | null>>({});
  const [pendingComments, setPendingComments] = useState<Record<string, boolean>>({});
  const [commentError, setCommentError] = useState<string | null>(null);
  const [postViewerVisible, setPostViewerVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileActionsOpen, setProfileActionsOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [peopleSheet, setPeopleSheet] = useState<"followers" | "following" | null>(null);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [visiblePeopleCount, setVisiblePeopleCount] = useState(20);
  const [profileEventIndex, setProfileEventIndex] = useState(0);
  const [messageComposerOpen, setMessageComposerOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageNotice, setMessageNotice] = useState<string | null>(null);
  const [profileActionNotice, setProfileActionNotice] = useState<string | null>(null);
  const [blockBusyHandle, setBlockBusyHandle] = useState<string | null>(null);
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const postListRef = useRef<HTMLDivElement | null>(null);
  const postCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeStories = useMemo(
    () => [...profile.stories].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [profile.stories]
  );
  const hasStories = activeStories.length > 0;
  const hasUnseenStories = useMemo(
    () => activeStories.some((story) => !story.hasSeen && !seenStoryIds.includes(story.id)),
    [activeStories, seenStoryIds]
  );
  const storyCluster = useMemo<MobileStoryCluster[]>(
    () =>
      hasStories
        ? [
            {
              ownerId: profile.profile.id,
              ownerType: "user",
              ownerLabel: `@${profile.profile.handle}`,
              ownerAvatarUrl: profile.profile.avatarUrl,
              unseenCount: activeStories.filter((story) => !story.hasSeen && !seenStoryIds.includes(story.id)).length,
              stories: activeStories
            }
          ]
        : [],
    [activeStories, hasStories, profile.profile.avatarUrl, profile.profile.handle, profile.profile.id, seenStoryIds]
  );
  const initialStoryIndex = useMemo(() => {
    const firstPendingIndex = activeStories.findIndex((story) => !story.hasSeen && !seenStoryIds.includes(story.id));
    return firstPendingIndex >= 0 ? firstPendingIndex : Math.max(0, activeStories.length - 1);
  }, [activeStories, seenStoryIds]);
  const currentOverlayIndex = useMemo(
    () => Math.max(0, profile.posts.findIndex((post) => post.id === activePostId)),
    [activePostId, profile.posts]
  );
  const visiblePeople = useMemo(() => {
    const source = peopleSheet === "followers" ? profile.followers : profile.following;
    const normalizedQuery = peopleQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? source.filter(
          (entry) =>
            entry.handle.toLowerCase().includes(normalizedQuery) ||
            entry.displayName.toLowerCase().includes(normalizedQuery) ||
            entry.city.toLowerCase().includes(normalizedQuery)
        )
      : source;

    return {
      all: filtered,
      items: filtered.slice(0, visiblePeopleCount)
    };
  }, [peopleQuery, peopleSheet, profile.followers, profile.following, visiblePeopleCount]);
  const profileEvents = useMemo(
    () =>
      [...profile.createdEvents, ...profile.joinedEvents].filter(
        (event, index, events) => events.findIndex((candidate) => candidate.id === event.id) === index
      ),
    [profile.createdEvents, profile.joinedEvents]
  );
  const canOpenPrivateSections = profile.isViewer || !profile.profile.isPrivate;
  const featuredEvent = useMemo(
    () =>
      [...profileEvents]
        .sort((left, right) => {
          if (left.experienceState === "live" && right.experienceState !== "live") {
            return -1;
          }
          if (right.experienceState === "live" && left.experienceState !== "live") {
            return 1;
          }
          return left.startsAt.localeCompare(right.startsAt);
        })[0] ?? null,
    [profileEvents]
  );
  const featuredPost = useMemo(
    () =>
      [...profile.posts].sort((left, right) => {
        if (right.likeCount !== left.likeCount) {
          return right.likeCount - left.likeCount;
        }
        if (right.commentCount !== left.commentCount) {
          return right.commentCount - left.commentCount;
        }
        return right.createdAt.localeCompare(left.createdAt);
      })[0] ?? null,
    [profile.posts]
  );
  const sharedFollowersLabel = useMemo(() => {
    if (!profile.sharedFollowerCount) {
      return null;
    }

    const [first, second] = profile.sharedFollowers;
    const firstLabel = first ? `@${first.handle}` : null;
    const secondLabel = second ? `@${second.handle}` : null;

    if (profile.sharedFollowerCount === 1 && firstLabel) {
      return `${firstLabel} sigue a este usuario`;
    }
    if (profile.sharedFollowerCount === 2 && firstLabel && secondLabel) {
      return `${firstLabel} y ${secondLabel} siguen a este usuario`;
    }
    if (firstLabel) {
      return `${firstLabel} y ${profile.sharedFollowerCount - 1} personas mas siguen a este usuario`;
    }

    return `${profile.sharedFollowerCount} personas siguen a este usuario`;
  }, [profile.sharedFollowerCount, profile.sharedFollowers]);

  useEffect(() => {
    const cached = readProfileCache(initialProfile.profile.handle);
    if (cached) {
      setProfile(cached);
    }
  }, [initialProfile.profile.handle]);

  useEffect(() => {
    writeProfileCache(profile);
  }, [profile]);

  useEffect(() => {
    setProfileEventIndex((current) => Math.min(current, Math.max(0, profileEvents.length - 1)));
  }, [profileEvents.length]);

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

  useEffect(() => {
    setPeopleQuery("");
    setVisiblePeopleCount(20);
  }, [peopleSheet]);

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
    const replyTarget = commentReplyTargets[postId] ?? null;
    const encodedBody = buildPostCommentBody(draft, replyTarget);

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticComment: MobilePostComment = {
      id: optimisticId,
      postId,
      authorId: profile.viewer.id,
      authorHandle: profile.viewer.handle,
      authorDisplayName: profile.viewer.displayName,
      authorAvatarUrl: profile.viewer.avatarUrl,
      body: encodedBody,
      createdAt: new Date().toISOString()
    };

    updatePost(postId, (post) => ({
      ...post,
      commentCount: post.commentCount + 1,
      comments: [...post.comments, optimisticComment]
    }));
    setCommentDrafts((current) => ({ ...current, [postId]: "" }));
    setCommentReplyTargets((current) => ({ ...current, [postId]: null }));

    try {
      const created = await createPostComment(postId, encodedBody);
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
      setCommentReplyTargets((current) => ({ ...current, [postId]: replyTarget }));
      setCommentError(error instanceof Error ? error.message : "No se pudo publicar el comentario.");
    } finally {
      setPendingComments((current) => ({ ...current, [postId]: false }));
    }
  }

  async function handleLogout() {
    await mobileLogout();
    router.replace("/login");
    router.refresh();
  }

  async function handleOpenMessage() {
    setMessageNotice(null);

    try {
      if (profile.relationship.followedByProfile) {
        const created = await createConversation({
          kind: "direct",
          title: null,
          participantIds: [profile.profile.id]
        });
        if (created.conversationId) {
          router.push(`/chat/${created.conversationId}`);
        }
        return;
      }

      setMessageComposerOpen(true);
    } catch (error) {
      setMessageNotice(error instanceof Error ? error.message : "No pude abrir este chat.");
    }
  }

  async function handleSendMessageRequest() {
    const trimmedDraft = messageDraft.trim();
    if (!trimmedDraft || messageBusy) {
      return;
    }

    setMessageBusy(true);
    setMessageNotice(null);
    try {
      const created = await createConversation({
        kind: "direct",
        title: null,
        participantIds: [profile.profile.id],
        initialBody: trimmedDraft
      });
      if (created.mode === "conversation" && created.conversationId) {
        setMessageComposerOpen(false);
        setMessageDraft("");
        router.push(`/chat/${created.conversationId}`);
        return;
      }

      setMessageComposerOpen(false);
      setMessageDraft("");
      setMessageNotice("Solicitud de chat enviada.");
    } catch (error) {
      setMessageNotice(error instanceof Error ? error.message : "No pude abrir este chat.");
    } finally {
      setMessageBusy(false);
    }
  }

  async function handleBlockCurrentProfile() {
    if (profile.isViewer || blockBusyHandle === profile.profile.handle) {
      return;
    }

    setBlockBusyHandle(profile.profile.handle);
    setProfileActionNotice(null);

    try {
      await blockProfile(profile.profile.handle);
      setConfirmBlockOpen(false);
      setProfileActionsOpen(false);
      router.push(backHref ?? "/buscar");
      router.refresh();
    } catch (error) {
      setProfileActionNotice(error instanceof Error ? error.message : "No pude bloquear este perfil.");
    } finally {
      setBlockBusyHandle(null);
    }
  }

  async function handleShareProfile() {
    const shareUrl =
      typeof window !== "undefined" ? `${window.location.origin}/perfil/${profile.profile.handle}` : "";
    const shareText = `Mira el perfil de @${profile.profile.handle} en Tindereo`;

    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({
        title: `@${profile.profile.handle}`,
        text: shareText,
        url: shareUrl
      });
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl || shareText);
      setProfileActionNotice("Perfil copiado al portapapeles.");
    }
  }

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    if (backHref) {
      router.push(backHref);
    }
  }

  const headerAction = backHref ? (
    <button
      type="button"
      onClick={handleBack}
      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void handleLogout()}
      className="flex h-12 items-center gap-2 rounded-2xl bg-white/90 px-4 text-sm font-semibold shadow-sm"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );

  return (
    <>
      <div
        className="space-y-5"
        onTouchEnd={(event) => {
          if (!backHref || !gestureStartRef.current) {
            gestureStartRef.current = null;
            return;
          }

          const touch = event.changedTouches[0];
          if (!touch) {
            gestureStartRef.current = null;
            return;
          }

          const deltaX = touch.clientX - gestureStartRef.current.x;
          const deltaY = Math.abs(touch.clientY - gestureStartRef.current.y);
          gestureStartRef.current = null;

          if (deltaX > 92 && deltaY < 64) {
            handleBack();
          }
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) {
            return;
          }

          gestureStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
      >
        <div className="flex items-center justify-between">
          {profile.isViewer ? (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm"
            >
              <Settings className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setProfileActionsOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm"
              aria-label="Opciones del perfil"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          )}
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
                    setStoryStartIndex(null);
                    setActiveStoryOpen(true);
                  }
                }}
                className={cn(!hasStories && "cursor-default")}
              >
                <ProfileAvatar
                  profile={profile.profile}
                  ring={hasStories}
                  ringTone={profile.isViewer || hasUnseenStories ? "active" : "seen"}
                />
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
                          coverUrl: profile.profile.coverUrl,
                          isPrivate: profile.profile.isPrivate
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
              {profile.profile.isPrivate ? (
                <div className="mt-2 space-y-2">
                  <div className="inline-flex rounded-full bg-[var(--bg-soft)] px-3 py-2 text-[11px] font-semibold text-[var(--text-soft)]">
                    Perfil privado
                  </div>
                  {sharedFollowersLabel && !profile.isViewer ? (
                    <div className="max-w-[240px] text-xs leading-5 text-[var(--text-soft)]">
                      {sharedFollowersLabel}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {!profile.isViewer ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <MobileFollowButton
                    handle={profile.profile.handle}
                    isPrivate={profile.profile.isPrivate}
                    relationship={profile.relationship}
                    onChange={(relationship) => {
                      setProfile((current) => ({
                        ...current,
                        relationship,
                        profile: { ...current.profile, relationship },
                        followerCount:
                          relationship.followsProfile && !current.relationship.followsProfile
                            ? current.followerCount + 1
                            : !relationship.followsProfile && current.relationship.followsProfile
                              ? Math.max(0, current.followerCount - 1)
                          : current.followerCount
                      }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleOpenMessage()}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line-warm)] bg-white px-4 py-3 text-sm font-semibold"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Mensaje
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareProfile()}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line-warm)] bg-white px-4 py-3 text-sm font-semibold"
                  >
                    <Share2 className="h-4 w-4" />
                    Compartir
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void handleShareProfile()}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--line-warm)] bg-white px-4 py-3 text-sm font-semibold"
                  >
                    <Share2 className="h-4 w-4" />
                    Compartir perfil
                  </button>
                </div>
              )}
              {!profile.isViewer && messageNotice ? (
                <div className="mt-3 text-xs text-[var(--text-soft)]">{messageNotice}</div>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  ["Posts", profile.posts.length],
                  ["Seguidores", profile.followerCount],
                  ["Seguidos", profile.followingCount]
                ].map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    disabled={!canOpenPrivateSections && label !== "Posts"}
                    onClick={() => {
                      if (!canOpenPrivateSections) {
                        return;
                      }
                      if (label === "Seguidores") {
                        setPeopleSheet("followers");
                      }
                      if (label === "Seguidos") {
                        setPeopleSheet("following");
                      }
                    }}
                    className={cn(
                      "rounded-[1.2rem] bg-[var(--bg-soft)] px-2 py-2 text-center",
                      !canOpenPrivateSections && label !== "Posts" && "opacity-70"
                    )}
                  >
                    <div className="text-lg font-black tracking-[-0.04em]">{value}</div>
                    <div className="mt-1 text-[10px] font-semibold text-[var(--text-soft)]">{label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            {profile.profile.bio ? (
              <p className="text-sm leading-6 text-[var(--text-main)]">{profile.profile.bio}</p>
            ) : (
              <p className="text-sm text-[var(--text-soft)]">Sin bio todavia.</p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          {profile.canViewContent && activeStories.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Destacados</div>
                <div className="text-xs font-semibold text-[var(--text-soft)]">{activeStories.length}</div>
              </div>
              <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {activeStories.map((story, index) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => {
                      setStoryStartIndex(index);
                      setActiveStoryOpen(true);
                    }}
                    className="w-[152px] shrink-0 overflow-hidden rounded-[1.7rem] border border-[var(--line-soft)] bg-white text-left shadow-sm"
                  >
                    {story.media?.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={story.media.previewUrl}
                        alt={story.caption || `Historia ${index + 1}`}
                        className="h-28 w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-soft)]">
                        Historia
                      </div>
                    )}
                    <div className="space-y-1 px-3 py-3">
                      <div className="text-xs font-semibold text-[var(--text-soft)]">{formatRelativeMobileTime(story.createdAt)}</div>
                      <div className="line-clamp-2 text-sm font-semibold">{story.caption || "Historia activa"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {profile.canViewContent && featuredEvent ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Evento destacado</div>
                <div className="rounded-full bg-[var(--bg-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--coral)]">
                  {featuredEvent.experienceState === "live" ? "En vivo" : "Proximo"}
                </div>
              </div>
              <Link
                href={`/evento/${featuredEvent.slug}`}
                className="block rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold">{featuredEvent.title}</div>
                    <div className="mt-1 text-sm text-[var(--text-soft)]">{featuredEvent.city}</div>
                    <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-soft)]">
                      <CalendarDays className="h-4 w-4" />
                      {formatMobileDateTime(featuredEvent.startsAt)}
                    </div>
                  </div>
                </div>
              </Link>
            </section>
          ) : null}

          {profile.canViewContent && featuredPost ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Post destacado</div>
                <div className="rounded-full bg-[var(--bg-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--coral)]">
                  {featuredPost.likeCount} likes
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPostViewerVisible(false);
                  setPostViewerOpenId(featuredPost.id);
                  setActivePostId(featuredPost.id);
                }}
                className="w-full overflow-hidden rounded-[1.8rem] border border-[var(--line-soft)] bg-white text-left shadow-sm"
              >
                {featuredPost.mediaItems[0]?.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featuredPost.mediaItems[0].previewUrl}
                    alt={featuredPost.caption || `Post de @${featuredPost.authorHandle}`}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <EmptyPostTile />
                )}
                <div className="space-y-2 px-4 py-4">
                  <div className="text-sm font-semibold">@{featuredPost.authorHandle}</div>
                  {featuredPost.caption ? <div className="line-clamp-2 text-sm text-[var(--text-soft)]">{featuredPost.caption}</div> : null}
                </div>
              </button>
            </section>
          ) : null}

        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Eventos</div>
            <div className="text-xs font-semibold text-[var(--text-soft)]">{profileEvents.length}</div>
          </div>
          {profile.profile.isPrivate && !profile.isViewer ? (
            <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
              El perfil es privado. Puedes ver el numero de eventos, pero no abrirlos.
            </div>
          ) : profileEvents.length ? (
            <>
              <div
                className="scrollbar-hide -mx-1 flex snap-x snap-mandatory overflow-x-auto px-1 pb-1"
                onScroll={(event) => {
                  const node = event.currentTarget;
                  const width = node.clientWidth || 1;
                  setProfileEventIndex(
                    Math.max(0, Math.min(profileEvents.length - 1, Math.round(node.scrollLeft / width)))
                  );
                }}
              >
              {profileEvents.map((event) => (
                  <div key={event.id} className="w-full min-w-full shrink-0 snap-center px-1">
                    <div className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 shadow-sm">
                      <Link href={`/evento/${event.slug}`} className="block">
                        <div className="text-base font-bold">{event.title}</div>
                        <div className="mt-1 text-sm text-[var(--text-soft)]">{event.city}</div>
                        <div className="mt-3 text-xs text-[var(--text-soft)]">{formatMobileDateTime(event.startsAt)}</div>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              {profileEvents.length > 1 ? (
                <div className="mt-3 flex items-center justify-center gap-2">
                  {profileEvents.map((event, index) => (
                    <span
                      key={event.id}
                      className={
                        index === profileEventIndex
                          ? "h-2 w-2 rounded-full bg-[var(--coral)]"
                          : "h-2 w-2 rounded-full bg-[var(--line-warm)]"
                      }
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
              Aun no hay eventos en este perfil.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">Publicaciones</div>
            <div className="text-xs font-semibold text-[var(--text-soft)]">{profile.posts.length}</div>
          </div>

          {profile.canViewContent && profile.posts.length ? (
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
          ) : !profile.canViewContent ? (
            <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-10 text-center text-sm text-[var(--text-soft)]">
              Las publicaciones se desbloquean cuando acepten tu seguimiento.
            </div>
          ) : (
            <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-10 text-center text-sm text-[var(--text-soft)]">
              Aun no hay publicaciones en este perfil.
            </div>
          )}
        </section>

        {pendingAvatar ? <div className="text-sm text-[var(--text-soft)]">Guardando foto de perfil...</div> : null}
        {updatingPrivacy ? <div className="text-sm text-[var(--text-soft)]">Actualizando privacidad...</div> : null}
        {commentError ? <div className="text-sm text-[#b84031]">{commentError}</div> : null}
        {profileActionNotice ? <div className="text-sm text-[#b84031]">{profileActionNotice}</div> : null}
      </div>

      {profileActionsOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setProfileActionsOpen(false)}>
          <div
            className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-black tracking-[-0.03em]">Opciones del perfil</div>
                <div className="text-sm text-[var(--text-soft)]">@{profile.profile.handle}</div>
              </div>
              <button
                type="button"
                onClick={() => setProfileActionsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-soft)]"
              >
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setProfileActionsOpen(false);
                setConfirmBlockOpen(true);
              }}
              className="w-full rounded-[1.6rem] border border-[var(--line-soft)] px-4 py-4 text-left text-sm font-semibold text-[#b84031]"
            >
              Bloquear perfil
            </button>
          </div>
        </div>
      ) : null}

      {confirmBlockOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/30 px-4" onClick={() => setConfirmBlockOpen(false)}>
          <div className="flex min-h-full items-end justify-center py-6">
            <div
              className="w-full max-w-sm rounded-[2rem] bg-white p-5 shadow-[0_24px_80px_rgba(27,19,10,0.22)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="text-lg font-semibold text-[var(--text-main)]">
                Bloquear a @{profile.profile.handle}
              </div>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Si confirmas, desaparecera de tu app y tambien dejara de verte.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmBlockOpen(false)}
                  className="flex-1 rounded-full border border-[var(--line-warm)] px-4 py-3 text-sm font-semibold text-[var(--text-main)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={blockBusyHandle === profile.profile.handle}
                  onClick={() => void handleBlockCurrentProfile()}
                  className="flex-1 rounded-full bg-[var(--text-main)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {blockBusyHandle === profile.profile.handle ? "Bloqueando..." : "Bloquear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSettingsOpen(false)}>
          <div
            className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-lg font-black tracking-[-0.03em]">Centro de operaciones</div>
                <div className="text-sm text-[var(--text-soft)]">Privacidad y ajustes rapidos del perfil.</div>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-soft)]">
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>

            <div className="rounded-[1.6rem] border border-[var(--line-soft)] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Perfil privado</div>
                  <div className="mt-1 text-sm text-[var(--text-soft)]">
                    Si lo activas, te tendran que enviar solicitud antes de ver tus publicaciones e historias.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={updatingPrivacy}
                  onClick={async () => {
                    setUpdatingPrivacy(true);
                    try {
                      const next = await updateViewerProfile({
                        displayName: profile.profile.displayName,
                        city: profile.profile.city,
                        bio: profile.profile.bio,
                        avatarUrl: profile.profile.avatarUrl,
                        coverUrl: profile.profile.coverUrl,
                        isPrivate: !profile.profile.isPrivate
                      });
                      setProfile((current) => ({
                        ...current,
                        viewer: { ...current.viewer, isPrivate: next.isPrivate },
                        profile: { ...current.profile, isPrivate: next.isPrivate }
                      }));
                    } finally {
                      setUpdatingPrivacy(false);
                    }
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold",
                    profile.profile.isPrivate ? "bg-[var(--text-main)] text-white" : "border border-[var(--line-warm)]"
                  )}
                >
                  {profile.profile.isPrivate ? "Activado" : "Activar"}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[1.6rem] border border-[var(--line-soft)] px-4 py-4">
              <div className="text-sm font-semibold">Perfiles bloqueados</div>
              <div className="mt-1 text-sm text-[var(--text-soft)]">
                Puedes revisar a quien has bloqueado y desbloquearlo cuando quieras.
              </div>

              <div className="mt-4 space-y-3">
                {profile.blockedProfiles.length ? (
                  profile.blockedProfiles.map((blockedProfile) => (
                    <div key={blockedProfile.id} className="flex items-center gap-3 rounded-[1.4rem] border border-[var(--line-soft)] px-3 py-3">
                      <ProfileMiniAvatar profile={blockedProfile} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">@{blockedProfile.handle}</div>
                        <div className="truncate text-xs text-[var(--text-soft)]">
                          {blockedProfile.displayName || blockedProfile.city}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={blockBusyHandle === blockedProfile.handle}
                        onClick={async () => {
                          setBlockBusyHandle(blockedProfile.handle);
                          try {
                            await unblockProfile(blockedProfile.handle);
                            setProfile((current) => ({
                              ...current,
                              blockedProfiles: current.blockedProfiles.filter((entry) => entry.id !== blockedProfile.id)
                            }));
                          } finally {
                            setBlockBusyHandle(null);
                          }
                        }}
                        className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                      >
                        Desbloquear
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-[var(--line-warm)] px-4 py-4 text-sm text-[var(--text-soft)]">
                    No tienes perfiles bloqueados ahora mismo.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="mt-4 w-full rounded-[1.6rem] border border-[var(--line-soft)] px-4 py-4 text-sm font-semibold"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      ) : null}

      {messageComposerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setMessageComposerOpen(false)}>
          <div
            className="absolute bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-black tracking-[-0.03em]">Enviar primer mensaje</div>
                <div className="text-sm text-[var(--text-soft)]">
                  Si no te sigue de vuelta, le llegara como solicitud de chat.
                </div>
              </div>
              <button type="button" onClick={() => setMessageComposerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-soft)]">
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>

            <textarea
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={4}
              className="w-full rounded-[1.6rem] border border-[var(--line-soft)] px-4 py-4 text-sm outline-none"
            />

            {messageNotice ? (
              <div className="mt-3 text-sm text-[var(--text-soft)]">{messageNotice}</div>
            ) : null}

            <button
              type="button"
              disabled={!messageDraft.trim() || messageBusy}
              onClick={() => void handleSendMessageRequest()}
              className="mt-4 w-full rounded-[1.4rem] bg-[var(--text-main)] px-4 py-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {messageBusy ? "Enviando..." : "Enviar mensaje"}
            </button>
          </div>
        </div>
      ) : null}

      {peopleSheet ? (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setPeopleSheet(null)}>
          <div
            className="absolute bottom-0 left-1/2 flex h-[76dvh] w-full max-w-[480px] -translate-x-1/2 flex-col rounded-t-[2rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-black tracking-[-0.03em]">
                {peopleSheet === "followers" ? "Seguidores" : "Seguidos"}
              </div>
              <button type="button" onClick={() => setPeopleSheet(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-soft)]">
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>

            <input
              value={peopleQuery}
              onChange={(event) => setPeopleQuery(event.target.value)}
              placeholder={`Buscar en ${peopleSheet === "followers" ? "seguidores" : "seguidos"}`}
              className="rounded-[1.4rem] border border-[var(--line-soft)] px-4 py-3 text-sm outline-none"
            />

            <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
              {visiblePeople.items.map((person) => (
                <Link
                  key={`${peopleSheet}-${person.id}`}
                  href={`/perfil/${person.handle}`}
                  onClick={() => setPeopleSheet(null)}
                  className="flex items-center gap-3 rounded-[1.4rem] border border-[var(--line-soft)] px-3 py-3"
                >
                  <ProfileMiniAvatar profile={person} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">@{person.handle}</div>
                    <div className="truncate text-xs text-[var(--text-soft)]">{person.displayName || person.city}</div>
                  </div>
                </Link>
              ))}
              {!visiblePeople.items.length ? (
                <div className="rounded-[1.4rem] border border-dashed border-[var(--line-warm)] px-4 py-6 text-center text-sm text-[var(--text-soft)]">
                  No hay resultados en esta seccion.
                </div>
              ) : null}
            </div>

            {visiblePeople.items.length < visiblePeople.all.length ? (
              <button
                type="button"
                onClick={() => setVisiblePeopleCount((current) => current + 20)}
                className="mt-4 rounded-full border border-[var(--line-warm)] px-4 py-3 text-sm font-semibold"
              >
                Cargar mas
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeStoryOpen && hasStories ? (
        <MobileStoryOverlay
          clusters={storyCluster}
          initialClusterIndex={0}
          initialStoryIndex={storyStartIndex ?? initialStoryIndex}
          onClose={() => {
            setActiveStoryOpen(false);
            setStoryStartIndex(null);
          }}
          seenStoryIds={seenStoryIds}
          showOwnStoryStats={profile.isViewer}
          viewer={profile.viewer}
          onStorySeen={(storyId) => {
            setSeenStoryIds((current) => (current.includes(storyId) ? current : [...current, storyId]));
          }}
        />
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
                            isPrivate: false,
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
                      onDoubleLike={() => {
                        if (!post.hasLiked) {
                          void handleLike(post.id);
                        }
                      }}
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
                          (() => {
                            const rootComments = post.comments.filter(
                              (comment) => !parsePostCommentBody(comment.body).reply
                            );
                            const repliesByParent = new Map<string, MobilePostComment[]>();

                            for (const comment of post.comments) {
                              const parsed = parsePostCommentBody(comment.body);
                              if (!parsed.reply) {
                                continue;
                              }
                              const currentReplies = repliesByParent.get(parsed.reply.commentId) ?? [];
                              currentReplies.push(comment);
                              repliesByParent.set(parsed.reply.commentId, currentReplies);
                            }

                            return rootComments.map((comment) => {
                              const parsedComment = parsePostCommentBody(comment.body);
                              const replies = repliesByParent.get(comment.id) ?? [];

                              return (
                                <div key={comment.id} className="space-y-2 text-sm leading-6">
                                  <div>
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
                                    {parsedComment.body}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCommentReplyTargets((current) => ({
                                          ...current,
                                          [post.id]: comment
                                        }))
                                      }
                                      className="inline-flex items-center gap-1 font-semibold text-[var(--text-soft)]"
                                    >
                                      <CornerUpLeft className="h-3.5 w-3.5" />
                                      Responder
                                    </button>
                                    <span className="text-[var(--text-soft)]">{formatRelativeMobileTime(comment.createdAt)}</span>
                                  </div>

                                  {replies.length ? (
                                    <div className="space-y-2 border-l border-[var(--line-soft)] pl-4">
                                      {replies.map((reply) => {
                                        const parsedReply = parsePostCommentBody(reply.body);
                                        return (
                                          <div key={reply.id} className="space-y-1.5">
                                            <div className="text-sm leading-6">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPostViewerOpenId(null);
                                                  setActivePostId(null);
                                                  router.push(`/perfil/${reply.authorHandle}`);
                                                }}
                                                className="mr-2 font-semibold"
                                              >
                                                @{reply.authorHandle}
                                              </button>
                                              {parsedReply.reply ? (
                                                <span className="mr-2 rounded-full bg-[var(--bg-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--text-soft)]">
                                                  respondiendo a @{parsedReply.reply.authorHandle}
                                                </span>
                                              ) : null}
                                              {parsedReply.body}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setCommentReplyTargets((current) => ({
                                                    ...current,
                                                    [post.id]: reply
                                                  }))
                                                }
                                                className="inline-flex items-center gap-1 font-semibold text-[var(--text-soft)]"
                                              >
                                                <CornerUpLeft className="h-3.5 w-3.5" />
                                                Responder
                                              </button>
                                              <span className="text-[var(--text-soft)]">{formatRelativeMobileTime(reply.createdAt)}</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            });
                          })()
                        ) : (
                          <div className="text-sm text-[var(--text-soft)]">Todavia no hay comentarios.</div>
                        )}
                      </div>

                      {commentReplyTargets[post.id] ? (
                        <div className="flex items-center justify-between gap-3 rounded-[1.2rem] bg-[var(--bg-soft)] px-4 py-3 text-xs text-[var(--text-soft)]">
                          <div className="min-w-0">
                            <div className="font-semibold">Respondiendo a @{commentReplyTargets[post.id]?.authorHandle}</div>
                            <div className="truncate">{getPostCommentSnippet(commentReplyTargets[post.id]!)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCommentReplyTargets((current) => ({
                                ...current,
                                [post.id]: null
                              }))
                            }
                            className="rounded-full bg-white px-3 py-1.5 font-semibold text-[var(--text-main)]"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2 rounded-full border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-2">
                        <input
                          value={commentDrafts[post.id] ?? ""}
                          onChange={(event) =>
                            setCommentDrafts((current) => ({
                              ...current,
                              [post.id]: event.target.value
                            }))
                          }
                          placeholder={commentReplyTargets[post.id] ? "Escribe una respuesta..." : "Añade un comentario..."}
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
