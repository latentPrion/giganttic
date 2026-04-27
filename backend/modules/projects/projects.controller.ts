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
  createProjectChartRequestSchema,
  createProjectChartResponseSchema,
  createProjectRequestSchema,
  createProjectResponseSchema,
  deleteProjectResponseSchema,
  getProjectResponseSchema,
  getProjectChartExportCapabilitiesResponseSchema,
  listProjectChartsResponseSchema,
  listProjectsResponseSchema,
  projectChartRouteParamsSchema,
  projectOrganizationAssociationRequestSchema,
  projectRoleAssignmentRequestSchema,
  projectTeamAssociationRequestSchema,
  projectIdParamSchema,
  updateProjectChartMetadataRequestSchema,
  updateProjectChartMetadataResponseSchema,
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

  @Get(":projectId/charts")
  listProjectCharts(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);
    return listProjectChartsResponseSchema.parse(
      this.projectsService.listProjectCharts(request.authContext!, projectId),
    );
  }

  @Post(":projectId/charts")
  async createProjectChart(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(createProjectChartRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIdParamSchema.parse(params);
    return createProjectChartResponseSchema.parse(
      await this.projectsService.createProjectChart(
        request.authContext!,
        projectId,
        createProjectChartRequestSchema.parse(body),
      ),
    );
  }

  @Get(":projectId/charts/:chartId")
  async getProjectChart(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: { type: (contentType: string) => void },
    @Param(new ZodValidationPipe(projectChartRouteParamsSchema)) params: unknown,
  ) {
    const { chartId, projectId } = projectChartRouteParamsSchema.parse(params);
    response.type("application/xml; charset=utf-8");

    return await this.projectsService.getProjectChart(
      request.authContext!,
      projectId,
      chartId,
    );
  }

  @Put(":projectId/charts/:chartId")
  async updateProjectChart(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectChartRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateProjectChartRequestSchema)) body: unknown,
  ) {
    const { chartId, projectId } = projectChartRouteParamsSchema.parse(params);
    const { xml } = updateProjectChartRequestSchema.parse(body);

    return updateProjectChartResponseSchema.parse(
      await this.projectsService.updateProjectChart(
        request.authContext!,
        projectId,
        chartId,
        xml,
      ),
    );
  }

  @Patch(":projectId/charts/:chartId")
  async updateProjectChartMetadata(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectChartRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateProjectChartMetadataRequestSchema)) body: unknown,
  ) {
    const { chartId, projectId } = projectChartRouteParamsSchema.parse(params);
    return updateProjectChartMetadataResponseSchema.parse(
      await this.projectsService.updateProjectChartMetadata(
        request.authContext!,
        projectId,
        chartId,
        updateProjectChartMetadataRequestSchema.parse(body),
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
