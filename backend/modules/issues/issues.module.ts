import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DiscussionModule } from "../discussion/discussion.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { IssueAttachmentsController } from "./issue-attachments.controller.js";
import { IssueCommentsController } from "./issue-comments.controller.js";
import { IssueCommentService } from "./issue-comment.service.js";
import { IssuesController } from "./issues.controller.js";
import { IssuesService } from "./issues.service.js";

@Module({
  controllers: [
    IssueAttachmentsController,
    IssueCommentsController,
    IssuesController,
  ],
  imports: [AuthModule, DatabaseModule, DiscussionModule, NotificationsModule],
  providers: [IssueCommentService, IssuesService],
})
export class IssuesModule {}
