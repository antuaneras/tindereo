import { DEFAULT_STATE } from "../tindereo-data";
import type { AppDataset } from "../tindereo-types";
import {
  getDatasetRevision as getLocalDatasetRevision,
  readAppDataset as readLocalAppDataset,
  replaceAppDataset as replaceLocalAppDataset,
  resetAppDataset as resetLocalAppDataset
} from "./tindereo-database";

const PLATFORM_STATE_ID = "main";

type SupabasePlatformStateRow = {
  data: AppDataset;
  revision: number;
};

function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? null;
}

function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

function buildSupabaseHeaders() {
  const apiKey = getSupabaseServiceRoleKey();

  if (!apiKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para usar la persistencia remota.");
  }

  return {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

async function parseSupabaseResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string; error?: string }
    | T
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && payload !== null
        ? "message" in payload && payload.message
          ? payload.message
          : "error" in payload && payload.error
            ? payload.error
            : "No se pudo completar la operacion con Supabase."
        : "No se pudo completar la operacion con Supabase."
    );
  }

  return payload as T;
}

async function callSupabase<T>(path: string, init?: RequestInit) {
  const url = getSupabaseUrl();

  if (!url) {
    throw new Error("Falta SUPABASE_URL para usar la persistencia remota.");
  }

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...buildSupabaseHeaders(),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  return parseSupabaseResponse<T>(response);
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
    return {
      data: row.data,
      revision: Number(row.revision)
    } satisfies SupabasePlatformStateRow;
  }

  return setSupabasePlatformState(DEFAULT_STATE);
}

export async function getDatasetRevision() {
  if (!isSupabaseConfigured()) {
    return getLocalDatasetRevision();
  }

  const row = await readSupabasePlatformState();
  return row.revision;
}

export async function readAppDataset() {
  if (!isSupabaseConfigured()) {
    return readLocalAppDataset();
  }

  const row = await readSupabasePlatformState();
  return row.data;
}

export async function replaceAppDataset(data: AppDataset) {
  if (!isSupabaseConfigured()) {
    return replaceLocalAppDataset(data);
  }

  const row = await setSupabasePlatformState(data);
  return row.data;
}

export async function resetAppDataset() {
  if (!isSupabaseConfigured()) {
    return resetLocalAppDataset();
  }

  const row = await setSupabasePlatformState(DEFAULT_STATE);
  return row.data;
}
