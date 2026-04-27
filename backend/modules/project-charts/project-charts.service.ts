import { Inject, Injectable } from "@nestjs/common";
import { and, eq, max } from "drizzle-orm";

import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";
import { DatabaseService } from "../database/database.service.js";
import { projectGanttCharts } from "../../../db/index.js";
import {
  createDefaultProjectChartXml,
  deleteAllProjectChartXml,
  deleteProjectChartXml,
  ensureDefaultProjectChartXml,
  readProjectChartXml,
  writeProjectChartXml,
} from "./project-chart-files.js";

const DEFAULT_CHART_ID = 0;

export interface ProjectGanttChartRecord {
  chartId: number;
  createdAt: Date;
  id: number;
  name: string;
  projectId: number;
  updatedAt: Date;
}

@Injectable()
export class ProjectChartsService {
  constructor(
    @Inject(BACKEND_CONFIG)
    private readonly config: BackendConfig,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  createDefaultProjectChart(projectId: number): ProjectGanttChartRecord {
    return this.createProjectChart(projectId, "default");
  }

  createProjectChart(projectId: number, name: string): ProjectGanttChartRecord {
    return this.databaseService.db.transaction((tx) => {
      const nextChartId = this.getNextChartIdForProject(projectId, tx);
      const [created] = tx.insert(projectGanttCharts)
        .values({
          chartId: nextChartId,
          name: name.trim(),
          projectId,
        })
        .returning()
        .all();
      ensureDefaultProjectChartXml(this.config.chartsDir, projectId, created.chartId);
      return created;
    });
  }

  deleteProjectChart(projectId: number, chartId: number): boolean {
    this.databaseService.db.delete(projectGanttCharts)
      .where(and(
        eq(projectGanttCharts.chartId, chartId),
        eq(projectGanttCharts.projectId, projectId),
      ))
      .run();
    return deleteProjectChartXml(this.config.chartsDir, projectId, chartId);
  }

  deleteProjectChartsForProject(projectId: number): void {
    this.databaseService.db.delete(projectGanttCharts)
      .where(eq(projectGanttCharts.projectId, projectId))
      .run();
    deleteAllProjectChartXml(this.config.chartsDir, projectId);
  }

  listProjectCharts(projectId: number): ProjectGanttChartRecord[] {
    return this.databaseService.db.select()
      .from(projectGanttCharts)
      .where(eq(projectGanttCharts.projectId, projectId))
      .orderBy(projectGanttCharts.chartId)
      .all();
  }

  readProjectChart(projectId: number, chartId: number): string | null {
    return readProjectChartXml(this.config.chartsDir, projectId, chartId);
  }

  resolveProjectChart(projectId: number, chartId: number): ProjectGanttChartRecord | null {
    return this.databaseService.db.select()
      .from(projectGanttCharts)
      .where(and(
        eq(projectGanttCharts.chartId, chartId),
        eq(projectGanttCharts.projectId, projectId),
      ))
      .get() ?? null;
  }

  updateProjectChartName(
    projectId: number,
    chartId: number,
    name: string,
  ): ProjectGanttChartRecord | null {
    const [updated] = this.databaseService.db.update(projectGanttCharts)
      .set({
        name: name.trim(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(projectGanttCharts.chartId, chartId),
        eq(projectGanttCharts.projectId, projectId),
      ))
      .returning()
      .all();
    return updated ?? null;
  }

  writeProjectChart(projectId: number, chartId: number, xmlContent: string): string {
    return writeProjectChartXml(this.config.chartsDir, projectId, chartId, xmlContent);
  }

  private getNextChartIdForProject(
    projectId: number,
    db: Pick<typeof this.databaseService.db, "select"> = this.databaseService.db,
  ): number {
    const row = db.select({
      maxChartId: max(projectGanttCharts.chartId),
    })
      .from(projectGanttCharts)
      .where(eq(projectGanttCharts.projectId, projectId))
      .get();
    const maxChartId = row?.maxChartId ?? null;
    return maxChartId === null ? DEFAULT_CHART_ID : maxChartId + 1;
  }
}
