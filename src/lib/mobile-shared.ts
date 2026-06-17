import type { MobileArrivalStatus, MobileEvent, MobileEventStatus } from "@/lib/mobile-types";

export function buildMobileId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export function slugifyMobile(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueMobileSlug(title: string, taken: Set<string>) {
  const base = slugifyMobile(title) || buildMobileId("evento");
  if (!taken.has(base)) {
    return base;
  }

  let index = 2;
  while (taken.has(`${base}-${index}`)) {
    index += 1;
  }

  return `${base}-${index}`;
}

export function safeJsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value !== "string") {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

export function getEventExperienceState(event: Pick<MobileEvent, "startsAt" | "endsAt">) {
  const now = Date.now();
  const startsAt = new Date(event.startsAt).getTime();
  const endsAt = new Date(event.endsAt).getTime();

  if (Number.isFinite(startsAt) && Number.isFinite(endsAt)) {
    if (now < startsAt) {
      return "upcoming" satisfies MobileEventStatus;
    }

    if (now <= endsAt + 4 * 60 * 60 * 1000) {
      return "live" satisfies MobileEventStatus;
    }
  }

  return "afterglow" satisfies MobileEventStatus;
}

export function getArrivalStatusLabel(status: MobileArrivalStatus) {
  switch (status) {
    case "going":
      return "Voy saliendo";
    case "eta20":
      return "Llego en 20";
    case "inside":
      return "Ya estoy dentro";
    default:
      return "Sin marcar";
  }
}

export function formatMobileDateTime(dateIso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateIso));
}

export function formatMobileTime(dateIso: string) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateIso));
}

export function formatRelativeMobileTime(dateIso: string) {
  const now = Date.now();
  const date = new Date(dateIso).getTime();
  const delta = Math.round((date - now) / 60000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

  if (Math.abs(delta) < 60) {
    return formatter.format(delta, "minute");
  }

  const hours = Math.round(delta / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  return formatter.format(Math.round(hours / 24), "day");
}

export function getConversationPreview(body: string) {
  const text = body.trim();
  if (!text) {
    return "Sin mensajes";
  }

  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
}

export function getMapLink(address: string | null, lat: number | null, lng: number | null) {
  if (lat !== null && lng !== null) {
    return `https://maps.apple.com/?ll=${lat},${lng}`;
  }

  if (address) {
    return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
  }

  return null;
}
