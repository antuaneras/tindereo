import type {
  AppDataset,
  LoginInput,
  PlatformAction,
  PlatformDataEnvelope,
  RegisterAccountInput
} from "@/lib/tindereo-types";

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

export async function loginAccount(input: LoginInput) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readJsonResponse(response);
}

export async function registerAccount(input: RegisterAccountInput) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return readJsonResponse(response);
}

export async function logoutAccount() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });

  const payload = (await response.json().catch(() => null)) as { error?: string } | { ok?: boolean } | null;

  if (!response.ok) {
    throw new Error(payload && "error" in payload && payload.error ? payload.error : "No se pudo cerrar sesion.");
  }

  return payload;
}

export function extractPlatformData(payload: PlatformDataEnvelope): AppDataset {
  return payload.data;
}

export async function fetchWebPushPublicKey() {
  const response = await fetch("/api/push/public-key", {
    method: "GET",
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; publicKey?: string }
    | null;

  if (!response.ok || !payload?.publicKey) {
    throw new Error(
      payload?.error ?? "No se pudo cargar la clave publica de notificaciones."
    );
  }

  return payload.publicKey;
}

export async function saveWebPushSubscription(subscription: PushSubscriptionJSON) {
  const response = await fetch("/api/push/subscription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(subscription)
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | { ok?: boolean } | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "No se pudo guardar la suscripcion push."
    );
  }

  return payload;
}

export async function deleteWebPushSubscription(endpoint?: string | null) {
  const response = await fetch("/api/push/subscription", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      endpoint: endpoint ?? null
    })
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | { ok?: boolean } | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "No se pudo desactivar la suscripcion push."
    );
  }

  return payload;
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
