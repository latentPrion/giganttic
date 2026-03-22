import { z } from "zod";

export const ganttDownloadFormatValues = [
  "dhtmlxXml",
  "msProjectXml",
] as const;

export const ganttDownloadFormatSchema = z.enum(ganttDownloadFormatValues);

export const ganttExportModeValues = [
  "configured_server",
  "cloud_fallback",
  "unavailable",
] as const;

export const ganttExportModeSchema = z.enum(ganttExportModeValues);

export const getProjectChartExportCapabilitiesResponseSchema = z.object({
  ganttExport: z.object({
    dhtmlxXml: z.object({
      enabled: z.literal(true),
    }),
    msProjectXml: z.object({
      enabled: z.boolean(),
      mode: ganttExportModeSchema,
      serverUrl: z.string().nullable(),
    }),
  }),
});

export type GanttDownloadFormat = z.infer<typeof ganttDownloadFormatSchema>;
export type GanttExportMode = z.infer<typeof ganttExportModeSchema>;
export type GetProjectChartExportCapabilitiesResponse = z.infer<
  typeof getProjectChartExportCapabilitiesResponseSchema
>;
