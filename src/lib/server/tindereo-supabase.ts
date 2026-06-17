type SupabaseErrorPayload = {
  code?: string;
  details?: string;
  error?: string;
  hint?: string;
  message?: string;
};

export class SupabaseRequestError extends Error {
  payload: SupabaseErrorPayload | null;
  status: number;

  constructor(
    message: string,
    status: number,
    payload: SupabaseErrorPayload | null = null
  ) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
}

export function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? null;
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

function shouldUseAuthorizationBearer(apiKey: string) {
  // Legacy JWT-based service_role keys still need Authorization, but sb_secret keys do not.
  return apiKey.startsWith("eyJ");
}

export function buildSupabaseHeaders(initHeaders?: HeadersInit) {
  const apiKey = getSupabaseServiceRoleKey();

  if (!apiKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para usar Supabase.");
  }

  const headers = new Headers(initHeaders);
  headers.set("apikey", apiKey);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (shouldUseAuthorizationBearer(apiKey) && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  return headers;
}

async function parseSupabaseResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as T | SupabaseErrorPayload | null;

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === "object" && payload !== null
        ? (payload as SupabaseErrorPayload)
        : null;
    const message =
      errorPayload?.message ??
      errorPayload?.error ??
      "No se pudo completar la operacion con Supabase.";

    throw new SupabaseRequestError(message, response.status, errorPayload);
  }

  return payload as T;
}

export async function callSupabase<T>(pathName: string, init?: RequestInit) {
  const url = getSupabaseUrl();

  if (!url) {
    throw new Error("Falta SUPABASE_URL para usar Supabase.");
  }

  const response = await fetch(`${url}${pathName}`, {
    ...init,
    headers: buildSupabaseHeaders(init?.headers),
    cache: "no-store"
  });

  return parseSupabaseResponse<T>(response);
}
