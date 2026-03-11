import { Inject, Injectable } from "@nestjs/common";

import { AuthService } from "./auth.service.js";

@Injectable()
export class AuthReferenceDataService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async ensureReferenceData(): Promise<void> {
    await this.authService.ensureReferenceData();
  }
}
