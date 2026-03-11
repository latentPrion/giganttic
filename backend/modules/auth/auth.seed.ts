import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";

import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";
import { TestDataService } from "../test-data/test-data.service.js";
import { AuthReferenceDataService } from "./auth-reference-data.service.js";

@Injectable()
export class AuthSeedService implements OnModuleInit {
  constructor(
    @Inject(AuthReferenceDataService)
    private readonly authReferenceDataService: AuthReferenceDataService,
    @Inject(TestDataService)
    private readonly testDataService: TestDataService,
    @Inject(BACKEND_CONFIG) private readonly config: BackendConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.ensureReferenceData) {
      await this.authReferenceDataService.ensureReferenceData();
    }

    if (this.config.seedTestAccounts) {
      await this.testDataService.ensureTestData();
    }

    if (
      this.config.failIfTestDataPresent
      && await this.testDataService.hasTestData()
    ) {
      throw new Error("Test data is present but forbidden by backend config.");
    }
  }
}
