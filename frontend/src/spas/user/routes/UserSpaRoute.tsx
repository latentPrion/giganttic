import React from "react";
import { useSearchParams } from "react-router-dom";

import {
  parseUserCredentialsTab,
  parseUserIdFromSearchParameters,
  parseUserTopTab,
} from "../contracts/user-route.contracts.js";
import { UserSpaPage } from "../pages/UserSpaPage.js";
import { UserAuthenticatedRoute } from "./UserAuthenticatedRoute.js";

export function UserSpaRoute() {
  const [searchParameters] = useSearchParams();

  const userId = parseUserIdFromSearchParameters(searchParameters);
  const topTab = parseUserTopTab(searchParameters);
  const credentialsTab = parseUserCredentialsTab(searchParameters);

  return (
    <UserAuthenticatedRoute>
      {(token, currentUserId, currentUserRoles) => (
        <UserSpaPage
          credentialsTab={credentialsTab}
          currentUserId={currentUserId}
          currentUserRoles={currentUserRoles}
          token={token}
          topTab={topTab}
          userId={userId}
        />
      )}
    </UserAuthenticatedRoute>
  );
}
