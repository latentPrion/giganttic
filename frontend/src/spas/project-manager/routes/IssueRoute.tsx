import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  parseIssueIdFromSearchParameters,
  parseProjectIdFromSearchParameters,
} from "../contracts/route-query.contracts.js";
import { ProjectManagerIssuePage } from "../pages/ProjectManagerIssuePage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function IssueRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token) => (
        <ProjectManagerIssuePage
          issueId={parseIssueIdFromSearchParameters(searchParameters)}
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
