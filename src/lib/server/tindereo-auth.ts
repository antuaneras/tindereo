import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import path from "node:path";

const AUTH_STATE_PATH = path.join(process.cwd(), "storage", "auth-state.json");
const SESSION_COOKIE_NAME = "tindereo_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

type AuthAccountRecord = {
  createdAt: string;
  id: string;
  passwordHash: string;
  passwordSalt: string;
  userId: string;
  username: string;
  usernameLower: string;
};

type AuthSessionRecord = {
  createdAt: string;
  expiresAt: string;
  id: string;
  lastSeenAt: string;
  tokenHash: string;
  userId: string;
};

type AuthStateRecord = {
  accounts: AuthAccountRecord[];
  sessions: AuthSessionRecord[];
};

type CookieStoreLike = {
  delete: (name: string) => void;
  get: (name: string) => { value: string } | undefined;
  set: (
    name: string,
    value: string,
    options?: {
      expires?: Date;
      httpOnly?: boolean;
      maxAge?: number;
      path?: string;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
    }
  ) => void;
};

declare global {
  // eslint-disable-next-line no-var
  var __tindereoAuthState__: AuthStateRecord | undefined;
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createEmptyAuthState(): AuthStateRecord {
  return {
    accounts: [],
    sessions: []
  };
}

function sanitizeAuthState(value: unknown): AuthStateRecord {
  if (!value || typeof value !== "object") {
    return createEmptyAuthState();
  }

  const candidate = value as Partial<AuthStateRecord>;

  return {
    accounts: Array.isArray(candidate.accounts)
      ? candidate.accounts.filter(
          (account): account is AuthAccountRecord =>
            Boolean(
              account &&
                typeof account === "object" &&
                typeof account.id === "string" &&
                typeof account.userId === "string" &&
                typeof account.username === "string" &&
                typeof account.usernameLower === "string" &&
                typeof account.passwordHash === "string" &&
                typeof account.passwordSalt === "string" &&
                typeof account.createdAt === "string"
            )
        )
      : [],
    sessions: Array.isArray(candidate.sessions)
      ? candidate.sessions.filter(
          (session): session is AuthSessionRecord =>
            Boolean(
              session &&
                typeof session === "object" &&
                typeof session.id === "string" &&
                typeof session.userId === "string" &&
                typeof session.tokenHash === "string" &&
                typeof session.createdAt === "string" &&
                typeof session.lastSeenAt === "string" &&
                typeof session.expiresAt === "string"
            )
        )
      : []
  };
}

function ensureAuthStateFile() {
  mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });

  try {
    readFileSync(AUTH_STATE_PATH, "utf8");
  } catch {
    writeFileSync(AUTH_STATE_PATH, JSON.stringify(createEmptyAuthState(), null, 2), "utf8");
  }
}

function readAuthState() {
  if (globalThis.__tindereoAuthState__) {
    return globalThis.__tindereoAuthState__;
  }

  ensureAuthStateFile();
  const raw = readFileSync(AUTH_STATE_PATH, "utf8");
  const nextState = sanitizeAuthState(JSON.parse(raw) as unknown);
  globalThis.__tindereoAuthState__ = nextState;
  return nextState;
}

function writeAuthState(nextState: AuthStateRecord) {
  globalThis.__tindereoAuthState__ = nextState;
  ensureAuthStateFile();
  writeFileSync(AUTH_STATE_PATH, JSON.stringify(nextState, null, 2), "utf8");
  return nextState;
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeUsername(username: string) {
  return username.trim().replace(/^@+/, "").toLowerCase();
}

export function validateCredentialsInput(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);

  if (!/^[a-z0-9._-]{3,24}$/.test(normalizedUsername)) {
    throw new Error(
      "El usuario debe tener entre 3 y 24 caracteres y solo puede usar letras, numeros, punto, guion o guion bajo."
    );
  }

  if (password.trim().length < 8) {
    throw new Error("La contrasena debe tener al menos 8 caracteres.");
  }

  return normalizedUsername;
}

function purgeExpiredSessions(state: AuthStateRecord) {
  const now = Date.now();

  return {
    ...state,
    sessions: state.sessions.filter((session) => new Date(session.expiresAt).getTime() > now)
  };
}

function createSessionForUser(state: AuthStateRecord, userId: string) {
  const now = new Date();
  const token = randomBytes(32).toString("hex");
  const nextState = purgeExpiredSessions(state);
  const nextSession: AuthSessionRecord = {
    id: `session-${randomBytes(8).toString("hex")}`,
    userId,
    tokenHash: hashSessionToken(token),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS).toISOString()
  };

  writeAuthState({
    ...nextState,
    sessions: [...nextState.sessions, nextSession]
  });

  return token;
}

export function createAuthAccount(userId: string, username: string, password: string) {
  const normalizedUsername = validateCredentialsInput(username, password);
  const currentState = purgeExpiredSessions(readAuthState());

  if (currentState.accounts.some((account) => account.usernameLower === normalizedUsername)) {
    throw new Error("Ese nombre de usuario ya esta en uso.");
  }

  const salt = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const nextAccount: AuthAccountRecord = {
    id: `account-${randomBytes(8).toString("hex")}`,
    userId,
    username: normalizedUsername,
    usernameLower: normalizedUsername,
    passwordSalt: salt,
    passwordHash: hashPassword(password, salt),
    createdAt: now
  };

  writeAuthState({
    ...currentState,
    accounts: [...currentState.accounts, nextAccount]
  });
}

export function authenticateUser(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const currentState = purgeExpiredSessions(readAuthState());
  const account = currentState.accounts.find(
    (candidate) => candidate.usernameLower === normalizedUsername
  );

  if (!account) {
    throw new Error("Usuario o contrasena incorrectos.");
  }

  const expectedHash = hashPassword(password, account.passwordSalt);
  const expectedBuffer = Buffer.from(account.passwordHash, "hex");
  const receivedBuffer = Buffer.from(expectedHash, "hex");

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new Error("Usuario o contrasena incorrectos.");
  }

  return {
    token: createSessionForUser(currentState, account.userId),
    userId: account.userId
  };
}

export function revokeSession(token: string | null) {
  if (!token) {
    return;
  }

  const tokenHash = hashSessionToken(token);
  const currentState = purgeExpiredSessions(readAuthState());
  writeAuthState({
    ...currentState,
    sessions: currentState.sessions.filter((session) => session.tokenHash !== tokenHash)
  });
}

export function getAuthenticatedUserId(cookieStore: CookieStoreLike) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const currentState = purgeExpiredSessions(readAuthState());
  const session = currentState.sessions.find((candidate) => candidate.tokenHash === tokenHash);

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    revokeSession(token);
    return null;
  }

  writeAuthState({
    ...currentState,
    sessions: currentState.sessions.map((candidate) =>
      candidate.id === session.id
        ? {
            ...candidate,
            lastSeenAt: new Date().toISOString()
          }
        : candidate
    )
  });

  return session.userId;
}

export function setAuthenticatedUserCookie(cookieStore: CookieStoreLike, token: string) {
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  });
}

export function clearAuthenticatedUserCookie(cookieStore: CookieStoreLike) {
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0
  });
}

export function resetAuthState() {
  writeAuthState(createEmptyAuthState());
}

export function createSessionAfterRegistration(userId: string) {
  const currentState = purgeExpiredSessions(readAuthState());
  return createSessionForUser(currentState, userId);
}
