import { z } from "zod";

export const mgrUploadFileEntrySchema = z.object({
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAtMs: z.number(),
});

export type MgrUploadFileEntry = z.infer<typeof mgrUploadFileEntrySchema>;

export const listMgrUploadsResponseSchema = z.object({
  files: z.array(mgrUploadFileEntrySchema),
});

export type ListMgrUploadsResponse = z.infer<typeof listMgrUploadsResponseSchema>;

export const uploadMgrUploadResponseSchema = z.object({
  file: mgrUploadFileEntrySchema,
});

export const deleteMgrUploadResponseSchema = z.object({
  deletedFilename: z.string(),
});
