import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { DiscussionModule } from "../discussion/discussion.module.js";
import { TestDataService } from "./test-data.service.js";

@Module({
  imports: [DatabaseModule, DiscussionModule],
  providers: [TestDataService],
  exports: [TestDataService],
})
export class TestDataModule {}
