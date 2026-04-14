import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";
import {
  hasEffectiveManagerAnywhere,
  hasSystemAdminRole,
} from "../access-control/access-control.utils.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import {
  resolveMgrUploadFilePath,
  sanitizeMgrUploadFilename,
} from "./mgr-upload-filename.utils.js";
import type { MgrUploadFileEntry, MgrUploadsStorage } from "./uploads.contracts.js";

const DEFAULT_STORAGE_DEVICE_PATH = "/dev/sda1";
const BYTES_PER_MIB = 1024 * 1024;
const DF_OUTPUT_VALUE_BASE_10 = "1";
const DF_OUTPUT_FIELDS = "avail";
const DF_FIELD_INDEX_AVAILABLE_BYTES = 1;
const DF_MINIMUM_OUTPUT_LINES = 2;
const execFileAsync = promisify(execFile);

function mgrUploadStatFields(
  fileStat: Awaited<ReturnType<typeof stat>>,
): Pick<MgrUploadFileEntry, "sizeBytes" | "updatedAtMs"> {
  return {
    sizeBytes: Number(fileStat.size),
    updatedAtMs: Number(fileStat.mtimeMs),
  };
}

function parseDfAvailableBytes(stdout: string): number {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < DF_MINIMUM_OUTPUT_LINES) {
    throw new Error("Unexpected df output while reading available storage");
  }
  const value = Number.parseInt(
    lines[DF_FIELD_INDEX_AVAILABLE_BYTES] ?? "",
    10,
  );
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid df available byte value");
  }
  return value;
}

function createStorageInfo(
  devicePath: string,
  availableBytes: number,
): MgrUploadsStorage {
  return {
    availableBytes,
    availableMib: Number((availableBytes / BYTES_PER_MIB).toFixed(2)),
    devicePath,
  };
}

@Injectable()
export class UploadsService implements OnModuleInit {
  constructor(
    @Inject(BACKEND_CONFIG)
    private readonly backendConfig: BackendConfig,
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureUploadsDirectoryExists();
  }

  private get uploadsRootDir(): string {
    return this.backendConfig.sharedInstanceUploadsDir;
  }

  private async ensureUploadsDirectoryExists(): Promise<void> {
    await mkdir(this.uploadsRootDir, { recursive: true });
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  private async statIfExists(
    filePath: string,
  ): Promise<Awaited<ReturnType<typeof stat>> | null> {
    try {
      return await stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  assertCanManageMgrUploads(authContext: AuthContext): void {
    if (hasSystemAdminRole(authContext)) {
      return;
    }

    if (
      hasEffectiveManagerAnywhere(this.databaseService.db, authContext.userId)
    ) {
      return;
    }

    throw new ForbiddenException(
      "Manager access is required for shared uploads management",
    );
  }

  async listMgrUploadFiles(authContext: AuthContext): Promise<MgrUploadFileEntry[]> {
    this.assertCanManageMgrUploads(authContext);
    await this.ensureUploadsDirectoryExists();
    const names = await readdir(this.uploadsRootDir);
    const entries: MgrUploadFileEntry[] = [];

    for (const name of names) {
      const safe = sanitizeMgrUploadFilename(name);
      if (safe === null || safe !== name) {
        continue;
      }

      const resolvedPath = resolveMgrUploadFilePath(this.uploadsRootDir, safe);
      if (!resolvedPath) {
        continue;
      }

      const fileStat = await this.statIfExists(resolvedPath);
      if (!fileStat || !fileStat.isFile()) {
        continue;
      }

      entries.push({
        name: safe,
        ...mgrUploadStatFields(fileStat),
      });
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));
    return entries;
  }

  async readMgrUploadsStorage(authContext: AuthContext): Promise<MgrUploadsStorage> {
    this.assertCanManageMgrUploads(authContext);
    const { stdout } = await execFileAsync("df", [
      `--block-size=${DF_OUTPUT_VALUE_BASE_10}`,
      `--output=${DF_OUTPUT_FIELDS}`,
      DEFAULT_STORAGE_DEVICE_PATH,
    ]);
    const availableBytes = parseDfAvailableBytes(stdout);
    return createStorageInfo(DEFAULT_STORAGE_DEVICE_PATH, availableBytes);
  }

  async uploadMgrUploadFile(
    authContext: AuthContext,
    buffer: Buffer,
    originalFilename: string,
  ): Promise<MgrUploadFileEntry> {
    this.assertCanManageMgrUploads(authContext);
    await this.ensureUploadsDirectoryExists();

    const safeName = sanitizeMgrUploadFilename(originalFilename);
    if (!safeName) {
      throw new BadRequestException("Invalid upload filename");
    }

    const targetPath = resolveMgrUploadFilePath(this.uploadsRootDir, safeName);
    if (!targetPath) {
      throw new BadRequestException("Invalid upload filename");
    }

    if (await this.pathExists(targetPath)) {
      throw new ConflictException("A file with this name already exists");
    }

    await writeFile(targetPath, buffer);
    const fileStat = await stat(targetPath);

    return {
      name: safeName,
      ...mgrUploadStatFields(fileStat),
    };
  }

  async deleteMgrUploadFile(
    authContext: AuthContext,
    rawFilename: string,
  ): Promise<string> {
    this.assertCanManageMgrUploads(authContext);
    const safeName = sanitizeMgrUploadFilename(rawFilename);
    if (!safeName) {
      throw new NotFoundException("File not found");
    }

    const targetPath = resolveMgrUploadFilePath(this.uploadsRootDir, safeName);
    if (!targetPath) {
      throw new NotFoundException("File not found");
    }

    if (!(await this.pathExists(targetPath))) {
      throw new NotFoundException("File not found");
    }

    await unlink(targetPath);
    return safeName;
  }

  resolvePublicMgrUploadReadStream(
    rawFilename: string,
  ): ReturnType<typeof createReadStream> {
    const targetPath = resolveMgrUploadFilePath(this.uploadsRootDir, rawFilename);
    if (!targetPath) {
      throw new NotFoundException("File not found");
    }

    return createReadStream(targetPath);
  }

  async assertPublicMgrUploadFileExists(rawFilename: string): Promise<void> {
    const targetPath = resolveMgrUploadFilePath(this.uploadsRootDir, rawFilename);
    if (!targetPath) {
      throw new NotFoundException("File not found");
    }

    const fileStat = await this.statIfExists(targetPath);
    if (!fileStat || !fileStat.isFile()) {
      throw new NotFoundException("File not found");
    }
  }
}
