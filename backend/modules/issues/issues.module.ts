import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { AttachmentService } from "./attachment.service.js";
import { IssueAttachmentsController } from "./issue-attachments.controller.js";
import { IssueCommentsController } from "./issue-comments.controller.js";
import { IssueCommentService } from "./issue-comment.service.js";
import { IssueUploadMultipartInterceptor } from "./issue-upload-multipart.interceptor.js";
import { IssuesController } from "./issues.controller.js";
import { IssuesService } from "./issues.service.js";

@Module({
  controllers: [
    IssueAttachmentsController,
    IssueCommentsController,
    IssuesController,
  ],
  imports: [AuthModule, DatabaseModule],
  providers: [
    AttachmentService,
    IssueCommentService,
    IssueUploadMultipartInterceptor,
    IssuesService,
  ],
})
export class IssuesModule {}
