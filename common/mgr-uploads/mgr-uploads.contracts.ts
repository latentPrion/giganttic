import { z } from "zod";

export const mgrUploadFileEntrySchema = z.object({
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAtMs: z.number(),
});

export type MgrUploadFileEntry = z.infer<typeof mgrUploadFileEntrySchema>;

export const mgrUploadsStorageSchema = z.object({
  devicePath: z.string(),
  availableBytes: z.number().int().nonnegative(),
  availableMib: z.number().nonnegative(),
});

export type MgrUploadsStorage = z.infer<typeof mgrUploadsStorageSchema>;

export const listMgrUploadsResponseSchema = z.object({
  files: z.array(mgrUploadFileEntrySchema),
  storage: mgrUploadsStorageSchema,
});

export type ListMgrUploadsResponse = z.infer<typeof listMgrUploadsResponseSchema>;

export const uploadMgrUploadResponseSchema = z.object({
  file: mgrUploadFileEntrySchema,
});

export const deleteMgrUploadResponseSchema = z.object({
  deletedFilename: z.string(),
});
