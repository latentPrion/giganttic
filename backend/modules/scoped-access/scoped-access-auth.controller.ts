import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import {
  loginResponseSchema,
  scopedAccessTokenLoginRequestSchema,
} from "../auth/auth.contracts.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { ScopedAccessService } from "./scoped-access.service.js";

@Controller("auth/login")
export class ScopedAccessAuthController {
  constructor(
    @Inject(ScopedAccessService)
    private readonly scopedAccessService: ScopedAccessService,
  ) {}

  @Post("scoped-access-token")
  loginWithScopedAccessToken(
    @Body(new ZodValidationPipe(scopedAccessTokenLoginRequestSchema)) body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const { token } = scopedAccessTokenLoginRequestSchema.parse(body);
    return loginResponseSchema.parse(
      this.scopedAccessService.redeemToken(
        token,
        {
          ipAddress: request.ip ?? request.socket?.remoteAddress ?? "unknown",
          location: null,
        },
      ),
    );
  }
}
