"use client";

const MOBILE_CACHE_VERSION = "v2";

type CacheStorageKind = "localStorage" | "sessionStorage";

function getBrowserStorage(kind: CacheStorageKind) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[kind];
  } catch {
    return null;
  }
}

export function buildMobileCacheKey(viewerScope: string, ...parts: string[]) {
  const normalizedScope = viewerScope.trim().toLowerCase() || "anonymous";
  return ["mobile-cache", MOBILE_CACHE_VERSION, normalizedScope, ...parts].join(":");
}

export function readMobilePersistentCache<T>(key: string) {
  const sessionStorage = getBrowserStorage("sessionStorage");
  const localStorage = getBrowserStorage("localStorage");

  for (const storage of [sessionStorage, localStorage]) {
    if (!storage) {
      continue;
    }

    try {
      const raw = storage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw) as T;

      if (storage === localStorage && sessionStorage && sessionStorage !== localStorage) {
        sessionStorage.setItem(key, raw);
      }

      return parsed;
    } catch {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore broken cache cleanup issues.
      }
    }
  }

  return null;
}

export function writeMobilePersistentCache(key: string, value: unknown) {
  const raw = JSON.stringify(value);

  for (const kind of ["sessionStorage", "localStorage"] as const) {
    const storage = getBrowserStorage(kind);
    if (!storage) {
      continue;
    }

    try {
      storage.setItem(key, raw);
    } catch {
      // Ignore storage quota issues and keep the app responsive.
    }
  }
}

export function clearMobilePersistentCache(key: string) {
  for (const kind of ["sessionStorage", "localStorage"] as const) {
    const storage = getBrowserStorage(kind);
    if (!storage) {
      continue;
    }

    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
  }
}
