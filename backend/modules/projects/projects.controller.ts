import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Get,
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
  createProjectRequestSchema,
  createProjectResponseSchema,
  deleteProjectResponseSchema,
  getProjectResponseSchema,
  listProjectsResponseSchema,
  projectRoleAssignmentRequestSchema,
  projectIdParamSchema,
  updateProjectMembershipRequestSchema,
  updateProjectMembershipResponseSchema,
  updateProjectRoleAssignmentResponseSchema,
  updateProjectRequestSchema,
  updateProjectResponseSchema,
} from "./projects.contracts.js";
import { ProjectsService } from "./projects.service.js";

@UseGuards(BearerAuthGuard)
@Controller("projects")
export class ProjectsController {
  constructor(
    @Inject(ProjectsService)
    private readonly projectsService: ProjectsService,
  ) {}

  @Post()
  async createProject(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createProjectRequestSchema)) body: unknown,
  ) {
    return createProjectResponseSchema.parse(
      await this.projectsService.createProject(
        request.authContext!,
        body as never,
      ),
    );
  }

  @Get()
  listProjects(@Req() request: AuthenticatedRequest) {
    return listProjectsResponseSchema.parse(
      this.projectsService.listProjects(request.authContext!),
    );
  }

  @Get(":projectId")
  getProject(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return getProjectResponseSchema.parse(
      this.projectsService.getProject(request.authContext!, projectId),
    );
  }

  @Patch(":projectId")
  async updateProject(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateProjectRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return updateProjectResponseSchema.parse(
      await this.projectsService.updateProject(
        request.authContext!,
        projectId,
        body as never,
      ),
    );
  }

  @Put(":projectId/members")
  async replaceProjectMembers(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateProjectMembershipRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return updateProjectMembershipResponseSchema.parse(
      await this.projectsService.replaceProjectMembers(
        request.authContext!,
        projectId,
        body as never,
      ),
    );
  }

  @Post(":projectId/roles/grant")
  @HttpCode(200)
  async grantProjectRole(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(projectRoleAssignmentRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return updateProjectRoleAssignmentResponseSchema.parse(
      await this.projectsService.grantProjectRole(
        request.authContext!,
        projectId,
        body as never,
      ),
    );
  }

  @Post(":projectId/roles/revoke")
  @HttpCode(200)
  async revokeProjectRole(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(projectRoleAssignmentRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return updateProjectRoleAssignmentResponseSchema.parse(
      await this.projectsService.revokeProjectRole(
        request.authContext!,
        projectId,
        body as never,
      ),
    );
  }

  @Delete(":projectId")
  async deleteProject(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return deleteProjectResponseSchema.parse(
      await this.projectsService.deleteProject(
        request.authContext!,
        projectId,
      ),
    );
  }
}
