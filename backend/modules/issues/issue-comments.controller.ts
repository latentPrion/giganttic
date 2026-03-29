import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UseInterceptors,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { buildAttachmentContentDisposition } from "../discussion/discussion-upload-controller.utils.js";
import { AttachmentService } from "./attachment.service.js";
import {
  createIssueCommentRequestSchema,
  deleteIssueCommentResponseSchema,
  getIssueCommentResponseSchema,
  issueCommentRouteParamsSchema,
  issueCommentAttachmentRouteParamsSchema,
  issueCommentsRouteParamsSchema,
  listIssueCommentsResponseSchema,
  updateIssueCommentRequestSchema,
  uploadIssueAttachmentResponseSchema,
  deleteIssueAttachmentResponseSchema,
} from "./issue-untrusted.contracts.js";
import { IssueCommentService } from "./issue-comment.service.js";
import { IssueUploadMultipartInterceptor } from "./issue-upload-multipart.interceptor.js";
import { IssuesService } from "./issues.service.js";
import type { MemoryUploadedFile } from "./memory-uploaded-file.types.js";
import { UploadedMemoryFile } from "./uploaded-memory-file.decorator.js";

const MISSING_UPLOAD_FILE_MESSAGE = "Multipart field 'file' is required";

@Authenticated()
@Controller("projects/:projectId/issues/:issueId/comments")
export class IssueCommentsController {
  constructor(
    @Inject(IssueCommentService)
    private readonly issueCommentService: IssueCommentService,
    @Inject(IssuesService)
    private readonly issuesService: IssuesService,
    @Inject(AttachmentService)
    private readonly attachmentService: AttachmentService,
  ) {}

  @Get()
  async listComments(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentsRouteParamsSchema)) params: unknown,
  ) {
    const { issueId, projectId } = issueCommentsRouteParamsSchema.parse(params);

    return listIssueCommentsResponseSchema.parse(
      await this.issueCommentService.listComments(
        request.authContext!,
        projectId,
        issueId,
      ),
    );
  }

  @Post()
  async createComment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentsRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(createIssueCommentRequestSchema)) body: unknown,
  ) {
    const { issueId, projectId } = issueCommentsRouteParamsSchema.parse(params);

    return getIssueCommentResponseSchema.parse(
      await this.issueCommentService.createComment(
        request.authContext!,
        projectId,
        issueId,
        body as never,
      ),
    );
  }

  @Get(":commentId")
  async getComment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentRouteParamsSchema)) params: unknown,
  ) {
    const { commentId, issueId, projectId } = issueCommentRouteParamsSchema.parse(
      params,
    );

    return getIssueCommentResponseSchema.parse(
      await this.issueCommentService.getComment(
        request.authContext!,
        projectId,
        issueId,
        commentId,
      ),
    );
  }

  @Patch(":commentId")
  async updateComment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateIssueCommentRequestSchema)) body: unknown,
  ) {
    const { commentId, issueId, projectId } = issueCommentRouteParamsSchema.parse(
      params,
    );

    return getIssueCommentResponseSchema.parse(
      await this.issueCommentService.updateComment(
        request.authContext!,
        projectId,
        issueId,
        commentId,
        body as never,
      ),
    );
  }

  @Delete(":commentId")
  async deleteComment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentRouteParamsSchema)) params: unknown,
  ) {
    const { commentId, issueId, projectId } = issueCommentRouteParamsSchema.parse(
      params,
    );

    return deleteIssueCommentResponseSchema.parse(
      await this.issueCommentService.deleteComment(
        request.authContext!,
        projectId,
        issueId,
        commentId,
      ),
    );
  }

  @Delete(":commentId/attachments/:attachmentId")
  async deleteCommentAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, commentId, issueId, projectId } =
      issueCommentAttachmentRouteParamsSchema.parse(params);

    const response = await this.issueCommentService.deleteCommentAttachment(
      request.authContext!,
      projectId,
      issueId,
      commentId,
      attachmentId,
    );

    return deleteIssueAttachmentResponseSchema.parse(response);
  }

  @Post(":commentId/attachments")
  @UseInterceptors(IssueUploadMultipartInterceptor)
  async uploadCommentAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentRouteParamsSchema)) params: unknown,
    @UploadedMemoryFile() file: MemoryUploadedFile | undefined,
  ) {
    const { commentId, issueId, projectId } = issueCommentRouteParamsSchema.parse(
      params,
    );

    const buffer = requireUploadedBuffer(file);
    const summary = await this.attachmentService.createAttachmentAndLinkToComment({
      buffer,
      commentId,
      issueId,
      originalFilename: file!.originalname,
      projectId,
      uploadedByUserId: request.authContext!.userId,
    });

    return uploadIssueAttachmentResponseSchema.parse({ attachment: summary });
  }

  @Get(":commentId/attachments/:attachmentId/download")
  downloadCommentAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueCommentAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, commentId, issueId, projectId } =
      issueCommentAttachmentRouteParamsSchema.parse(params);

    this.issuesService.validateIssueReadableForCurrentUser(
      request.authContext!,
      projectId,
      issueId,
    );

    const row = this.attachmentService.requireAttachmentLinkedToIssueComment(
      projectId,
      issueId,
      commentId,
      attachmentId,
    );

    return new StreamableFile(
      this.attachmentService.getAttachmentFileStream(attachmentId),
      {
        disposition: buildAttachmentContentDisposition(row.originalFilename),
        type: "application/octet-stream",
      },
    );
  }
}

function requireUploadedBuffer(file: MemoryUploadedFile | undefined): Buffer {
  if (!file?.buffer) {
    throw new BadRequestException(MISSING_UPLOAD_FILE_MESSAGE);
  }

  return file.buffer;
}
