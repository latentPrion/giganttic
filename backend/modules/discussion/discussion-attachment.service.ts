import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, eq, notExists } from "drizzle-orm";

import {
  attachments,
  issueComments,
  issueCommentsAttachments,
  issues,
  issuesAttachments,
  projects,
  projectsAttachments,
  taskAttachments,
  taskComments,
  taskCommentsAttachments,
} from "../../../db/index.js";
import type { BackendConfig } from "../../config/backend-config.js";
import { BACKEND_CONFIG } from "../../config/backend-config.js";
import { hasProjectUploadFileTypeBypassRole } from "../access-control/access-control.utils.js";
import { DatabaseService } from "../database/database.service.js";
import {
  assertBufferMatchesExtensionMagic,
  normalizeFilenameExtension,
} from "../issues/attachment-content-validation.js";
import type { DiscussionAttachmentSummary } from "../../../common/discussion/discussion.contracts.js";

const EMPTY_ATTACHMENT_NOTIFICATION = "Uploaded file is empty";
const EXTENSION_NOT_PERMITTED_MESSAGE =
  "Attachment file extension is not permitted";
const MAGIC_BYTES_MISMATCH_MESSAGE =
  "File contents do not match the declared extension";
const MAX_ATTACHMENTS_REACHED_MESSAGE =
  "Maximum attachments for this issue or comment has been reached";

export type AttachmentRow = typeof attachments.$inferSelect;
export type AttachmentSummary = DiscussionAttachmentSummary;

type AttachmentLinkInput =
  | { kind: "project"; projectId: number }
  | { issueId: number; kind: "issue" }
  | { commentId: number; issueId: number; kind: "issue-comment" }
  | { kind: "task"; projectGanttChartId: number; taskId: string }
  | {
    commentId: number;
    kind: "task-comment";
    projectGanttChartId: number;
    taskId: string;
  };

type AttachmentValidationOptions = {
  bypassFileTypeValidation: boolean;
};

export function toAttachmentSummary(row: AttachmentRow): AttachmentSummary {
  return {
    byteLength: row.byteLength,
    id: row.id,
    originalFilename: row.originalFilename,
  };
}

function buildAllowedExtensionsSet(config: BackendConfig): Set<string> {
  return new Set(
    config.allowedAttachmentExtensions.map((item) => item.toLowerCase()),
  );
}

async function unlinkQuietly(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

@Injectable()
export class DiscussionAttachmentService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(BACKEND_CONFIG)
    private readonly config: BackendConfig,
  ) {}

  async ensureUntrustedDirectoriesExist(): Promise<void> {
    await mkdir(this.config.untrustedContentAttachmentsDir, {
      recursive: true,
    });
  }

  resolveBlobPath(attachmentId: string): string {
    const safeName = path.basename(attachmentId);
    return path.join(this.config.untrustedContentAttachmentsDir, safeName);
  }

  getAttachmentFileStream(attachmentId: string): Readable {
    return createReadStream(this.resolveBlobPath(attachmentId));
  }

  async readAttachmentFile(attachmentId: string): Promise<Buffer> {
    return readFile(this.resolveBlobPath(attachmentId));
  }

  countIssueLevelAttachments(issueId: number): number {
    return this.countByQuery(
      this.databaseService.db
        .select({ value: count() })
        .from(issuesAttachments)
        .where(eq(issuesAttachments.issueId, issueId))
        .get(),
    );
  }

  countProjectLevelAttachments(projectId: number): number {
    return this.countByQuery(
      this.databaseService.db
        .select({ value: count() })
        .from(projectsAttachments)
        .where(eq(projectsAttachments.projectId, projectId))
        .get(),
    );
  }

  countCommentAttachments(issueId: number, commentId: number): number {
    return this.countByQuery(
      this.databaseService.db
        .select({ value: count() })
        .from(issueCommentsAttachments)
        .where(
          and(
            eq(issueCommentsAttachments.issueId, issueId),
            eq(issueCommentsAttachments.commentId, commentId),
          ),
        )
        .get(),
    );
  }

  countTaskLevelAttachments(projectGanttChartId: number, taskId: string): number {
    return this.countByQuery(
      this.databaseService.db
        .select({ value: count() })
        .from(taskAttachments)
        .where(
          and(
            eq(taskAttachments.projectGanttChartId, projectGanttChartId),
            eq(taskAttachments.taskId, taskId),
          ),
        )
        .get(),
    );
  }

  countTaskCommentAttachments(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
  ): number {
    return this.countByQuery(
      this.databaseService.db
        .select({ value: count() })
        .from(taskCommentsAttachments)
        .where(
          and(
            eq(taskCommentsAttachments.projectGanttChartId, projectGanttChartId),
            eq(taskCommentsAttachments.taskId, taskId),
            eq(taskCommentsAttachments.commentId, commentId),
          ),
        )
        .get(),
    );
  }

  assertCanAddIssueAttachment(issueId: number): void {
    this.assertWithinAttachmentLimit(this.countIssueLevelAttachments(issueId));
  }

  assertCanAddProjectAttachment(projectId: number): void {
    this.assertWithinAttachmentLimit(this.countProjectLevelAttachments(projectId));
  }

  assertCanAddCommentAttachment(issueId: number, commentId: number): void {
    this.assertWithinAttachmentLimit(
      this.countCommentAttachments(issueId, commentId),
    );
  }

  assertCanAddTaskAttachment(projectGanttChartId: number, taskId: string): void {
    this.assertWithinAttachmentLimit(
      this.countTaskLevelAttachments(projectGanttChartId, taskId),
    );
  }

  assertCanAddTaskCommentAttachment(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
  ): void {
    this.assertWithinAttachmentLimit(
      this.countTaskCommentAttachments(projectGanttChartId, taskId, commentId),
    );
  }

  async createAttachmentAndLinkToIssue(input: {
    buffer: Buffer;
    issueId: number;
    originalFilename: string;
    projectId: number;
    uploadedByUserId: number;
  }): Promise<AttachmentSummary> {
    this.assertIssueExists(input.projectId, input.issueId);
    this.assertCanAddIssueAttachment(input.issueId);

    return this.persistAttachmentAndInsert({
      buffer: input.buffer,
      link: { issueId: input.issueId, kind: "issue" },
      originalFilename: input.originalFilename,
      validationOptions: this.buildAttachmentValidationOptions(
        input.projectId,
        input.uploadedByUserId,
      ),
      uploadedByUserId: input.uploadedByUserId,
    });
  }

  async createAttachmentAndLinkToProject(input: {
    buffer: Buffer;
    originalFilename: string;
    projectId: number;
    uploadedByUserId: number;
  }): Promise<AttachmentSummary> {
    this.assertProjectExists(input.projectId);
    this.assertCanAddProjectAttachment(input.projectId);

    return this.persistAttachmentAndInsert({
      buffer: input.buffer,
      link: { kind: "project", projectId: input.projectId },
      originalFilename: input.originalFilename,
      validationOptions: this.buildAttachmentValidationOptions(
        input.projectId,
        input.uploadedByUserId,
      ),
      uploadedByUserId: input.uploadedByUserId,
    });
  }

  async createAttachmentAndLinkToComment(input: {
    buffer: Buffer;
    commentId: number;
    issueId: number;
    originalFilename: string;
    projectId: number;
    uploadedByUserId: number;
  }): Promise<AttachmentSummary> {
    this.assertIssueCommentExists(input.projectId, input.issueId, input.commentId);
    this.assertCanAddCommentAttachment(input.issueId, input.commentId);

    return this.persistAttachmentAndInsert({
      buffer: input.buffer,
      link: {
        commentId: input.commentId,
        issueId: input.issueId,
        kind: "issue-comment",
      },
      originalFilename: input.originalFilename,
      validationOptions: this.buildAttachmentValidationOptions(
        input.projectId,
        input.uploadedByUserId,
      ),
      uploadedByUserId: input.uploadedByUserId,
    });
  }

  async createAttachmentAndLinkToTask(input: {
    buffer: Buffer;
    originalFilename: string;
    projectId: number;
    projectGanttChartId: number;
    taskId: string;
    uploadedByUserId: number;
  }): Promise<AttachmentSummary> {
    this.assertCanAddTaskAttachment(input.projectGanttChartId, input.taskId);

    return this.persistAttachmentAndInsert({
      buffer: input.buffer,
      link: {
        kind: "task",
        projectGanttChartId: input.projectGanttChartId,
        taskId: input.taskId,
      },
      originalFilename: input.originalFilename,
      validationOptions: this.buildAttachmentValidationOptions(
        input.projectId,
        input.uploadedByUserId,
      ),
      uploadedByUserId: input.uploadedByUserId,
    });
  }

  async createAttachmentAndLinkToTaskComment(input: {
    buffer: Buffer;
    commentId: number;
    originalFilename: string;
    projectId: number;
    projectGanttChartId: number;
    taskId: string;
    uploadedByUserId: number;
  }): Promise<AttachmentSummary> {
    this.assertTaskCommentExists(
      input.projectGanttChartId,
      input.taskId,
      input.commentId,
    );
    this.assertCanAddTaskCommentAttachment(
      input.projectGanttChartId,
      input.taskId,
      input.commentId,
    );

    return this.persistAttachmentAndInsert({
      buffer: input.buffer,
      link: {
        commentId: input.commentId,
        kind: "task-comment",
        projectGanttChartId: input.projectGanttChartId,
        taskId: input.taskId,
      },
      originalFilename: input.originalFilename,
      validationOptions: this.buildAttachmentValidationOptions(
        input.projectId,
        input.uploadedByUserId,
      ),
      uploadedByUserId: input.uploadedByUserId,
    });
  }

  listIssueLevelAttachmentRows(issueId: number): AttachmentRow[] {
    return this.databaseService.db
      .select({ attachment: attachments })
      .from(issuesAttachments)
      .innerJoin(
        attachments,
        eq(issuesAttachments.attachmentId, attachments.id),
      )
      .where(eq(issuesAttachments.issueId, issueId))
      .orderBy(attachments.id)
      .all()
      .map((row) => row.attachment);
  }

  listProjectLevelAttachmentRows(projectId: number): AttachmentRow[] {
    return this.databaseService.db
      .select({ attachment: attachments })
      .from(projectsAttachments)
      .innerJoin(
        attachments,
        eq(projectsAttachments.attachmentId, attachments.id),
      )
      .where(eq(projectsAttachments.projectId, projectId))
      .orderBy(attachments.id)
      .all()
      .map((row) => row.attachment);
  }

  listAttachmentsForComment(
    issueId: number,
    commentId: number,
  ): AttachmentRow[] {
    return this.databaseService.db
      .select({ attachment: attachments })
      .from(issueCommentsAttachments)
      .innerJoin(
        attachments,
        eq(issueCommentsAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(issueCommentsAttachments.issueId, issueId),
          eq(issueCommentsAttachments.commentId, commentId),
        ),
      )
      .orderBy(attachments.id)
      .all()
      .map((row) => row.attachment);
  }

  listTaskLevelAttachmentRows(
    projectGanttChartId: number,
    taskId: string,
  ): AttachmentRow[] {
    return this.databaseService.db
      .select({ attachment: attachments })
      .from(taskAttachments)
      .innerJoin(
        attachments,
        eq(taskAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(taskAttachments.projectGanttChartId, projectGanttChartId),
          eq(taskAttachments.taskId, taskId),
        ),
      )
      .orderBy(attachments.id)
      .all()
      .map((row) => row.attachment);
  }

  listAttachmentsForTaskComment(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
  ): AttachmentRow[] {
    return this.databaseService.db
      .select({ attachment: attachments })
      .from(taskCommentsAttachments)
      .innerJoin(
        attachments,
        eq(taskCommentsAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(taskCommentsAttachments.projectGanttChartId, projectGanttChartId),
          eq(taskCommentsAttachments.taskId, taskId),
          eq(taskCommentsAttachments.commentId, commentId),
        ),
      )
      .orderBy(attachments.id)
      .all()
      .map((row) => row.attachment);
  }

  async deleteIssueAttachmentLink(
    issueId: number,
    attachmentId: string,
  ): Promise<string> {
    const linked = this.requireIssueAttachmentLink(issueId, attachmentId);
    this.databaseService.db
      .delete(issuesAttachments)
      .where(
        and(
          eq(issuesAttachments.issueId, issueId),
          eq(issuesAttachments.attachmentId, attachmentId),
        ),
      )
      .run();

    await this.removeOrphanAttachmentsAndFiles();
    return linked.id;
  }

  async deleteProjectAttachmentLink(
    projectId: number,
    attachmentId: string,
  ): Promise<string> {
    const linked = this.requireProjectAttachmentLink(projectId, attachmentId);

    this.databaseService.db
      .delete(projectsAttachments)
      .where(
        and(
          eq(projectsAttachments.projectId, projectId),
          eq(projectsAttachments.attachmentId, attachmentId),
        ),
      )
      .run();

    await this.removeOrphanAttachmentsAndFiles();
    return linked.id;
  }

  async deleteCommentAttachmentLink(
    issueId: number,
    commentId: number,
    attachmentId: string,
  ): Promise<string> {
    const linked = this.requireIssueCommentAttachmentLink(
      issueId,
      commentId,
      attachmentId,
    );

    this.databaseService.db
      .delete(issueCommentsAttachments)
      .where(
        and(
          eq(issueCommentsAttachments.issueId, issueId),
          eq(issueCommentsAttachments.commentId, commentId),
          eq(issueCommentsAttachments.attachmentId, attachmentId),
        ),
      )
      .run();

    await this.removeOrphanAttachmentsAndFiles();
    return linked.id;
  }

  async deleteTaskAttachmentLink(
    projectGanttChartId: number,
    taskId: string,
    attachmentId: string,
  ): Promise<string> {
    const linked = this.requireTaskAttachmentLink(
      projectGanttChartId,
      taskId,
      attachmentId,
    );

    this.databaseService.db
      .delete(taskAttachments)
      .where(
        and(
          eq(taskAttachments.projectGanttChartId, projectGanttChartId),
          eq(taskAttachments.taskId, taskId),
          eq(taskAttachments.attachmentId, attachmentId),
        ),
      )
      .run();

    await this.removeOrphanAttachmentsAndFiles();
    return linked.id;
  }

  async deleteTaskCommentAttachmentLink(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
    attachmentId: string,
  ): Promise<string> {
    const linked = this.requireTaskCommentAttachmentLink(
      projectGanttChartId,
      taskId,
      commentId,
      attachmentId,
    );

    this.databaseService.db
      .delete(taskCommentsAttachments)
      .where(
        and(
          eq(taskCommentsAttachments.projectGanttChartId, projectGanttChartId),
          eq(taskCommentsAttachments.taskId, taskId),
          eq(taskCommentsAttachments.commentId, commentId),
          eq(taskCommentsAttachments.attachmentId, attachmentId),
        ),
      )
      .run();

    await this.removeOrphanAttachmentsAndFiles();
    return linked.id;
  }

  requireAttachmentLinkedToIssue(
    projectId: number,
    issueId: number,
    attachmentId: string,
  ): AttachmentRow {
    this.assertIssueExists(projectId, issueId);
    return this.requireIssueAttachmentRow(issueId, attachmentId);
  }

  requireAttachmentLinkedToProject(
    projectId: number,
    attachmentId: string,
  ): AttachmentRow {
    this.assertProjectExists(projectId);

    const linked = this.databaseService.db
      .select({ attachment: attachments })
      .from(projectsAttachments)
      .innerJoin(
        attachments,
        eq(projectsAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(projectsAttachments.projectId, projectId),
          eq(projectsAttachments.attachmentId, attachmentId),
        ),
      )
      .get();

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return linked.attachment;
  }

  requireAttachmentLinkedToTask(
    projectGanttChartId: number,
    taskId: string,
    attachmentId: string,
  ): AttachmentRow {
    return this.requireTaskAttachmentRow(projectGanttChartId, taskId, attachmentId);
  }

  requireAttachmentLinkedToIssueComment(
    projectId: number,
    issueId: number,
    commentId: number,
    attachmentId: string,
  ): AttachmentRow {
    this.assertIssueCommentExists(projectId, issueId, commentId);
    return this.requireIssueCommentAttachmentRow(issueId, commentId, attachmentId);
  }

  requireAttachmentLinkedToTaskComment(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
    attachmentId: string,
  ): AttachmentRow {
    this.assertTaskCommentExists(projectGanttChartId, taskId, commentId);
    return this.requireTaskCommentAttachmentRow(
      projectGanttChartId,
      taskId,
      commentId,
      attachmentId,
    );
  }

  async removeOrphanAttachmentsAndFiles(): Promise<void> {
    const orphanIds = this.databaseService.db
      .select({ id: attachments.id })
      .from(attachments)
      .where(
        and(
          notExists(
            this.databaseService.db
              .select()
              .from(projectsAttachments)
              .where(eq(projectsAttachments.attachmentId, attachments.id)),
          ),
          notExists(
            this.databaseService.db
              .select()
              .from(issuesAttachments)
              .where(eq(issuesAttachments.attachmentId, attachments.id)),
          ),
          notExists(
            this.databaseService.db
              .select()
              .from(issueCommentsAttachments)
              .where(eq(issueCommentsAttachments.attachmentId, attachments.id)),
          ),
          notExists(
            this.databaseService.db
              .select()
              .from(taskAttachments)
              .where(eq(taskAttachments.attachmentId, attachments.id)),
          ),
          notExists(
            this.databaseService.db
              .select()
              .from(taskCommentsAttachments)
              .where(eq(taskCommentsAttachments.attachmentId, attachments.id)),
          ),
        ),
      )
      .all()
      .map((row) => row.id);

    for (const id of orphanIds) {
      await unlinkQuietly(this.resolveBlobPath(id));
      this.databaseService.db
        .delete(attachments)
        .where(eq(attachments.id, id))
        .run();
    }
  }

  private countByQuery(row: { value: unknown } | undefined): number {
    return Number(row?.value ?? 0);
  }

  private assertWithinAttachmentLimit(currentCount: number): void {
    if (currentCount >= this.config.maxAttachmentsPerIssueOrComment) {
      throw new BadRequestException(MAX_ATTACHMENTS_REACHED_MESSAGE);
    }
  }

  private assertIssueExists(projectId: number, issueId: number): void {
    const issueRow = this.databaseService.db.select({ id: issues.id })
      .from(issues)
      .where(
        and(
          eq(issues.id, issueId),
          eq(issues.projectId, projectId),
        ),
      )
      .get();

    if (!issueRow) {
      throw new NotFoundException("Issue not found");
    }
  }

  private assertProjectExists(projectId: number): void {
    const projectRow = this.databaseService.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!projectRow) {
      throw new NotFoundException("Project not found");
    }
  }

  private assertIssueCommentExists(
    projectId: number,
    issueId: number,
    commentId: number,
  ): void {
    const commentRow = this.databaseService.db
      .select({ id: issueComments.id })
      .from(issueComments)
      .innerJoin(issues, eq(issueComments.issueId, issues.id))
      .where(
        and(
          eq(issueComments.id, commentId),
          eq(issueComments.issueId, issueId),
          eq(issues.projectId, projectId),
        ),
      )
      .get();

    if (!commentRow) {
      throw new NotFoundException("Comment not found");
    }
  }

  private assertTaskCommentExists(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
  ): void {
    const commentRow = this.databaseService.db
      .select({ id: taskComments.id })
      .from(taskComments)
      .where(
        and(
          eq(taskComments.id, commentId),
          eq(taskComments.projectGanttChartId, projectGanttChartId),
          eq(taskComments.taskId, taskId),
        ),
      )
      .get();

    if (!commentRow) {
      throw new NotFoundException("Comment not found");
    }
  }

  private requireIssueAttachmentLink(
    issueId: number,
    attachmentId: string,
  ): { id: string } {
    const linked = this.requireIssueAttachmentRow(issueId, attachmentId);

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return { id: linked.id };
  }

  private requireProjectAttachmentLink(
    projectId: number,
    attachmentId: string,
  ): { id: string } {
    const linked = this.databaseService.db
      .select({ id: attachments.id })
      .from(projectsAttachments)
      .innerJoin(
        attachments,
        eq(projectsAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(projectsAttachments.projectId, projectId),
          eq(projectsAttachments.attachmentId, attachmentId),
        ),
      )
      .get();

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return linked;
  }

  private requireIssueCommentAttachmentLink(
    issueId: number,
    commentId: number,
    attachmentId: string,
  ): { id: string } {
    const linked = this.requireIssueCommentAttachmentRow(
      issueId,
      commentId,
      attachmentId,
    );

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return { id: linked.id };
  }

  private requireTaskAttachmentLink(
    projectGanttChartId: number,
    taskId: string,
    attachmentId: string,
  ): { id: string } {
    const linked = this.requireTaskAttachmentRow(
      projectGanttChartId,
      taskId,
      attachmentId,
    );

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return { id: linked.id };
  }

  private requireTaskCommentAttachmentLink(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
    attachmentId: string,
  ): { id: string } {
    const linked = this.requireTaskCommentAttachmentRow(
      projectGanttChartId,
      taskId,
      commentId,
      attachmentId,
    );

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return { id: linked.id };
  }

  private requireIssueAttachmentRow(
    issueId: number,
    attachmentId: string,
  ): AttachmentRow {
    const linked = this.databaseService.db
      .select({ attachment: attachments })
      .from(issuesAttachments)
      .innerJoin(
        attachments,
        eq(issuesAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(issuesAttachments.issueId, issueId),
          eq(issuesAttachments.attachmentId, attachmentId),
        ),
      )
      .get();

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return linked.attachment;
  }

  private requireIssueCommentAttachmentRow(
    issueId: number,
    commentId: number,
    attachmentId: string,
  ): AttachmentRow {
    const linked = this.databaseService.db
      .select({ attachment: attachments })
      .from(issueCommentsAttachments)
      .innerJoin(
        attachments,
        eq(issueCommentsAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(issueCommentsAttachments.issueId, issueId),
          eq(issueCommentsAttachments.commentId, commentId),
          eq(issueCommentsAttachments.attachmentId, attachmentId),
        ),
      )
      .get();

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return linked.attachment;
  }

  private requireTaskAttachmentRow(
    projectGanttChartId: number,
    taskId: string,
    attachmentId: string,
  ): AttachmentRow {
    const linked = this.databaseService.db
      .select({ attachment: attachments })
      .from(taskAttachments)
      .innerJoin(
        attachments,
        eq(taskAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(taskAttachments.projectGanttChartId, projectGanttChartId),
          eq(taskAttachments.taskId, taskId),
          eq(taskAttachments.attachmentId, attachmentId),
        ),
      )
      .get();

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return linked.attachment;
  }

  private requireTaskCommentAttachmentRow(
    projectGanttChartId: number,
    taskId: string,
    commentId: number,
    attachmentId: string,
  ): AttachmentRow {
    const linked = this.databaseService.db
      .select({ attachment: attachments })
      .from(taskCommentsAttachments)
      .innerJoin(
        attachments,
        eq(taskCommentsAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(taskCommentsAttachments.projectGanttChartId, projectGanttChartId),
          eq(taskCommentsAttachments.taskId, taskId),
          eq(taskCommentsAttachments.commentId, commentId),
          eq(taskCommentsAttachments.attachmentId, attachmentId),
        ),
      )
      .get();

    if (!linked) {
      throw new NotFoundException("Attachment not found");
    }

    return linked.attachment;
  }

  private async persistAttachmentAndInsert(input: {
    buffer: Buffer;
    link: AttachmentLinkInput;
    originalFilename: string;
    validationOptions: AttachmentValidationOptions;
    uploadedByUserId: number;
  }): Promise<AttachmentSummary> {
    await this.ensureUntrustedDirectoriesExist();

    const safeFilename = path.basename(input.originalFilename);
    const extension = normalizeFilenameExtension(safeFilename);
    this.assertBufferUploadable(
      input.buffer,
      extension,
      input.validationOptions,
    );

    const attachmentId = randomUUID();
    const contentHash = createHash("sha256").update(input.buffer).digest("hex");
    const diskPath = this.resolveBlobPath(attachmentId);

    await writeFile(diskPath, input.buffer);

    try {
      this.databaseService.db.insert(attachments).values({
        byteLength: input.buffer.length,
        contentHash,
        id: attachmentId,
        originalFilename: safeFilename,
        uploadedByUserId: input.uploadedByUserId,
      }).run();

      this.insertAttachmentLink(attachmentId, input.link);
    } catch (error) {
      await unlinkQuietly(diskPath);
      throw error;
    }

    const row = this.databaseService.db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId))
      .get();

    if (!row) {
      throw new NotFoundException("Attachment failed to persist");
    }

    return toAttachmentSummary(row);
  }

  private buildAttachmentValidationOptions(
    projectId: number,
    uploadedByUserId: number,
  ): AttachmentValidationOptions {
    return {
      bypassFileTypeValidation: hasProjectUploadFileTypeBypassRole(
        this.databaseService.db,
        projectId,
        uploadedByUserId,
      ),
    };
  }

  private insertAttachmentLink(
    attachmentId: string,
    link: AttachmentLinkInput,
  ): void {
    if (link.kind === "project") {
      this.databaseService.db.insert(projectsAttachments).values({
        attachmentId,
        projectId: link.projectId,
      }).run();
      return;
    }

    if (link.kind === "issue") {
      this.databaseService.db.insert(issuesAttachments).values({
        attachmentId,
        issueId: link.issueId,
      }).run();
      return;
    }

    if (link.kind === "issue-comment") {
      this.databaseService.db.insert(issueCommentsAttachments).values({
        attachmentId,
        commentId: link.commentId,
        issueId: link.issueId,
      }).run();
      return;
    }

    if (link.kind === "task") {
      this.databaseService.db.insert(taskAttachments).values({
        attachmentId,
        projectGanttChartId: link.projectGanttChartId,
        taskId: link.taskId,
      }).run();
      return;
    }

    this.databaseService.db.insert(taskCommentsAttachments).values({
      attachmentId,
      commentId: link.commentId,
      projectGanttChartId: link.projectGanttChartId,
      taskId: link.taskId,
    }).run();
  }

  private assertPermittedExtension(extension: string): void {
    if (!extension) {
      throw new BadRequestException(EXTENSION_NOT_PERMITTED_MESSAGE);
    }

    const allowed = buildAllowedExtensionsSet(this.config);
    if (!allowed.has(extension.toLowerCase())) {
      throw new BadRequestException(EXTENSION_NOT_PERMITTED_MESSAGE);
    }
  }

  private assertBufferUploadable(
    buffer: Buffer,
    extension: string,
    validationOptions: AttachmentValidationOptions,
  ): void {
    if (buffer.length === 0) {
      throw new BadRequestException(EMPTY_ATTACHMENT_NOTIFICATION);
    }

    if (buffer.length > this.config.maxAttachmentUploadBytes) {
      throw new BadRequestException(
        `Attachment exceeds ${this.config.maxAttachmentUploadBytes} bytes`,
      );
    }

    if (validationOptions.bypassFileTypeValidation) {
      return;
    }

    this.assertPermittedExtension(extension);

    if (!assertBufferMatchesExtensionMagic(extension, buffer)) {
      throw new BadRequestException(MAGIC_BYTES_MISMATCH_MESSAGE);
    }
  }
}
