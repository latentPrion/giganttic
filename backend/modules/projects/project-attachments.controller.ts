import {
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
import { z } from "zod";

import {
  deleteDiscussionAttachmentResponseSchema,
  discussionAttachmentIdSchema,
  listDiscussionAttachmentsResponseSchema,
  uploadDiscussionAttachmentResponseSchema,
} from "../../../common/discussion/discussion.contracts.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DiscussionAttachmentService } from "../discussion/discussion-attachment.service.js";
import {
  buildAttachmentContentDisposition,
  requireUploadedBuffer,
} from "../discussion/discussion-upload-controller.utils.js";
import { DiscussionUploadMultipartInterceptor } from "../discussion/discussion-upload-multipart.interceptor.js";
import type { MemoryUploadedFile } from "../discussion/memory-uploaded-file.types.js";
import { UploadedMemoryFile } from "../discussion/uploaded-memory-file.decorator.js";
import { projectIdParamSchema } from "./projects.contracts.js";
import { ProjectsService } from "./projects.service.js";

const projectAttachmentRouteParamsSchema = projectIdParamSchema.extend({
  attachmentId: discussionAttachmentIdSchema,
});

@Authenticated()
@Controller("projects/:projectId/attachments")
export class ProjectAttachmentsController {
  constructor(
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,
    @Inject(DiscussionAttachmentService)
    private readonly attachmentService: DiscussionAttachmentService,
  ) {}

  @Get()
  listProjectAttachments(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);
    return listDiscussionAttachmentsResponseSchema.parse(
      this.projectsService.listProjectAttachments(request.authContext!, projectId),
    );
  }

  @Post()
  @UseInterceptors(DiscussionUploadMultipartInterceptor)
  async uploadProjectAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @UploadedMemoryFile() file: MemoryUploadedFile | undefined,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);
    return uploadDiscussionAttachmentResponseSchema.parse(
      await this.projectsService.uploadProjectAttachment(
        request.authContext!,
        projectId,
        requireUploadedBuffer(file),
        file!.originalname,
      ),
    );
  }

  @Delete(":attachmentId")
  async deleteProjectAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, projectId } = projectAttachmentRouteParamsSchema.parse(params);
    return deleteDiscussionAttachmentResponseSchema.parse(
      await this.projectsService.deleteProjectAttachment(
        request.authContext!,
        projectId,
        attachmentId,
      ),
    );
  }

  @Get(":attachmentId/download")
  downloadProjectAttachment(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectAttachmentRouteParamsSchema)) params: unknown,
  ) {
    const { attachmentId, projectId } = projectAttachmentRouteParamsSchema.parse(params);
    const row = this.attachmentService.requireAttachmentLinkedToProject(
      projectId,
      attachmentId,
    );
    this.projectsService.getProject(request.authContext!, projectId);

    return new StreamableFile(
      this.attachmentService.getAttachmentFileStream(attachmentId),
      {
        disposition: buildAttachmentContentDisposition(row.originalFilename),
        type: "application/octet-stream",
      },
    );
  }
}
