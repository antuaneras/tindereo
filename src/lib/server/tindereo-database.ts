import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_STATE } from "@/lib/tindereo-data";
import { stripSession } from "@/lib/tindereo-session";
import type {
  AppDataset,
  EventGroupMessage,
  EventItem,
  EventMembership,
  PlatformUser,
  PrivateChat,
  PrivateChatRequest,
  PrivateMessage
} from "@/lib/tindereo-types";

const DATABASE_PATH = path.join(process.cwd(), "storage", "tindereo.sqlite");

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT NOT NULL,
    city TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    bio TEXT NOT NULL,
    tagline TEXT NOT NULL,
    avatar TEXT NOT NULL,
    cover_image TEXT NOT NULL,
    interests_json TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
    city TEXT NOT NULL,
    venue TEXT NOT NULL,
    cover_image TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    price_label TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    base_guest_count INTEGER NOT NULL DEFAULT 0,
    host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    description TEXT NOT NULL,
    highlights_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    dress_code TEXT NOT NULL,
    conversation_prompt TEXT NOT NULL,
    minimum_guests_required INTEGER NOT NULL DEFAULT 4,
    validation_window_days INTEGER NOT NULL DEFAULT 7
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TEXT NOT NULL,
    responded_at TEXT,
    UNIQUE (event_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS group_messages (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    text TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'system')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS private_chat_requests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TEXT NOT NULL,
    responded_at TEXT
  );

  CREATE TABLE IF NOT EXISTS private_chats (
    id TEXT PRIMARY KEY,
    participant_a_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_b_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin_event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL UNIQUE REFERENCES private_chat_requests(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    CHECK (participant_a_id <> participant_b_id)
  );

  CREATE TABLE IF NOT EXISTS private_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES private_chats(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_events_host_id ON events(host_id);
  CREATE INDEX IF NOT EXISTS idx_memberships_event_status ON memberships(event_id, status);
  CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
  CREATE INDEX IF NOT EXISTS idx_group_messages_event_id ON group_messages(event_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_private_requests_to_user ON private_chat_requests(to_user_id, status);
  CREATE INDEX IF NOT EXISTS idx_private_chats_origin_event_id ON private_chats(origin_event_id);
  CREATE INDEX IF NOT EXISTS idx_private_messages_chat_id ON private_messages(chat_id, created_at);
`;

declare global {
  var __tindereoDatabase__: DatabaseSync | undefined;
}

function parseStringArray(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function serializeStringArray(value: string[]) {
  return JSON.stringify(value);
}

function readCount(value: unknown) {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function booleanToInteger(value: boolean) {
  return value ? 1 : 0;
}

function getOrCreateDatabase() {
  if (globalThis.__tindereoDatabase__) {
    return globalThis.__tindereoDatabase__;
  }

  mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });

  const database = new DatabaseSync(DATABASE_PATH);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec(SCHEMA_SQL);
  globalThis.__tindereoDatabase__ = database;

  const userCountRow = database.prepare("SELECT COUNT(*) AS count FROM users").get() as {
    count?: number | bigint;
  };
  if (readCount(userCountRow.count) === 0) {
    replaceAppDataset(stripSession(DEFAULT_STATE));
  }

  return database;
}

export function readAppDataset(): AppDataset {
  const database = getOrCreateDatabase();

  const users = database
    .prepare("SELECT * FROM users ORDER BY rowid")
    .all()
    .map(
      (row): PlatformUser => ({
        id: String(row.id),
        name: String(row.name),
        handle: String(row.handle),
        city: String(row.city),
        title: String(row.title),
        company: row.company ? String(row.company) : undefined,
        bio: String(row.bio),
        tagline: String(row.tagline),
        avatar: String(row.avatar),
        coverImage: String(row.cover_image),
        interests: parseStringArray(row.interests_json),
        verified: Boolean(row.verified)
      })
    );

  const events = database
    .prepare("SELECT * FROM events ORDER BY rowid")
    .all()
    .map(
      (row): EventItem => ({
        id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
        category: row.category as EventItem["category"],
        visibility: row.visibility as EventItem["visibility"],
        city: String(row.city),
        venue: String(row.venue),
        coverImage: String(row.cover_image),
        startsAt: String(row.starts_at),
        endsAt: String(row.ends_at),
        createdAt: String(row.created_at),
        priceLabel: String(row.price_label),
        capacity: readCount(row.capacity),
        baseGuestCount: readCount(row.base_guest_count),
        hostId: String(row.host_id),
        summary: String(row.summary),
        description: String(row.description),
        highlights: parseStringArray(row.highlights_json),
        tags: parseStringArray(row.tags_json),
        dressCode: String(row.dress_code),
        conversationPrompt: String(row.conversation_prompt),
        minimumGuestsRequired: readCount(row.minimum_guests_required),
        validationWindowDays: readCount(row.validation_window_days)
      })
    );

  const memberships = database
    .prepare("SELECT * FROM memberships ORDER BY rowid")
    .all()
    .map(
      (row): EventMembership => ({
        id: String(row.id),
        eventId: String(row.event_id),
        userId: String(row.user_id),
        status: row.status as EventMembership["status"],
        requestedAt: String(row.requested_at),
        respondedAt: row.responded_at ? String(row.responded_at) : undefined
      })
    );

  const groupMessages = database
    .prepare("SELECT * FROM group_messages ORDER BY rowid")
    .all()
    .map(
      (row): EventGroupMessage => ({
        id: String(row.id),
        eventId: String(row.event_id),
        authorId: row.author_id as EventGroupMessage["authorId"],
        text: String(row.text),
        kind: row.kind as EventGroupMessage["kind"],
        createdAt: String(row.created_at)
      })
    );

  const privateChatRequests = database
    .prepare("SELECT * FROM private_chat_requests ORDER BY rowid")
    .all()
    .map(
      (row): PrivateChatRequest => ({
        id: String(row.id),
        eventId: String(row.event_id),
        fromUserId: String(row.from_user_id),
        toUserId: String(row.to_user_id),
        message: String(row.message),
        status: row.status as PrivateChatRequest["status"],
        createdAt: String(row.created_at),
        respondedAt: row.responded_at ? String(row.responded_at) : undefined
      })
    );

  const privateChats = database
    .prepare("SELECT * FROM private_chats ORDER BY rowid")
    .all()
    .map(
      (row): PrivateChat => ({
        id: String(row.id),
        participantIds: [String(row.participant_a_id), String(row.participant_b_id)],
        originEventId: String(row.origin_event_id),
        requestId: String(row.request_id),
        createdAt: String(row.created_at)
      })
    );

  const privateMessages = database
    .prepare("SELECT * FROM private_messages ORDER BY rowid")
    .all()
    .map(
      (row): PrivateMessage => ({
        id: String(row.id),
        chatId: String(row.chat_id),
        authorId: String(row.author_id),
        text: String(row.text),
        createdAt: String(row.created_at)
      })
    );

  return {
    users,
    events,
    memberships,
    groupMessages,
    privateChatRequests,
    privateChats,
    privateMessages
  };
}

export function replaceAppDataset(data: AppDataset) {
  const database = getOrCreateDatabase();

  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      DELETE FROM private_messages;
      DELETE FROM private_chats;
      DELETE FROM private_chat_requests;
      DELETE FROM group_messages;
      DELETE FROM memberships;
      DELETE FROM events;
      DELETE FROM users;
    `);

    const insertUser = database.prepare(`
      INSERT INTO users (
        id,
        name,
        handle,
        city,
        title,
        company,
        bio,
        tagline,
        avatar,
        cover_image,
        interests_json,
        verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const user of data.users) {
      insertUser.run(
        user.id,
        user.name,
        user.handle,
        user.city,
        user.title,
        user.company ?? null,
        user.bio,
        user.tagline,
        user.avatar,
        user.coverImage,
        serializeStringArray(user.interests),
        booleanToInteger(user.verified)
      );
    }

    const insertEvent = database.prepare(`
      INSERT INTO events (
        id,
        slug,
        title,
        category,
        visibility,
        city,
        venue,
        cover_image,
        starts_at,
        ends_at,
        created_at,
        price_label,
        capacity,
        base_guest_count,
        host_id,
        summary,
        description,
        highlights_json,
        tags_json,
        dress_code,
        conversation_prompt,
        minimum_guests_required,
        validation_window_days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const event of data.events) {
      insertEvent.run(
        event.id,
        event.slug,
        event.title,
        event.category,
        event.visibility,
        event.city,
        event.venue,
        event.coverImage,
        event.startsAt,
        event.endsAt,
        event.createdAt,
        event.priceLabel,
        event.capacity,
        event.baseGuestCount,
        event.hostId,
        event.summary,
        event.description,
        serializeStringArray(event.highlights),
        serializeStringArray(event.tags),
        event.dressCode,
        event.conversationPrompt,
        event.minimumGuestsRequired,
        event.validationWindowDays
      );
    }

    const insertMembership = database.prepare(`
      INSERT INTO memberships (
        id,
        event_id,
        user_id,
        status,
        requested_at,
        responded_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const membership of data.memberships) {
      insertMembership.run(
        membership.id,
        membership.eventId,
        membership.userId,
        membership.status,
        membership.requestedAt,
        membership.respondedAt ?? null
      );
    }

    const insertGroupMessage = database.prepare(`
      INSERT INTO group_messages (
        id,
        event_id,
        author_id,
        text,
        kind,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const message of data.groupMessages) {
      insertGroupMessage.run(
        message.id,
        message.eventId,
        message.authorId,
        message.text,
        message.kind,
        message.createdAt
      );
    }

    const insertPrivateRequest = database.prepare(`
      INSERT INTO private_chat_requests (
        id,
        event_id,
        from_user_id,
        to_user_id,
        message,
        status,
        created_at,
        responded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const request of data.privateChatRequests) {
      insertPrivateRequest.run(
        request.id,
        request.eventId,
        request.fromUserId,
        request.toUserId,
        request.message,
        request.status,
        request.createdAt,
        request.respondedAt ?? null
      );
    }

    const insertPrivateChat = database.prepare(`
      INSERT INTO private_chats (
        id,
        participant_a_id,
        participant_b_id,
        origin_event_id,
        request_id,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const chat of data.privateChats) {
      insertPrivateChat.run(
        chat.id,
        chat.participantIds[0],
        chat.participantIds[1],
        chat.originEventId,
        chat.requestId,
        chat.createdAt
      );
    }

    const insertPrivateMessage = database.prepare(`
      INSERT INTO private_messages (
        id,
        chat_id,
        author_id,
        text,
        created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const message of data.privateMessages) {
      insertPrivateMessage.run(
        message.id,
        message.chatId,
        message.authorId,
        message.text,
        message.createdAt
      );
    }

    database.exec("COMMIT;");
    return data;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function resetAppDataset() {
  return replaceAppDataset(stripSession(DEFAULT_STATE));
}
