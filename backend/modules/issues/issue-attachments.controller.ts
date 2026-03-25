import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
  StreamableFile,
  UseInterceptors,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import {
  AttachmentService,
  toAttachmentSummary,
} from "./attachment.service.js";
import {
  issueAttachmentRouteParamsSchema,
  issueCommentsRouteParamsSchema,
  deleteIssueAttachmentResponseSchema,
  listIssueAttachmentsResponseSchema,
  uploadIssueAttachmentResponseSchema,
} from "./issue-untrusted.contracts.js";
import { IssueUploadMultipartInterceptor } from "./issue-upload-multipart.interceptor.js";
import { IssuesService } from "./issues.service.js";
import type { MemoryUploadedFile } from "./memory-uploaded-file.types.js";
import { UploadedMemoryFile } from "./uploaded-memory-file.decorator.js";

const MISSING_UPLOAD_FILE_MESSAGE = "Multipart field 'file' is required";

@Authenticated()
@Controller("projects/:projectId/issues/:issueId/attachments")
export class IssueAttachmentsController {
  constructor(
    @Inject(IssuesService)
    private readonly issuesService: IssuesService,
    @Inject(AttachmentService)
    private readonly attachmentService: AttachmentService,
  ) {}

  @Get()
  listIssueAttachments(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentsRouteParamsSchema)) params: unknown,
  ) {
    const { issueId, projectId } = issueCommentsRouteParamsSchema.parse(params);
    this.issuesService.validateIssueReadableForCurrentUser(
      request.authContext!,
      projectId,
      issueId,
    );

    const rows = this.attachmentService.listIssueLevelAttachmentRows(issueId);

    return listIssueAttachmentsResponseSchema.parse({
      attachments: rows.map(toAttachmentSummary),
    });
  }

  @Post()
  @UseInterceptors(IssueUploadMultipartInterceptor)
  async uploadIssueAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentsRouteParamsSchema)) params: unknown,
    @UploadedMemoryFile() file: MemoryUploadedFile | undefined,
  ) {
    const { issueId, projectId } = issueCommentsRouteParamsSchema.parse(params);
    this.issuesService.validateIssueReadableForCurrentUser(
      request.authContext!,
      projectId,
      issueId,
    );

    const buffer = requireUploadedBuffer(file);
    const summary = await this.attachmentService.createAttachmentAndLinkToIssue({
      buffer,
      issueId,
      originalFilename: file!.originalname,
      projectId,
      uploadedByUserId: request.authContext!.userId,
    });

    return uploadIssueAttachmentResponseSchema.parse({ attachment: summary });
  }

  @Delete(":attachmentId")
  async deleteIssueAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, issueId, projectId } = issueAttachmentRouteParamsSchema.parse(
      params,
    );

    const response = await this.issuesService.deleteIssueAttachment(
      request.authContext!,
      projectId,
      issueId,
      attachmentId,
    );

    return deleteIssueAttachmentResponseSchema.parse(response);
  }

  @Get(":attachmentId/download")
  downloadIssueAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, issueId, projectId } = issueAttachmentRouteParamsSchema.parse(
      params,
    );

    this.issuesService.validateIssueReadableForCurrentUser(
      request.authContext!,
      projectId,
      issueId,
    );

    const row = this.attachmentService.requireAttachmentLinkedToIssue(
      projectId,
      issueId,
      attachmentId,
    );

    const stream = this.attachmentService.getAttachmentFileStream(attachmentId);
    const disposition = buildAttachmentContentDisposition(row.originalFilename);

    return new StreamableFile(stream, {
      disposition,
      type: "application/octet-stream",
    });
  }
}

function requireUploadedBuffer(file: MemoryUploadedFile | undefined): Buffer {
  if (!file?.buffer) {
    throw new BadRequestException(MISSING_UPLOAD_FILE_MESSAGE);
  }

  return file.buffer;
}

function buildAttachmentContentDisposition(originalFilename: string): string {
  const safeName = originalFilename.replace(/["\r\n]/g, "_").trim() || "attachment";

  return `attachment; filename="${safeName}"`;
}
