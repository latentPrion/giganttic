import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import { buildBackendConfigFromEnv } from "./config/backend-config.js";

async function bootstrap(): Promise<void> {
  const config = buildBackendConfigFromEnv();
  const app = await NestFactory.create(AppModule.register(config));

  app.setGlobalPrefix(config.routePrefix);
  await app.listen(config.port, config.host);
}

await bootstrap();
