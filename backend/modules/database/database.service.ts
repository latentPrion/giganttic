import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import initSqlJs, { type Database as SqlJsDatabaseClient } from "sql.js";

import {
  activeSchemaVersion,
  credentialTypes,
  roles,
  users,
  usersCredentialTypes,
  usersPasswordCredentials,
  usersRoles,
  usersSessions,
} from "../../../db/index.js";
import {
  BACKEND_CONFIG,
  buildBackendConfig,
  type BackendConfig,
} from "../../config/backend-config.js";

const dbSchema = {
  credentialTypes,
  roles,
  users,
  usersCredentialTypes,
  usersPasswordCredentials,
  usersRoles,
  usersSessions,
} as const;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client!: SqlJsDatabaseClient;
  private drizzleDb!: SQLJsDatabase<typeof dbSchema>;

  constructor(
    @Inject(BACKEND_CONFIG) private readonly config: BackendConfig,
  ) {}

  get db(): SQLJsDatabase<typeof dbSchema> {
    return this.drizzleDb;
  }

  private get resolvedConfig(): BackendConfig {
    return buildBackendConfig(this.config ?? {});
  }

  async onModuleInit(): Promise<void> {
    const SQL = await initSqlJs();
    try {
      const buffer = await readFile(this.resolvedConfig.dbPath);
      this.client = new SQL.Database(new Uint8Array(buffer));
    } catch {
      this.client = new SQL.Database();
    }
    this.client.exec("PRAGMA foreign_keys = ON;");
    await this.ensureSchema();
    this.drizzleDb = drizzle(this.client, { schema: dbSchema });
    await this.persist();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.persist();
      this.client.close();
    }
  }

  async persist(): Promise<void> {
    await mkdir(path.dirname(this.resolvedConfig.dbPath), { recursive: true });
    await writeFile(
      this.resolvedConfig.dbPath,
      Buffer.from(this.client.export()),
    );
  }

  private async ensureSchema(): Promise<void> {
    const result = this.client.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Users'",
    );
    if (result[0]?.values.length) {
      return;
    }

    const generatedSqlDdlDir = path.resolve(
      process.cwd(),
      `db/${activeSchemaVersion}/generated-sql-ddl`,
    );
    const files = (await readdir(generatedSqlDdlDir))
      .filter((entry) => entry.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const ddl = await readFile(path.join(generatedSqlDdlDir, file), "utf8");
      for (const statement of ddl
        .split("--> statement-breakpoint")
        .map((entry) => entry.trim())
        .filter(Boolean)) {
        this.client.exec(statement);
      }
    }
  }
}
