import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  parseProjectIdFromSearchParameters,
  parseProjectViewFromSearchParameters,
} from "../contracts/route-query.contracts.js";
import { ProjectManagerProjectPage } from "../pages/ProjectManagerProjectPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function ProjectRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token) => (
        <ProjectManagerProjectPage
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
          viewMode={parseProjectViewFromSearchParameters(searchParameters)}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
