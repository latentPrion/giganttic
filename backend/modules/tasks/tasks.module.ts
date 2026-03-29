import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DiscussionModule } from "../discussion/discussion.module.js";
import { ProjectChartsModule } from "../project-charts/project-charts.module.js";
import { TaskAttachmentsController } from "./task-attachments.controller.js";
import { TaskCommentsController } from "./task-comments.controller.js";
import { TaskCommentService } from "./task-comment.service.js";
import { TaskJournalController } from "./task-journal.controller.js";
import { TaskMirrorService } from "./task-mirror.service.js";
import { TasksService } from "./tasks.service.js";

@Module({
  controllers: [TaskAttachmentsController, TaskCommentsController, TaskJournalController],
  imports: [AuthModule, DatabaseModule, DiscussionModule, ProjectChartsModule],
  providers: [TaskCommentService, TaskMirrorService, TasksService],
  exports: [TaskMirrorService],
})
export class TasksModule {}
