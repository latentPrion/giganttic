import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { scopedTokensApi } from "../api/scoped-tokens-api.js";
import type { ScopedAccessToken } from "../contracts/scoped-token.contracts.js";
import { createUserRoute } from "../routes/user-route-paths.js";

interface ScopedTokenEditorProps {
  token: string;
  tokenCredential: ScopedAccessToken | null;
  userId: number;
}

export function ScopedTokenEditor(props: ScopedTokenEditorProps) {
  const navigate = useNavigate();
  const [projectIdInput, setProjectIdInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const projectScopes = useMemo(
    () => props.tokenCredential?.scopes.filter((scope) =>
      scope.objectTypeCode === "SCOPED_ACCESS_OBJECT_TYPE_PROJECT"
    ) ?? [],
    [props.tokenCredential],
  );

  if (!props.tokenCredential) {
    return <Alert severity="warning">Scoped token not found.</Alert>;
  }
  const tokenCredential = props.tokenCredential;

  async function handleAddProjectScope(): Promise<void> {
    const projectId = Number(projectIdInput);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      setErrorMessage("Enter a valid project id.");
      return;
    }

    try {
      await scopedTokensApi.addProjectScope(props.token, tokenCredential.id, projectId);
      setSuccessMessage("Project scope added.");
      navigate(createUserRoute(props.userId, "credentials", "scoped-access-tokens"));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to add project scope."));
    }
  }

  async function handleRemoveProjectScope(projectId: number): Promise<void> {
    try {
      await scopedTokensApi.removeProjectScope(props.token, tokenCredential.id, projectId);
      setSuccessMessage("Project scope removed.");
      navigate(createUserRoute(props.userId, "credentials", "scoped-access-tokens"));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, "Unable to remove project scope."));
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Scoped Token #{tokenCredential.id}</Typography>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      <Stack direction="row" spacing={1.25}>
        <TextField
          label="Project ID"
          onChange={(event) => setProjectIdInput(event.target.value)}
          size="small"
          value={projectIdInput}
        />
        <Button onClick={() => void handleAddProjectScope()} variant="contained">
          Add Project Scope
        </Button>
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {projectScopes.map((scope) => (
          <Chip
            key={scope.objectId}
            label={`Project ${scope.objectId}`}
            onDelete={() => void handleRemoveProjectScope(scope.objectId)}
          />
        ))}
      </Stack>
      <Button
        onClick={() => navigate(createUserRoute(props.userId, "credentials", "scoped-access-tokens"))}
        variant="text"
      >
        Back to tokens
      </Button>
    </Stack>
  );
}
