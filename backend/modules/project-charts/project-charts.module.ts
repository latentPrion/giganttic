import { Module } from "@nestjs/common";

import { ProjectChartsService } from "./project-charts.service.js";

@Module({
  providers: [ProjectChartsService],
  exports: [ProjectChartsService],
})
export class ProjectChartsModule {}
