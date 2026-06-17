import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_STATE } from "../tindereo-data";
import { stripSession } from "../tindereo-session";
import type { AppDataset } from "../tindereo-types";
import {
  callSupabase,
  isSupabaseConfigured
} from "./tindereo-supabase";
import {
  compactDatasetForPrimaryStore,
  persistLegacyMessagesIfNeeded,
  readNormalizedMessages
} from "./tindereo-message-store";

const PLATFORM_STATE_ID = "main";
const LOCAL_STATE_PATH = path.join(process.cwd(), "storage", "platform-state.json");
const LEGACY_LOCAL_DATABASE_PATHS = [
  path.join(process.cwd(), "storage", "tindereo.sqlite"),
  path.join(process.cwd(), "storage", "tindereo.sqlite-shm"),
  path.join(process.cwd(), "storage", "tindereo.sqlite-wal")
];

type PlatformStateRecord = {
  data: AppDataset;
  revision: number;
};

type SupabasePlatformStateRow = {
  data: AppDataset;
  revision: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __tindereoLocalPlatformState__: PlatformStateRecord | undefined;
}

const LEGACY_DEMO_USER_IDS = new Set([
  "lucia-serrano",
  "mateo-rivas",
  "ines-oliver",
  "nora-costa",
  "diego-luna",
  "sara-mora"
]);

const LEGACY_DEMO_EVENT_IDS = new Set([
  "after-solar-2026",
  "founders-brunch-circle",
  "design-night-lab",
  "cena-secreta-estudio"
]);

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptyDataset() {
  return cloneData(stripSession(DEFAULT_STATE));
}

function containsLegacyDemoData(data: AppDataset) {
  return (
    data.users.some((user) => LEGACY_DEMO_USER_IDS.has(user.id)) ||
    data.events.some((event) => LEGACY_DEMO_EVENT_IDS.has(event.id))
  );
}

function createInitialLocalState(): PlatformStateRecord {
  return {
    data: createEmptyDataset(),
    revision: 1
  };
}

function sanitizeLocalState(value: unknown) {
  if (!value || typeof value !== "object") {
    return createInitialLocalState();
  }

  const candidate = value as Partial<PlatformStateRecord>;
  const nextData = cloneData((candidate.data as AppDataset | undefined) ?? createEmptyDataset());

  return {
    data: containsLegacyDemoData(nextData) ? createEmptyDataset() : nextData,
    revision: Number(candidate.revision ?? 1) || 1
  } satisfies PlatformStateRecord;
}

function ensureLocalStateFile() {
  mkdirSync(path.dirname(LOCAL_STATE_PATH), { recursive: true });

  try {
    readFileSync(LOCAL_STATE_PATH, "utf8");
  } catch {
    const initialState = createInitialLocalState();
    writeFileSync(LOCAL_STATE_PATH, JSON.stringify(initialState, null, 2), "utf8");
  }
}

function readLocalStateRecord() {
  if (globalThis.__tindereoLocalPlatformState__) {
    return globalThis.__tindereoLocalPlatformState__;
  }

  ensureLocalStateFile();
  const raw = readFileSync(LOCAL_STATE_PATH, "utf8");
  const parsed = sanitizeLocalState(JSON.parse(raw) as unknown);
  globalThis.__tindereoLocalPlatformState__ = parsed;
  return parsed;
}

function writeLocalStateRecord(nextRecord: PlatformStateRecord) {
  ensureLocalStateFile();
  globalThis.__tindereoLocalPlatformState__ = nextRecord;
  writeFileSync(LOCAL_STATE_PATH, JSON.stringify(nextRecord, null, 2), "utf8");
  return nextRecord;
}

function removeLegacyLocalDatabaseFiles() {
  for (const filePath of LEGACY_LOCAL_DATABASE_PATHS) {
    try {
      rmSync(filePath, { force: true });
    } catch {
      // Ignore legacy cleanup failures to avoid blocking app resets.
    }
  }
}

async function setSupabasePlatformState(data: AppDataset) {
  const rows = await callSupabase<
    Array<{
      id: string;
      data: AppDataset;
      revision: number;
      updated_at: string;
    }>
  >("/rest/v1/rpc/set_platform_state", {
    method: "POST",
    body: JSON.stringify({
      next_data: data
    })
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    throw new Error("Supabase ha respondido sin el estado persistido.");
  }

  return {
    data: row.data,
    revision: Number(row.revision)
  } satisfies SupabasePlatformStateRow;
}

async function readSupabasePlatformState() {
  const params = new URLSearchParams({
    id: `eq.${PLATFORM_STATE_ID}`,
    select: "data,revision"
  });

  const rows = await callSupabase<Array<{ data: AppDataset; revision: number }>>(
    `/rest/v1/platform_state?${params.toString()}`,
    {
      method: "GET"
    }
  );

  const row = Array.isArray(rows) ? rows[0] : null;
  if (row) {
    if (containsLegacyDemoData(row.data)) {
      return setSupabasePlatformState(createEmptyDataset());
    }

    return {
      data: row.data,
      revision: Number(row.revision)
    } satisfies SupabasePlatformStateRow;
  }

  return setSupabasePlatformState(createEmptyDataset());
}

export async function getDatasetRevision() {
  if (!isSupabaseConfigured()) {
    return readLocalStateRecord().revision;
  }

  const row = await readSupabasePlatformState();
  return row.revision;
}

export async function readAppDataset() {
  if (!isSupabaseConfigured()) {
    return cloneData(readLocalStateRecord().data);
  }

  const row = await readSupabasePlatformState();
  const normalizedMessages = await persistLegacyMessagesIfNeeded(row.data);

  if (!normalizedMessages) {
    return row.data;
  }

  return {
    ...row.data,
    groupMessages: normalizedMessages.groupMessages,
    privateMessages: normalizedMessages.privateMessages
  };
}

export async function replaceAppDataset(data: AppDataset) {
  if (!isSupabaseConfigured()) {
    const current = readLocalStateRecord();
    return writeLocalStateRecord({
      data: cloneData(data),
      revision: current.revision + 1
    }).data;
  }

  const normalizedMessages = await readNormalizedMessages();
  const row = await setSupabasePlatformState(
    normalizedMessages ? compactDatasetForPrimaryStore(data) : data
  );
  return row.data;
}

export async function resetAppDataset() {
  if (!isSupabaseConfigured()) {
    const current = readLocalStateRecord();
    const nextRecord = writeLocalStateRecord({
      data: createEmptyDataset(),
      revision: current.revision + 1
    });
    removeLegacyLocalDatabaseFiles();
    return nextRecord.data;
  }

  const row = await setSupabasePlatformState(createEmptyDataset());
  return row.data;
}
