import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { TestDataService } from "./test-data.service.js";

@Module({
  imports: [DatabaseModule],
  providers: [TestDataService],
  exports: [TestDataService],
})
export class TestDataModule {}
