import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";

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
import type { MgrUploadFileEntry } from "./uploads.contracts.js";

function mgrUploadStatFields(
  fileStat: Awaited<ReturnType<typeof stat>>,
): Pick<MgrUploadFileEntry, "sizeBytes" | "updatedAtMs"> {
  return {
    sizeBytes: Number(fileStat.size),
    updatedAtMs: Number(fileStat.mtimeMs),
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
