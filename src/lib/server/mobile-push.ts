import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildSupabaseHeaders, getSupabaseUrl } from "@/lib/server/tindereo-supabase";
import { buildMobileId } from "@/lib/mobile-shared";
import { insertRow, deleteRows, selectRows } from "@/lib/server/mobile-db";
import type { MobileNotification } from "@/lib/mobile-types";

const VAPID_STATE_PATH = path.join(process.cwd(), "storage", "web-push-state.json");
const DEFAULT_PUSH_SUBJECT = "mailto:soporte@tindereo.app";
const PUSH_TTL_SECONDS = 60;
const PUSH_RECORD_SIZE = 4096;
const TABLE = "push_subscriptions";

type PushSubscriptionRow = {
  auth: string;
  created_at: string;
  endpoint: string;
  expiration_time: number | null;
  id: string;
  p256dh: string;
  updated_at: string;
  user_agent: string | null;
  user_id: string;
};

type VapidStateRecord = {
  privateKey: string;
  publicKey: string;
  subject: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __mobileVapidState__: VapidStateRecord | undefined;
}

function normalizeBase64Url(value: string) {
  return value.replace(/-/g, "+").replace(/_/g, "/");
}

function encodeBase64Url(value: Buffer | Uint8Array | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalizedValue = normalizeBase64Url(value);
  const padding = normalizedValue.length % 4 === 0 ? "" : "=".repeat(4 - (normalizedValue.length % 4));
  return Buffer.from(`${normalizedValue}${padding}`, "base64");
}

function hmacSha256(key: Buffer, value: Buffer) {
  return Buffer.from(createHmac("sha256", key).update(value).digest());
}

function hkdfExtract(salt: Buffer, inputKeyMaterial: Buffer) {
  return hmacSha256(salt, inputKeyMaterial);
}

function hkdfExpand(pseudoRandomKey: Buffer, info: Buffer, length: number) {
  const chunks: Buffer[] = [];
  let block = Buffer.alloc(0);
  let counter = 1;

  while (Buffer.concat(chunks).length < length) {
    block = hmacSha256(
      pseudoRandomKey,
      Buffer.concat([block, info, Buffer.from([counter])])
    );
    chunks.push(block);
    counter += 1;
  }

  return Buffer.concat(chunks).subarray(0, length);
}

function hkdf(salt: Buffer, inputKeyMaterial: Buffer, info: Buffer, length: number) {
  return hkdfExpand(hkdfExtract(salt, inputKeyMaterial), info, length);
}

function buildGeneratedVapidState() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    privateKey: encodeBase64Url(ecdh.getPrivateKey()),
    publicKey: encodeBase64Url(ecdh.getPublicKey(undefined, "uncompressed")),
    subject: process.env.WEB_PUSH_SUBJECT ?? DEFAULT_PUSH_SUBJECT
  } satisfies VapidStateRecord;
}

function sanitizeStoredVapidState(value: unknown): VapidStateRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<VapidStateRecord>;
  if (typeof candidate.privateKey !== "string" || typeof candidate.publicKey !== "string") {
    return null;
  }
  return {
    privateKey: candidate.privateKey,
    publicKey: candidate.publicKey,
    subject: typeof candidate.subject === "string" ? candidate.subject : DEFAULT_PUSH_SUBJECT
  };
}

function readLocalVapidState() {
  if (globalThis.__mobileVapidState__) {
    return globalThis.__mobileVapidState__;
  }

  mkdirSync(path.dirname(VAPID_STATE_PATH), { recursive: true });
  try {
    readFileSync(VAPID_STATE_PATH, "utf8");
  } catch {
    writeFileSync(VAPID_STATE_PATH, JSON.stringify(buildGeneratedVapidState(), null, 2), "utf8");
  }

  const parsed =
    sanitizeStoredVapidState(JSON.parse(readFileSync(VAPID_STATE_PATH, "utf8")) as unknown) ??
    buildGeneratedVapidState();
  globalThis.__mobileVapidState__ = parsed;
  writeFileSync(VAPID_STATE_PATH, JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

function getVapidState() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    return {
      publicKey,
      privateKey,
      subject: process.env.WEB_PUSH_SUBJECT ?? DEFAULT_PUSH_SUBJECT
    };
  }
  return readLocalVapidState();
}

function createVapidJwt(audience: string, vapidState: VapidStateRecord) {
  const publicKeyBytes = decodeBase64Url(vapidState.publicKey);
  const privateKeyBytes = decodeBase64Url(vapidState.privateKey);
  const encodedHeader = encodeBase64Url(JSON.stringify({ alg: "ES256", typ: "JWT" }));
  const encodedPayload = encodeBase64Url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
      sub: vapidState.subject
    })
  );
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const privateKey = createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      d: encodeBase64Url(privateKeyBytes),
      x: encodeBase64Url(publicKeyBytes.subarray(1, 33)),
      y: encodeBase64Url(publicKeyBytes.subarray(33, 65))
    }
  });
  const signature = sign("sha256", Buffer.from(unsignedToken), {
    key: privateKey,
    dsaEncoding: "ieee-p1363"
  });

  return `${unsignedToken}.${encodeBase64Url(signature)}`;
}

function encryptPushPayload(subscription: PushSubscriptionRow, payload: string) {
  const clientPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  const senderKey = createECDH("prime256v1");
  senderKey.generateKeys();
  const senderPublicKey = senderKey.getPublicKey(undefined, "uncompressed");
  const sharedSecret = senderKey.computeSecret(clientPublicKey);
  const info = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    clientPublicKey,
    senderPublicKey
  ]);
  const inputKeyMaterial = hkdf(authSecret, sharedSecret, info, 32);
  const salt = randomBytes(16);
  const contentEncryptionKey = hkdf(
    salt,
    inputKeyMaterial,
    Buffer.from("Content-Encoding: aes128gcm\0", "utf8"),
    16
  );
  const nonce = hkdf(
    salt,
    inputKeyMaterial,
    Buffer.from("Content-Encoding: nonce\0", "utf8"),
    12
  );
  const plaintext = Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([0x02])]);
  const cipher = createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21 + senderPublicKey.length);
  salt.copy(header, 0);
  header.writeUInt32BE(PUSH_RECORD_SIZE, 16);
  header.writeUInt8(senderPublicKey.length, 20);
  senderPublicKey.copy(header, 21);
  return Buffer.concat([header, ciphertext]);
}

export function getMobileWebPushPublicKey() {
  return getVapidState().publicKey;
}

export async function saveMobilePushSubscription(
  userId: string,
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: { auth: string; p256dh: string };
  },
  userAgent: string | null
) {
  const now = new Date().toISOString();
  await insertRow(
    TABLE,
    {
      id: buildMobileId("push"),
      user_id: userId,
      endpoint: subscription.endpoint,
      expiration_time: subscription.expirationTime ?? null,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      created_at: now,
      updated_at: now
    },
    {
      onConflict: "endpoint",
      returning: "minimal"
    }
  );
}

export async function removeMobilePushSubscription(userId: string, endpoint?: string | null) {
  await deleteRows(
    TABLE,
    endpoint
      ? [{ column: "endpoint", op: "eq", value: endpoint }]
      : [{ column: "user_id", op: "eq", value: userId }],
    { returning: "minimal" }
  );
}

function buildTargetUrl(notification: MobileNotification) {
  const eventSlug = typeof notification.data.eventSlug === "string" ? notification.data.eventSlug : null;
  const targetHandle = typeof notification.data.targetHandle === "string" ? notification.data.targetHandle : null;
  const requesterHandle =
    typeof notification.data.requesterHandle === "string" ? notification.data.requesterHandle : null;
  const conversationId =
    typeof notification.data.conversationId === "string" ? notification.data.conversationId : null;

  if (notification.kind === "follow-request" || notification.kind === "chat-request") {
    return "/notificaciones";
  }

  if (notification.entityType === "conversation" && notification.entityId) {
    return `/chat/${notification.entityId}`;
  }

  if (conversationId) {
    return `/chat/${conversationId}`;
  }

  if (notification.entityType === "event") {
    if (eventSlug) {
      return `/evento/${eventSlug}`;
    }
    return "/eventos";
  }

  if (targetHandle) {
    return `/perfil/${targetHandle}`;
  }

  if (requesterHandle) {
    return `/perfil/${requesterHandle}`;
  }

  if (
    notification.entityType === "post" ||
    notification.kind === "post-like" ||
    notification.kind === "mention" ||
    notification.kind === "story-reaction" ||
    notification.kind === "story-reply"
  ) {
    return "/perfil";
  }

  return "/";
}

async function sendPushRequest(subscription: PushSubscriptionRow, payload: Record<string, unknown>) {
  const vapidState = getVapidState();
  const audience = new URL(subscription.endpoint).origin;
  const encryptedPayload = encryptPushPayload(subscription, JSON.stringify(payload));
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${createVapidJwt(audience, vapidState)}, k=${vapidState.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: `${PUSH_TTL_SECONDS}`,
      Urgency: "normal"
    },
    body: encryptedPayload
  });

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error(`Push status ${response.status}`);
  }
}

export async function sendMobilePushNotifications(notifications: MobileNotification[]) {
  if (notifications.length === 0) {
    return;
  }
  const userIds = [...new Set(notifications.map((item) => item.userId))];
  const subscriptions = await selectRows<PushSubscriptionRow>(TABLE, {
    filters: [{ column: "user_id", op: "in", value: userIds }]
  });

  await Promise.allSettled(
    notifications.flatMap((notification) =>
      subscriptions
        .filter((subscription) => subscription.user_id === notification.userId)
        .map((subscription) =>
          sendPushRequest(subscription, {
            title: notification.title,
            body: notification.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: notification.id,
            data: {
              notificationId: notification.id,
              url: buildTargetUrl(notification)
            }
          }).catch(async (error) => {
            if (
              error instanceof Error &&
              (error.message.includes("404") || error.message.includes("410"))
            ) {
              await removeMobilePushSubscription(notification.userId, subscription.endpoint).catch(() => undefined);
            }
          })
        )
    )
  );
}

export async function uploadManagedMediaViaStorage(pathName: string, init: RequestInit) {
  const supabaseUrl = getSupabaseUrl();
  if (!supabaseUrl) {
    throw new Error("Falta SUPABASE_URL.");
  }

  return fetch(`${supabaseUrl}${pathName}`, {
    ...init,
    headers: buildSupabaseHeaders(init.headers),
    cache: "no-store"
  });
}
