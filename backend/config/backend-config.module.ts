import { Global, Module, type DynamicModule } from "@nestjs/common";

import {
  BACKEND_CONFIG,
  type BackendConfig,
  buildBackendConfig,
} from "./backend-config.js";

@Global()
@Module({})
export class BackendConfigModule {
  static forRoot(config: Partial<BackendConfig> = {}): DynamicModule {
    const resolvedConfig = buildBackendConfig(config);

    return {
      module: BackendConfigModule,
      providers: [
        {
          provide: BACKEND_CONFIG,
          useValue: resolvedConfig,
        },
      ],
      exports: [BACKEND_CONFIG],
    };
  }
}
