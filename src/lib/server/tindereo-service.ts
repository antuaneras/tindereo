import { hydratePersistedState, stripSession } from "../tindereo-session";
import {
  getDatasetRevision,
  readAppDataset,
  readPrimaryAppDataset,
  replaceAppDataset,
  resetAppDataset
} from "./tindereo-store";
import { persistMessageCollectionsDelta } from "./tindereo-message-store";
import { publishPlatformUpdate } from "./tindereo-realtime";
import { sendPushNotificationsForNotifications } from "./tindereo-web-push";
import type {
  AppDataset,
  CreateEventInput,
  PersistedState,
  PlatformAction,
  PlatformDataEnvelope
} from "../tindereo-types";
import {
  createGroupChat,
  createEventPost,
  createEventStory,
  createEvent,
  createUserPost,
  createUserStory,
  deletePrivateMessage,
  deleteEventPost,
  deleteEventStory,
  deleteUserPost,
  deleteUserStory,
  leaveEvent,
  markAllNotificationsRead,
  markChatMediaViewed,
  markNotificationRead,
  markStoryViewed,
  markThreadRead,
  postEventMessage,
  postEventMediaMessage,
  registerUser,
  requestEventAccess,
  respondToEventAccess,
  respondToEventInvite,
  respondToPrivateChatRequest,
  sendPrivateMediaMessage,
  sendPrivateChatRequest,
  sendEventInvite,
  sendPrivateMessage,
  setEventChatMode,
  startFriendChat,
  toggleFriendship,
  updateUserAvatar,
  updateEventPost,
  updateEventStory,
  updateUserPost,
  updateUserStory
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
  metaBuilder?: (state: PersistedState) => PlatformDataEnvelope["meta"],
  options?: {
    requiresHydratedMessages?: boolean;
  }
): Promise<PlatformDataEnvelope> {
  const currentData = options?.requiresHydratedMessages
    ? await readAppDataset()
    : await readPrimaryAppDataset();
  const previousNotificationIds = new Set(currentData.notifications.map((notification) => notification.id));
  const nextState = mutation(hydratePersistedState(currentData, { currentUserId: actorId }));
  const nextData = stripSession(nextState);
  await persistMessageCollectionsDelta(currentData, nextData);
  await replaceAppDataset(nextData);
  const payload = await buildPlatformEnvelope(await readAppDataset(), metaBuilder?.(nextState));
  publishPlatformUpdate(payload);
  void sendPushNotificationsForNotifications(
    nextData,
    nextData.notifications.filter((notification) => !previousNotificationIds.has(notification.id))
  ).catch(() => undefined);
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
      const currentData = await readPrimaryAppDataset();
      const nextState = registerUser(hydratePersistedState(currentData), action.input);
      const createdUser = nextState.users[0];
      if (!createdUser) {
        throw new Error("No se pudo crear el perfil.");
      }
      const nextData = stripSession(nextState);
      await replaceAppDataset(nextData);
      const payload = await buildPlatformEnvelope(await readAppDataset(), {
        currentUserId: createdUser.id
      });
      publishPlatformUpdate(payload);
      return payload;
    }
    case "update-user-avatar":
      return runStateMutation(action.actorId, (state) =>
        updateUserAvatar(state, action.actorId, action.imageUrl)
      );
    case "create-event":
      return createEventRecord(action.actorId, action.input);
    case "set-event-chat-mode":
      return runStateMutation(action.actorId, (state) =>
        setEventChatMode(state, action.actorId, action.eventId, action.mode)
      );
    case "request-event-access":
      return runStateMutation(action.actorId, (state) =>
        requestEventAccess(state, action.eventId, action.actorId)
      );
    case "respond-event-access":
      return runStateMutation(action.actorId, (state) =>
        respondToEventAccess(state, action.membershipId, action.actorId, action.accept)
      );
    case "toggle-friendship":
      return runStateMutation(action.actorId, (state) =>
        toggleFriendship(state, action.actorId, action.targetUserId)
      );
    case "send-event-invite":
      return runStateMutation(
        action.actorId,
        (state) => sendEventInvite(state, action.actorId, action.eventId, action.targetUserId)
      );
    case "respond-event-invite":
      return runStateMutation(action.actorId, (state) =>
        respondToEventInvite(state, action.inviteId, action.actorId, action.accept)
      );
    case "leave-event":
      return runStateMutation(action.actorId, (state) =>
        leaveEvent(state, action.eventId, action.actorId)
      );
    case "create-user-post":
      return runStateMutation(action.actorId, (state) =>
        createUserPost(state, action.actorId, action.imageUrl, action.caption)
      );
    case "create-user-story":
      return runStateMutation(action.actorId, (state) =>
        createUserStory(state, action.actorId, action.imageUrl, action.caption)
      );
    case "update-user-post":
      return runStateMutation(action.actorId, (state) =>
        updateUserPost(state, action.actorId, action.postId, action.caption)
      );
    case "delete-user-post":
      return runStateMutation(action.actorId, (state) =>
        deleteUserPost(state, action.actorId, action.postId)
      );
    case "update-user-story":
      return runStateMutation(action.actorId, (state) =>
        updateUserStory(state, action.actorId, action.storyId, action.caption)
      );
    case "delete-user-story":
      return runStateMutation(action.actorId, (state) =>
        deleteUserStory(state, action.actorId, action.storyId)
      );
    case "create-event-post":
      return runStateMutation(action.actorId, (state) =>
        createEventPost(state, action.actorId, action.eventId, action.imageUrl, action.caption)
      );
    case "create-event-story":
      return runStateMutation(action.actorId, (state) =>
        createEventStory(state, action.actorId, action.eventId, action.imageUrl, action.caption)
      );
    case "update-event-post":
      return runStateMutation(action.actorId, (state) =>
        updateEventPost(state, action.actorId, action.eventId, action.postId, action.caption)
      );
    case "delete-event-post":
      return runStateMutation(action.actorId, (state) =>
        deleteEventPost(state, action.actorId, action.eventId, action.postId)
      );
    case "update-event-story":
      return runStateMutation(action.actorId, (state) =>
        updateEventStory(state, action.actorId, action.eventId, action.storyId, action.caption)
      );
    case "delete-event-story":
      return runStateMutation(action.actorId, (state) =>
        deleteEventStory(state, action.actorId, action.eventId, action.storyId)
      );
    case "send-group-message":
      return runStateMutation(action.actorId, (state) =>
        postEventMessage(state, action.eventId, action.actorId, action.text)
      );
    case "send-group-media-message":
      return runStateMutation(action.actorId, (state) =>
        postEventMediaMessage(
          state,
          action.eventId,
          action.actorId,
          action.imageUrl,
          action.caption,
          action.viewOnce
        )
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
    case "start-friend-chat":
      return runStateMutation(action.actorId, (state) =>
        startFriendChat(state, action.actorId, action.targetUserId)
      );
    case "create-group-chat":
      return runStateMutation(action.actorId, (state) =>
        createGroupChat(state, action.actorId, action.title, action.participantIds)
      );
    case "send-private-message":
      return runStateMutation(action.actorId, (state) =>
        sendPrivateMessage(state, action.chatId, action.actorId, action.text)
      );
    case "delete-private-message":
      return runStateMutation(
        action.actorId,
        (state) => deletePrivateMessage(state, action.chatId, action.messageId, action.actorId),
        undefined,
        { requiresHydratedMessages: true }
      );
    case "send-private-media-message":
      return runStateMutation(action.actorId, (state) =>
        sendPrivateMediaMessage(
          state,
          action.chatId,
          action.actorId,
          action.imageUrl,
          action.caption,
          action.viewOnce
        )
      );
    case "mark-story-viewed":
      return runStateMutation(action.actorId, (state) =>
        markStoryViewed(state, action.actorId, action.storyId)
      );
    case "mark-chat-media-viewed":
      return runStateMutation(
        action.actorId,
        (state) => markChatMediaViewed(state, action.actorId, action.messageId),
        undefined,
        { requiresHydratedMessages: true }
      );
    case "mark-thread-read":
      return runStateMutation(action.actorId, (state) =>
        markThreadRead(state, action.actorId, action.scope, action.targetId)
      );
    case "mark-notification-read":
      return runStateMutation(action.actorId, (state) =>
        markNotificationRead(state, action.actorId, action.notificationId)
      );
    case "mark-all-notifications-read":
      return runStateMutation(action.actorId, (state) =>
        markAllNotificationsRead(state, action.actorId)
      );
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unsupported action: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
