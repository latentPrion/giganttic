import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { IssuesController } from "./issues.controller.js";
import { IssuesService } from "./issues.service.js";

@Module({
  controllers: [IssuesController],
  imports: [AuthModule, DatabaseModule],
  providers: [IssuesService],
})
export class IssuesModule {}
