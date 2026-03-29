import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  parseIssueCommentIdFromSearchParameters,
  parseIssueIdFromSearchParameters,
  parseIssueTabFromSearchParameters,
  parseProjectIdFromSearchParameters,
} from "../contracts/route-query.contracts.js";
import { inferIssueTabFromAnchor } from "../lib/detail-section-anchor-routing.js";
import { ProjectManagerIssuePage } from "../pages/ProjectManagerIssuePage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function IssueRoute() {
  const location = useLocation();
  const [searchParameters] = useSearchParams();
  const inferredTab = inferIssueTabFromAnchor(location.hash);

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId) => (
        <ProjectManagerIssuePage
          commentId={parseIssueCommentIdFromSearchParameters(searchParameters)}
          currentUserId={currentUserId}
          issueId={parseIssueIdFromSearchParameters(searchParameters)}
          issueTab={inferredTab ?? parseIssueTabFromSearchParameters(searchParameters)}
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
