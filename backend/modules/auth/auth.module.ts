import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { TestDataModule } from "../test-data/test-data.module.js";
import { AuthController } from "./auth.controller.js";
import { AuthReferenceDataService } from "./auth-reference-data.service.js";
import { BearerAuthGuard } from "./auth.guard.js";
import { AuthSeedService } from "./auth.seed.js";
import { AuthService } from "./auth.service.js";

export const AUTH_REFERENCE_DATA_SERVICE_TOKEN = "AUTH_REFERENCE_DATA_SERVICE";

@Module({
  controllers: [AuthController],
  imports: [DatabaseModule, TestDataModule],
  providers: [
    AuthService,
    AuthReferenceDataService,
    {
      provide: AUTH_REFERENCE_DATA_SERVICE_TOKEN,
      useExisting: AuthReferenceDataService,
    },
    AuthSeedService,
    BearerAuthGuard,
  ],
  exports: [
    AuthService,
    AuthReferenceDataService,
    AUTH_REFERENCE_DATA_SERVICE_TOKEN,
    BearerAuthGuard,
  ],
})
export class AuthModule {}
