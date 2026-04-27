import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { ProjectChartsService } from "./project-charts.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [ProjectChartsService],
  exports: [ProjectChartsService],
})
export class ProjectChartsModule {}
