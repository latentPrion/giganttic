import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsService } from "./organizations.service.js";

@Module({
  controllers: [OrganizationsController],
  imports: [AuthModule, DatabaseModule],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
