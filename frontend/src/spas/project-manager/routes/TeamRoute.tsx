import React from "react";
import { useSearchParams } from "react-router-dom";

import { parseTeamIdFromSearchParameters } from "../contracts/route-query.contracts.js";
import { ProjectManagerTeamPage } from "../pages/ProjectManagerTeamPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function TeamRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId, currentUserRoles) => (
        <ProjectManagerTeamPage
          currentUserId={currentUserId}
          currentUserRoles={currentUserRoles}
          teamId={parseTeamIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
