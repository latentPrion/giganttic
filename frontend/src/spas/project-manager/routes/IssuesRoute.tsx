import React from "react";
import { useSearchParams } from "react-router-dom";
import { parseProjectIdFromSearchParameters } from "../contracts/route-query.contracts.js";
import { ProjectManagerIssuesPage } from "../pages/ProjectManagerIssuesPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function IssuesRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token) => (
        <ProjectManagerIssuesPage
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
