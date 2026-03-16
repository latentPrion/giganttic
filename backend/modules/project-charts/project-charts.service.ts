import { Inject, Injectable } from "@nestjs/common";

import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";
import {
  deleteProjectChartXml,
  ensureDefaultProjectChartXml,
  readProjectChartXml,
  writeProjectChartXml,
} from "./project-chart-files.js";

@Injectable()
export class ProjectChartsService {
  constructor(
    @Inject(BACKEND_CONFIG)
    private readonly config: BackendConfig,
  ) {}

  createDefaultProjectChart(projectId: number): string {
    return ensureDefaultProjectChartXml(this.config.chartsDir, projectId);
  }

  deleteProjectChart(projectId: number): boolean {
    return deleteProjectChartXml(this.config.chartsDir, projectId);
  }

  readProjectChart(projectId: number): string | null {
    return readProjectChartXml(this.config.chartsDir, projectId);
  }

  writeProjectChart(projectId: number, xmlContent: string): string {
    return writeProjectChartXml(this.config.chartsDir, projectId, xmlContent);
  }
}
