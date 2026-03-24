import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { ScopedAccessAuthController } from "./scoped-access-auth.controller.js";
import { ScopedAccessController } from "./scoped-access.controller.js";
import { ScopedAccessService } from "./scoped-access.service.js";

@Module({
  controllers: [ScopedAccessAuthController, ScopedAccessController],
  imports: [AuthModule, DatabaseModule],
  providers: [ScopedAccessService],
  exports: [ScopedAccessService],
})
export class ScopedAccessModule {}
