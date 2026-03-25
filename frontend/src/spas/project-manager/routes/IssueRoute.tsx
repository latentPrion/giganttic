import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  parseIssueCommentIdFromSearchParameters,
  parseIssueIdFromSearchParameters,
  parseIssueTabFromSearchParameters,
  parseProjectIdFromSearchParameters,
} from "../contracts/route-query.contracts.js";
import { ProjectManagerIssuePage } from "../pages/ProjectManagerIssuePage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function IssueRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId) => (
        <ProjectManagerIssuePage
          commentId={parseIssueCommentIdFromSearchParameters(searchParameters)}
          currentUserId={currentUserId}
          issueId={parseIssueIdFromSearchParameters(searchParameters)}
          issueTab={parseIssueTabFromSearchParameters(searchParameters)}
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
