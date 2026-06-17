import type { AppDataset, EventItem, StoryItem } from "@/lib/tindereo-types";
import { stripPrivatePlatformFields } from "@/lib/server/tindereo-web-push";

function getEventMap(events: EventItem[]) {
  return new Map(events.map((event) => [event.id, event]));
}

function getStoryMap(stories: StoryItem[]) {
  return new Map(stories.map((story) => [story.id, story]));
}

function getFriendIds(data: AppDataset, viewerId: string) {
  return new Set(
    data.friendships
      .filter((friendship) => friendship.userIds.includes(viewerId))
      .map((friendship) => friendship.userIds.find((userId) => userId !== viewerId) ?? viewerId)
  );
}

function hasMembershipStatus(data: AppDataset, eventId: string, userId: string, statuses: string[]) {
  return data.memberships.some(
    (membership) =>
      membership.eventId === eventId &&
      membership.userId === userId &&
      statuses.includes(membership.status)
  );
}

function hasEventInvite(data: AppDataset, eventId: string, userId: string) {
  return data.eventInvites.some(
    (invite) =>
      invite.eventId === eventId &&
      (invite.toUserId === userId || invite.fromUserId === userId)
  );
}

function getVisibleEvents(data: AppDataset, viewerId: string) {
  return data.events.filter(
    (event) =>
      event.visibility === "public" ||
      event.hostId === viewerId ||
      hasMembershipStatus(data, event.id, viewerId, ["approved", "pending", "rejected"]) ||
      hasEventInvite(data, event.id, viewerId)
  );
}

function canSeeEventChat(data: AppDataset, eventId: string, viewerId: string) {
  const event = data.events.find((candidate) => candidate.id === eventId);
  if (!event) {
    return false;
  }

  return (
    event.hostId === viewerId || hasMembershipStatus(data, eventId, viewerId, ["approved"])
  );
}

function canSeeEventMedia(data: AppDataset, eventId: string, viewerId: string) {
  const event = data.events.find((candidate) => candidate.id === eventId);
  if (!event) {
    return false;
  }

  return (
    event.visibility === "public" ||
    event.hostId === viewerId ||
    hasMembershipStatus(data, eventId, viewerId, ["approved"]) ||
    hasEventInvite(data, eventId, viewerId)
  );
}

export function sanitizePlatformDataForViewer(data: AppDataset, viewerId: string | null): AppDataset {
  const publicData = stripPrivatePlatformFields(data);

  if (!viewerId) {
    return {
      ...publicData,
      users: [],
      events: publicData.events.filter((event) => event.visibility === "public"),
      memberships: [],
      groupMessages: [],
      privateChatRequests: [],
      privateChats: [],
      privateMessages: [],
      friendships: [],
      eventInvites: [],
      socialPosts: [],
      stories: [],
      storyViews: [],
      conversationReadStates: [],
      notifications: []
    };
  }

  const visibleEvents = getVisibleEvents(publicData, viewerId);
  const visibleEventIds = new Set(visibleEvents.map((event) => event.id));
  const friendIds = getFriendIds(publicData, viewerId);
  const visibleChatIds = new Set(
    publicData.privateChats
      .filter((chat) => chat.participantIds.includes(viewerId))
      .map((chat) => chat.id)
  );
  const visibleStories = publicData.stories.filter((story) => {
    if (story.authorType === "user") {
      return story.authorId === viewerId || friendIds.has(story.authorId);
    }

    return canSeeEventMedia(publicData, story.authorId, viewerId);
  });
  const visibleStoryIds = new Set(visibleStories.map((story) => story.id));
  const visiblePosts = publicData.socialPosts.filter((post) => {
    if (post.authorType === "user") {
      return post.authorId === viewerId || friendIds.has(post.authorId);
    }

    return canSeeEventMedia(publicData, post.authorId, viewerId);
  });
  const eventMap = getEventMap(publicData.events);
  const storyMap = getStoryMap(publicData.stories);

  return {
    ...publicData,
    users: publicData.users,
    events: visibleEvents,
    memberships: publicData.memberships.filter((membership) => {
      if (membership.userId === viewerId) {
        return true;
      }

      const event = eventMap.get(membership.eventId);
      if (!event || !visibleEventIds.has(event.id)) {
        return false;
      }

      if (event.hostId === viewerId) {
        return true;
      }

      return canSeeEventChat(publicData, event.id, viewerId) && membership.status === "approved";
    }),
    groupMessages: publicData.groupMessages.filter((message) =>
      canSeeEventChat(publicData, message.eventId, viewerId)
    ),
    privateChatRequests: publicData.privateChatRequests.filter(
      (request) => request.fromUserId === viewerId || request.toUserId === viewerId
    ),
    privateChats: publicData.privateChats.filter((chat) => visibleChatIds.has(chat.id)),
    privateMessages: publicData.privateMessages.filter((message) => visibleChatIds.has(message.chatId)),
    friendships: publicData.friendships.filter((friendship) => friendship.userIds.includes(viewerId)),
    eventInvites: publicData.eventInvites.filter(
      (invite) => invite.fromUserId === viewerId || invite.toUserId === viewerId
    ),
    socialPosts: visiblePosts,
    stories: visibleStories,
    storyViews: publicData.storyViews.filter((view) => {
      if (view.userId === viewerId) {
        return true;
      }

      const story = storyMap.get(view.storyId);
      if (!story) {
        return false;
      }

      if (story.authorType === "user") {
        return story.authorId === viewerId && visibleStoryIds.has(story.id);
      }

      const event = eventMap.get(story.authorId);
      return Boolean(
        event && event.hostId === viewerId && visibleStoryIds.has(story.id)
      );
    }),
    conversationReadStates: publicData.conversationReadStates.filter(
      (entry) => entry.userId === viewerId
    ),
    notifications: publicData.notifications.filter((notification) => notification.userId === viewerId)
  };
}
