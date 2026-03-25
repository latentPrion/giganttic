/** Shape of an in-memory multer file (see multer memory storage). */
export type MemoryUploadedFile = {
  buffer: Buffer;
  originalname: string;
};
