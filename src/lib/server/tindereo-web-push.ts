import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AppDataset, AppNotification } from "@/lib/tindereo-types";

const PRIVATE_PUSH_SUBSCRIPTIONS_KEY = "__pushSubscriptions";
const VAPID_STATE_PATH = path.join(process.cwd(), "storage", "web-push-state.json");
const DEFAULT_PUSH_SUBJECT = "mailto:soporte@tindereo.app";
const PUSH_TTL_SECONDS = 60;
const PUSH_RECORD_SIZE = 4096;

type StoredPushSubscription = {
  createdAt: string;
  endpoint: string;
  expirationTime: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
  updatedAt: string;
  userAgent: string | null;
  userId: string;
};

type VapidStateRecord = {
  privateKey: string;
  publicKey: string;
  subject: string;
};

type PrivateDataset = AppDataset & {
  [PRIVATE_PUSH_SUBSCRIPTIONS_KEY]?: StoredPushSubscription[];
};

type PushPayload = {
  body: string;
  icon: string;
  badge: string;
  tag: string;
  title: string;
  data: {
    notificationId: string;
    url: string;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __tindereoWebPushState__: VapidStateRecord | undefined;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
  let block: Buffer = Buffer.alloc(0);
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

function getPushSubscriptions(data: AppDataset) {
  const candidate = (data as PrivateDataset)[PRIVATE_PUSH_SUBSCRIPTIONS_KEY];
  return Array.isArray(candidate)
    ? candidate.filter(
        (entry): entry is StoredPushSubscription =>
          Boolean(
            entry &&
              typeof entry === "object" &&
              typeof entry.userId === "string" &&
              typeof entry.endpoint === "string" &&
              typeof entry.keys?.auth === "string" &&
              typeof entry.keys?.p256dh === "string"
          )
      )
    : [];
}

function setPushSubscriptions(data: AppDataset, subscriptions: StoredPushSubscription[]) {
  return {
    ...(data as PrivateDataset),
    [PRIVATE_PUSH_SUBSCRIPTIONS_KEY]: subscriptions
  } as AppDataset;
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

  if (
    typeof candidate.privateKey !== "string" ||
    typeof candidate.publicKey !== "string"
  ) {
    return null;
  }

  return {
    privateKey: candidate.privateKey,
    publicKey: candidate.publicKey,
    subject:
      typeof candidate.subject === "string" && candidate.subject.trim()
        ? candidate.subject
        : process.env.WEB_PUSH_SUBJECT ?? DEFAULT_PUSH_SUBJECT
  };
}

function ensureLocalVapidStateFile() {
  mkdirSync(path.dirname(VAPID_STATE_PATH), { recursive: true });

  try {
    readFileSync(VAPID_STATE_PATH, "utf8");
  } catch {
    writeFileSync(
      VAPID_STATE_PATH,
      JSON.stringify(buildGeneratedVapidState(), null, 2),
      "utf8"
    );
  }
}

function readLocalVapidState() {
  if (globalThis.__tindereoWebPushState__) {
    return globalThis.__tindereoWebPushState__;
  }

  ensureLocalVapidStateFile();
  const raw = readFileSync(VAPID_STATE_PATH, "utf8");
  const parsed = sanitizeStoredVapidState(JSON.parse(raw) as unknown) ?? buildGeneratedVapidState();
  globalThis.__tindereoWebPushState__ = parsed;
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
    } satisfies VapidStateRecord;
  }

  return readLocalVapidState();
}

function createVapidJwt(audience: string, vapidState: VapidStateRecord) {
  const publicKeyBytes = decodeBase64Url(vapidState.publicKey);
  const privateKeyBytes = decodeBase64Url(vapidState.privateKey);
  const encodedHeader = encodeBase64Url(
    JSON.stringify({
      alg: "ES256",
      typ: "JWT"
    })
  );
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

function encryptPushPayload(subscription: StoredPushSubscription, payload: string) {
  const clientPublicKey = decodeBase64Url(subscription.keys.p256dh);
  const authSecret = decodeBase64Url(subscription.keys.auth);
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

  if (plaintext.length + 16 >= PUSH_RECORD_SIZE) {
    throw new Error("El payload push es demasiado grande.");
  }

  const cipher = createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21 + senderPublicKey.length);

  salt.copy(header, 0);
  header.writeUInt32BE(PUSH_RECORD_SIZE, 16);
  header.writeUInt8(senderPublicKey.length, 20);
  senderPublicKey.copy(header, 21);

  return Buffer.concat([header, ciphertext]);
}

function buildPushTag(notification: AppNotification) {
  if (notification.chatId) {
    return `chat:${notification.chatId}`;
  }

  if (notification.eventId) {
    return `event:${notification.eventId}`;
  }

  if (notification.storyId) {
    return `story:${notification.storyId}`;
  }

  if (notification.postId) {
    return `post:${notification.postId}`;
  }

  return `notification:${notification.id}`;
}

function buildPushPayload(notification: AppNotification): PushPayload {
  return {
    badge: "/icon-192.png",
    body: notification.body,
    data: {
      notificationId: notification.id,
      url: "/"
    },
    icon: "/icon-192.png",
    tag: buildPushTag(notification),
    title: notification.title
  };
}

async function sendPushRequest(subscription: StoredPushSubscription, payload: PushPayload) {
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

export function stripPrivatePlatformFields(data: AppDataset): AppDataset {
  const { [PRIVATE_PUSH_SUBSCRIPTIONS_KEY]: _pushSubscriptions, ...publicData } =
    data as PrivateDataset;
  return publicData as AppDataset;
}

export function getWebPushPublicKey() {
  return getVapidState().publicKey;
}

export function upsertPushSubscription(
  data: AppDataset,
  userId: string,
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      auth: string;
      p256dh: string;
    };
  },
  userAgent: string | null
) {
  const now = new Date().toISOString();
  const currentSubscriptions = getPushSubscriptions(data);
  const nextRecord: StoredPushSubscription = {
    createdAt:
      currentSubscriptions.find((entry) => entry.endpoint === subscription.endpoint)?.createdAt ?? now,
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      auth: subscription.keys.auth,
      p256dh: subscription.keys.p256dh
    },
    updatedAt: now,
    userAgent,
    userId
  };

  return setPushSubscriptions(
    data,
    [
      nextRecord,
      ...currentSubscriptions.filter((entry) => entry.endpoint !== subscription.endpoint)
    ]
  );
}

export function removePushSubscription(
  data: AppDataset,
  userId: string,
  endpoint?: string | null
) {
  const currentSubscriptions = getPushSubscriptions(data);

  return setPushSubscriptions(
    data,
    currentSubscriptions.filter((entry) =>
      endpoint
        ? entry.endpoint !== endpoint
        : entry.userId !== userId
    )
  );
}

export async function sendPushNotificationsForNotifications(
  data: AppDataset,
  notifications: AppNotification[]
) {
  if (notifications.length === 0) {
    return;
  }

  const subscriptions = getPushSubscriptions(data);
  if (subscriptions.length === 0) {
    return;
  }

  await Promise.allSettled(
    notifications.flatMap((notification) =>
      subscriptions
        .filter((subscription) => subscription.userId === notification.userId)
        .map((subscription) => sendPushRequest(subscription, buildPushPayload(notification)))
    )
  );
}

export function getPushSubscriptionCount(data: AppDataset, userId: string) {
  return getPushSubscriptions(data).filter((subscription) => subscription.userId === userId).length;
}

export function cloneDatasetWithPushData(data: AppDataset) {
  return cloneValue(data);
}
