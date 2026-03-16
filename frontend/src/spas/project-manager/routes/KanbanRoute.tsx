import React from "react";
import { useSearchParams } from "react-router-dom";

import { parseProjectIdFromSearchParameters } from "../contracts/route-query.contracts.js";
import { ProjectManagerKanbanPage } from "../pages/ProjectManagerKanbanPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function KanbanRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token) => (
        <ProjectManagerKanbanPage
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
