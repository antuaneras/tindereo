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

export function subscribeToPlatformStream({
  onError,
  onMessage,
  onOpen
}: {
  onError?: () => void;
  onMessage: (payload: PlatformDataEnvelope) => void;
  onOpen?: () => void;
}) {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }

  const eventSource = new EventSource("/api/platform/stream");

  const handlePlatformMessage = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as PlatformDataEnvelope;
      if (payload && "data" in payload) {
        onMessage(payload);
      }
    } catch {
      // Ignore malformed realtime payloads and keep the stream alive.
    }
  };

  const handleOpen = () => {
    onOpen?.();
  };

  const handleError = () => {
    onError?.();
  };

  eventSource.addEventListener("platform", handlePlatformMessage as EventListener);
  eventSource.addEventListener("open", handleOpen as EventListener);
  eventSource.onerror = handleError;

  return () => {
    eventSource.removeEventListener("platform", handlePlatformMessage as EventListener);
    eventSource.removeEventListener("open", handleOpen as EventListener);
    eventSource.close();
  };
}
