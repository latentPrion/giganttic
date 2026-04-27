import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import { projectGanttCharts, taskComments, taskMirror } from "../../../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import { DiscussionAttachmentService } from "../discussion/discussion-attachment.service.js";
import { DiscussionCommentBodyStorageService } from "../discussion/discussion-comment-body-storage.service.js";
import { DiscussionJournalStorageService } from "../discussion/discussion-journal-storage.service.js";
import { ProjectChartsService } from "../project-charts/project-charts.service.js";
import { collectProjectChartTaskIdsBestEffort } from "../project-charts/project-chart-task-id-validation.js";

const TASK_NOT_FOUND_MESSAGE = "Task not found";

@Injectable()
export class TaskMirrorService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(ProjectChartsService)
    private readonly projectChartsService: ProjectChartsService,
    @Inject(DiscussionCommentBodyStorageService)
    private readonly commentBodyStorage: DiscussionCommentBodyStorageService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
    @Inject(DiscussionJournalStorageService)
    private readonly journalStorage: DiscussionJournalStorageService,
  ) {}

  ensureTaskMirrorExists(projectGanttChartId: number, taskId: string): void {
    this.databaseService.db.insert(taskMirror)
      .values({ projectGanttChartId, taskId })
      .onConflictDoNothing()
      .run();
  }

  assertTaskExistsInCurrentChart(
    projectId: number,
    chartId: number,
    taskId: string,
  ): void {
    const taskIds = this.listTaskIdsFromCurrentChart(projectId, chartId);
    if (!taskIds.includes(taskId)) {
      throw new NotFoundException(TASK_NOT_FOUND_MESSAGE);
    }
  }

  taskMirrorExists(projectGanttChartId: number, taskId: string): boolean {
    const row = this.databaseService.db
      .select({ projectGanttChartId: taskMirror.projectGanttChartId })
      .from(taskMirror)
      .where(
        and(
          eq(taskMirror.projectGanttChartId, projectGanttChartId),
          eq(taskMirror.taskId, taskId),
        ),
      )
      .get();

    return Boolean(row);
  }

  deleteTaskMirror(projectGanttChartId: number, taskId: string): void {
    this.databaseService.db.delete(taskMirror)
      .where(
        and(
          eq(taskMirror.projectGanttChartId, projectGanttChartId),
          eq(taskMirror.taskId, taskId),
        ),
      )
      .run();
  }

  listTaskIdsFromCurrentChart(projectId: number, chartId: number): string[] {
    const chartXml = this.projectChartsService.readProjectChart(projectId, chartId);
    if (chartXml === null) {
      return [];
    }

    return collectProjectChartTaskIdsBestEffort(chartXml);
  }

  async deleteRemovedTaskMirrorData(
    projectGanttChartId: number,
    removedTaskIds: readonly string[],
  ): Promise<void> {
    if (removedTaskIds.length === 0) {
      return;
    }

    const commentRows = this.databaseService.db
      .select({
        id: taskComments.id,
        taskId: taskComments.taskId,
      })
      .from(taskComments)
      .where(
        and(
          eq(taskComments.projectGanttChartId, projectGanttChartId),
          inArray(taskComments.taskId, [...removedTaskIds]),
        ),
      )
      .all();

    for (const row of commentRows) {
      await this.commentBodyStorage.deleteTaskCommentBody(
        this.resolveProjectIdForChart(projectGanttChartId),
        row.taskId,
        row.id,
      );
    }

    const chart = this.resolveChartIdentityById(projectGanttChartId);
    for (const taskId of removedTaskIds) {
      await this.journalStorage.deleteTaskJournal(
        chart.projectId,
        chart.chartId,
        taskId,
      );
    }

    this.databaseService.db.delete(taskMirror)
      .where(
        and(
          eq(taskMirror.projectGanttChartId, projectGanttChartId),
          inArray(taskMirror.taskId, [...removedTaskIds]),
        ),
      )
      .run();

    await this.attachmentService.removeOrphanAttachmentsAndFiles();
  }

  private resolveProjectIdForChart(projectGanttChartId: number): number {
    return this.resolveChartIdentityById(projectGanttChartId).projectId;
  }

  private resolveChartIdentityById(projectGanttChartId: number): {
    chartId: number;
    projectId: number;
  } {
    const row = this.databaseService.db.select({
      chartId: projectGanttCharts.chartId,
      projectId: projectGanttCharts.projectId,
    })
      .from(projectGanttCharts)
      .where(eq(projectGanttCharts.id, projectGanttChartId))
      .get();
    if (!row) {
      throw new NotFoundException("Project chart not found");
    }
    return row;
  }
}
