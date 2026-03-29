import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import {
  issues,
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
  buildIssueAttachmentCreatedNotification,
  buildIssueCommentNotification,
  buildIssueJournalUpdatedNotification,
  buildIssueStatusChangedNotification,
  buildProjectAttachmentCreatedNotification,
  buildProjectJournalUpdatedNotification,
  buildTaskAttachmentCreatedNotification,
  buildTaskCommentNotification,
  buildTaskJournalUpdatedNotification,
  buildTaskStatusChangedNotification,
  type NotificationEventSnapshot,
} from "./notifications-message-builders.js";
import { listProjectNotificationRecipientUserIds } from "./notifications-recipients.js";
import {
  collectProjectChartTaskNotificationSnapshots,
  diffProjectChartTaskStatusChanges,
} from "./project-chart-task-notification-snapshots.js";

const NOTIFICATION_NOT_FOUND_MESSAGE = "Notification not found";

interface ListNotificationsQuery {
  eventTypes: NotificationEventCategory[];
  includeNoticed: boolean;
  limit: number;
  offset: number;
  sort: NotificationListSort;
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
    targetUrl: row.targetUrl,
  };
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

@Injectable()
export class NotificationsService {
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

  async notifyTaskCommentCreated(args: {
    actorUserId: number;
    commentId: number;
    projectId: number;
    taskId: string;
  }): Promise<void> {
    const projectName = this.getProjectNameOrThrow(args.projectId);
    const actorUsername = this.getUsernameOrThrow(args.actorUserId);
    const taskTitle = this.getTaskTitle(args.projectId, args.taskId);
    await this.createNotificationEvent(
      args.actorUserId,
      buildTaskCommentNotification({
        actorUsername,
        commentId: args.commentId,
        projectId: args.projectId,
        projectName,
        taskId: args.taskId,
        taskTitle,
      }),
    );
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

  async notifyTaskJournalUpdated(args: {
    actorUserId: number;
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
        projectId: args.projectId,
        projectName: this.getProjectNameOrThrow(args.projectId),
        taskId: args.taskId,
        taskTitle: this.getTaskTitle(args.projectId, args.taskId),
      }),
    );
  }

  async notifyProjectAttachmentCreated(args: {
    actorUserId: number;
    attachmentId: string;
    projectId: number;
  }): Promise<void> {
    await this.createNotificationEvent(
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
    await this.createNotificationEvent(
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
    projectId: number;
    taskId: string;
  }): Promise<void> {
    await this.createNotificationEvent(
      args.actorUserId,
      buildTaskAttachmentCreatedNotification({
        actorUsername: this.getUsernameOrThrow(args.actorUserId),
        attachmentId: args.attachmentId,
        projectId: args.projectId,
        projectName: this.getProjectNameOrThrow(args.projectId),
        taskId: args.taskId,
        taskTitle: this.getTaskTitle(args.projectId, args.taskId),
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

  private async createNotificationEvent(
    actorUserId: number,
    event: NotificationEventSnapshot,
  ): Promise<void> {
    const [created] = this.databaseService.db.insert(notifications)
      .values({
        actorUserId,
        attachmentId: event.attachmentId ?? null,
        commentId: event.commentId ?? null,
        eventType: event.eventType,
        issueId: event.issueId ?? null,
        message: event.message,
        projectId: event.projectId,
        targetUrl: event.targetUrl,
        taskId: event.taskId ?? null,
      })
      .returning({ id: notifications.id })
      .all();

    if (!created) {
      return;
    }

    const recipientUserIds = listProjectNotificationRecipientUserIds(
      this.databaseService.db,
      event.projectId,
      actorUserId,
    );
    if (recipientUserIds.length === 0) {
      return;
    }

    this.databaseService.db.insert(usersNotifications)
      .values(
        recipientUserIds.map((userId) => ({
          notificationId: created.id,
          userId,
        })),
      )
      .run();
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

  private getTaskTitle(projectId: number, taskId: string): string | null {
    const xml = this.projectChartsService.readProjectChart(projectId);
    if (!xml) {
      return null;
    }

    return collectProjectChartTaskNotificationSnapshots(xml).get(taskId)?.title ?? null;
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
