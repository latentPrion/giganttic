const CRLF = "\r\n";

export function createMultipartFileBuffer(options: {
  boundary: string;
  content: Buffer;
  contentType: string;
  fieldName: string;
  filename: string;
}): Buffer {
  const header = [
    `--${options.boundary}`,
    `Content-Disposition: form-data; name="${options.fieldName}"; filename="${options.filename}"`,
    `Content-Type: ${options.contentType}`,
    "",
    "",
  ].join(CRLF);

  return Buffer.concat([
    Buffer.from(header, "utf8"),
    options.content,
    Buffer.from(`${CRLF}--${options.boundary}--${CRLF}`, "utf8"),
  ]);
}
