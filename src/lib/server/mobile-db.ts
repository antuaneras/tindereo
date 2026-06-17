import { callSupabase, SupabaseRequestError } from "@/lib/server/tindereo-supabase";

type FilterValue = string | number | boolean | null;

export type QueryFilter =
  | { column: string; op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "is"; value: FilterValue }
  | { column: string; op: "in"; value: Array<string | number> }
  | { column: string; op: "ilike"; value: string };

export type QueryOrder = {
  column: string;
  ascending?: boolean;
};

function encodeFilter(filter: QueryFilter) {
  if (filter.op === "in") {
    return `${filter.op}.(${filter.value.map((item) => String(item)).join(",")})`;
  }

  if (filter.op === "is") {
    return `${filter.op}.${filter.value === null ? "null" : String(filter.value)}`;
  }

  return `${filter.op}.${String(filter.value)}`;
}

function buildQueryString(options?: {
  filters?: QueryFilter[];
  limit?: number;
  offset?: number;
  order?: QueryOrder[];
  select?: string;
}) {
  const params = new URLSearchParams();
  params.set("select", options?.select ?? "*");

  for (const filter of options?.filters ?? []) {
    params.append(filter.column, encodeFilter(filter));
  }

  if (typeof options?.limit === "number") {
    params.set("limit", `${options.limit}`);
  }

  if (typeof options?.offset === "number") {
    params.set("offset", `${options.offset}`);
  }

  for (const order of options?.order ?? []) {
    params.append("order", `${order.column}.${order.ascending === false ? "desc" : "asc"}`);
  }

  return params.toString();
}

export function isMissingMobileSchemaError(error: unknown) {
  if (!(error instanceof SupabaseRequestError)) {
    return false;
  }

  return (
    error.status === 404 ||
    error.payload?.code === "PGRST205" ||
    error.payload?.message?.toLowerCase().includes("relation") ||
    error.payload?.message?.toLowerCase().includes("could not find") ||
    false
  );
}

export async function selectRows<T>(
  table: string,
  options?: {
    filters?: QueryFilter[];
    limit?: number;
    offset?: number;
    order?: QueryOrder[];
    select?: string;
  }
) {
  const query = buildQueryString(options);
  return callSupabase<T[]>(`/rest/v1/${table}?${query}`, { method: "GET" });
}

export async function insertRow<TInput, TOutput = TInput>(
  table: string,
  input: TInput,
  options?: {
    onConflict?: string;
    returning?: "minimal" | "representation";
  }
) {
  const params = new URLSearchParams();
  if (options?.onConflict) {
    params.set("on_conflict", options.onConflict);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const prefer = [
    options?.onConflict ? "resolution=merge-duplicates" : null,
    `return=${options?.returning ?? "representation"}`
  ]
    .filter(Boolean)
    .join(",");

  const payload = await callSupabase<TOutput[] | null>(`/rest/v1/${table}${suffix}`, {
    method: "POST",
    headers: {
      Prefer: prefer
    },
    body: JSON.stringify(input)
  });

  return Array.isArray(payload) ? payload[0] ?? null : null;
}

export async function insertRows<TInput, TOutput = TInput>(
  table: string,
  input: TInput[],
  options?: {
    onConflict?: string;
    returning?: "minimal" | "representation";
  }
) {
  if (input.length === 0) {
    return [] as TOutput[];
  }

  const params = new URLSearchParams();
  if (options?.onConflict) {
    params.set("on_conflict", options.onConflict);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const prefer = [
    options?.onConflict ? "resolution=merge-duplicates" : null,
    `return=${options?.returning ?? "representation"}`
  ]
    .filter(Boolean)
    .join(",");

  const payload = await callSupabase<TOutput[] | null>(`/rest/v1/${table}${suffix}`, {
    method: "POST",
    headers: {
      Prefer: prefer
    },
    body: JSON.stringify(input)
  });

  return Array.isArray(payload) ? payload : [];
}

export async function patchRows<TOutput>(
  table: string,
  filters: QueryFilter[],
  input: Record<string, unknown>,
  options?: {
    returning?: "minimal" | "representation";
  }
) {
  const query = buildQueryString({ filters });
  const payload = await callSupabase<TOutput[] | null>(`/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      Prefer: `return=${options?.returning ?? "representation"}`
    },
    body: JSON.stringify(input)
  });

  return Array.isArray(payload) ? payload : [];
}

export async function deleteRows<TOutput = null>(
  table: string,
  filters: QueryFilter[],
  options?: {
    returning?: "minimal" | "representation";
  }
) {
  const query = buildQueryString({ filters });
  const payload = await callSupabase<TOutput[] | null>(`/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: {
      Prefer: `return=${options?.returning ?? "representation"}`
    }
  });

  return Array.isArray(payload) ? payload : [];
}
