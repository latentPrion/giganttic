import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { TeamsController } from "./teams.controller.js";
import { TeamsService } from "./teams.service.js";

@Module({
  controllers: [TeamsController],
  imports: [AuthModule, DatabaseModule],
  providers: [TeamsService],
})
export class TeamsModule {}
