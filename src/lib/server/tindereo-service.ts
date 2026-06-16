import { hydratePersistedState, stripSession } from "../tindereo-session";
import {
  getDatasetRevision,
  readAppDataset,
  replaceAppDataset,
  resetAppDataset
} from "./tindereo-store";
import { publishPlatformUpdate } from "./tindereo-realtime";
import type {
  AppDataset,
  CreateEventInput,
  PersistedState,
  PlatformAction,
  PlatformDataEnvelope
} from "../tindereo-types";
import {
  createEvent,
  leaveEvent,
  postEventMessage,
  registerUser,
  requestEventAccess,
  respondToEventAccess,
  respondToPrivateChatRequest,
  sendPrivateChatRequest,
  sendPrivateMessage
} from "../tindereo-utils";

function buildPlatformEnvelope(
  data: AppDataset,
  meta?: PlatformDataEnvelope["meta"]
): Promise<PlatformDataEnvelope> {
  return getDatasetRevision().then((revision) => ({
    data,
    meta: {
      revision,
      ...(meta ?? {})
    }
  }));
}

async function runStateMutation(
  actorId: string,
  mutation: (state: PersistedState) => PersistedState,
  metaBuilder?: (state: PersistedState) => PlatformDataEnvelope["meta"]
): Promise<PlatformDataEnvelope> {
  const currentData = await readAppDataset();
  const nextState = mutation(hydratePersistedState(currentData, { currentUserId: actorId }));
  const nextData = stripSession(nextState);
  await replaceAppDataset(nextData);
  const payload = await buildPlatformEnvelope(nextData, metaBuilder?.(nextState));
  publishPlatformUpdate(payload);
  return payload;
}

export async function getPlatformData(): Promise<AppDataset> {
  return readAppDataset();
}

export async function getPlatformEnvelope(): Promise<PlatformDataEnvelope> {
  return buildPlatformEnvelope(await readAppDataset());
}

export async function resetPlatformData(): Promise<PlatformDataEnvelope> {
  const data = await resetAppDataset();
  const payload = await buildPlatformEnvelope(data);
  publishPlatformUpdate(payload);
  return payload;
}

export async function createEventRecord(
  actorId: string,
  input: CreateEventInput
): Promise<PlatformDataEnvelope> {
  return runStateMutation(
    actorId,
    (state) => createEvent(state, actorId, input),
    (state) => ({
      selectedEventId: state.session.selectedEventId
    })
  );
}

export async function runPlatformAction(action: PlatformAction): Promise<PlatformDataEnvelope> {
  switch (action.type) {
    case "register-user": {
      const currentData = await readAppDataset();
      const nextState = registerUser(hydratePersistedState(currentData), action.input);
      const createdUser = nextState.users[0];
      if (!createdUser) {
        throw new Error("No se pudo crear el perfil.");
      }
      const nextData = stripSession(nextState);
      await replaceAppDataset(nextData);
      const payload = await buildPlatformEnvelope(nextData, {
        currentUserId: createdUser.id
      });
      publishPlatformUpdate(payload);
      return payload;
    }
    case "create-event":
      return createEventRecord(action.actorId, action.input);
    case "request-event-access":
      return runStateMutation(action.actorId, (state) =>
        requestEventAccess(state, action.eventId, action.actorId)
      );
    case "respond-event-access":
      return runStateMutation(action.actorId, (state) =>
        respondToEventAccess(state, action.membershipId, action.actorId, action.accept)
      );
    case "leave-event":
      return runStateMutation(action.actorId, (state) =>
        leaveEvent(state, action.eventId, action.actorId)
      );
    case "send-group-message":
      return runStateMutation(action.actorId, (state) =>
        postEventMessage(state, action.eventId, action.actorId, action.text)
      );
    case "send-private-request":
      return runStateMutation(action.actorId, (state) =>
        sendPrivateChatRequest(
          state,
          action.eventId,
          action.actorId,
          action.targetUserId,
          action.message
        )
      );
    case "respond-private-request":
      return runStateMutation(action.actorId, (state) =>
        respondToPrivateChatRequest(state, action.requestId, action.actorId, action.accept)
      );
    case "send-private-message":
      return runStateMutation(action.actorId, (state) =>
        sendPrivateMessage(state, action.chatId, action.actorId, action.text)
      );
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unsupported action: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
