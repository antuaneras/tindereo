import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import {
  callSupabase,
  isSupabaseConfigured,
  SupabaseRequestError
} from "@/lib/server/tindereo-supabase";

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

type SupabaseAuthAccountRow = {
  created_at: string;
  id: string;
  password_hash: string;
  password_salt: string;
  updated_at: string;
  user_id: string;
  username: string;
  username_lower: string;
};

type SupabaseAuthSessionRow = {
  created_at: string;
  expires_at: string;
  id: string;
  last_seen_at: string;
  token_hash: string;
  user_id: string;
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

function readLocalAuthState() {
  if (globalThis.__tindereoAuthState__) {
    return globalThis.__tindereoAuthState__;
  }

  ensureAuthStateFile();
  const raw = readFileSync(AUTH_STATE_PATH, "utf8");
  const nextState = sanitizeAuthState(JSON.parse(raw) as unknown);
  globalThis.__tindereoAuthState__ = nextState;
  return nextState;
}

function writeLocalAuthState(nextState: AuthStateRecord) {
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

function toLocalAccount(row: SupabaseAuthAccountRow): AuthAccountRecord {
  return {
    createdAt: row.created_at,
    id: row.id,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    userId: row.user_id,
    username: row.username,
    usernameLower: row.username_lower
  };
}

function toLocalSession(row: SupabaseAuthSessionRow): AuthSessionRecord {
  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    lastSeenAt: row.last_seen_at,
    tokenHash: row.token_hash,
    userId: row.user_id
  };
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

function purgeExpiredLocalSessions(state: AuthStateRecord) {
  const now = Date.now();

  return {
    ...state,
    sessions: state.sessions.filter((session) => new Date(session.expiresAt).getTime() > now)
  };
}

function createLocalSessionForUser(state: AuthStateRecord, userId: string) {
  const now = new Date();
  const token = randomBytes(32).toString("hex");
  const nextState = purgeExpiredLocalSessions(state);
  const nextSession: AuthSessionRecord = {
    id: `session-${randomBytes(8).toString("hex")}`,
    userId,
    tokenHash: hashSessionToken(token),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS).toISOString()
  };

  writeLocalAuthState({
    ...nextState,
    sessions: [...nextState.sessions, nextSession]
  });

  return token;
}

function createLocalAuthAccount(userId: string, username: string, password: string) {
  const normalizedUsername = validateCredentialsInput(username, password);
  const currentState = purgeExpiredLocalSessions(readLocalAuthState());

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

  writeLocalAuthState({
    ...currentState,
    accounts: [...currentState.accounts, nextAccount]
  });
}

function authenticateLocalUser(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const currentState = purgeExpiredLocalSessions(readLocalAuthState());
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
    token: createLocalSessionForUser(currentState, account.userId),
    userId: account.userId
  };
}

function revokeLocalSession(token: string | null) {
  if (!token) {
    return;
  }

  const tokenHash = hashSessionToken(token);
  const currentState = purgeExpiredLocalSessions(readLocalAuthState());
  writeLocalAuthState({
    ...currentState,
    sessions: currentState.sessions.filter((session) => session.tokenHash !== tokenHash)
  });
}

function getLocalAuthenticatedUserId(cookieStore: CookieStoreLike) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const currentState = purgeExpiredLocalSessions(readLocalAuthState());
  const session = currentState.sessions.find((candidate) => candidate.tokenHash === tokenHash);

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    revokeLocalSession(token);
    return null;
  }

  writeLocalAuthState({
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

function resetLocalAuthState() {
  writeLocalAuthState(createEmptyAuthState());
}

function createLocalSessionAfterRegistration(userId: string) {
  const currentState = purgeExpiredLocalSessions(readLocalAuthState());
  return createLocalSessionForUser(currentState, userId);
}

async function findRemoteAccountByUsername(usernameLower: string) {
  const params = new URLSearchParams({
    select: "id,user_id,username,username_lower,password_hash,password_salt,created_at,updated_at",
    username_lower: `eq.${usernameLower}`,
    limit: "1"
  });
  const rows = await callSupabase<SupabaseAuthAccountRow[]>(
    `/rest/v1/tindereo_auth_accounts?${params.toString()}`,
    {
      method: "GET"
    }
  );

  return rows[0] ? toLocalAccount(rows[0]) : null;
}

async function deleteRemoteAccountByUsername(usernameLower: string) {
  const params = new URLSearchParams({
    username_lower: `eq.${usernameLower}`
  });

  await callSupabase<null>(`/rest/v1/tindereo_auth_accounts?${params.toString()}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });
}

async function insertRemoteSession(userId: string) {
  const now = new Date();
  const token = randomBytes(32).toString("hex");
  const nextSession: AuthSessionRecord = {
    id: `session-${randomBytes(8).toString("hex")}`,
    userId,
    tokenHash: hashSessionToken(token),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_DURATION_MS).toISOString()
  };

  await callSupabase<null>("/rest/v1/tindereo_auth_sessions", {
    method: "POST",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      id: nextSession.id,
      user_id: nextSession.userId,
      token_hash: nextSession.tokenHash,
      created_at: nextSession.createdAt,
      last_seen_at: nextSession.lastSeenAt,
      expires_at: nextSession.expiresAt
    })
  });

  return token;
}

async function findRemoteSessionByTokenHash(tokenHash: string) {
  const params = new URLSearchParams({
    select: "id,user_id,token_hash,created_at,last_seen_at,expires_at",
    token_hash: `eq.${tokenHash}`,
    limit: "1"
  });
  const rows = await callSupabase<SupabaseAuthSessionRow[]>(
    `/rest/v1/tindereo_auth_sessions?${params.toString()}`,
    {
      method: "GET"
    }
  );

  return rows[0] ? toLocalSession(rows[0]) : null;
}

async function touchRemoteSession(sessionId: string) {
  const params = new URLSearchParams({
    id: `eq.${sessionId}`
  });

  await callSupabase<null>(`/rest/v1/tindereo_auth_sessions?${params.toString()}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      last_seen_at: new Date().toISOString()
    })
  });
}

async function deleteRemoteSessionByTokenHash(tokenHash: string) {
  const params = new URLSearchParams({
    token_hash: `eq.${tokenHash}`
  });

  await callSupabase<null>(`/rest/v1/tindereo_auth_sessions?${params.toString()}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });
}

async function createRemoteAuthAccount(userId: string, username: string, password: string) {
  const normalizedUsername = validateCredentialsInput(username, password);
  const existingAccount = await findRemoteAccountByUsername(normalizedUsername);

  if (existingAccount) {
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

  try {
    await callSupabase<null>("/rest/v1/tindereo_auth_accounts", {
      method: "POST",
      headers: {
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        id: nextAccount.id,
        user_id: nextAccount.userId,
        username: nextAccount.username,
        username_lower: nextAccount.usernameLower,
        password_hash: nextAccount.passwordHash,
        password_salt: nextAccount.passwordSalt,
        created_at: nextAccount.createdAt,
        updated_at: nextAccount.createdAt
      })
    });
  } catch (error) {
    if (
      error instanceof SupabaseRequestError &&
      (error.payload?.code === "23505" || error.status === 409)
    ) {
      throw new Error("Ese nombre de usuario ya esta en uso.");
    }

    throw error;
  }
}

async function authenticateRemoteUser(username: string, password: string) {
  const normalizedUsername = normalizeUsername(username);
  const account = await findRemoteAccountByUsername(normalizedUsername);

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
    token: await insertRemoteSession(account.userId),
    userId: account.userId
  };
}

async function revokeRemoteSession(token: string | null) {
  if (!token) {
    return;
  }

  await deleteRemoteSessionByTokenHash(hashSessionToken(token));
}

async function getRemoteAuthenticatedUserId(cookieStore: CookieStoreLike) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;

  if (!token) {
    return null;
  }

  const session = await findRemoteSessionByTokenHash(hashSessionToken(token));

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await revokeRemoteSession(token);
    return null;
  }

  await touchRemoteSession(session.id);
  return session.userId;
}

async function resetRemoteAuthState() {
  await callSupabase<null>("/rest/v1/tindereo_auth_sessions", {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });

  await callSupabase<null>("/rest/v1/tindereo_auth_accounts", {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal"
    }
  });
}

async function createRemoteSessionAfterRegistration(userId: string) {
  return insertRemoteSession(userId);
}

export async function createAuthAccount(userId: string, username: string, password: string) {
  if (!isSupabaseConfigured()) {
    createLocalAuthAccount(userId, username, password);
    return;
  }

  await createRemoteAuthAccount(userId, username, password);
}

export async function authenticateUser(username: string, password: string) {
  if (!isSupabaseConfigured()) {
    return authenticateLocalUser(username, password);
  }

  return authenticateRemoteUser(username, password);
}

export async function revokeSession(token: string | null) {
  if (!isSupabaseConfigured()) {
    revokeLocalSession(token);
    return;
  }

  await revokeRemoteSession(token);
}

export async function getAuthenticatedUserId(cookieStore: CookieStoreLike) {
  if (!isSupabaseConfigured()) {
    return getLocalAuthenticatedUserId(cookieStore);
  }

  return getRemoteAuthenticatedUserId(cookieStore);
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

export async function resetAuthState() {
  if (!isSupabaseConfigured()) {
    resetLocalAuthState();
    return;
  }

  await resetRemoteAuthState();
}

export async function createSessionAfterRegistration(userId: string) {
  if (!isSupabaseConfigured()) {
    return createLocalSessionAfterRegistration(userId);
  }

  return createRemoteSessionAfterRegistration(userId);
}

export async function deleteAuthAccountByUsername(username: string) {
  if (!isSupabaseConfigured()) {
    const normalizedUsername = normalizeUsername(username);
    const currentState = readLocalAuthState();
    writeLocalAuthState({
      ...currentState,
      accounts: currentState.accounts.filter(
        (account) => account.usernameLower !== normalizedUsername
      )
    });
    return;
  }

  await deleteRemoteAccountByUsername(normalizeUsername(username));
}
