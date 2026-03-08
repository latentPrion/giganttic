import {
  Body,
  Controller,
  Delete,
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
  createTeamRequestSchema,
  createTeamResponseSchema,
  deleteTeamResponseSchema,
  getTeamResponseSchema,
  listTeamsResponseSchema,
  teamIdParamSchema,
  updateTeamMembershipRequestSchema,
  updateTeamMembershipResponseSchema,
  updateTeamRequestSchema,
  updateTeamResponseSchema,
} from "./teams.contracts.js";
import { TeamsService } from "./teams.service.js";

@UseGuards(BearerAuthGuard)
@Controller("teams")
export class TeamsController {
  constructor(@Inject(TeamsService) private readonly teamsService: TeamsService) {}

  @Post()
  async createTeam(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createTeamRequestSchema)) body: unknown,
  ) {
    return createTeamResponseSchema.parse(
      await this.teamsService.createTeam(request.authContext!, body as never),
    );
  }

  @Get()
  listTeams(@Req() request: AuthenticatedRequest) {
    return listTeamsResponseSchema.parse(
      this.teamsService.listTeams(request.authContext!),
    );
  }

  @Get(":teamId")
  getTeam(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(teamIdParamSchema)) params: unknown,
  ) {
    const { teamId } = teamIdParamSchema.parse(params);

    return getTeamResponseSchema.parse(
      this.teamsService.getTeam(request.authContext!, teamId),
    );
  }

  @Patch(":teamId")
  async updateTeam(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(teamIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateTeamRequestSchema)) body: unknown,
  ) {
    const { teamId } = teamIdParamSchema.parse(params);

    return updateTeamResponseSchema.parse(
      await this.teamsService.updateTeam(
        request.authContext!,
        teamId,
        body as never,
      ),
    );
  }

  @Put(":teamId/members")
  async replaceTeamMembers(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(teamIdParamSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateTeamMembershipRequestSchema)) body: unknown,
  ) {
    const { teamId } = teamIdParamSchema.parse(params);

    return updateTeamMembershipResponseSchema.parse(
      await this.teamsService.replaceTeamMembers(
        request.authContext!,
        teamId,
        body as never,
      ),
    );
  }

  @Delete(":teamId")
  async deleteTeam(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(teamIdParamSchema)) params: unknown,
  ) {
    const { teamId } = teamIdParamSchema.parse(params);

    return deleteTeamResponseSchema.parse(
      await this.teamsService.deleteTeam(request.authContext!, teamId),
    );
  }
}
