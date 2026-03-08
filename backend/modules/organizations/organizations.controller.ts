import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { BearerAuthGuard } from "../auth/auth.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import {
  assignOrganizationTeamRequestSchema,
  createOrganizationRequestSchema,
  createOrganizationResponseSchema,
  deleteOrganizationResponseSchema,
  getOrganizationResponseSchema,
  listOrganizationsResponseSchema,
  organizationIdParamSchema,
  organizationRoleAssignmentRequestSchema,
  updateOrganizationProjectsRequestSchema,
  updateOrganizationProjectsResponseSchema,
  updateOrganizationResponseSchema,
  updateOrganizationRoleAssignmentResponseSchema,
  updateOrganizationTeamsResponseSchema,
  updateOrganizationRequestSchema,
  updateOrganizationUsersRequestSchema,
  updateOrganizationUsersResponseSchema,
} from "./organizations.contracts.js";
import { OrganizationsService } from "./organizations.service.js";

@UseGuards(BearerAuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(
    @Inject(OrganizationsService)
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post()
  async createOrganization(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createOrganizationRequestSchema)) body: unknown,
  ) {
    return createOrganizationResponseSchema.parse(
      await this.organizationsService.createOrganization(
        request.authContext!,
        body as never,
      ),
    );
  }

  @Get()
  listOrganizations(@Req() request: AuthenticatedRequest) {
    return listOrganizationsResponseSchema.parse(
      this.organizationsService.listOrganizations(request.authContext!),
    );
  }

  @Get(":organizationId")
  getOrganization(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(organizationIdParamSchema)) params: unknown,
  ) {
    const { organizationId } = organizationIdParamSchema.parse(params);

    return getOrganizationResponseSchema.parse(
      this.organizationsService.getOrganization(
        request.authContext!,
        organizationId,
      ),
    );
  }

  @Patch(":organizationId")
  async updateOrganization(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(organizationIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateOrganizationRequestSchema)) body: unknown,
  ) {
    const { organizationId } = organizationIdParamSchema.parse(params);

    return updateOrganizationResponseSchema.parse(
      await this.organizationsService.updateOrganization(
        request.authContext!,
        organizationId,
        body as never,
      ),
    );
  }

  @Put(":organizationId/users")
  async replaceOrganizationUsers(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(organizationIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateOrganizationUsersRequestSchema)) body: unknown,
  ) {
    const { organizationId } = organizationIdParamSchema.parse(params);

    return updateOrganizationUsersResponseSchema.parse(
      await this.organizationsService.replaceOrganizationUsers(
        request.authContext!,
        organizationId,
        body as never,
      ),
    );
  }

  @Put(":organizationId/projects")
  async replaceOrganizationProjects(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(organizationIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateOrganizationProjectsRequestSchema)) body: unknown,
  ) {
    const { organizationId } = organizationIdParamSchema.parse(params);

    return updateOrganizationProjectsResponseSchema.parse(
      await this.organizationsService.replaceOrganizationProjects(
        request.authContext!,
        organizationId,
        body as never,
      ),
    );
  }

  @Post(":organizationId/teams")
  @HttpCode(200)
  async assignTeam(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(organizationIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(assignOrganizationTeamRequestSchema)) body: unknown,
  ) {
    const { organizationId } = organizationIdParamSchema.parse(params);

    return updateOrganizationTeamsResponseSchema.parse(
      await this.organizationsService.assignTeam(
        request.authContext!,
        organizationId,
        body as never,
      ),
    );
  }

  @Post(":organizationId/roles/grant")
  @HttpCode(200)
  async grantOrganizationRole(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(organizationIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(organizationRoleAssignmentRequestSchema)) body: unknown,
  ) {
    const { organizationId } = organizationIdParamSchema.parse(params);

    return updateOrganizationRoleAssignmentResponseSchema.parse(
      await this.organizationsService.grantOrganizationRole(
        request.authContext!,
        organizationId,
        body as never,
      ),
    );
  }

  @Post(":organizationId/roles/revoke")
  @HttpCode(200)
  async revokeOrganizationRole(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(organizationIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(organizationRoleAssignmentRequestSchema)) body: unknown,
  ) {
    const { organizationId } = organizationIdParamSchema.parse(params);

    return updateOrganizationRoleAssignmentResponseSchema.parse(
      await this.organizationsService.revokeOrganizationRole(
        request.authContext!,
        organizationId,
        body as never,
      ),
    );
  }

  @Delete(":organizationId")
  async deleteOrganization(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(organizationIdParamSchema)) params: unknown,
  ) {
    const { organizationId } = organizationIdParamSchema.parse(params);

    return deleteOrganizationResponseSchema.parse(
      await this.organizationsService.deleteOrganization(
        request.authContext!,
        organizationId,
      ),
    );
  }
}
