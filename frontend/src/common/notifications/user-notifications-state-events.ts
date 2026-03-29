import {
  emitBrowserCrossTabEvent,
  subscribeBrowserCrossTabEvent,
} from "../../spas/project-manager/lib/browser-cross-tab-events.js";

const USER_NOTIFICATIONS_STATE_EVENT = "user-notifications-state";

export function emitUserNotificationsStateEvent(): void {
  emitBrowserCrossTabEvent(USER_NOTIFICATIONS_STATE_EVENT, {});
}

export function subscribeUserNotificationsStateEvent(
  handler: () => void,
): () => void {
  return subscribeBrowserCrossTabEvent(USER_NOTIFICATIONS_STATE_EVENT, () => {
    handler();
  });
}

