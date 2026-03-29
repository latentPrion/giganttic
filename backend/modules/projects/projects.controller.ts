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
  Res,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import {
  getDiscussionJournalResponseSchema,
  upsertDiscussionJournalRequestSchema,
} from "../../../common/discussion/discussion-journal.contracts.js";
import {
  createProjectRequestSchema,
  createProjectResponseSchema,
  deleteProjectResponseSchema,
  getProjectResponseSchema,
  getProjectChartExportCapabilitiesResponseSchema,
  listProjectsResponseSchema,
  projectOrganizationAssociationRequestSchema,
  projectRoleAssignmentRequestSchema,
  projectTeamAssociationRequestSchema,
  projectIdParamSchema,
  updateProjectOrganizationsResponseSchema,
  updateProjectMembershipRequestSchema,
  updateProjectMembershipResponseSchema,
  updateProjectRoleAssignmentResponseSchema,
  updateProjectTeamsResponseSchema,
  updateProjectRequestSchema,
  updateProjectResponseSchema,
  updateProjectChartRequestSchema,
  updateProjectChartResponseSchema,
} from "./projects.contracts.js";
import { ProjectsService } from "./projects.service.js";

@Authenticated()
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

  @Get("chart-export-capabilities")
  getProjectChartExportCapabilities(@Req() request: AuthenticatedRequest) {
    return getProjectChartExportCapabilitiesResponseSchema.parse(
      this.projectsService.getProjectChartExportCapabilities(
        request.authContext!,
      ),
    );
  }

  @Get(":projectId/chart")
  async getProjectChart(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: { type: (contentType: string) => void },
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);
    response.type("application/xml; charset=utf-8");

    return await this.projectsService.getProjectChart(
      request.authContext!,
      projectId,
    );
  }

  @Put(":projectId/chart")
  async updateProjectChart(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateProjectChartRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);
    const { xml } = updateProjectChartRequestSchema.parse(body);

    return updateProjectChartResponseSchema.parse(
      await this.projectsService.updateProjectChart(
        request.authContext!,
        projectId,
        xml,
      ),
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

  @Get(":projectId/journal")
  async getProjectJournal(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return getDiscussionJournalResponseSchema.parse(
      await this.projectsService.getProjectJournal(request.authContext!, projectId),
    );
  }

  @Put(":projectId/journal")
  async updateProjectJournal(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(upsertDiscussionJournalRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);
    const { markdown } = upsertDiscussionJournalRequestSchema.parse(body);

    return getDiscussionJournalResponseSchema.parse(
      await this.projectsService.updateProjectJournal(
        request.authContext!,
        projectId,
        markdown,
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

  @Post(":projectId/teams")
  @HttpCode(200)
  async associateProjectTeam(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(projectTeamAssociationRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return updateProjectTeamsResponseSchema.parse(
      await this.projectsService.associateProjectTeam(
        request.authContext!,
        projectId,
        body as never,
      ),
    );
  }

  @Post(":projectId/organizations")
  @HttpCode(200)
  async associateProjectOrganization(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(projectOrganizationAssociationRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);

    return updateProjectOrganizationsResponseSchema.parse(
      await this.projectsService.associateProjectOrganization(
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
