import { DEFAULT_STATE } from "@/lib/tindereo-data";
import type { AppDataset, PersistedState, SessionState } from "@/lib/tindereo-types";

export const SESSION_STORAGE_KEY = "tindereo-session-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function pickBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export function createSessionState(currentUserId: string): SessionState {
  return {
    ...DEFAULT_STATE.session,
    isAuthenticated: false,
    currentUserId
  };
}

export function readSessionState(raw: string | null): Partial<SessionState> {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }

    return {
      isAuthenticated: pickBoolean(parsed.isAuthenticated),
      currentUserId: pickString(parsed.currentUserId),
      activeTab: pickString(parsed.activeTab) as SessionState["activeTab"] | undefined,
      selectedEventId:
        parsed.selectedEventId === null ? null : pickString(parsed.selectedEventId),
      selectedEventView: pickString(
        parsed.selectedEventView
      ) as SessionState["selectedEventView"] | undefined,
      selectedPrivateChatId:
        parsed.selectedPrivateChatId === null ? null : pickString(parsed.selectedPrivateChatId)
    };
  } catch {
    return {};
  }
}

export function hydratePersistedState(
  data: AppDataset,
  sessionPatch?: Partial<SessionState>
): PersistedState {
  const fallbackUserId =
    sessionPatch?.currentUserId?.trim() ||
    data.users[0]?.id ||
    DEFAULT_STATE.session.currentUserId;

  return {
    ...data,
    session: {
      ...createSessionState(fallbackUserId),
      ...sessionPatch,
      currentUserId: fallbackUserId
    }
  };
}

export function stripSession(state: PersistedState): AppDataset {
  const { session: _session, ...data } = state;
  return data;
}
