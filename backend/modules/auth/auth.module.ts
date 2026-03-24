import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { AuthController } from "./auth.controller.js";
import { BearerAuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { ScopedAccessRouteGuard } from "./scoped-access-route.guard.js";

@Module({
  controllers: [AuthController],
  imports: [DatabaseModule],
  providers: [
    AuthService,
    BearerAuthGuard,
    ScopedAccessRouteGuard,
  ],
  exports: [
    AuthService,
    BearerAuthGuard,
    ScopedAccessRouteGuard,
  ],
})
export class AuthModule {}
