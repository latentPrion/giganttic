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
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import {
  getDiscussionJournalResponseSchema,
  upsertDiscussionJournalRequestSchema,
} from "../../../common/discussion/discussion-journal.contracts.js";
import {
  createIssueRequestSchema,
  createIssueResponseSchema,
  deleteIssueResponseSchema,
  getIssueResponseSchema,
  issueRouteParamsSchema,
  listIssuesResponseSchema,
  projectIssueRouteParamsSchema,
  updateIssueRequestSchema,
  updateIssueResponseSchema,
} from "./issues.contracts.js";
import { IssuesService } from "./issues.service.js";

@Authenticated()
@Controller("projects/:projectId/issues")
export class IssuesController {
  constructor(
    @Inject(IssuesService)
    private readonly issuesService: IssuesService,
  ) {}

  @Post()
  async createIssue(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIssueRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(createIssueRequestSchema)) body: unknown,
  ) {
    const { projectId } = projectIssueRouteParamsSchema.parse(params);

    return createIssueResponseSchema.parse(
      await this.issuesService.createIssue(
        request.authContext!,
        projectId,
        body as never,
      ),
    );
  }

  @Get()
  listIssues(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(projectIssueRouteParamsSchema)) params: unknown,
  ) {
    const { projectId } = projectIssueRouteParamsSchema.parse(params);

    return listIssuesResponseSchema.parse(
      this.issuesService.listIssues(request.authContext!, projectId),
    );
  }

  @Get(":issueId")
  getIssue(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueRouteParamsSchema)) params: unknown,
  ) {
    const { issueId, projectId } = issueRouteParamsSchema.parse(params);

    return getIssueResponseSchema.parse(
      this.issuesService.getIssue(request.authContext!, projectId, issueId),
    );
  }

  @Patch(":issueId")
  async updateIssue(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(updateIssueRequestSchema)) body: unknown,
  ) {
    const { issueId, projectId } = issueRouteParamsSchema.parse(params);

    return updateIssueResponseSchema.parse(
      await this.issuesService.updateIssue(
        request.authContext!,
        projectId,
        issueId,
        body as never,
      ),
    );
  }

  @Get(":issueId/journal")
  async getIssueJournal(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueRouteParamsSchema)) params: unknown,
  ) {
    const { issueId, projectId } = issueRouteParamsSchema.parse(params);

    return getDiscussionJournalResponseSchema.parse(
      await this.issuesService.getIssueJournal(
        request.authContext!,
        projectId,
        issueId,
      ),
    );
  }

  @Put(":issueId/journal")
  async updateIssueJournal(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueRouteParamsSchema)) params: unknown,
    @Body(new ZodValidationPipe(upsertDiscussionJournalRequestSchema)) body: unknown,
  ) {
    const { issueId, projectId } = issueRouteParamsSchema.parse(params);
    const { markdown } = upsertDiscussionJournalRequestSchema.parse(body);

    return getDiscussionJournalResponseSchema.parse(
      await this.issuesService.updateIssueJournal(
        request.authContext!,
        projectId,
        issueId,
        markdown,
      ),
    );
  }

  @Delete(":issueId")
  async deleteIssue(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(issueRouteParamsSchema)) params: unknown,
  ) {
    const { issueId, projectId } = issueRouteParamsSchema.parse(params);

    return deleteIssueResponseSchema.parse(
      await this.issuesService.deleteIssue(
        request.authContext!,
        projectId,
        issueId,
      ),
    );
  }
}
