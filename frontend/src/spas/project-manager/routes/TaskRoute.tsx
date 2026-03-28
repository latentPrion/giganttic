import React from "react";
import { useSearchParams } from "react-router-dom";

import {
  parseProjectIdFromSearchParameters,
  parseTaskCommentIdFromSearchParameters,
  parseTaskIdFromSearchParameters,
  parseTaskTabFromSearchParameters,
} from "../contracts/route-query.contracts.js";
import { ProjectManagerTaskPage } from "../pages/ProjectManagerTaskPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function TaskRoute() {
  const [searchParameters] = useSearchParams();

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId) => (
        <ProjectManagerTaskPage
          commentId={parseTaskCommentIdFromSearchParameters(searchParameters)}
          currentUserId={currentUserId}
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          taskId={parseTaskIdFromSearchParameters(searchParameters)}
          taskTab={parseTaskTabFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
