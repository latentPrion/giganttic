import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import {
  currentSessionResponseSchema,
  listSessionsResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
  revokeSessionsRequestSchema,
  revokeSessionsResponseSchema,
  sessionQuerySchema,
} from "./auth.contracts.js";
import { AuthService } from "./auth.service.js";
import { BearerAuthGuard } from "./auth.guard.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: unknown,
  ) {
    return registerResponseSchema.parse(
      await this.authService.register(body as never),
    );
  }

  @Post("login")
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return loginResponseSchema.parse(
      await this.authService.login(
        body as never,
        this.authService.extractRequestMetadata({
          headers: request.headers as Record<string, string | string[] | undefined>,
          ip: request.ip,
          socket: request.socket,
        }),
      ),
    );
  }

  @UseGuards(BearerAuthGuard)
  @Get("session/me")
  getCurrentSession(@Req() request: AuthenticatedRequest) {
    return currentSessionResponseSchema.parse(
      this.authService.getCurrentSession(request.authContext!),
    );
  }

  @UseGuards(BearerAuthGuard)
  @Get("session")
  listSessions(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(sessionQuerySchema)) query: unknown,
  ) {
    return listSessionsResponseSchema.parse(
      this.authService.listActiveSessions(
        request.authContext!,
        query as never,
      ),
    );
  }

  @UseGuards(BearerAuthGuard)
  @Post("session/revoke")
  async revokeSessions(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(revokeSessionsRequestSchema)) body: unknown,
  ) {
    return revokeSessionsResponseSchema.parse(
      await this.authService.revokeSessions(
        request.authContext!,
        body as never,
      ),
    );
  }
}
