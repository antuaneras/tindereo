import { randomUUID } from "node:crypto";
import { buildSupabaseHeaders, getSupabaseUrl } from "./tindereo-supabase";
import type {
  AppDataset,
  EventGroupMessage,
  PlatformUser,
  PrivateMessage,
  SocialPost,
  StoryItem
} from "../tindereo-types";

const MEDIA_BUCKET = "tindereo-media";
const MEDIA_REF_PREFIX = "tindereo-media://";

type UploadMediaInput = {
  contentType: string;
  fileName: string;
  ownerId: string;
  purpose: "avatar" | "chat" | "post" | "story";
  bytes: ArrayBuffer;
};

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getFileExtension(fileName: string, contentType: string) {
  const fromName = fileName.split(".").pop()?.trim().toLowerCase();
  if (fromName && /^[a-z0-9]{2,6}$/.test(fromName)) {
    return fromName;
  }

  if (contentType.startsWith("image/")) {
    return contentType.split("/")[1] || "jpg";
  }

  if (contentType.startsWith("video/")) {
    return contentType.split("/")[1] || "mp4";
  }

  return "bin";
}

function buildStoragePath({ contentType, fileName, ownerId, purpose }: UploadMediaInput) {
  const extension = getFileExtension(fileName, contentType);
  const safeOwnerId = sanitizePathSegment(ownerId) || "user";
  const safePurpose = sanitizePathSegment(purpose) || "media";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeOwnerId}/${safePurpose}/${timestamp}-${randomUUID()}.${extension}`;
}

export function isManagedMediaRef(value: string) {
  return value.startsWith(MEDIA_REF_PREFIX);
}

export function buildManagedMediaRef(path: string) {
  return `${MEDIA_REF_PREFIX}${path}`;
}

export function parseManagedMediaRef(value: string) {
  if (!isManagedMediaRef(value)) {
    return null;
  }

  const path = value.slice(MEDIA_REF_PREFIX.length).trim();
  return path ? path : null;
}

export function buildManagedMediaProxyUrl(value: string) {
  const path = parseManagedMediaRef(value);
  if (!path) {
    return value;
  }

  return `/api/media/asset/${path}`;
}

async function ensureStorageResponseOk(response: Response) {
  if (response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | null;
  throw new Error(payload?.message ?? payload?.error ?? "No se pudo guardar el archivo en Storage.");
}

export async function uploadManagedMedia(input: UploadMediaInput) {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error("Falta SUPABASE_URL para subir archivos.");
  }

  const storagePath = buildStoragePath(input);
  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${MEDIA_BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: buildSupabaseHeaders({
        "Content-Type": input.contentType || "application/octet-stream",
        "x-upsert": "false"
      }),
      body: Buffer.from(input.bytes),
      cache: "no-store"
    }
  );

  await ensureStorageResponseOk(response);
  return buildManagedMediaRef(storagePath);
}

export async function fetchManagedMediaObject(path: string) {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error("Falta SUPABASE_URL para leer archivos.");
  }

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/authenticated/${MEDIA_BUCKET}/${path}`,
    {
      method: "GET",
      headers: buildSupabaseHeaders(),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("No se pudo abrir el archivo.");
  }

  return response;
}

function resolvePost(post: SocialPost): SocialPost {
  return isManagedMediaRef(post.imageUrl)
    ? {
        ...post,
        imageUrl: buildManagedMediaProxyUrl(post.imageUrl)
      }
    : post;
}

function resolveStory(story: StoryItem): StoryItem {
  return isManagedMediaRef(story.imageUrl)
    ? {
        ...story,
        imageUrl: buildManagedMediaProxyUrl(story.imageUrl)
      }
    : story;
}

function resolveUser(user: PlatformUser): PlatformUser {
  return {
    ...user,
    avatar: isManagedMediaRef(user.avatar) ? buildManagedMediaProxyUrl(user.avatar) : user.avatar,
    coverImage: isManagedMediaRef(user.coverImage)
      ? buildManagedMediaProxyUrl(user.coverImage)
      : user.coverImage
  };
}

function replaceMediaUrlInsideMessageText(text: string) {
  const prefix = "[media:";
  if (!text.startsWith(prefix)) {
    return text;
  }

  const closingIndex = text.indexOf("]");
  if (closingIndex === -1) {
    return text;
  }

  const metadata = text.slice(prefix.length, closingIndex).split("|");
  if (metadata.length < 5) {
    return text;
  }

  const encodedImageUrl = metadata[3] ?? "";
  const decodedImageUrl = decodeURIComponent(encodedImageUrl);
  if (!isManagedMediaRef(decodedImageUrl)) {
    return text;
  }

  const nextMetadata = [...metadata];
  nextMetadata[3] = encodeURIComponent(buildManagedMediaProxyUrl(decodedImageUrl));
  return `${prefix}${nextMetadata.join("|")}]${text.slice(closingIndex + 1)}`;
}

function resolveGroupMessage(message: EventGroupMessage): EventGroupMessage {
  return {
    ...message,
    text: replaceMediaUrlInsideMessageText(message.text)
  };
}

function resolvePrivateMessage(message: PrivateMessage): PrivateMessage {
  return {
    ...message,
    text: replaceMediaUrlInsideMessageText(message.text)
  };
}

export function resolveDatasetMediaUrls(data: AppDataset): AppDataset {
  return {
    ...data,
    users: data.users.map(resolveUser),
    events: data.events.map((event) => ({
      ...event,
      coverImage: isManagedMediaRef(event.coverImage)
        ? buildManagedMediaProxyUrl(event.coverImage)
        : event.coverImage
    })),
    socialPosts: data.socialPosts.map(resolvePost),
    stories: data.stories.map(resolveStory),
    groupMessages: data.groupMessages.map(resolveGroupMessage),
    privateMessages: data.privateMessages.map(resolvePrivateMessage)
  };
}
