import React from "react";
import { useSearchParams } from "react-router-dom";

import { parseProjectIdFromSearchParameters } from "../contracts/route-query.contracts.js";
import { ProjectManagerMgrUploadsPage } from "../pages/ProjectManagerMgrUploadsPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function MgrUploadsRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, _currentUserId, _currentUserRoles) => (
        <ProjectManagerMgrUploadsPage
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
