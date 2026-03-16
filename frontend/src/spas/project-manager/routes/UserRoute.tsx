import React from "react";
import { useSearchParams } from "react-router-dom";

import { parseUserIdFromSearchParameters } from "../contracts/route-query.contracts.js";
import { ProjectManagerUserPage } from "../pages/ProjectManagerUserPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function UserRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token) => (
        <ProjectManagerUserPage
          token={token}
          userId={parseUserIdFromSearchParameters(searchParameters)}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
