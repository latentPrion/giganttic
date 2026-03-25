import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";
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
} from "../../../db/index.js";
import type { BackendConfig } from "../../config/backend-config.js";
import { BACKEND_CONFIG } from "../../config/backend-config.js";
import { DatabaseService } from "../database/database.service.js";
import {
  assertBufferMatchesExtensionMagic,
  normalizeFilenameExtension,
} from "./attachment-content-validation.js";
import type { IssueCommentResponse } from "./issue-untrusted.contracts.js";

const EMPTY_ATTACHMENT_NOTIFICATION = "Uploaded file is empty";
const EXTENSION_NOT_PERMITTED_MESSAGE =
  "Attachment file extension is not permitted";
const MAGIC_BYTES_MISMATCH_MESSAGE =
  "File contents do not match the declared extension";
const MAX_ATTACHMENTS_REACHED_MESSAGE =
  "Maximum attachments for this issue or comment has been reached";

export type AttachmentRow = typeof attachments.$inferSelect;

export type AttachmentSummary = IssueCommentResponse["attachments"][number];

export function toAttachmentSummary(row: AttachmentRow): AttachmentSummary {
  return {
    byteLength: row.byteLength,
    id: row.id,
    originalFilename: row.originalFilename,
  };
}

@Injectable()
export class AttachmentService {
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
    await mkdir(this.config.untrustedContentIssueCommentsDir, {
      recursive: true,
    });
  }

  countIssueLevelAttachments(issueId: number): number {
    const row = this.databaseService.db
      .select({ value: count() })
      .from(issuesAttachments)
      .where(eq(issuesAttachments.issueId, issueId))
      .get();

    return Number(row?.value ?? 0);
  }

  countCommentAttachments(issueId: number, commentId: number): number {
    const row = this.databaseService.db
      .select({ value: count() })
      .from(issueCommentsAttachments)
      .where(
        and(
          eq(issueCommentsAttachments.issueId, issueId),
          eq(issueCommentsAttachments.commentId, commentId),
        ),
      )
      .get();

    return Number(row?.value ?? 0);
  }

  assertCanAddIssueAttachment(issueId: number): void {
    const current = this.countIssueLevelAttachments(issueId);
    if (current >= this.config.maxAttachmentsPerIssueOrComment) {
      throw new BadRequestException(MAX_ATTACHMENTS_REACHED_MESSAGE);
    }
  }

  assertCanAddCommentAttachment(issueId: number, commentId: number): void {
    const current = this.countCommentAttachments(issueId, commentId);
    if (current >= this.config.maxAttachmentsPerIssueOrComment) {
      throw new BadRequestException(MAX_ATTACHMENTS_REACHED_MESSAGE);
    }
  }

  async createAttachmentAndLinkToIssue(input: {
    buffer: Buffer;
    issueId: number;
    originalFilename: string;
    projectId: number;
    uploadedByUserId: number;
  }): Promise<AttachmentSummary> {
    const issueRow = this.databaseService.db.select({ id: issues.id })
      .from(issues)
      .where(
        and(
          eq(issues.id, input.issueId),
          eq(issues.projectId, input.projectId),
        ),
      )
      .get();
    if (!issueRow) {
      throw new NotFoundException("Issue not found");
    }

    this.assertCanAddIssueAttachment(input.issueId);
    return this.persistAttachmentAndInsert({
      buffer: input.buffer,
      link: { kind: "issue", issueId: input.issueId },
      originalFilename: input.originalFilename,
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
    const commentRow = this.databaseService.db
      .select({
        id: issueComments.id,
      })
      .from(issueComments)
      .innerJoin(issues, eq(issueComments.issueId, issues.id))
      .where(
        and(
          eq(issueComments.id, input.commentId),
          eq(issueComments.issueId, input.issueId),
          eq(issues.projectId, input.projectId),
        ),
      )
      .get();
    if (!commentRow) {
      throw new NotFoundException("Comment not found");
    }

    this.assertCanAddCommentAttachment(input.issueId, input.commentId);
    return this.persistAttachmentAndInsert({
      buffer: input.buffer,
      link: {
        commentId: input.commentId,
        issueId: input.issueId,
        kind: "comment",
      },
      originalFilename: input.originalFilename,
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

  getAttachmentFileStream(attachmentId: string): Readable {
    return createReadStream(this.resolveBlobPath(attachmentId));
  }

  async readAttachmentFile(attachmentId: string): Promise<Buffer> {
    return readFile(this.resolveBlobPath(attachmentId));
  }

  resolveBlobPath(attachmentId: string): string {
    const safeName = path.basename(attachmentId);
    return path.join(this.config.untrustedContentAttachmentsDir, safeName);
  }

  resolveIssueCommentMarkdownPath(issueId: number, commentId: number): string {
    return path.join(
      this.config.untrustedContentIssueCommentsDir,
      `${issueId}-${commentId}.md`,
    );
  }

  requireAttachmentLinkedToIssue(
    projectId: number,
    issueId: number,
    attachmentId: string,
  ): AttachmentRow {
    const issueRow = this.databaseService.db
      .select({ id: issues.id })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.projectId, projectId)))
      .get();
    if (!issueRow) {
      throw new NotFoundException("Issue not found");
    }

    const fromIssue = this.databaseService.db
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

    if (fromIssue) {
      return fromIssue.attachment;
    }

    const fromComment = this.databaseService.db
      .select({ attachment: attachments })
      .from(issueCommentsAttachments)
      .innerJoin(
        attachments,
        eq(issueCommentsAttachments.attachmentId, attachments.id),
      )
      .where(
        and(
          eq(issueCommentsAttachments.issueId, issueId),
          eq(issueCommentsAttachments.attachmentId, attachmentId),
        ),
      )
      .get();

    if (fromComment) {
      return fromComment.attachment;
    }

    throw new NotFoundException("Attachment not found");
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
              .from(issuesAttachments)
              .where(eq(issuesAttachments.attachmentId, attachments.id)),
          ),
          notExists(
            this.databaseService.db
              .select()
              .from(issueCommentsAttachments)
              .where(
                eq(issueCommentsAttachments.attachmentId, attachments.id),
              ),
          ),
        ),
      )
      .all()
      .map((row) => row.id);

    for (const id of orphanIds) {
      await this.deleteBlobFileIfPresent(id);
      this.databaseService.db
        .delete(attachments)
        .where(eq(attachments.id, id))
        .run();
    }
  }

  private async deleteBlobFileIfPresent(attachmentId: string): Promise<void> {
    try {
      await unlink(this.resolveBlobPath(attachmentId));
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  private async persistAttachmentAndInsert(input: {
    buffer: Buffer;
    link:
      | { issueId: number; kind: "issue" }
      | {
        commentId: number;
        issueId: number;
        kind: "comment";
      };
    originalFilename: string;
    uploadedByUserId: number;
  }): Promise<AttachmentSummary> {
    await this.ensureUntrustedDirectoriesExist();

    const safeFilename = path.basename(input.originalFilename);
    const extension = normalizeFilenameExtension(safeFilename);
    this.assertPermittedExtension(extension);

    if (input.buffer.length === 0) {
      throw new BadRequestException(EMPTY_ATTACHMENT_NOTIFICATION);
    }

    if (input.buffer.length > this.config.maxAttachmentUploadBytes) {
      throw new BadRequestException(
        `Attachment exceeds ${this.config.maxAttachmentUploadBytes} bytes`,
      );
    }

    if (!assertBufferMatchesExtensionMagic(extension, input.buffer)) {
      throw new BadRequestException(MAGIC_BYTES_MISMATCH_MESSAGE);
    }

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

      if (input.link.kind === "issue") {
        this.databaseService.db.insert(issuesAttachments).values({
          attachmentId,
          issueId: input.link.issueId,
        }).run();
      } else {
        this.databaseService.db.insert(issueCommentsAttachments).values({
          attachmentId,
          commentId: input.link.commentId,
          issueId: input.link.issueId,
        }).run();
      }
    } catch (error) {
      await this.deleteBlobFileIfPresent(attachmentId);
      throw error;
    }

    const row = this.databaseService.db.select().from(attachments).where(
      eq(attachments.id, attachmentId),
    ).get();
    if (!row) {
      throw new NotFoundException("Attachment failed to persist");
    }

    return toAttachmentSummary(row);
  }

  private assertPermittedExtension(extension: string): void {
    if (!extension) {
      throw new BadRequestException(EXTENSION_NOT_PERMITTED_MESSAGE);
    }

    const allowed = new Set(
      this.config.allowedAttachmentExtensions.map((item) => item.toLowerCase()),
    );

    if (!allowed.has(extension.toLowerCase())) {
      throw new BadRequestException(EXTENSION_NOT_PERMITTED_MESSAGE);
    }
  }
}
