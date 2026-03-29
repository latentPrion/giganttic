import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DiscussionModule } from "../discussion/discussion.module.js";
import { ProjectChartsModule } from "../project-charts/project-charts.module.js";
import { TasksModule } from "../tasks/tasks.module.js";
import { ProjectAttachmentsController } from "./project-attachments.controller.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsService } from "./projects.service.js";

@Module({
  controllers: [ProjectAttachmentsController, ProjectsController],
  imports: [AuthModule, DatabaseModule, DiscussionModule, ProjectChartsModule, TasksModule],
  providers: [ProjectsService],
})
export class ProjectsModule {}
