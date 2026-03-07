import { Module, type DynamicModule } from "@nestjs/common";

import { type BackendConfig } from "./config/backend-config.js";
import { BackendConfigModule } from "./config/backend-config.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { DatabaseModule } from "./modules/database/database.module.js";

@Module({})
export class AppModule {
  static register(config: Partial<BackendConfig> = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        BackendConfigModule.forRoot(config),
        DatabaseModule,
        AuthModule,
      ],
    };
  }
}
