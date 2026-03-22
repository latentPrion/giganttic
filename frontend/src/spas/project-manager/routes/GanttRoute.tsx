import React from "react";
import { useSearchParams } from "react-router-dom";
import { parseProjectIdFromSearchParameters } from "../contracts/route-query.contracts.js";
import { ProjectManagerGanttPage } from "../pages/ProjectManagerGanttPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function GanttRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId, currentUserRoles) => (
        <ProjectManagerGanttPage
          currentUserId={currentUserId}
          currentUserRoles={currentUserRoles}
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
