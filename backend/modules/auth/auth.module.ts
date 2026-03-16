import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { AuthController } from "./auth.controller.js";
import { BearerAuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";

@Module({
  controllers: [AuthController],
  imports: [DatabaseModule],
  providers: [
    AuthService,
    BearerAuthGuard,
  ],
  exports: [
    AuthService,
    BearerAuthGuard,
  ],
})
export class AuthModule {}
