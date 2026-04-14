import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { DatabaseModule } from "../database/database.module.js";
import { DiscussionModule } from "../discussion/discussion.module.js";
import { MgrUploadsMultipartInterceptor } from "./mgr-uploads-multipart.interceptor.js";
import { UploadsController } from "./uploads.controller.js";
import { UploadsService } from "./uploads.service.js";

@Module({
  controllers: [UploadsController],
  imports: [AuthModule, DatabaseModule, DiscussionModule],
  providers: [MgrUploadsMultipartInterceptor, UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
