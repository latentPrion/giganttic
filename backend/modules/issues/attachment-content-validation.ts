import path from "node:path";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const GIF_MAGIC_A = Buffer.from("GIF87a", "ascii");
const GIF_MAGIC_B = Buffer.from("GIF89a", "ascii");
const PDF_MAGIC = Buffer.from("%PDF", "ascii");
const WEBP_RIFF = Buffer.from("RIFF", "ascii");
const WEBP_WEBP = Buffer.from("WEBP", "ascii");

function readPrefix(buffer: Buffer, length: number): Buffer {
  return buffer.subarray(0, Math.min(length, buffer.length));
}

function startsWithBuffer(data: Buffer, prefix: Buffer): boolean {
  if (data.length < prefix.length) {
    return false;
  }

  return prefix.equals(data.subarray(0, prefix.length));
}

function validatePngMagic(buffer: Buffer): boolean {
  return startsWithBuffer(buffer, PNG_MAGIC.subarray(0, 8));
}

function validateJpegMagic(buffer: Buffer): boolean {
  return startsWithBuffer(buffer, JPEG_MAGIC);
}

function validateGifMagic(buffer: Buffer): boolean {
  return startsWithBuffer(buffer, GIF_MAGIC_A)
    || startsWithBuffer(buffer, GIF_MAGIC_B);
}

function validatePdfMagic(buffer: Buffer): boolean {
  return startsWithBuffer(buffer, PDF_MAGIC);
}

function validateWebpMagic(buffer: Buffer): boolean {
  if (buffer.length < 12) {
    return false;
  }

  return startsWithBuffer(buffer, WEBP_RIFF)
    && WEBP_WEBP.equals(buffer.subarray(8, 12));
}

function validateSvgOrXmlMagic(buffer: Buffer): boolean {
  const prefix = readPrefix(buffer, 256).toString("utf8").trimStart();
  return prefix.startsWith("<?xml") || prefix.startsWith("<svg");
}

function validateTextLikeMagic(buffer: Buffer): boolean {
  const sample = readPrefix(buffer, 8_192);
  for (const byte of sample) {
    if (byte === 0) {
      return false;
    }
  }

  return true;
}

export function normalizeFilenameExtension(filename: string): string {
  const extension = path.extname(filename).toLowerCase();

  return extension.length > 0 ? extension : "";
}

export function assertBufferMatchesExtensionMagic(
  extension: string,
  buffer: Buffer,
): boolean {
  if (extension === ".png") {
    return validatePngMagic(buffer);
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return validateJpegMagic(buffer);
  }

  if (extension === ".gif") {
    return validateGifMagic(buffer);
  }

  if (extension === ".pdf") {
    return validatePdfMagic(buffer);
  }

  if (extension === ".webp") {
    return validateWebpMagic(buffer);
  }

  if (extension === ".svg" || extension === ".xml") {
    return validateSvgOrXmlMagic(buffer);
  }

  if (
    extension === ".txt"
    || extension === ".md"
    || extension === ".csv"
  ) {
    return validateTextLikeMagic(buffer);
  }

  return false;
}
