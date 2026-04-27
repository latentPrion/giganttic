import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import {
  issues,
  mentionContainerTypeCodes,
  mentions,
  notifications,
  projects,
  users,
  usersNotifications,
} from "../../../db/index.js";
import {
  getNotificationEventCategory,
  listNotificationEventTypesForCategories,
  type NotificationEventCategory,
  type NotificationEventType,
  type NotificationListSort,
} from "../../../common/notifications/notification.contracts.js";
import { DatabaseService } from "../database/database.service.js";
import { ProjectChartsService } from "../project-charts/project-charts.service.js";
import type { AuthContext } from "../auth/auth.types.js";
import {
  buildIssueCommentMentionedNotification,
  buildIssueAttachmentCreatedNotification,
  buildIssueCommentNotification,
  buildIssueCreatedNotification,
  buildIssueJournalUpdatedNotification,
  buildIssueJournalMentionedNotification,
  buildIssueStatusChangedNotification,
  buildProjectAttachmentCreatedNotification,
  buildProjectJournalUpdatedNotification,
  buildProjectJournalMentionedNotification,
  buildTaskCommentMentionedNotification,
  buildTaskAttachmentCreatedNotification,
  buildTaskCommentNotification,
  buildTaskJournalUpdatedNotification,
  buildTaskJournalMentionedNotification,
  buildTaskStatusChangedNotification,
  type NotificationEventSnapshot,
} from "./notifications-message-builders.js";
import {
  createMentionContainerKey,
  type MentionContainerDescriptor,
} from "./notification-mention-containers.js";
import { extractMentionUsernames } from "./notification-mentions.js";
import { listProjectNotificationRecipientUserIds } from "./notifications-recipients.js";
import {
  collectProjectChartTaskNotificationSnapshots,
  diffProjectChartTaskStatusChanges,
} from "./project-chart-task-notification-snapshots.js";

const NOTIFICATION_NOT_FOUND_MESSAGE = "Notification not found";
const LEGACY_PM_TARGET_URL_PREFIX = "/pm/pm";
const PM_TARGET_URL_PREFIX = "/pm";

interface ListNotificationsQuery {
  eventTypes: NotificationEventCategory[];
  includeNoticed: boolean;
  limit: number;
  offset: number;
  sort: NotificationListSort;
}

interface ResolvedMentionUser {
  id: number;
  username: string;
}

interface NotificationSummaryRow {
  createdAt: string;
  eventCategory: NotificationEventCategory;
  eventType: NotificationEventType;
  hasBeenNoticed: boolean;
  id: number;
  message: string;
  noticedTimestamp: string | null;
  targetUrl: string;
}

type JoinedNotificationRow = {
  createdAt: Date;
  eventType: NotificationEventType;
  hasBeenNoticed: boolean;
  id: number;
  message: string;
  noticedTimestamp: Date | null;
  targetUrl: string;
};

function toNotificationSummaryRow(row: JoinedNotificationRow): NotificationSummaryRow {
  return {
    createdAt: row.createdAt.toISOString(),
    eventCategory: getNotificationEventCategory(row.eventType),
    eventType: row.eventType,
    hasBeenNoticed: row.hasBeenNoticed,
    id: row.id,
    message: row.message,
    noticedTimestamp: row.noticedTimestamp?.toISOString() ?? null,
    targetUrl: normalizeNotificationTargetUrl(row.targetUrl),
  };
}

function normalizeNotificationTargetUrl(targetUrl: string): string {
  return targetUrl.startsWith(`${LEGACY_PM_TARGET_URL_PREFIX}/`)
    ? `${PM_TARGET_URL_PREFIX}${targetUrl.slice(LEGACY_PM_TARGET_URL_PREFIX.length)}`
    : targetUrl;
}

function createListWhereClause(
  userId: number,
  includeNoticed: boolean,
  eventTypes: NotificationEventCategory[],
) {
  const conditions = [eq(usersNotifications.userId, userId)];
  if (!includeNoticed) {
    conditions.push(sql`${usersNotifications.hasBeenNoticed} = 0`);
  }

  const resolvedEventTypes = listNotificationEventTypesForCategories(eventTypes);
  if (resolvedEventTypes.length > 0) {
    conditions.push(inArray(notifications.eventType, resolvedEventTypes));
  }

  return and(...conditions);
}

function createNotificationOrder(sort: NotificationListSort) {
  return sort === "asc" ? asc(notifications.createdAt) : desc(notifications.createdAt);
}

function createMentionContainerWhereClause(
  container: MentionContainerDescriptor,
) {
  return and(
    eq(mentions.mentionContainerType, container.mentionContainerType),
    eq(mentions.containerKey, createMentionContainerKey(container)),
  );
}

@Injectable()
export class NotificationsService {
  private hasNormalizedLegacyNotificationTargets = false;

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(ProjectChartsService)
    private readonly projectChartsService: ProjectChartsService,
  ) {}

  async getNotificationSummary(authContext: AuthContext) {
    const row = this.databaseService.db
      .select({ value: count() })
      .from(usersNotifications)
      .where(and(
        eq(usersNotifications.userId, authContext.userId),
        sql`${usersNotifications.hasBeenNoticed} = 0`,
      ))
      .get();

    return {
      unnoticedCount: Number(row?.value ?? 0),
    };
  }

  async listUnnoticedNotifications(authContext: AuthContext, limit: number) {
    this.normalizeLegacyNotificationTargetsIfNeeded();
    return {
      notifications: this.selectNotificationRows(authContext.userId, {
        eventTypes: [],
        includeNoticed: false,
        limit,
        offset: 0,
        sort: "desc",
      }),
    };
  }

  async listNotifications(authContext: AuthContext, query: ListNotificationsQuery) {
    this.normalizeLegacyNotificationTargetsIfNeeded();
    const whereClause = createListWhereClause(
      authContext.userId,
      query.includeNoticed,
      query.eventTypes,
    );
    const totalCountRow = this.databaseService.db
      .select({ value: count() })
      .from(usersNotifications)
      .innerJoin(notifications, eq(notifications.id, usersNotifications.notificationId))
      .where(whereClause)
      .get();

    return {
      limit: query.limit,
      notifications: this.selectNotificationRows(authContext.userId, query),
      offset: query.offset,
      totalCount: Number(totalCountRow?.value ?? 0),
    };
  }

  async toggleNotificationNoticed(authContext: AuthContext, notificationId: number) {
    const current = this.databaseService.db
      .select({
        hasBeenNoticed: usersNotifications.hasBeenNoticed,
        notificationId: usersNotifications.notificationId,
      })
      .from(usersNotifications)
      .where(and(
        eq(usersNotifications.notificationId, notificationId),
        eq(usersNotifications.userId, authContext.userId),
      ))
      .get();

    if (!current) {
      throw new NotFoundException(NOTIFICATION_NOT_FOUND_MESSAGE);
    }

    const nextHasBeenNoticed = !current.hasBeenNoticed;
    const nextNoticedTimestamp = nextHasBeenNoticed ? new Date() : null;

    this.databaseService.db.update(usersNotifications)
      .set({
        hasBeenNoticed: nextHasBeenNoticed,
        noticedTimestamp: nextNoticedTimestamp,
      })
      .where(and(
        eq(usersNotifications.notificationId, notificationId),
        eq(usersNotifications.userId, authContext.userId),
      ))
      .run();

    return {
      hasBeenNoticed: nextHasBeenNoticed,
      id: notificationId,
      noticedTimestamp: nextNoticedTimestamp?.toISOString() ?? null,
    };
  }

  async notifyIssueCommentCreated(args: {
    actorUserId: number;
    commentId: number;
    issueId: number;
    projectId: number;
  }): Promise<void> {
    const names = this.getIssueContextNames(args.projectId, args.issueId);
    const actorUsername = this.getUsernameOrThrow(args.actorUserId);
    await this.createNotificationEvent(
      args.actorUserId,
      buildIssueCommentNotification({
        actorUsername,
        commentId: args.commentId,
        issueId: args.issueId,
        issueName: names.issueName,
        projectId: args.projectId,
        projectName: names.projectName,
      }),
    );
  }

  async notifyIssueCreated(args: {
    actorUserId: number;
    issueId: number;
    projectId: number;
  }): Promise<void> {
    const names = this.getIssueContextNames(args.projectId, args.issueId);
    await this.createFanoutNotificationEvent(
      args.actorUserId,
      buildIssueCreatedNotification({
        actorUsername: this.getUsernameOrThrow(args.actorUserId),
        issueId: args.issueId,
        issueName: names.issueName,
        projectId: args.projectId,
        projectName: names.projectName,
      }),
    );
  }

  async notifyIssueCommentMentions(args: {
    actorUserId: number;
    body: string;
    commentId: number;
    issueId: number;
    projectId: number;
  }): Promise<void> {
    const names = this.getIssueContextNames(args.projectId, args.issueId);
    const mentionedUsers = this.collectFirstTimeMentionUsers(
      args.actorUserId,
      args.body,
      {
        chartId: null,
        commentId: args.commentId,
        issueId: args.issueId,
        mentionContainerType: mentionContainerTypeCodes.issueComment,
        projectId: args.projectId,
        taskId: null,
      },
    );

    for (const mentionedUser of mentionedUsers) {
      await this.createDirectNotificationEvent(
        args.actorUserId,
        buildIssueCommentMentionedNotification({
          actorUsername: this.getUsernameOrThrow(args.actorUserId),
          commentId: args.commentId,
          issueId: args.issueId,
          issueName: names.issueName,
          mentionedUserId: mentionedUser.id,
          projectId: args.projectId,
          projectName: names.projectName,
        }),
        mentionedUser.id,
      );
    }
  }

  async notifyTaskCommentCreated(args: {
    actorUserId: number;
    chartId: number;
    commentId: number;
    projectId: number;
    taskId: string;
  }): Promise<void> {
    const projectName = this.getProjectNameOrThrow(args.projectId);
    const actorUsername = this.getUsernameOrThrow(args.actorUserId);
    const taskTitle = this.getTaskTitle(args.projectId, args.taskId, args.chartId);
    await this.createNotificationEvent(
      args.actorUserId,
      buildTaskCommentNotification({
        actorUsername,
        chartId: args.chartId,
        commentId: args.commentId,
        projectId: args.projectId,
        projectName,
        taskId: args.taskId,
        taskTitle,
      }),
    );
  }

  async notifyTaskCommentMentions(args: {
    actorUserId: number;
    body: string;
    chartId: number;
    commentId: number;
    projectId: number;
    taskId: string;
  }): Promise<void> {
    const projectName = this.getProjectNameOrThrow(args.projectId);
    const taskTitle = this.getTaskTitle(args.projectId, args.taskId, args.chartId);
    const mentionedUsers = this.collectFirstTimeMentionUsers(
      args.actorUserId,
      args.body,
      {
        chartId: args.chartId,
        commentId: args.commentId,
        issueId: null,
        mentionContainerType: mentionContainerTypeCodes.taskComment,
        projectId: args.projectId,
        taskId: args.taskId,
      },
    );

    for (const mentionedUser of mentionedUsers) {
      await this.createDirectNotificationEvent(
        args.actorUserId,
        buildTaskCommentMentionedNotification({
          actorUsername: this.getUsernameOrThrow(args.actorUserId),
          chartId: args.chartId,
          commentId: args.commentId,
          mentionedUserId: mentionedUser.id,
          projectId: args.projectId,
          projectName,
          taskId: args.taskId,
          taskTitle,
        }),
        mentionedUser.id,
      );
    }
  }

  async notifyIssueStatusChanged(args: {
    actorUserId: number;
    issueId: number;
    nextStatus: string;
    previousStatus: string;
    projectId: number;
  }): Promise<void> {
    if (args.previousStatus === args.nextStatus) {
      return;
    }

    const names = this.getIssueContextNames(args.projectId, args.issueId);
    const actorUsername = this.getUsernameOrThrow(args.actorUserId);
    await this.createNotificationEvent(
      args.actorUserId,
      buildIssueStatusChangedNotification({
        actorUsername,
        issueId: args.issueId,
        issueName: names.issueName,
        nextStatus: args.nextStatus,
        previousStatus: args.previousStatus,
        projectId: args.projectId,
        projectName: names.projectName,
      }),
    );
  }

  async notifyTaskStatusChanges(args: {
    actorUserId: number;
    chartId: number;
    nextXml: string;
    previousXml: string | null;
    projectId: number;
  }): Promise<void> {
    const changes = diffProjectChartTaskStatusChanges(args.previousXml, args.nextXml);
    if (changes.length === 0) {
      return;
    }

    const actorUsername = this.getUsernameOrThrow(args.actorUserId);
    const projectName = this.getProjectNameOrThrow(args.projectId);

    for (const change of changes) {
      await this.createNotificationEvent(
        args.actorUserId,
        buildTaskStatusChangedNotification({
          actorUsername,
          chartId: args.chartId,
          nextStatus: change.next.status,
          previousStatus: change.previous.status,
          projectId: args.projectId,
          projectName,
          taskId: change.next.taskId,
          taskTitle: change.next.title || null,
        }),
      );
    }
  }

  async notifyProjectJournalUpdated(args: {
    actorUserId: number;
    markdown: string;
    previousMarkdown: string | null;
    projectId: number;
  }): Promise<void> {
    if ((args.previousMarkdown ?? "") === args.markdown) {
      return;
    }

    await this.createNotificationEvent(
      args.actorUserId,
      buildProjectJournalUpdatedNotification({
        actorUsername: this.getUsernameOrThrow(args.actorUserId),
        projectId: args.projectId,
        projectName: this.getProjectNameOrThrow(args.projectId),
      }),
    );
  }

  async notifyProjectJournalMentions(args: {
    actorUserId: number;
    markdown: string;
    projectId: number;
  }): Promise<void> {
    const projectName = this.getProjectNameOrThrow(args.projectId);
    const mentionedUsers = this.collectFirstTimeMentionUsers(
      args.actorUserId,
      args.markdown,
      {
        chartId: null,
        commentId: null,
        issueId: null,
        mentionContainerType: mentionContainerTypeCodes.projectJournal,
        projectId: args.projectId,
        taskId: null,
      },
    );

    for (const mentionedUser of mentionedUsers) {
      await this.createDirectNotificationEvent(
        args.actorUserId,
        buildProjectJournalMentionedNotification({
          actorUsername: this.getUsernameOrThrow(args.actorUserId),
          mentionedUserId: mentionedUser.id,
          projectId: args.projectId,
          projectName,
        }),
        mentionedUser.id,
      );
    }
  }

  async notifyIssueJournalUpdated(args: {
    actorUserId: number;
    issueId: number;
    markdown: string;
    previousMarkdown: string | null;
    projectId: number;
  }): Promise<void> {
    if ((args.previousMarkdown ?? "") === args.markdown) {
      return;
    }

    const names = this.getIssueContextNames(args.projectId, args.issueId);
    await this.createNotificationEvent(
      args.actorUserId,
      buildIssueJournalUpdatedNotification({
        actorUsername: this.getUsernameOrThrow(args.actorUserId),
        issueId: args.issueId,
        issueName: names.issueName,
        projectId: args.projectId,
        projectName: names.projectName,
      }),
    );
  }

  async notifyIssueJournalMentions(args: {
    actorUserId: number;
    issueId: number;
    markdown: string;
    projectId: number;
  }): Promise<void> {
    const names = this.getIssueContextNames(args.projectId, args.issueId);
    const mentionedUsers = this.collectFirstTimeMentionUsers(
      args.actorUserId,
      args.markdown,
      {
        chartId: null,
        commentId: null,
        issueId: args.issueId,
        mentionContainerType: mentionContainerTypeCodes.issueJournal,
        projectId: args.projectId,
        taskId: null,
      },
    );

    for (const mentionedUser of mentionedUsers) {
      await this.createDirectNotificationEvent(
        args.actorUserId,
        buildIssueJournalMentionedNotification({
          actorUsername: this.getUsernameOrThrow(args.actorUserId),
          issueId: args.issueId,
          issueName: names.issueName,
          mentionedUserId: mentionedUser.id,
          projectId: args.projectId,
          projectName: names.projectName,
        }),
        mentionedUser.id,
      );
    }
  }

  async notifyTaskJournalUpdated(args: {
    actorUserId: number;
    chartId: number;
    markdown: string;
    previousMarkdown: string | null;
    projectId: number;
    taskId: string;
  }): Promise<void> {
    if ((args.previousMarkdown ?? "") === args.markdown) {
      return;
    }

    await this.createNotificationEvent(
      args.actorUserId,
      buildTaskJournalUpdatedNotification({
        actorUsername: this.getUsernameOrThrow(args.actorUserId),
        chartId: args.chartId,
        projectId: args.projectId,
        projectName: this.getProjectNameOrThrow(args.projectId),
        taskId: args.taskId,
        taskTitle: this.getTaskTitle(args.projectId, args.taskId, args.chartId),
      }),
    );
  }

  async notifyTaskJournalMentions(args: {
    actorUserId: number;
    chartId: number;
    markdown: string;
    projectId: number;
    taskId: string;
  }): Promise<void> {
    const projectName = this.getProjectNameOrThrow(args.projectId);
    const taskTitle = this.getTaskTitle(args.projectId, args.taskId, args.chartId);
    const mentionedUsers = this.collectFirstTimeMentionUsers(
      args.actorUserId,
      args.markdown,
      {
        chartId: args.chartId,
        commentId: null,
        issueId: null,
        mentionContainerType: mentionContainerTypeCodes.taskJournal,
        projectId: args.projectId,
        taskId: args.taskId,
      },
    );

    for (const mentionedUser of mentionedUsers) {
      await this.createDirectNotificationEvent(
        args.actorUserId,
        buildTaskJournalMentionedNotification({
          actorUsername: this.getUsernameOrThrow(args.actorUserId),
          chartId: args.chartId,
          mentionedUserId: mentionedUser.id,
          projectId: args.projectId,
          projectName,
          taskId: args.taskId,
          taskTitle,
        }),
        mentionedUser.id,
      );
    }
  }

  async notifyProjectAttachmentCreated(args: {
    actorUserId: number;
    attachmentId: string;
    projectId: number;
  }): Promise<void> {
    await this.createFanoutNotificationEvent(
      args.actorUserId,
      buildProjectAttachmentCreatedNotification({
        actorUsername: this.getUsernameOrThrow(args.actorUserId),
        attachmentId: args.attachmentId,
        projectId: args.projectId,
        projectName: this.getProjectNameOrThrow(args.projectId),
      }),
    );
  }

  async notifyIssueAttachmentCreated(args: {
    actorUserId: number;
    attachmentId: string;
    issueId: number;
    projectId: number;
  }): Promise<void> {
    const names = this.getIssueContextNames(args.projectId, args.issueId);
    await this.createFanoutNotificationEvent(
      args.actorUserId,
      buildIssueAttachmentCreatedNotification({
        actorUsername: this.getUsernameOrThrow(args.actorUserId),
        attachmentId: args.attachmentId,
        issueId: args.issueId,
        issueName: names.issueName,
        projectId: args.projectId,
        projectName: names.projectName,
      }),
    );
  }

  async notifyTaskAttachmentCreated(args: {
    actorUserId: number;
    attachmentId: string;
    chartId: number;
    projectId: number;
    taskId: string;
  }): Promise<void> {
    await this.createFanoutNotificationEvent(
      args.actorUserId,
      buildTaskAttachmentCreatedNotification({
        actorUsername: this.getUsernameOrThrow(args.actorUserId),
        attachmentId: args.attachmentId,
        chartId: args.chartId,
        projectId: args.projectId,
        projectName: this.getProjectNameOrThrow(args.projectId),
        taskId: args.taskId,
        taskTitle: this.getTaskTitle(args.projectId, args.taskId, args.chartId),
      }),
    );
  }

  private selectNotificationRows(
    userId: number,
    query: ListNotificationsQuery,
  ): NotificationSummaryRow[] {
    return this.databaseService.db
      .select({
        createdAt: notifications.createdAt,
        eventType: notifications.eventType,
        hasBeenNoticed: usersNotifications.hasBeenNoticed,
        id: notifications.id,
        message: notifications.message,
        noticedTimestamp: usersNotifications.noticedTimestamp,
        targetUrl: notifications.targetUrl,
      })
      .from(usersNotifications)
      .innerJoin(notifications, eq(notifications.id, usersNotifications.notificationId))
      .where(createListWhereClause(userId, query.includeNoticed, query.eventTypes))
      .orderBy(createNotificationOrder(query.sort))
      .limit(query.limit)
      .offset(query.offset)
      .all()
      .map((row) => toNotificationSummaryRow(row as JoinedNotificationRow));
  }

  private normalizeLegacyNotificationTargetsIfNeeded(): void {
    if (this.hasNormalizedLegacyNotificationTargets) {
      return;
    }

    const legacyRows = this.databaseService.db
      .select({
        id: notifications.id,
        targetUrl: notifications.targetUrl,
      })
      .from(notifications)
      .where(sql`${notifications.targetUrl} like '/pm/pm/%'`)
      .all();

    for (const row of legacyRows) {
      this.databaseService.db.update(notifications)
        .set({
          targetUrl: normalizeNotificationTargetUrl(row.targetUrl),
        })
        .where(eq(notifications.id, row.id))
        .run();
    }

    this.hasNormalizedLegacyNotificationTargets = true;
  }

  private async createNotificationEvent(
    actorUserId: number,
    event: NotificationEventSnapshot,
  ): Promise<void> {
    await this.createFanoutNotificationEvent(actorUserId, event);
  }

  private async createFanoutNotificationEvent(
    actorUserId: number,
    event: NotificationEventSnapshot,
  ): Promise<void> {
    const recipientUserIds = listProjectNotificationRecipientUserIds(
      this.databaseService.db,
      event.projectId,
      actorUserId,
    );
    await this.createNotificationRecordForRecipients(
      actorUserId,
      event,
      recipientUserIds,
    );
  }

  private async createDirectNotificationEvent(
    actorUserId: number,
    event: NotificationEventSnapshot,
    recipientUserId: number,
  ): Promise<void> {
    await this.createNotificationRecordForRecipients(
      actorUserId,
      event,
      [recipientUserId],
    );
  }

  private async createNotificationRecordForRecipients(
    actorUserId: number,
    event: NotificationEventSnapshot,
    recipientUserIds: readonly number[],
  ): Promise<void> {
    const [created] = this.databaseService.db.insert(notifications)
      .values({
        actorUserId,
        attachmentId: event.attachmentId ?? null,
        commentId: event.commentId ?? null,
        eventType: event.eventType,
        issueId: event.issueId ?? null,
        message: event.message,
        mentionedUserId: event.mentionedUserId ?? null,
        projectId: event.projectId,
        targetUrl: event.targetUrl,
        taskId: event.taskId ?? null,
      })
      .returning({ id: notifications.id })
      .all();

    if (!created) {
      return;
    }

    const distinctRecipientUserIds = [...new Set(
      recipientUserIds.filter((userId) => userId !== actorUserId),
    )];
    if (distinctRecipientUserIds.length === 0) {
      return;
    }

    this.databaseService.db.insert(usersNotifications)
      .values(
        distinctRecipientUserIds.map((userId) => ({
          notificationId: created.id,
          userId,
        })),
      )
      .run();
  }

  private collectFirstTimeMentionUsers(
    actorUserId: number,
    body: string,
    container: MentionContainerDescriptor,
  ): ResolvedMentionUser[] {
    const mentionedUsernames = extractMentionUsernames(body);
    if (mentionedUsernames.length === 0) {
      return [];
    }

    const allowedRecipientUserIds = new Set(
      listProjectNotificationRecipientUserIds(
        this.databaseService.db,
        container.projectId,
        actorUserId,
      ),
    );
    if (allowedRecipientUserIds.size === 0) {
      return [];
    }

    const resolvedUsers = this.resolveMentionUsersByUsername(mentionedUsernames);
    const eligibleUsers = resolvedUsers.filter((user) =>
      allowedRecipientUserIds.has(user.id)
    );
    if (eligibleUsers.length === 0) {
      return [];
    }

    const existingMentionedUserIds = new Set(
      this.databaseService.db
        .select({ mentionedUserId: mentions.mentionedUserId })
        .from(mentions)
        .where(and(
          createMentionContainerWhereClause(container),
          inArray(
            mentions.mentionedUserId,
            eligibleUsers.map((user) => user.id),
          ),
        ))
        .all()
        .map((row) => row.mentionedUserId),
    );
    const firstTimeMentionUsers = eligibleUsers.filter((user) =>
      !existingMentionedUserIds.has(user.id)
    );

    if (firstTimeMentionUsers.length === 0) {
      return [];
    }

    this.databaseService.db.insert(mentions)
      .values(
        firstTimeMentionUsers.map((user) => ({
          commentId: container.commentId,
          containerKey: createMentionContainerKey(container),
          issueId: container.issueId,
          mentionContainerType: container.mentionContainerType,
          mentionedUserId: user.id,
          projectId: container.projectId,
          speakerUserId: actorUserId,
          taskId: container.taskId,
        })),
      )
      .onConflictDoNothing()
      .run();

    return firstTimeMentionUsers;
  }

  private resolveMentionUsersByUsername(
    mentionedUsernames: readonly string[],
  ): ResolvedMentionUser[] {
    if (mentionedUsernames.length === 0) {
      return [];
    }

    const rows = this.databaseService.db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(and(
        inArray(users.username, [...new Set(mentionedUsernames)]),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ))
      .all();
    const userByUsername = new Map(
      rows.map((row) => [row.username, row] as const),
    );

    return mentionedUsernames.flatMap((username) => {
      const resolvedUser = userByUsername.get(username);
      return resolvedUser ? [resolvedUser] : [];
    });
  }

  private getProjectNameOrThrow(projectId: number): string {
    const project = this.databaseService.db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project.name;
  }

  private getIssueContextNames(projectId: number, issueId: number): {
    issueName: string;
    projectName: string;
  } {
    const row = this.databaseService.db
      .select({
        issueName: issues.name,
        projectName: projects.name,
      })
      .from(issues)
      .innerJoin(projects, eq(projects.id, issues.projectId))
      .where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
      .get();

    if (!row) {
      throw new NotFoundException("Issue not found");
    }

    return row;
  }

  private getTaskTitle(
    projectId: number,
    taskId: string,
    chartId: number | null = null,
  ): string | null {
    if (chartId !== null) {
      const xml = this.projectChartsService.readProjectChart(projectId, chartId);
      if (!xml) {
        return null;
      }
      return collectProjectChartTaskNotificationSnapshots(xml).get(taskId)?.title ?? null;
    }

    const charts = this.projectChartsService.listProjectCharts(projectId);
    for (const chart of charts) {
      const xml = this.projectChartsService.readProjectChart(projectId, chart.chartId);
      if (!xml) {
        continue;
      }
      const title = collectProjectChartTaskNotificationSnapshots(xml).get(taskId)?.title ?? null;
      if (title !== null) {
        return title;
      }
    }
    return null;
  }

  private getUsernameOrThrow(userId: number): string {
    const row = this.databaseService.db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!row) {
      throw new NotFoundException("User not found");
    }

    return row.username;
  }
}
