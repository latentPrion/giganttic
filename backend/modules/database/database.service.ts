import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { drizzle, type SQLJsDatabase } from "drizzle-orm/sql-js";
import initSqlJs, { type Database as SqlJsDatabaseClient } from "sql.js";

import {
  closedReasons,
  credentialTypes,
  issues,
  issueStatuses,
  organizationRoles,
  organizations,
  organizationsTeams,
  projectRoles,
  projects,
  projectsOrganizations,
  projectsTeams,
  projectsUsers,
  systemRoles,
  teamRoles,
  teams,
  teamsUsers,
  users,
  usersCredentialTypes,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersPasswordCredentials,
  usersProjectsProjectRoles,
  usersSessions,
  usersSystemRoles,
  usersTeamsTeamRoles,
} from "../../../db/index.js";
import {
  BACKEND_CONFIG,
  buildBackendConfig,
  type BackendConfig,
} from "../../config/backend-config.js";

const dbSchema = {
  closedReasons,
  credentialTypes,
  issues,
  issueStatuses,
  organizationRoles,
  organizations,
  organizationsTeams,
  projectRoles,
  projects,
  projectsOrganizations,
  projectsTeams,
  projectsUsers,
  systemRoles,
  teamRoles,
  teams,
  teamsUsers,
  users,
  usersCredentialTypes,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersPasswordCredentials,
  usersProjectsProjectRoles,
  usersSessions,
  usersSystemRoles,
  usersTeamsTeamRoles,
} as const;

const REQUIRED_ACTIVE_SCHEMA_TABLES = [
  "Users",
  "Projects",
  "Teams",
  "Organizations",
  "Issues",
] as const;

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
    if (this.hasActiveSchemaTables()) {
      return;
    }

    if (this.isDatabaseEmpty()) {
      if (!this.resolvedConfig.createDbIfMissing) {
        throw new Error(
          `Database at ${this.resolvedConfig.dbPath} is empty and createDbIfMissing is disabled.`,
        );
      }

      await this.applyActiveSchemaDdl();
      return;
    }

    throw new Error(
      `Database at ${this.resolvedConfig.dbPath} does not match runtime schema ${this.resolvedConfig.runtimeSchemaSnapshotSubdir}. Run db:migrate or recreate it explicitly.`,
    );
  }

  private async applyActiveSchemaDdl(): Promise<void> {
    const generatedSqlDdlPath = path.resolve(
      process.cwd(),
      `db/${this.resolvedConfig.runtimeSchemaSnapshotSubdir}/generated-sql-ddl/schema.sql`,
    );
    const ddl = await readFile(generatedSqlDdlPath, "utf8");

    for (const statement of ddl
      .split("--> statement-breakpoint")
      .map((entry) => entry.trim())
      .filter(Boolean)) {
      this.client.exec(statement);
    }
  }

  private isDatabaseEmpty(): boolean {
    const existingTableRows = this.client.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    return (existingTableRows[0]?.values ?? []).length === 0;
  }

  private hasActiveSchemaTables(): boolean {
    const existingTableRows = this.client.exec(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const existingTables = new Set(
      (existingTableRows[0]?.values ?? []).map((row) => String(row[0])),
    );

    return REQUIRED_ACTIVE_SCHEMA_TABLES.every((tableName) =>
      existingTables.has(tableName)
    );
  }
}
