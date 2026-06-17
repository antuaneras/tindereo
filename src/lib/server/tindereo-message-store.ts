import type { AppDataset, EventGroupMessage, PrivateMessage } from "../tindereo-types";
import {
  SupabaseRequestError,
  callSupabase,
  isSupabaseConfigured
} from "./tindereo-supabase";

const GROUP_MESSAGES_TABLE = "tindereo_group_messages";
const PRIVATE_MESSAGES_TABLE = "tindereo_private_messages";

type SupabaseGroupMessageRow = {
  author_id: string;
  created_at: string;
  event_id: string;
  id: string;
  kind: EventGroupMessage["kind"];
  text: string;
};

type SupabasePrivateMessageRow = {
  author_id: string;
  chat_id: string;
  created_at: string;
  id: string;
  text: string;
};

function isMissingTableError(error: unknown) {
  if (!(error instanceof SupabaseRequestError)) {
    return false;
  }

  return (
    error.status === 404 ||
    error.payload?.code === "PGRST205" ||
    error.payload?.message?.toLowerCase().includes("could not find") ||
    error.payload?.message?.toLowerCase().includes("relation") ||
    false
  );
}

function mapGroupMessage(row: SupabaseGroupMessageRow): EventGroupMessage {
  return {
    authorId: row.author_id,
    createdAt: row.created_at,
    eventId: row.event_id,
    id: row.id,
    kind: row.kind === "system" ? "system" : "text",
    text: row.text
  };
}

function mapPrivateMessage(row: SupabasePrivateMessageRow): PrivateMessage {
  return {
    authorId: row.author_id,
    chatId: row.chat_id,
    createdAt: row.created_at,
    id: row.id,
    text: row.text
  };
}

async function upsertRows<T>(tableName: string, rows: T[]) {
  if (rows.length === 0 || !isSupabaseConfigured()) {
    return;
  }

  await callSupabase(
    `/rest/v1/${tableName}?on_conflict=id`,
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(rows)
    }
  );
}

export async function readNormalizedMessages() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const [groupRows, privateRows] = await Promise.all([
      callSupabase<SupabaseGroupMessageRow[]>(
        `/rest/v1/${GROUP_MESSAGES_TABLE}?select=id,event_id,author_id,text,kind,created_at&order=created_at.asc`,
        { method: "GET" }
      ),
      callSupabase<SupabasePrivateMessageRow[]>(
        `/rest/v1/${PRIVATE_MESSAGES_TABLE}?select=id,chat_id,author_id,text,created_at&order=created_at.asc`,
        { method: "GET" }
      )
    ]);

    return {
      groupMessages: groupRows.map(mapGroupMessage),
      privateMessages: privateRows.map(mapPrivateMessage)
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return null;
    }

    throw error;
  }
}

export async function persistLegacyMessagesIfNeeded(data: AppDataset) {
  const normalized = await readNormalizedMessages();
  if (!normalized) {
    return normalized;
  }

  const shouldSeedGroupMessages =
    normalized.groupMessages.length === 0 && data.groupMessages.length > 0;
  const shouldSeedPrivateMessages =
    normalized.privateMessages.length === 0 && data.privateMessages.length > 0;

  if (!shouldSeedGroupMessages && !shouldSeedPrivateMessages) {
    return normalized;
  }

  await Promise.all([
    shouldSeedGroupMessages
      ? upsertRows(
          GROUP_MESSAGES_TABLE,
          data.groupMessages.map((message) => ({
            author_id: message.authorId,
            created_at: message.createdAt,
            event_id: message.eventId,
            id: message.id,
            kind: message.kind,
            text: message.text
          }))
        )
      : Promise.resolve(),
    shouldSeedPrivateMessages
      ? upsertRows(
          PRIVATE_MESSAGES_TABLE,
          data.privateMessages.map((message) => ({
            author_id: message.authorId,
            chat_id: message.chatId,
            created_at: message.createdAt,
            id: message.id,
            text: message.text
          }))
        )
      : Promise.resolve()
  ]);

  return {
    groupMessages: shouldSeedGroupMessages ? data.groupMessages : normalized.groupMessages,
    privateMessages: shouldSeedPrivateMessages ? data.privateMessages : normalized.privateMessages
  };
}

export async function persistMessageCollectionsDelta(previous: AppDataset, next: AppDataset) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const normalized = await readNormalizedMessages();
  if (!normalized) {
    return;
  }

  const previousGroupMessagesById = new Map(
    previous.groupMessages.map((message) => [message.id, message])
  );
  const previousPrivateMessagesById = new Map(
    previous.privateMessages.map((message) => [message.id, message])
  );
  const nextGroupMessages = next.groupMessages.filter((message) => {
    const previousMessage = previousGroupMessagesById.get(message.id);
    return (
      !previousMessage ||
      previousMessage.authorId !== message.authorId ||
      previousMessage.createdAt !== message.createdAt ||
      previousMessage.eventId !== message.eventId ||
      previousMessage.kind !== message.kind ||
      previousMessage.text !== message.text
    );
  });
  const nextPrivateMessages = next.privateMessages.filter((message) => {
    const previousMessage = previousPrivateMessagesById.get(message.id);
    return (
      !previousMessage ||
      previousMessage.authorId !== message.authorId ||
      previousMessage.chatId !== message.chatId ||
      previousMessage.createdAt !== message.createdAt ||
      previousMessage.text !== message.text
    );
  });

  await Promise.all([
    upsertRows(
      GROUP_MESSAGES_TABLE,
      nextGroupMessages.map((message) => ({
        author_id: message.authorId,
        created_at: message.createdAt,
        event_id: message.eventId,
        id: message.id,
        kind: message.kind,
        text: message.text
      }))
    ),
    upsertRows(
      PRIVATE_MESSAGES_TABLE,
      nextPrivateMessages.map((message) => ({
        author_id: message.authorId,
        chat_id: message.chatId,
        created_at: message.createdAt,
        id: message.id,
        text: message.text
      }))
    )
  ]);
}

export function compactDatasetForPrimaryStore(data: AppDataset): AppDataset {
  if (!isSupabaseConfigured()) {
    return data;
  }

  return {
    ...data,
    groupMessages: [],
    privateMessages: []
  };
}
