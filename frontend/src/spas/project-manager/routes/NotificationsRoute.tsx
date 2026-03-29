import React from "react";

import { ProjectManagerNotificationsPage } from "../pages/ProjectManagerNotificationsPage.js";
import { ProjectManagerAuthenticatedRoute } from "./ProjectManagerAuthenticatedRoute.js";

export function NotificationsRoute() {
  return (
    <ProjectManagerAuthenticatedRoute>
      {(token, currentUserId, currentUserRoles) => (
        <ProjectManagerNotificationsPage
          currentUserId={currentUserId}
          currentUserRoles={currentUserRoles}
          token={token}
        />
      )}
    </ProjectManagerAuthenticatedRoute>
  );
}
