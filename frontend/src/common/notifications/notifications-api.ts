import {
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  listUnnoticedNotificationsResponseSchema,
  notificationSummaryResponseSchema,
  toggleNotificationNoticedResponseSchema,
  type ListNotificationsResponse,
  type ListUnnoticedNotificationsResponse,
  type NotificationSummaryResponse,
  type NotificationEventCategory,
  type NotificationListSort,
  type ToggleNotificationNoticedResponse,
} from "../../../../common/notifications/notification.contracts.js";
import { requestJson } from "../api/http-client.js";

interface ListNotificationsOptions {
  eventTypes: NotificationEventCategory[];
  includeNoticed: boolean;
  limit: number;
  offset: number;
  sort: NotificationListSort;
}

function createListNotificationsPath(query: ListNotificationsOptions): string {
  const parameters = new URLSearchParams();
  parameters.set("includeNoticed", String(query.includeNoticed));
  parameters.set("limit", String(query.limit));
  parameters.set("offset", String(query.offset));
  parameters.set("sort", query.sort);

  if (query.eventTypes.length > 0) {
    parameters.set("eventTypes", query.eventTypes.join(","));
  }

  return `/notifications?${parameters.toString()}`;
}

export const notificationsApi = {
  async getNotificationSummary(token: string): Promise<NotificationSummaryResponse> {
    return await requestJson<NotificationSummaryResponse, undefined>({
      method: "GET",
      path: "/notifications/summary",
      responseSchema: notificationSummaryResponseSchema,
      token,
    });
  },

  async listNotifications(
    token: string,
    query: ListNotificationsOptions,
  ): Promise<ListNotificationsResponse> {
    const parsedQuery = listNotificationsQuerySchema.parse(query);
    return await requestJson<ListNotificationsResponse, undefined>({
      method: "GET",
      path: createListNotificationsPath(parsedQuery),
      responseSchema: listNotificationsResponseSchema,
      token,
    });
  },

  async listUnnoticedNotifications(
    token: string,
    limit: number,
  ): Promise<ListUnnoticedNotificationsResponse> {
    return await requestJson<ListUnnoticedNotificationsResponse, undefined>({
      method: "GET",
      path: `/notifications/unnoticed?limit=${encodeURIComponent(String(limit))}`,
      responseSchema: listUnnoticedNotificationsResponseSchema,
      token,
    });
  },

  async toggleNotificationNoticed(
    token: string,
    notificationId: number,
  ): Promise<ToggleNotificationNoticedResponse> {
    return await requestJson<ToggleNotificationNoticedResponse, undefined>({
      method: "POST",
      path: `/notifications/${notificationId}/toggle-noticed`,
      responseSchema: toggleNotificationNoticedResponseSchema,
      token,
    });
  },
};
