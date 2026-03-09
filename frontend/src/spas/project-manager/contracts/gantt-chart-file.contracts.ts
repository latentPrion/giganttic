import { z } from "zod";

const ganttIdentifierSchema = z.union([z.number(), z.string()]);

const ganttTaskSchema = z.object({
  duration: z.number().optional(),
  id: ganttIdentifierSchema,
  open: z.boolean().optional(),
  parent: ganttIdentifierSchema.optional(),
  progress: z.number().optional(),
  start_date: z.string().optional(),
  text: z.string(),
  type: z.string().optional(),
}).passthrough();

const ganttLinkSchema = z.object({
  id: ganttIdentifierSchema,
  source: ganttIdentifierSchema,
  target: ganttIdentifierSchema,
  type: z.string(),
}).passthrough();

export const ganttChartFileSchema = z.object({
  data: z.array(ganttTaskSchema),
  links: z.array(ganttLinkSchema),
});

export type GanttChartFile = z.infer<typeof ganttChartFileSchema>;
