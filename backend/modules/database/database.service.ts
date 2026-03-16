import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

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
import { executeSqlStatements } from "../../../db/native-sqlite.mjs";

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
  private client!: Database.Database;
  private drizzleDb!: BetterSQLite3Database<typeof dbSchema>;

  constructor(
    @Inject(BACKEND_CONFIG) private readonly config: BackendConfig,
  ) {}

  get db(): BetterSQLite3Database<typeof dbSchema> {
    return this.drizzleDb;
  }

  private get resolvedConfig(): BackendConfig {
    return buildBackendConfig(this.config ?? {});
  }

  async onModuleInit(): Promise<void> {
    this.client = this.createClient();
    await this.ensureSchema();
    this.drizzleDb = drizzle(this.client, { schema: dbSchema });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      this.client.close();
    }
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
    const { readGeneratedSqlStatements } = await import("../../../db/apply-sql-ddl.mjs");
    const statements = await readGeneratedSqlStatements(
      this.resolvedConfig.runtimeSchemaSnapshotSubdir,
    );

    executeSqlStatements(this.client, statements);
  }

  private isDatabaseEmpty(): boolean {
    const row = this.client
      .prepare("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'")
      .pluck()
      .get();

    return Number(row ?? 0) === 0;
  }

  private hasActiveSchemaTables(): boolean {
    const existingTables = new Set(
      this.client
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .raw(true)
        .all()
        .map((row) => String((row as unknown[])[0])),
    );

    return REQUIRED_ACTIVE_SCHEMA_TABLES.every((tableName) =>
      existingTables.has(tableName)
    );
  }

  private createClient(): Database.Database {
    const client = new Database(this.resolvedConfig.dbPath);

    client.pragma("foreign_keys = ON");
    client.pragma("journal_mode = WAL");
    client.pragma("synchronous = NORMAL");
    client.pragma("busy_timeout = 5000");

    return client;
  }
}
