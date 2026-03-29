import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { DiscussionAttachmentService } from "./discussion-attachment.service.js";
import { DiscussionCommentBodyStorageService } from "./discussion-comment-body-storage.service.js";
import { DiscussionJournalStorageService } from "./discussion-journal-storage.service.js";
import { DiscussionUploadMultipartInterceptor } from "./discussion-upload-multipart.interceptor.js";

@Module({
  imports: [DatabaseModule],
  providers: [
    DiscussionAttachmentService,
    DiscussionCommentBodyStorageService,
    DiscussionJournalStorageService,
    DiscussionUploadMultipartInterceptor,
  ],
  exports: [
    DiscussionAttachmentService,
    DiscussionCommentBodyStorageService,
    DiscussionJournalStorageService,
    DiscussionUploadMultipartInterceptor,
  ],
})
export class DiscussionModule {}
