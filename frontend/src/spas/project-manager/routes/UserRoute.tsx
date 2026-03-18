import React from "react";
import { useSearchParams } from "react-router-dom";

import { useSessionManager } from "../../../common/session/hooks/useSessionManager.js";
import { parseUserIdFromSearchParameters } from "../contracts/route-query.contracts.js";
import { ProjectManagerUserPage } from "../pages/ProjectManagerUserPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function UserRoute() {
  const [searchParameters] = useSearchParams();
  const { actions } = useSessionManager();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId, currentUserRoles) => (
        <ProjectManagerUserPage
          currentUserId={currentUserId}
          currentUserRoles={currentUserRoles}
          onSelfPasswordRevoked={actions.logout}
          token={token}
          userId={parseUserIdFromSearchParameters(searchParameters)}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
