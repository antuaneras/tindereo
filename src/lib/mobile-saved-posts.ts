import type { MobilePost } from "@/lib/mobile-types";

const SAVED_POST_IDS_KEY = "mobile-saved-posts:v1";
const SAVED_POST_SNAPSHOTS_KEY = "mobile-saved-post-snapshots:v1";
export const SAVED_POSTS_UPDATED_EVENT = "mobile-saved-posts-updated";

type SavedPostSnapshot = {
  post: MobilePost;
  savedAt: string;
};

function dispatchSavedPostsUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(SAVED_POSTS_UPDATED_EVENT));
}

function readSavedPostSnapshots() {
  if (typeof window === "undefined") {
    return [] as SavedPostSnapshot[];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_POST_SNAPSHOTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedPostSnapshot[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is SavedPostSnapshot =>
            Boolean(entry) &&
            typeof entry.savedAt === "string" &&
            Boolean(entry.post) &&
            typeof entry.post.id === "string"
        )
      : [];
  } catch {
    return [] as SavedPostSnapshot[];
  }
}

function writeSavedPostSnapshots(entries: SavedPostSnapshot[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SAVED_POST_SNAPSHOTS_KEY, JSON.stringify(entries));
}

export function readSavedPostIds() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_POST_IDS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [] as string[];
  }
}

export function writeSavedPostIds(postIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SAVED_POST_IDS_KEY, JSON.stringify(postIds));
}

export function isPostSaved(postId: string) {
  return readSavedPostIds().includes(postId);
}

export function readSavedPosts() {
  const savedIds = new Set(readSavedPostIds());
  return readSavedPostSnapshots()
    .filter((entry) => savedIds.has(entry.post.id))
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .map((entry) => entry.post);
}

export function removeSavedPost(postId: string) {
  const nextIds = readSavedPostIds().filter((entry) => entry !== postId);
  const nextSnapshots = readSavedPostSnapshots().filter((entry) => entry.post.id !== postId);
  writeSavedPostIds(nextIds);
  writeSavedPostSnapshots(nextSnapshots);
  dispatchSavedPostsUpdated();
}

export function syncSavedPostSnapshot(post: MobilePost) {
  if (!isPostSaved(post.id)) {
    return;
  }

  const existingEntries = readSavedPostSnapshots();
  const existingEntry = existingEntries.find((entry) => entry.post.id === post.id);
  const nextEntries = [
    {
      post,
      savedAt: existingEntry?.savedAt ?? new Date().toISOString()
    },
    ...existingEntries.filter((entry) => entry.post.id !== post.id)
  ];

  writeSavedPostSnapshots(nextEntries);
  dispatchSavedPostsUpdated();
}

export function savePost(post: MobilePost) {
  const nextIds = Array.from(new Set([post.id, ...readSavedPostIds()]));
  const existingEntries = readSavedPostSnapshots();
  const existingEntry = existingEntries.find((entry) => entry.post.id === post.id);
  const nextEntries = [
    {
      post,
      savedAt: existingEntry?.savedAt ?? new Date().toISOString()
    },
    ...existingEntries.filter((entry) => entry.post.id !== post.id)
  ];

  writeSavedPostIds(nextIds);
  writeSavedPostSnapshots(nextEntries);
  dispatchSavedPostsUpdated();
}

export function toggleSavedPost(post: MobilePost) {
  if (isPostSaved(post.id)) {
    removeSavedPost(post.id);
    return false;
  }

  savePost(post);
  return true;
}

export function hydrateSavedPostsFromCandidates(posts: MobilePost[]) {
  const savedIds = new Set(readSavedPostIds());
  if (!savedIds.size || !posts.length) {
    return;
  }

  const existingEntries = readSavedPostSnapshots();
  const existingIds = new Set(existingEntries.map((entry) => entry.post.id));
  const missingEntries = posts
    .filter((post) => savedIds.has(post.id) && !existingIds.has(post.id))
    .map((post) => ({
      post,
      savedAt: new Date().toISOString()
    }));

  if (!missingEntries.length) {
    return;
  }

  writeSavedPostSnapshots([...missingEntries, ...existingEntries]);
  dispatchSavedPostsUpdated();
}
