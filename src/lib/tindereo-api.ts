import type { AppDataset, PlatformAction, PlatformDataEnvelope } from "@/lib/tindereo-types";

async function readJsonResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | PlatformDataEnvelope
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "No se pudo completar la operacion."
    );
  }

  if (!payload || !("data" in payload)) {
    throw new Error("La API ha respondido sin datos.");
  }

  return payload;
}

export async function fetchPlatformData() {
  const response = await fetch("/api/platform", {
    method: "GET",
    cache: "no-store"
  });

  return readJsonResponse(response);
}

export async function resetPlatformData() {
  const response = await fetch("/api/platform/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });

  return readJsonResponse(response);
}

export async function executePlatformAction(action: PlatformAction) {
  const response = await fetch("/api/platform/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(action)
  });

  return readJsonResponse(response);
}

export function extractPlatformData(payload: PlatformDataEnvelope): AppDataset {
  return payload.data;
}
