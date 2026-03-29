import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ProjectChartsModule } from "../project-charts/project-charts.module.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsService } from "./notifications.service.js";

@Module({
  controllers: [NotificationsController],
  exports: [NotificationsService],
  imports: [AuthModule, DatabaseModule, ProjectChartsModule],
  providers: [NotificationsService],
})
export class NotificationsModule {}
