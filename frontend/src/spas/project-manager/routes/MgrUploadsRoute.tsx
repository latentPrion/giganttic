import React from "react";

import { ProjectManagerMgrUploadsPage } from "../pages/ProjectManagerMgrUploadsPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function MgrUploadsRoute() {
  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, _currentUserId, _currentUserRoles) => (
        <ProjectManagerMgrUploadsPage token={token} />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
