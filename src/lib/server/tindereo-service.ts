import { hydratePersistedState, stripSession } from "@/lib/tindereo-session";
import {
  getDatasetRevision,
  readAppDataset,
  replaceAppDataset,
  resetAppDataset
} from "@/lib/server/tindereo-database";
import { publishPlatformUpdate } from "@/lib/server/tindereo-realtime";
import type {
  AppDataset,
  CreateEventInput,
  PersistedState,
  PlatformAction,
  PlatformDataEnvelope
} from "@/lib/tindereo-types";
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
} from "@/lib/tindereo-utils";

function buildPlatformEnvelope(
  data: AppDataset,
  meta?: PlatformDataEnvelope["meta"]
): PlatformDataEnvelope {
  const revision = getDatasetRevision();

  return {
    data,
    meta: {
      revision,
      ...(meta ?? {})
    }
  };
}

function runStateMutation(
  actorId: string,
  mutation: (state: PersistedState) => PersistedState,
  metaBuilder?: (state: PersistedState) => PlatformDataEnvelope["meta"]
): PlatformDataEnvelope {
  const currentData = readAppDataset();
  const nextState = mutation(hydratePersistedState(currentData, { currentUserId: actorId }));
  const nextData = stripSession(nextState);
  replaceAppDataset(nextData);
  const payload = buildPlatformEnvelope(nextData, metaBuilder?.(nextState));
  publishPlatformUpdate(payload);
  return payload;
}

export function getPlatformData(): AppDataset {
  return readAppDataset();
}

export function getPlatformEnvelope(): PlatformDataEnvelope {
  return buildPlatformEnvelope(readAppDataset());
}

export function resetPlatformData(): PlatformDataEnvelope {
  const data = resetAppDataset();
  const payload = buildPlatformEnvelope(data);
  publishPlatformUpdate(payload);
  return payload;
}

export function createEventRecord(actorId: string, input: CreateEventInput): PlatformDataEnvelope {
  return runStateMutation(
    actorId,
    (state) => createEvent(state, actorId, input),
    (state) => ({
      selectedEventId: state.session.selectedEventId
    })
  );
}

export function runPlatformAction(action: PlatformAction): PlatformDataEnvelope {
  switch (action.type) {
    case "register-user": {
      const currentData = readAppDataset();
      const nextState = registerUser(hydratePersistedState(currentData), action.input);
      const createdUser = nextState.users[0];
      if (!createdUser) {
        throw new Error("No se pudo crear el perfil.");
      }
      const nextData = stripSession(nextState);
      replaceAppDataset(nextData);
      const payload = buildPlatformEnvelope(nextData, {
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
