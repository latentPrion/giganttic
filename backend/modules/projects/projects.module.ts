import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ProjectChartsModule } from "../project-charts/project-charts.module.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsService } from "./projects.service.js";

@Module({
  controllers: [ProjectsController],
  imports: [AuthModule, DatabaseModule, ProjectChartsModule],
  providers: [ProjectsService],
})
export class ProjectsModule {}
