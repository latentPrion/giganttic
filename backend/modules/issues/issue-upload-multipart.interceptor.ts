import {
  BadRequestException,
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { MulterError } from "multer";
import multer from "multer";
import { Observable, from, switchMap, tap } from "rxjs";

import { BACKEND_CONFIG, type BackendConfig } from "../../config/backend-config.js";
import {
  ISSUE_UPLOAD_FIELD_NAME,
  MULTIPART_MEMORY_FILE_KEY,
} from "./issue-upload.constants.js";
import type { MemoryUploadedFile } from "./memory-uploaded-file.types.js";

interface FastifyMultipartLikeRequest {
  file: (
    options?: { limits?: { fileSize?: number } },
  ) => Promise<
    | {
        filename?: string;
        toBuffer: () => Promise<Buffer>;
      }
    | undefined
  >;
  isMultipart: () => boolean;
}

function isFastifyMultipartCapableRequest(
  request: unknown,
): request is FastifyMultipartLikeRequest {
  return typeof (request as FastifyMultipartLikeRequest).isMultipart === "function";
}

function mapMulterError(error: unknown): Error {
  if (!error || !(error instanceof Error)) {
    return new BadRequestException("Upload failed");
  }

  const code = (error as MulterError).code;
  if (code === "LIMIT_FILE_SIZE") {
    return new PayloadTooLargeException("Uploaded file is too large");
  }

  return new BadRequestException(error.message);
}

async function readFastifyMultipartFile(
  request: FastifyMultipartLikeRequest,
  maxBytes: number,
): Promise<MemoryUploadedFile | undefined> {
  if (!request.isMultipart()) {
    return undefined;
  }

  const data = await request.file({
    limits: { fileSize: maxBytes },
  });

  if (!data) {
    return undefined;
  }

  const buffer = await data.toBuffer();

  return {
    buffer,
    originalname: data.filename ?? ISSUE_UPLOAD_FIELD_NAME,
  };
}

function assignStoredFile(request: unknown, file: MemoryUploadedFile | undefined): void {
  (request as Record<string, unknown>)[MULTIPART_MEMORY_FILE_KEY] = file;
}

function createExpressMemoryUploadObservable(
  request: unknown,
  response: unknown,
  maxBytes: number,
  next: CallHandler,
): Observable<unknown> {
  return new Observable((subscriber) => {
    const upload = multer({
      limits: { fileSize: maxBytes },
      storage: multer.memoryStorage(),
    }).single(ISSUE_UPLOAD_FIELD_NAME);

    upload(
      request as Parameters<typeof upload>[0],
      response as Parameters<typeof upload>[1],
      (error: unknown) => {
        if (error) {
          subscriber.error(mapMulterError(error));
          return;
        }

        const expressFile = (
          request as {
            file?: { buffer: Buffer; originalname: string };
          }
        ).file;
        assignStoredFile(
          request,
          expressFile
            ? {
                buffer: expressFile.buffer,
                originalname: expressFile.originalname,
              }
            : undefined,
        );
        next.handle().subscribe(subscriber);
      },
    );
  });
}

@Injectable()
export class IssueUploadMultipartInterceptor implements NestInterceptor {
  constructor(
    @Inject(BACKEND_CONFIG)
    private readonly backendConfig: BackendConfig,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const maxBytes = this.backendConfig.maxAttachmentUploadBytes;

    if (isFastifyMultipartCapableRequest(request)) {
      return from(readFastifyMultipartFile(request, maxBytes)).pipe(
        tap((file) => assignStoredFile(request, file)),
        switchMap(() => next.handle()),
      );
    }

    return createExpressMemoryUploadObservable(request, response, maxBytes, next);
  }
}
