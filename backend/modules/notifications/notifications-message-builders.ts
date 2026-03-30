import { issueStatusCodes } from "../../../db/index.js";
import {
  createIssueAttachmentsNotificationTarget,
  createIssueCommentNotificationTarget,
  createIssueDetailsNotificationTarget,
  createIssueJournalNotificationTarget,
  createProjectAttachmentsNotificationTarget,
  createProjectJournalNotificationTarget,
  createTaskAttachmentsNotificationTarget,
  createTaskCommentNotificationTarget,
  createTaskDetailsNotificationTarget,
  createTaskJournalNotificationTarget,
} from "../../../common/notifications/notification-targets.js";
import type { NotificationEventType } from "../../../common/notifications/notification.contracts.js";

export interface NotificationEventSnapshot {
  attachmentId?: string | null;
  commentId?: number | null;
  eventType: NotificationEventType;
  issueId?: number | null;
  message: string;
  mentionedUserId?: number | null;
  projectId: number;
  targetUrl: string;
  taskId?: string | null;
}

const ISSUE_STATUS_LABELS: Record<string, string> = {
  [issueStatusCodes.blocked]: "Blocked",
  [issueStatusCodes.closed]: "Closed",
  [issueStatusCodes.inProgress]: "In Progress",
  [issueStatusCodes.open]: "Open",
};

function getStatusLabel(status: string): string {
  return ISSUE_STATUS_LABELS[status] ?? status;
}

function getResolvedTaskLabel(taskTitle: string | null, taskId: string): string {
  const trimmedTitle = taskTitle?.trim() ?? "";
  return trimmedTitle.length > 0 ? trimmedTitle : taskId;
}

export function buildIssueCommentNotification(args: {
  actorUsername: string;
  commentId: number;
  issueId: number;
  issueName: string;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    commentId: args.commentId,
    eventType: "NOTIFICATION_EVENT_ISSUE_COMMENT_CREATED",
    issueId: args.issueId,
    message: `${args.actorUsername} commented on Issue "${args.issueName}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createIssueCommentNotificationTarget(
      args.projectId,
      args.issueId,
      args.commentId,
    ),
  };
}

export function buildIssueCreatedNotification(args: {
  actorUsername: string;
  issueId: number;
  issueName: string;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    eventType: "NOTIFICATION_EVENT_ISSUE_CREATED",
    issueId: args.issueId,
    message: `${args.actorUsername} created Issue "${args.issueName}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createIssueDetailsNotificationTarget(args.projectId, args.issueId),
  };
}

export function buildTaskCommentNotification(args: {
  actorUsername: string;
  commentId: number;
  projectId: number;
  projectName: string;
  taskId: string;
  taskTitle: string | null;
}): NotificationEventSnapshot {
  const taskLabel = getResolvedTaskLabel(args.taskTitle, args.taskId);
  return {
    commentId: args.commentId,
    eventType: "NOTIFICATION_EVENT_TASK_COMMENT_CREATED",
    message: `${args.actorUsername} commented on Task "${taskLabel}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createTaskCommentNotificationTarget(
      args.projectId,
      args.taskId,
      args.commentId,
    ),
    taskId: args.taskId,
  };
}

export function buildIssueCommentMentionedNotification(args: {
  actorUsername: string;
  commentId: number;
  issueId: number;
  issueName: string;
  mentionedUserId: number;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    commentId: args.commentId,
    eventType: "NOTIFICATION_EVENT_ISSUE_COMMENT_MENTIONED",
    issueId: args.issueId,
    mentionedUserId: args.mentionedUserId,
    message: `${args.actorUsername} mentioned you in a comment on Issue "${args.issueName}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createIssueCommentNotificationTarget(
      args.projectId,
      args.issueId,
      args.commentId,
    ),
  };
}

export function buildTaskCommentMentionedNotification(args: {
  actorUsername: string;
  commentId: number;
  mentionedUserId: number;
  projectId: number;
  projectName: string;
  taskId: string;
  taskTitle: string | null;
}): NotificationEventSnapshot {
  const taskLabel = getResolvedTaskLabel(args.taskTitle, args.taskId);
  return {
    commentId: args.commentId,
    eventType: "NOTIFICATION_EVENT_TASK_COMMENT_MENTIONED",
    mentionedUserId: args.mentionedUserId,
    message: `${args.actorUsername} mentioned you in a comment on Task "${taskLabel}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createTaskCommentNotificationTarget(
      args.projectId,
      args.taskId,
      args.commentId,
    ),
    taskId: args.taskId,
  };
}

export function buildIssueStatusChangedNotification(args: {
  actorUsername: string;
  issueId: number;
  issueName: string;
  nextStatus: string;
  previousStatus: string;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    eventType: "NOTIFICATION_EVENT_ISSUE_STATUS_CHANGED",
    issueId: args.issueId,
    message:
      `${args.actorUsername} changed Issue "${args.issueName}" under ${args.projectName} `
      + `from ${getStatusLabel(args.previousStatus)} to ${getStatusLabel(args.nextStatus)}.`,
    projectId: args.projectId,
    targetUrl: createIssueDetailsNotificationTarget(args.projectId, args.issueId),
  };
}

export function buildTaskStatusChangedNotification(args: {
  actorUsername: string;
  nextStatus: string;
  previousStatus: string;
  projectId: number;
  projectName: string;
  taskId: string;
  taskTitle: string | null;
}): NotificationEventSnapshot {
  const taskLabel = getResolvedTaskLabel(args.taskTitle, args.taskId);
  return {
    eventType: "NOTIFICATION_EVENT_TASK_STATUS_CHANGED",
    message:
      `${args.actorUsername} changed Task "${taskLabel}" under ${args.projectName} `
      + `from ${getStatusLabel(args.previousStatus)} to ${getStatusLabel(args.nextStatus)}.`,
    projectId: args.projectId,
    targetUrl: createTaskDetailsNotificationTarget(args.projectId, args.taskId),
    taskId: args.taskId,
  };
}

export function buildProjectJournalUpdatedNotification(args: {
  actorUsername: string;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    eventType: "NOTIFICATION_EVENT_PROJECT_JOURNAL_UPDATED",
    message: `${args.actorUsername} updated the journal for Project "${args.projectName}".`,
    projectId: args.projectId,
    targetUrl: createProjectJournalNotificationTarget(args.projectId),
  };
}

export function buildProjectJournalMentionedNotification(args: {
  actorUsername: string;
  mentionedUserId: number;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    eventType: "NOTIFICATION_EVENT_PROJECT_JOURNAL_MENTIONED",
    mentionedUserId: args.mentionedUserId,
    message: `${args.actorUsername} mentioned you in the journal for Project "${args.projectName}".`,
    projectId: args.projectId,
    targetUrl: createProjectJournalNotificationTarget(args.projectId),
  };
}

export function buildIssueJournalUpdatedNotification(args: {
  actorUsername: string;
  issueId: number;
  issueName: string;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    eventType: "NOTIFICATION_EVENT_ISSUE_JOURNAL_UPDATED",
    issueId: args.issueId,
    message: `${args.actorUsername} updated the journal for Issue "${args.issueName}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createIssueJournalNotificationTarget(args.projectId, args.issueId),
  };
}

export function buildIssueJournalMentionedNotification(args: {
  actorUsername: string;
  issueId: number;
  issueName: string;
  mentionedUserId: number;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    eventType: "NOTIFICATION_EVENT_ISSUE_JOURNAL_MENTIONED",
    issueId: args.issueId,
    mentionedUserId: args.mentionedUserId,
    message: `${args.actorUsername} mentioned you in the journal for Issue "${args.issueName}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createIssueJournalNotificationTarget(args.projectId, args.issueId),
  };
}

export function buildTaskJournalUpdatedNotification(args: {
  actorUsername: string;
  projectId: number;
  projectName: string;
  taskId: string;
  taskTitle: string | null;
}): NotificationEventSnapshot {
  const taskLabel = getResolvedTaskLabel(args.taskTitle, args.taskId);
  return {
    eventType: "NOTIFICATION_EVENT_TASK_JOURNAL_UPDATED",
    message: `${args.actorUsername} updated the journal for Task "${taskLabel}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createTaskJournalNotificationTarget(args.projectId, args.taskId),
    taskId: args.taskId,
  };
}

export function buildTaskJournalMentionedNotification(args: {
  actorUsername: string;
  mentionedUserId: number;
  projectId: number;
  projectName: string;
  taskId: string;
  taskTitle: string | null;
}): NotificationEventSnapshot {
  const taskLabel = getResolvedTaskLabel(args.taskTitle, args.taskId);
  return {
    eventType: "NOTIFICATION_EVENT_TASK_JOURNAL_MENTIONED",
    mentionedUserId: args.mentionedUserId,
    message: `${args.actorUsername} mentioned you in the journal for Task "${taskLabel}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createTaskJournalNotificationTarget(args.projectId, args.taskId),
    taskId: args.taskId,
  };
}

export function buildProjectAttachmentCreatedNotification(args: {
  actorUsername: string;
  attachmentId: string;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    attachmentId: args.attachmentId,
    eventType: "NOTIFICATION_EVENT_PROJECT_ATTACHMENT_CREATED",
    message: `${args.actorUsername} added an attachment to Project "${args.projectName}".`,
    projectId: args.projectId,
    targetUrl: createProjectAttachmentsNotificationTarget(args.projectId),
  };
}

export function buildIssueAttachmentCreatedNotification(args: {
  actorUsername: string;
  attachmentId: string;
  issueId: number;
  issueName: string;
  projectId: number;
  projectName: string;
}): NotificationEventSnapshot {
  return {
    attachmentId: args.attachmentId,
    eventType: "NOTIFICATION_EVENT_ISSUE_ATTACHMENT_CREATED",
    issueId: args.issueId,
    message: `${args.actorUsername} added an attachment to Issue "${args.issueName}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createIssueAttachmentsNotificationTarget(args.projectId, args.issueId),
  };
}

export function buildTaskAttachmentCreatedNotification(args: {
  actorUsername: string;
  attachmentId: string;
  projectId: number;
  projectName: string;
  taskId: string;
  taskTitle: string | null;
}): NotificationEventSnapshot {
  const taskLabel = getResolvedTaskLabel(args.taskTitle, args.taskId);
  return {
    attachmentId: args.attachmentId,
    eventType: "NOTIFICATION_EVENT_TASK_ATTACHMENT_CREATED",
    message: `${args.actorUsername} added an attachment to Task "${taskLabel}" under ${args.projectName}.`,
    projectId: args.projectId,
    targetUrl: createTaskAttachmentsNotificationTarget(args.projectId, args.taskId),
    taskId: args.taskId,
  };
}
