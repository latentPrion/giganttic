import React from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import {
  parseChartIdFromSearchParameters,
  parseProjectIdFromSearchParameters,
  parseTaskCommentIdFromSearchParameters,
  parseTaskIdFromSearchParameters,
  parseTaskTabFromSearchParameters,
} from "../contracts/route-query.contracts.js";
import { inferTaskTabFromAnchor } from "../lib/detail-section-anchor-routing.js";
import { ProjectManagerTaskPage } from "../pages/ProjectManagerTaskPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function TaskRoute() {
  const location = useLocation();
  const [searchParameters] = useSearchParams();
  const inferredTab = inferTaskTabFromAnchor(location.hash);

  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId) => (
        <ProjectManagerTaskPage
          chartId={parseChartIdFromSearchParameters(searchParameters)}
          commentId={parseTaskCommentIdFromSearchParameters(searchParameters)}
          currentUserId={currentUserId}
          projectId={parseProjectIdFromSearchParameters(searchParameters)}
          taskId={parseTaskIdFromSearchParameters(searchParameters)}
          taskTab={inferredTab ?? parseTaskTabFromSearchParameters(searchParameters)}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
