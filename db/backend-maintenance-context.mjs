import "reflect-metadata";

import { access } from "node:fs/promises";

import { NestFactory } from "@nestjs/core";

const TEST_ENVIRONMENT_FLAG = "VITEST";

async function pathExists(targetPath) {
  try {
    await access(new URL(targetPath, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

function shouldPreferSourceModules(env = process.env) {
  return env[TEST_ENVIRONMENT_FLAG] === "true";
}

async function loadAppModule() {
  if (
    !shouldPreferSourceModules()
    && await pathExists("../dist/backend/app.module.js")
  ) {
    return import("../dist/backend/app.module.js");
  }

  return import("../backend/app.module.ts");
}

async function loadBackendConfigBuilder() {
  if (
    !shouldPreferSourceModules()
    && await pathExists("../dist/backend/config/backend-config.js")
  ) {
    return import("../dist/backend/config/backend-config.js");
  }

  return import("../backend/config/backend-config.ts");
}

async function createMaintenanceContext(overrides = {}, env = process.env) {
  const [{ AppModule }, { buildBackendConfigFromEnv }] = await Promise.all([
    loadAppModule(),
    loadBackendConfigBuilder(),
  ]);
  const baseConfig = buildBackendConfigFromEnv(env);

  return NestFactory.createApplicationContext(
    AppModule.register({
      ...baseConfig,
      ...overrides,
    }),
  );
}

export {
  createMaintenanceContext,
};
