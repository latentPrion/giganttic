import "reflect-metadata";

import { rm } from "node:fs/promises";
import path from "node:path";

import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";

import { AppModule } from "../backend/app.module.js";
import {
  buildBackendConfig,
  type BackendConfig,
} from "../backend/config/backend-config.js";
import { DatabaseService } from "../backend/modules/database/database.service.js";
import {
  requireDbTestRuntimeConfig,
} from "./db-test-runtime-guard.js";
import { createDbTestExecutionSandbox } from "./db-test-execution-db.js";
import { seedExecutionDatabase } from "./db-test-seeding.js";

export const MISSING_ENTITY_ID = 999_999;
const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

export interface AuthSession {
  accessToken: string;
  user: {
    id: number;
    roles: string[];
    username: string;
  };
}

interface CrudTestHarness {
  cleanup(): Promise<void>;
  createAuthHeaders(accessToken: string): Record<string, string>;
  createProjectChartPath(projectId: number): string;
  databaseService: DatabaseService;
  loginSeededAdmin(): Promise<AuthSession>;
  parseJson<T>(payload: string): T;
  registerUser(prefix: string): Promise<AuthSession>;
  setup(): Promise<void>;
  app: NestFastifyApplication;
}

export function createCrudTestHarness(
  dbFileName: string,
  backendConfigOverrides: Partial<BackendConfig> = {},
): CrudTestHarness {
  let app: NestFastifyApplication | undefined;
  let chartsDir: string | undefined;
  let dbPath: string | undefined;
  let databaseService: DatabaseService | undefined;
  let tempDir: string | undefined;
  let userCounter = 0;

  function assertApp(): NestFastifyApplication {
    if (!app) {
      throw new Error("Test app is not initialized");
    }

    return app;
  }

  function assertDatabaseService(): DatabaseService {
    if (!databaseService) {
      throw new Error("Database service is not initialized");
    }

    return databaseService;
  }

  function assertChartsDir(): string {
    if (!chartsDir) {
      throw new Error("Charts directory is not initialized");
    }

    return chartsDir;
  }

  function buildUniqueUserSeed(prefix: string) {
    userCounter += 1;

    return {
      email: `${prefix}-${userCounter}@example.com`,
      password: "secret123",
      username: `${prefix}-${userCounter}`,
    };
  }

  function createAuthHeaders(accessToken: string): Record<string, string> {
    return {
      authorization: `Bearer ${accessToken}`,
    };
  }

  function createProjectChartPath(projectId: number): string {
    return path.join(assertChartsDir(), `${projectId}.xml`);
  }

  function parseJson<T>(payload: string): T {
    return JSON.parse(payload) as T;
  }

  async function buildApp(databasePath: string): Promise<NestFastifyApplication> {
    const resolvedChartsDir = path.join(path.dirname(databasePath), "charts");
    const config = buildBackendConfig({
      ...backendConfigOverrides,
      chartsDir: resolvedChartsDir,
      createDbIfMissing: false,
      dbPath: databasePath,
      port: 0,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    }).compile();

    const nextApp = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    nextApp.setGlobalPrefix(config.routePrefix);
    await nextApp.init();
    await nextApp.getHttpAdapter().getInstance().ready();

    return nextApp;
  }

  async function setup(): Promise<void> {
    const sandbox = await createDbTestExecutionSandbox({
      contextLabel: "CRUD integration database",
      copyBaseDb: false,
      dbFileName,
      runtimeConfig: dbTestRuntimeConfig,
      tempDirPrefix: "giganttic-crud-tests-",
    });
    dbPath = sandbox.dbPath;
    chartsDir = path.join(path.dirname(dbPath), "charts");
    tempDir = sandbox.tempDir;
    await seedExecutionDatabase({
      dbPath,
      includeTestData: true,
      schemaName: dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir,
    });
    app = await buildApp(dbPath);
    databaseService = assertApp().get(DatabaseService);
  }

  async function cleanup(): Promise<void> {
    if (app) {
      await app.close();
    }

    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  async function registerUser(prefix: string): Promise<AuthSession> {
    const seed = buildUniqueUserSeed(prefix);
    const registerResponse = await assertApp().inject({
      method: "POST",
      payload: seed,
      url: "/stc-proj-mgmt/api/auth/register",
    });

    if (registerResponse.statusCode !== 201) {
      throw new Error(`Register failed: ${registerResponse.statusCode}`);
    }

    const loginResponse = await assertApp().inject({
      method: "POST",
      payload: {
        password: seed.password,
        username: seed.username,
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });

    if (loginResponse.statusCode !== 201) {
      throw new Error(`Login failed: ${loginResponse.statusCode}`);
    }

    return parseJson<AuthSession>(loginResponse.payload);
  }

  async function loginSeededAdmin(): Promise<AuthSession> {
    const loginResponse = await assertApp().inject({
      method: "POST",
      payload: {
        password: "1234",
        username: "testadminuser",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });

    if (loginResponse.statusCode !== 201) {
      throw new Error(`Admin login failed: ${loginResponse.statusCode}`);
    }

    return parseJson<AuthSession>(loginResponse.payload);
  }

  return {
    cleanup,
    createAuthHeaders,
    createProjectChartPath,
    get app() {
      return assertApp();
    },
    get databaseService() {
      return assertDatabaseService();
    },
    loginSeededAdmin,
    parseJson,
    registerUser,
    setup,
  };
}
