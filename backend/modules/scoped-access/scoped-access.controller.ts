import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { loginResponseSchema } from "../auth/auth.contracts.js";
import {
  addScopedAccessOrganizationScopeRequestSchema,
  addScopedAccessProjectScopeRequestSchema,
  createScopedAccessTokenRequestSchema,
  createScopedAccessTokenResponseSchema,
  listScopedAccessTokensResponseSchema,
  redeemScopedAccessTokenRequestSchema,
  revokeScopedAccessTokenResponseSchema,
  scopedAccessTokenIdParamSchema,
  scopedAccessTokenOrganizationScopeParamsSchema,
  scopedAccessTokenProjectScopeParamsSchema,
  updateScopedAccessTokenScopeResponseSchema,
} from "./scoped-access.contracts.js";
import { ScopedAccessService } from "./scoped-access.service.js";

@Controller("scoped-access")
export class ScopedAccessController {
  constructor(
    @Inject(ScopedAccessService)
    private readonly scopedAccessService: ScopedAccessService,
  ) {}

  @Authenticated()
  @Get("tokens")
  listTokens(@Req() request: AuthenticatedRequest) {
    return listScopedAccessTokensResponseSchema.parse(
      this.scopedAccessService.listTokens(request.authContext!),
    );
  }

  @Authenticated()
  @Post("tokens")
  createToken(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createScopedAccessTokenRequestSchema)) body: unknown,
  ) {
    return createScopedAccessTokenResponseSchema.parse(
      this.scopedAccessService.createToken(
        request.authContext!,
        createScopedAccessTokenRequestSchema.parse(body),
      ),
    );
  }

  @Authenticated()
  @Post("tokens/:scopedAccessTokenCredentialId/revoke")
  revokeToken(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(scopedAccessTokenIdParamSchema)) params: unknown,
  ) {
    const { scopedAccessTokenCredentialId } = scopedAccessTokenIdParamSchema.parse(params);
    return revokeScopedAccessTokenResponseSchema.parse(
      this.scopedAccessService.revokeToken(
        request.authContext!,
        scopedAccessTokenCredentialId,
      ),
    );
  }

  @Authenticated()
  @Post("tokens/:scopedAccessTokenCredentialId/scopes/projects")
  addProjectScope(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(scopedAccessTokenIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(addScopedAccessProjectScopeRequestSchema)) body: unknown,
  ) {
    const { scopedAccessTokenCredentialId } = scopedAccessTokenIdParamSchema.parse(params);
    return updateScopedAccessTokenScopeResponseSchema.parse(
      this.scopedAccessService.addProjectScope(
        request.authContext!,
        scopedAccessTokenCredentialId,
        addScopedAccessProjectScopeRequestSchema.parse(body),
      ),
    );
  }

  @Authenticated()
  @Delete("tokens/:scopedAccessTokenCredentialId/scopes/projects/:projectId")
  removeProjectScope(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(scopedAccessTokenProjectScopeParamsSchema)) params: unknown,
  ) {
    const parsedParams = scopedAccessTokenProjectScopeParamsSchema.parse(params);
    return updateScopedAccessTokenScopeResponseSchema.parse(
      this.scopedAccessService.removeProjectScope(
        request.authContext!,
        parsedParams.scopedAccessTokenCredentialId,
        parsedParams.projectId,
      ),
    );
  }

  @Authenticated()
  @Post("tokens/:scopedAccessTokenCredentialId/scopes/organizations")
  addOrganizationScope(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(scopedAccessTokenIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(addScopedAccessOrganizationScopeRequestSchema)) body: unknown,
  ) {
    const { scopedAccessTokenCredentialId } = scopedAccessTokenIdParamSchema.parse(params);
    return updateScopedAccessTokenScopeResponseSchema.parse(
      this.scopedAccessService.addOrganizationScope(
        request.authContext!,
        scopedAccessTokenCredentialId,
        addScopedAccessOrganizationScopeRequestSchema.parse(body),
      ),
    );
  }

  @Authenticated()
  @Delete("tokens/:scopedAccessTokenCredentialId/scopes/organizations/:organizationId")
  removeOrganizationScope(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(scopedAccessTokenOrganizationScopeParamsSchema)) params: unknown,
  ) {
    const parsedParams = scopedAccessTokenOrganizationScopeParamsSchema.parse(params);
    return updateScopedAccessTokenScopeResponseSchema.parse(
      this.scopedAccessService.removeOrganizationScope(
        request.authContext!,
        parsedParams.scopedAccessTokenCredentialId,
        parsedParams.organizationId,
      ),
    );
  }

  @Post("redeem")
  redeem(
    @Body(new ZodValidationPipe(redeemScopedAccessTokenRequestSchema)) body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const { token } = redeemScopedAccessTokenRequestSchema.parse(body);

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
