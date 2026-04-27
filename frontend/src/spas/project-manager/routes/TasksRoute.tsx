import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  parseChartIdFromSearchParameters,
  parseProjectIdFromSearchParameters,
} from "../contracts/route-query.contracts.js";
import { ProjectManagerTasksPage } from "../pages/ProjectManagerTasksPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function TasksRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token) => (
        <ProjectManagerTasksPage
          chartId={parseChartIdFromSearchParameters(searchParameters)}
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
