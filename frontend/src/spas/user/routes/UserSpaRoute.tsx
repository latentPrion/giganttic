import React, { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import {
  parseUserCredentialsTab,
  parseUserIdFromSearchParameters,
  parseUserTopTab,
} from "../contracts/user-route.contracts.js";
import { USER_ROUTE_PATH } from "../../../../../common/routes/app-route-paths.js";
import { USER_LOBBY_PATH, isUserLobbyPath } from "../routes/user-route-paths.js";
import { UserSpaPage } from "../pages/UserSpaPage.js";
import { UserAuthenticatedRoute } from "./UserAuthenticatedRoute.js";

export function UserSpaRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();

  const lobbyPath = isUserLobbyPath(location.pathname);
  const parsedUserId = parseUserIdFromSearchParameters(searchParameters);
  const topTab = parseUserTopTab(searchParameters, location.pathname);
  const credentialsTab = parseUserCredentialsTab(searchParameters);

  useEffect(() => {
    if (location.pathname === USER_ROUTE_PATH && searchParameters.toString() === "") {
      navigate(USER_LOBBY_PATH, { replace: true });
    }
  }, [location.pathname, navigate, searchParameters]);

  return (
    <UserAuthenticatedRoute>
      {(token, currentUserId, currentUserRoles, isScopedAccessSession) => {
        const effectiveUserId = lobbyPath ? currentUserId : parsedUserId;
        return (
          <UserSpaPage
            credentialsTab={credentialsTab}
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
            isScopedAccessSession={isScopedAccessSession}
            token={token}
            topTab={topTab}
            userId={effectiveUserId}
          />
        );
      }}
    </UserAuthenticatedRoute>
  );
}
