import React, { useEffect } from "react";
import { Alert, CircularProgress, Stack, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PROJECT_MANAGER_ROUTE_PATH } from "../../../../../common/routes/app-route-paths.js";
import { getApiErrorMessage } from "../../api/api-error.js";
import { useAuthSessionContext } from "../context/AuthSessionContext.js";

export function ScopedAccessTokenLoginRoute() {
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const { actions } = useAuthSessionContext();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scopedAccessToken = searchParameters.get("token")?.trim() ?? "";

    if (!scopedAccessToken) {
      setErrorMessage("Missing scoped access token query parameter.");
      return;
    }

    async function redeemScopedAccessToken(): Promise<void> {
      try {
        await actions.loginWithScopedAccessToken(scopedAccessToken);
        if (!cancelled) {
          navigate(PROJECT_MANAGER_ROUTE_PATH, { replace: true });
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getApiErrorMessage(error, "Unable to redeem scoped access token."));
        }
      }
    }

    void redeemScopedAccessToken();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack spacing={1.5}>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {!errorMessage ? (
        <Stack alignItems="center" direction="row" spacing={1}>
          <CircularProgress size={20} />
          <Typography>Signing in with scoped access token...</Typography>
        </Stack>
      ) : null}
    </Stack>
  );
}
