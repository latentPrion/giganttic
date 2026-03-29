import { z } from "zod";

export const NOTIFICATION_EVENT_TYPES = [
  "NOTIFICATION_EVENT_ISSUE_COMMENT_CREATED",
  "NOTIFICATION_EVENT_ISSUE_STATUS_CHANGED",
  "NOTIFICATION_EVENT_ISSUE_ATTACHMENT_CREATED",
  "NOTIFICATION_EVENT_ISSUE_JOURNAL_UPDATED",
  "NOTIFICATION_EVENT_PROJECT_ATTACHMENT_CREATED",
  "NOTIFICATION_EVENT_PROJECT_JOURNAL_UPDATED",
  "NOTIFICATION_EVENT_TASK_COMMENT_CREATED",
  "NOTIFICATION_EVENT_TASK_STATUS_CHANGED",
  "NOTIFICATION_EVENT_TASK_ATTACHMENT_CREATED",
  "NOTIFICATION_EVENT_TASK_JOURNAL_UPDATED",
] as const;

export const NOTIFICATION_EVENT_CATEGORIES = [
  "attachments",
  "comments",
  "issue-status",
  "journal-updates",
  "task-status",
] as const;

export const NOTIFICATION_LIST_SORT_VALUES = ["asc", "desc"] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];
export type NotificationEventCategory = (typeof NOTIFICATION_EVENT_CATEGORIES)[number];
export type NotificationListSort = (typeof NOTIFICATION_LIST_SORT_VALUES)[number];

const notificationEventTypeSchema = z.enum(NOTIFICATION_EVENT_TYPES);
const notificationEventCategorySchema = z.enum(NOTIFICATION_EVENT_CATEGORIES);
const notificationListSortSchema = z.enum(NOTIFICATION_LIST_SORT_VALUES);

export function getNotificationEventCategory(
  eventType: NotificationEventType,
): NotificationEventCategory {
  switch (eventType) {
    case "NOTIFICATION_EVENT_ISSUE_COMMENT_CREATED":
    case "NOTIFICATION_EVENT_TASK_COMMENT_CREATED":
      return "comments";
    case "NOTIFICATION_EVENT_ISSUE_STATUS_CHANGED":
      return "issue-status";
    case "NOTIFICATION_EVENT_TASK_STATUS_CHANGED":
      return "task-status";
    case "NOTIFICATION_EVENT_PROJECT_JOURNAL_UPDATED":
    case "NOTIFICATION_EVENT_ISSUE_JOURNAL_UPDATED":
    case "NOTIFICATION_EVENT_TASK_JOURNAL_UPDATED":
      return "journal-updates";
    case "NOTIFICATION_EVENT_PROJECT_ATTACHMENT_CREATED":
    case "NOTIFICATION_EVENT_ISSUE_ATTACHMENT_CREATED":
    case "NOTIFICATION_EVENT_TASK_ATTACHMENT_CREATED":
      return "attachments";
  }
}

export function listNotificationEventTypesForCategory(
  eventCategory: NotificationEventCategory,
): NotificationEventType[] {
  return NOTIFICATION_EVENT_TYPES.filter((eventType) =>
    getNotificationEventCategory(eventType) === eventCategory
  );
}

export function listNotificationEventTypesForCategories(
  eventCategories: ReadonlyArray<NotificationEventCategory>,
): NotificationEventType[] {
  const distinctCategories = [...new Set(eventCategories)];
  return distinctCategories.flatMap((eventCategory) =>
    listNotificationEventTypesForCategory(eventCategory)
  );
}

export const notificationSummaryRowSchema = z.object({
  createdAt: z.string().datetime(),
  eventCategory: notificationEventCategorySchema,
  eventType: notificationEventTypeSchema,
  hasBeenNoticed: z.boolean(),
  id: z.number().int().positive(),
  message: z.string().min(1),
  noticedTimestamp: z.string().datetime().nullable(),
  targetUrl: z.string().min(1),
});

export const notificationSummaryResponseSchema = z.object({
  unnoticedCount: z.number().int().nonnegative(),
});

export const listUnnoticedNotificationsResponseSchema = z.object({
  notifications: z.array(notificationSummaryRowSchema),
});

export const listNotificationsQuerySchema = z.object({
  eventTypes: z.array(notificationEventCategorySchema).default([]),
  includeNoticed: z.boolean().default(false),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  sort: notificationListSortSchema.default("desc"),
});

export const listNotificationsResponseSchema = z.object({
  limit: z.number().int().positive(),
  notifications: z.array(notificationSummaryRowSchema),
  offset: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});

export const toggleNotificationNoticedResponseSchema = z.object({
  hasBeenNoticed: z.boolean(),
  id: z.number().int().positive(),
  noticedTimestamp: z.string().datetime().nullable(),
});

export type NotificationSummaryRow = z.infer<typeof notificationSummaryRowSchema>;
export type NotificationSummaryResponse = z.infer<typeof notificationSummaryResponseSchema>;
export type ListUnnoticedNotificationsResponse =
  z.infer<typeof listUnnoticedNotificationsResponseSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;
export type ToggleNotificationNoticedResponse =
  z.infer<typeof toggleNotificationNoticedResponseSchema>;
