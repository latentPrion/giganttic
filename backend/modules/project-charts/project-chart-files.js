import fs from "node:fs";
import path from "node:path";

const DEFAULT_TASK_DURATION_DAYS = 3;
const DEFAULT_TASK_ID = 1;
const DEFAULT_TASK_PROGRESS = "0";
const DEFAULT_TASK_START_DATE = "2026-03-01 09:00";
const DEFAULT_TASK_TEXT = "Edit your new Gantt chart";
const DEFAULT_CHART_ID = 0;
const PROJECT_CHART_EXTENSION = ".xml";
const XML_CONTENT_TYPE = "application/xml; charset=utf-8";

function escapeCdataText(value) {
  return String(value).replaceAll("]]>", "]]]]><![CDATA[>");
}

function normalizeChartsDir(chartsDir) {
  return path.resolve(chartsDir);
}

export function createProjectChartFilename(projectId, chartId) {
  return `${projectId}-${chartId}${PROJECT_CHART_EXTENSION}`;
}

export function createProjectChartPath(chartsDir, projectId, chartId) {
  return path.join(
    normalizeChartsDir(chartsDir),
    createProjectChartFilename(projectId, chartId),
  );
}

export function createDefaultProjectChartXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="${DEFAULT_TASK_ID}" open="1" parent="0" progress="${DEFAULT_TASK_PROGRESS}" start_date="${DEFAULT_TASK_START_DATE}" duration="${DEFAULT_TASK_DURATION_DAYS}"><![CDATA[${escapeCdataText(DEFAULT_TASK_TEXT)}]]></task>
</data>
`;
}

function ensureChartsDirectoryExists(chartsDir) {
  fs.mkdirSync(normalizeChartsDir(chartsDir), { recursive: true });
}

export function readProjectChartXml(chartsDir, projectId, chartId) {
  const chartPath = createProjectChartPath(chartsDir, projectId, chartId);

  if (!fs.existsSync(chartPath)) {
    return null;
  }

  return fs.readFileSync(chartPath, "utf8");
}

export function writeProjectChartXml(chartsDir, projectId, chartId, xmlContent) {
  ensureChartsDirectoryExists(chartsDir);
  const chartPath = createProjectChartPath(chartsDir, projectId, chartId);
  fs.writeFileSync(chartPath, xmlContent, "utf8");
  return chartPath;
}

export function ensureDefaultProjectChartXml(
  chartsDir,
  projectId,
  chartId = DEFAULT_CHART_ID,
) {
  return writeProjectChartXml(
    chartsDir,
    projectId,
    chartId,
    createDefaultProjectChartXml(),
  );
}

export function deleteProjectChartXml(chartsDir, projectId, chartId) {
  const chartPath = createProjectChartPath(chartsDir, projectId, chartId);

  try {
    fs.unlinkSync(chartPath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export function deleteAllProjectChartXml(chartsDir, projectId) {
  const absoluteChartsDir = normalizeChartsDir(chartsDir);
  if (!fs.existsSync(absoluteChartsDir)) {
    return;
  }
  const chartFilePrefix = `${projectId}-`;
  for (const filename of fs.readdirSync(absoluteChartsDir)) {
    if (!filename.startsWith(chartFilePrefix) || !filename.endsWith(PROJECT_CHART_EXTENSION)) {
      continue;
    }
    const targetPath = path.join(absoluteChartsDir, filename);
    try {
      fs.unlinkSync(targetPath);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}

export {
  XML_CONTENT_TYPE,
};
