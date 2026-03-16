import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDefaultProjectChartXml,
  createProjectChartPath,
  deleteProjectChartXml,
  ensureDefaultProjectChartXml,
  readProjectChartXml,
  writeProjectChartXml,
} from "./project-chart-files.js";
import { createDbTestTempDir } from "../../../tests/db-test-execution-db.js";

const TEMP_DIR_PREFIX = "giganttic-project-chart-files-";
const DEFAULT_TASK_TEXT = "Edit your new Gantt chart";
const FIRST_PROJECT_ID = 101;
const SECOND_PROJECT_ID = 202;
const CUSTOM_CHART_XML =
  "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"77\"><![CDATA[Custom task]]></task></data>\n";

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

describe("project chart files", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        await rm(tempDir, { force: true, recursive: true });
      }
    }
  });

  it("creates deterministic default XML with one starter task and fixed fields", () => {
    const firstXml = createDefaultProjectChartXml();
    const secondXml = createDefaultProjectChartXml();

    expect(firstXml).toBe(secondXml);
    expect(firstXml).toContain(DEFAULT_TASK_TEXT);
    expect(firstXml).toContain("<data>");
    expect(firstXml).toContain('id="1"');
    expect(firstXml).toContain('open="1"');
    expect(firstXml).toContain('parent="0"');
    expect(firstXml).toContain('progress="0"');
    expect(firstXml).toContain('start_date="2026-03-01 09:00"');
    expect(firstXml).toContain('duration="3"');
    expect(firstXml.match(/<task\b/g)?.length ?? 0).toBe(1);
  });

  it("writes and reads default chart XML at the project-specific path", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const chartsDir = path.join(tempDir, "charts");

    const chartPath = ensureDefaultProjectChartXml(chartsDir, FIRST_PROJECT_ID);

    expect(chartPath).toBe(createProjectChartPath(chartsDir, FIRST_PROJECT_ID));
    expect(await pathExists(chartPath)).toBe(true);
    expect(await readFile(chartPath, "utf8")).toBe(createDefaultProjectChartXml());
    expect(readProjectChartXml(chartsDir, FIRST_PROJECT_ID)).toBe(
      createDefaultProjectChartXml(),
    );
  });

  it("keeps chart files isolated per project id and deletes only the targeted chart", async () => {
    const tempDir = await createDbTestTempDir(TEMP_DIR_PREFIX);
    tempDirs.push(tempDir);
    const chartsDir = path.join(tempDir, "charts");

    const firstChartPath = writeProjectChartXml(chartsDir, FIRST_PROJECT_ID, CUSTOM_CHART_XML);
    const secondChartPath = ensureDefaultProjectChartXml(chartsDir, SECOND_PROJECT_ID);

    expect(await readFile(firstChartPath, "utf8")).toBe(CUSTOM_CHART_XML);
    expect(await readFile(secondChartPath, "utf8")).toBe(createDefaultProjectChartXml());

    expect(deleteProjectChartXml(chartsDir, SECOND_PROJECT_ID)).toBe(true);
    expect(await pathExists(secondChartPath)).toBe(false);
    expect(await pathExists(firstChartPath)).toBe(true);
    expect(await readFile(firstChartPath, "utf8")).toBe(CUSTOM_CHART_XML);
  });
});
