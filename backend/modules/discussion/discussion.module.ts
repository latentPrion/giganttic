import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { DiscussionAttachmentService } from "./discussion-attachment.service.js";
import { DiscussionCommentBodyStorageService } from "./discussion-comment-body-storage.service.js";
import { DiscussionUploadMultipartInterceptor } from "./discussion-upload-multipart.interceptor.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    DiscussionAttachmentService,
    DiscussionCommentBodyStorageService,
    DiscussionUploadMultipartInterceptor,
  ],
  exports: [
    DiscussionAttachmentService,
    DiscussionCommentBodyStorageService,
    DiscussionUploadMultipartInterceptor,
  ],
})
export class DiscussionModule {}
