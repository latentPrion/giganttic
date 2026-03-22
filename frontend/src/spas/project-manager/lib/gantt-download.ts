import type {
  GanttDownloadFormat,
  GetProjectChartExportCapabilitiesResponse,
} from "../contracts/gantt-export.contracts.js";

interface GanttMsProjectExporter {
  exportToMSProject(config?: Record<string, unknown>): void;
}

const CLOUD_EXPORT_URL = "https://export.dhtmlx.com/gantt";
const DHTMLX_XML_FILE_EXTENSION = ".xml";
const MS_PROJECT_FILE_EXTENSION = ".xml";
const XML_CONTENT_TYPE = "application/xml;charset=utf-8";

function createBaseProjectFileName(projectId: number): string {
  return `project-${projectId}`;
}

function createDhtmlxXmlFileName(projectId: number): string {
  return `${createBaseProjectFileName(projectId)}${DHTMLX_XML_FILE_EXTENSION}`;
}

function createMsProjectFileName(projectId: number): string {
  return `${createBaseProjectFileName(projectId)}.ms-project${MS_PROJECT_FILE_EXTENSION}`;
}

function downloadTextFile(
  content: string,
  contentType: string,
  fileName: string,
): void {
  const blob = new Blob([content], { type: contentType });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function resolveMsProjectExportServerUrl(
  capabilities: GetProjectChartExportCapabilitiesResponse,
): string | undefined {
  const { msProjectXml } = capabilities.ganttExport;

  if (msProjectXml.mode === "configured_server" && msProjectXml.serverUrl) {
    return msProjectXml.serverUrl;
  }

  if (msProjectXml.mode === "cloud_fallback") {
    return CLOUD_EXPORT_URL;
  }

  return undefined;
}

function exportMsProjectXml(
  ganttInstance: GanttMsProjectExporter,
  projectId: number,
  capabilities: GetProjectChartExportCapabilitiesResponse,
): void {
  if (typeof ganttInstance.exportToMSProject !== "function") {
    throw new Error("MS Project XML export is unavailable in this Gantt runtime.");
  }

  const exportServerUrl = resolveMsProjectExportServerUrl(capabilities);

  if (!exportServerUrl) {
    throw new Error("MS Project XML export is unavailable right now.");
  }

  ganttInstance.exportToMSProject({
    name: createMsProjectFileName(projectId),
    server: exportServerUrl,
  });
}

function exportDhtmlxXml(projectId: number, chartXml: string): void {
  downloadTextFile(
    chartXml,
    XML_CONTENT_TYPE,
    createDhtmlxXmlFileName(projectId),
  );
}

export function downloadSelectedGanttFormat(
  format: GanttDownloadFormat,
  ganttInstance: GanttMsProjectExporter,
  projectId: number,
  chartXml: string,
  capabilities: GetProjectChartExportCapabilitiesResponse,
): void {
  if (format === "msProjectXml") {
    exportMsProjectXml(ganttInstance, projectId, capabilities);
    return;
  }

  exportDhtmlxXml(projectId, chartXml);
}
