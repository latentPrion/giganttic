import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";

import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";
import { AuthService } from "./auth.service.js";

@Injectable()
export class AuthSeedService implements OnModuleInit {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(BACKEND_CONFIG) private readonly config: BackendConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.seedTestAccounts) {
      return;
    }

    await this.authService.ensureSeedData();
  }
}
