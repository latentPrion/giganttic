import React from "react";
import { useSearchParams } from "react-router-dom";

import { parseOrganizationIdFromSearchParameters } from "../contracts/route-query.contracts.js";
import { ProjectManagerOrganizationPage } from "../pages/ProjectManagerOrganizationPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function OrganizationRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId, currentUserRoles) => (
        <ProjectManagerOrganizationPage
          currentUserId={currentUserId}
          currentUserRoles={currentUserRoles}
          organizationId={parseOrganizationIdFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
