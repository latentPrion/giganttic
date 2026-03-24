import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { OrganizationListItem } from "../../../common/components/entity-list/OrganizationListItem.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import { TeamListItem } from "../../../common/components/entity-list/TeamListItem.js";
import { TokenItemList } from "../../../common/components/entity-list/TokenItemList.js";
import { TokenListItem } from "../../../common/components/entity-list/TokenListItem.js";
import { TokenObjectItemList } from "../../../common/components/entity-list/TokenObjectItemList.js";
import { TokenObjectListItem } from "../../../common/components/entity-list/TokenObjectListItem.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type {
  GetUserResponse,
  LobbyProject,
} from "../../../lobby/contracts/lobby.contracts.js";
import { UserPasswordChangeModal } from "../../project-manager/components/users/UserPasswordChangeModal.js";
import {
  createProjectDetailRoute,
  createProjectManagerOrganizationRoute,
  createProjectManagerTeamRoute,
} from "../../project-manager/routes/project-route-paths.js";
import { scopedTokensApi } from "../api/scoped-tokens-api.js";
import type { ScopedAccessToken } from "../contracts/scoped-token.contracts.js";
import { UserCredentialsTabs } from "../components/UserCredentialsTabs.js";
import { UserTopNavigation } from "../components/UserTopNavigation.js";
import {
  type UserCredentialsTab,
  type UserTopTab,
  createUserRoute,
} from "../routes/user-route-paths.js";

interface UserSpaPageProps {
  credentialsTab: UserCredentialsTab;
  currentUserId: number;
  currentUserRoles: string[];
  onSelfPasswordRevoked?(): Promise<void>;
  token: string;
  topTab: UserTopTab;
  userId: number | null;
}

const SYSTEM_ADMIN_ROLE_CODE = "GGTC_SYSTEMROLE_ADMIN";
const ASSOCIATIONS_LIST_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const TOKEN_LIST_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const TOKEN_SCOPE_TAB_VALUES = [
  "currently-accessible-objects",
  "projects",
  "teams",
  "organizations",
] as const;
type TokenScopeTab = typeof TOKEN_SCOPE_TAB_VALUES[number];

export function UserSpaPage(props: UserSpaPageProps) {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(props.userId !== null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const [tokenActionError, setTokenActionError] = useState<string | null>(null);
  const [tokenActionSuccess, setTokenActionSuccess] = useState<string | null>(null);
  const [tokenIssueMessage, setTokenIssueMessage] = useState<string | null>(null);
  const [retainedMintedTokenValues, setRetainedMintedTokenValues] = useState<Record<number, string>>({});
  const [isMintedTokenModalOpen, setIsMintedTokenModalOpen] = useState(false);
  const [mintedTokenModalValue, setMintedTokenModalValue] = useState<string | null>(null);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [scopeModalTokenId, setScopeModalTokenId] = useState<number | null>(null);
  const [scopeModalTab, setScopeModalTab] = useState<TokenScopeTab>("currently-accessible-objects");
  const [selectedProjectScopeCandidate, setSelectedProjectScopeCandidate] = useState<LobbyProject | null>(null);
  const [tokens, setTokens] = useState<ScopedAccessToken[]>([]);
  const [userResponse, setUserResponse] = useState<GetUserResponse | null>(null);

  const isSelfView = props.userId !== null && props.currentUserId === props.userId;
  const resolvedTopTab: UserTopTab = !isSelfView && (props.topTab === "credentials" || props.topTab === "settings")
    ? "details"
    : props.topTab;
  const selectedScopeToken = useMemo(
    () => tokens.find((token) => token.id === scopeModalTokenId) ?? null,
    [scopeModalTokenId, tokens],
  );
  const selectedScopeProjectIds = useMemo(
    () => new Set(
      selectedScopeToken?.scopes
        .filter((scope) => scope.objectTypeCode === "SCOPED_ACCESS_OBJECT_TYPE_PROJECT")
        .map((scope) => scope.objectId) ?? [],
    ),
    [selectedScopeToken],
  );
  const selectableScopeProjects = useMemo(
    () => userResponse?.projects.filter((project) => !selectedScopeProjectIds.has(project.id)) ?? [],
    [selectedScopeProjectIds, userResponse?.projects],
  );

  useEffect(() => {
    if (props.userId === null) {
      setUserResponse(null);
      setIsLoading(false);
      return;
    }
    let isMounted = true;

    async function loadUser(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await lobbyApi.getUser(props.token, props.userId!);
        if (isMounted) {
          setUserResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getApiErrorMessage(error, "Unable to load user."));
          setUserResponse(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();
    return () => {
      isMounted = false;
    };
  }, [props.token, props.userId]);

  useEffect(() => {
    if (!isSelfView && props.userId !== null && (props.topTab === "credentials" || props.topTab === "settings")) {
      navigate(createUserRoute(props.userId, "details"), { replace: true });
    }
  }, [isSelfView, navigate, props.topTab, props.userId]);

  useEffect(() => {
    if (!isSelfView || resolvedTopTab !== "credentials" || props.credentialsTab !== "scoped-access-tokens") {
      return;
    }

    void refreshTokens();
  }, [isSelfView, props.credentialsTab, resolvedTopTab, props.token]);

  async function refreshTokens(): Promise<void> {
    setIsRefreshingTokens(true);
    setTokenIssueMessage(null);
    try {
      const response = await scopedTokensApi.listTokens(props.token);
      setTokens(response.tokenCredentials);
    } catch (error) {
      setTokenIssueMessage(getApiErrorMessage(error, "Unable to load scoped tokens."));
      setTokens([]);
    } finally {
      setIsRefreshingTokens(false);
    }
  }

  function navigateTopTab(nextTab: UserTopTab): void {
    if (props.userId === null) {
      return;
    }
    navigate(createUserRoute(props.userId, nextTab, props.credentialsTab));
  }

  function navigateCredentialsTab(nextTab: UserCredentialsTab): void {
    if (props.userId === null) {
      return;
    }
    navigate(createUserRoute(props.userId, "credentials", nextTab));
  }

  function canChangePassword(): boolean {
    return props.userId !== null && (
      props.currentUserId === props.userId ||
      props.currentUserRoles.includes(SYSTEM_ADMIN_ROLE_CODE)
    );
  }

  async function handleChangePassword(payload: {
    currentPassword?: string;
    newPassword: string;
    revokeSessions: boolean;
  }): Promise<void> {
    if (props.userId === null) {
      return;
    }

    setIsChangingPassword(true);
    try {
      await lobbyApi.changeUserPassword(props.token, props.userId, payload);
      if (payload.revokeSessions && props.currentUserId === props.userId) {
        await props.onSelfPasswordRevoked?.();
      }
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleCreateToken(): Promise<void> {
    setTokenActionError(null);
    setTokenActionSuccess(null);
    try {
      const response = await scopedTokensApi.createToken(props.token, null);
      await refreshTokens();
      setRetainedMintedTokenValues((previous) => ({
        ...previous,
        [response.tokenCredential.id]: response.token,
      }));
      setMintedTokenModalValue(response.token);
      setIsMintedTokenModalOpen(true);
      setTokenActionSuccess(`Scoped token minted (Token #${response.tokenCredential.id}).`);
    } catch (error) {
      setTokenActionError(getApiErrorMessage(error, "Unable to mint scoped token."));
    }
  }

  async function handleRevokeToken(tokenId: number): Promise<void> {
    setTokenActionError(null);
    setTokenActionSuccess(null);
    try {
      await scopedTokensApi.revokeToken(props.token, tokenId);
      await refreshTokens();
      setRetainedMintedTokenValues((previous) => {
        const next = { ...previous };
        delete next[tokenId];
        return next;
      });
      if (scopeModalTokenId === tokenId) {
        handleCloseScopeModal();
      }
      setTokenActionSuccess(`Revoked token ${tokenId}.`);
    } catch (error) {
      setTokenActionError(getApiErrorMessage(error, "Unable to revoke scoped token."));
    }
  }

  function openScopeModal(tokenId: number): void {
    setScopeModalTokenId(tokenId);
    setScopeModalTab("currently-accessible-objects");
    setSelectedProjectScopeCandidate(null);
    setIsScopeModalOpen(true);
  }

  function handleCloseScopeModal(): void {
    setIsScopeModalOpen(false);
    setScopeModalTokenId(null);
    setScopeModalTab("currently-accessible-objects");
    setSelectedProjectScopeCandidate(null);
  }

  async function handleAddProjectScopeFromModal(): Promise<void> {
    if (!selectedScopeToken || !selectedProjectScopeCandidate) {
      setTokenActionError("Select a project to add to this token scope.");
      return;
    }
    try {
      await scopedTokensApi.addProjectScope(
        props.token,
        selectedScopeToken.id,
        selectedProjectScopeCandidate.id,
      );
      await refreshTokens();
      setSelectedProjectScopeCandidate(null);
      setTokenActionSuccess(`Added project ${selectedProjectScopeCandidate.id} to token scope.`);
    } catch (error) {
      setTokenActionError(getApiErrorMessage(error, "Unable to add project scope."));
    }
  }

  async function handleRemoveScopeObject(
    objectTypeCode: string,
    objectId: number,
  ): Promise<void> {
    if (!selectedScopeToken) {
      return;
    }
    if (objectTypeCode !== "SCOPED_ACCESS_OBJECT_TYPE_PROJECT") {
      setTokenActionError("Only project scope removal is currently supported.");
      return;
    }
    try {
      await scopedTokensApi.removeProjectScope(props.token, selectedScopeToken.id, objectId);
      await refreshTokens();
      setTokenActionSuccess(`Removed project ${objectId} from token scope.`);
    } catch (error) {
      setTokenActionError(getApiErrorMessage(error, "Unable to remove project scope."));
    }
  }

  async function handleCopyTokenValue(tokenValue: string): Promise<void> {
    if (!navigator.clipboard) {
      setTokenActionError("Clipboard access is unavailable in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(tokenValue);
      setTokenActionSuccess("Token copied to clipboard.");
    } catch {
      setTokenActionError("Unable to copy token to clipboard.");
    }
  }

  function createObjectHref(objectTypeCode: string, objectId: number): string | null {
    if (objectTypeCode === "SCOPED_ACCESS_OBJECT_TYPE_PROJECT") {
      return createProjectDetailRoute(objectId);
    }
    if (objectTypeCode === "SCOPED_ACCESS_OBJECT_TYPE_TEAM") {
      return createProjectManagerTeamRoute(objectId);
    }
    if (objectTypeCode === "SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION") {
      return createProjectManagerOrganizationRoute(objectId);
    }
    return null;
  }

  function renderDetailsContent() {
    if (!userResponse) {
      return null;
    }
    return (
      <Stack spacing={0.75}>
        <Typography>User ID: {userResponse.user.id}</Typography>
        <Typography>Username: {userResponse.user.username}</Typography>
        <Typography>Active: {userResponse.user.isActive ? "Yes" : "No"}</Typography>
      </Stack>
    );
  }

  function renderAssociationsContent() {
    if (!userResponse) {
      return null;
    }
    return (
      <Stack spacing={1.25}>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Projects ({userResponse.projects.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <EntityItemList viewMode={ASSOCIATIONS_LIST_VIEW_MODE}>
              {userResponse.projects.map((project) => (
                <ProjectListItem
                  key={project.id}
                  onNavigate={() => navigate(createProjectDetailRoute(project.id))}
                  project={project}
                  viewMode={ASSOCIATIONS_LIST_VIEW_MODE}
                />
              ))}
            </EntityItemList>
          </AccordionDetails>
        </Accordion>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Teams ({userResponse.teams.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <EntityItemList viewMode={ASSOCIATIONS_LIST_VIEW_MODE}>
              {userResponse.teams.map((team) => (
                <TeamListItem
                  key={team.id}
                  onNavigate={() => navigate(createProjectManagerTeamRoute(team.id))}
                  team={team}
                  viewMode={ASSOCIATIONS_LIST_VIEW_MODE}
                />
              ))}
            </EntityItemList>
          </AccordionDetails>
        </Accordion>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Organizations ({userResponse.organizations.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <EntityItemList viewMode={ASSOCIATIONS_LIST_VIEW_MODE}>
              {userResponse.organizations.map((organization) => (
                <OrganizationListItem
                  key={organization.id}
                  onNavigate={() => navigate(createProjectManagerOrganizationRoute(organization.id))}
                  organization={organization}
                  viewMode={ASSOCIATIONS_LIST_VIEW_MODE}
                />
              ))}
            </EntityItemList>
          </AccordionDetails>
        </Accordion>
      </Stack>
    );
  }

  function renderCredentialsContent() {
    if (!isSelfView) {
      return <Alert severity="info">Credentials are only available when viewing your own profile.</Alert>;
    }

    if (props.credentialsTab === "password") {
      return (
        <Stack spacing={1.25}>
          <Typography>Update your account password.</Typography>
          <Button
            disabled={!canChangePassword() || isChangingPassword}
            onClick={() => setIsPasswordModalOpen(true)}
            variant="contained"
          >
            Change Password
          </Button>
        </Stack>
      );
    }

    if (props.credentialsTab === "passkeys") {
      return <Alert severity="info">Passkeys support is coming soon.</Alert>;
    }

    return (
      <Stack spacing={1.25}>
        <Alert severity="warning">
          Minted token values are only shown once. Copy token values immediately after minting. Reloading
          this SPA permanently loses any un-copied token values.
        </Alert>
        {tokenIssueMessage ? <Alert severity="error">{tokenIssueMessage}</Alert> : null}
        {tokenActionError ? <Alert severity="error">{tokenActionError}</Alert> : null}
        {tokenActionSuccess ? <Alert severity="success">{tokenActionSuccess}</Alert> : null}
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h6">Scoped Access Tokens</Typography>
          <Button onClick={() => void handleCreateToken()} variant="contained">
            Mint token
          </Button>
        </Stack>
        {isRefreshingTokens ? <CircularProgress size={20} /> : null}
        <TokenItemList viewMode={TOKEN_LIST_VIEW_MODE}>
          {tokens.map((tokenCredential) => (
            <TokenListItem
              key={tokenCredential.id}
              onCopyTokenValue={() => void handleCopyTokenValue(retainedMintedTokenValues[tokenCredential.id]!)}
              onEditScope={() => openScopeModal(tokenCredential.id)}
              onRevoke={() => void handleRevokeToken(tokenCredential.id)}
              retainedTokenValue={retainedMintedTokenValues[tokenCredential.id]}
              tokenCredential={tokenCredential}
              viewMode={TOKEN_LIST_VIEW_MODE}
            />
          ))}
        </TokenItemList>
      </Stack>
    );
  }

  function renderCurrentScopeObjectsTab() {
    if (!selectedScopeToken) {
      return <Alert severity="warning">Scoped token not found.</Alert>;
    }
    return (
      <TokenObjectItemList viewMode={TOKEN_LIST_VIEW_MODE}>
        {selectedScopeToken.scopes.map((scope) => (
          <TokenObjectListItem
            key={`${scope.objectTypeCode}-${scope.objectId}`}
            onDelete={() => void handleRemoveScopeObject(scope.objectTypeCode, scope.objectId)}
            renderObjectLink={(tokenScope) => {
              const objectHref = createObjectHref(tokenScope.objectTypeCode, tokenScope.objectId);
              if (!objectHref) {
                return null;
              }
              return (
                <Typography
                  color="primary"
                  component="a"
                  href={objectHref}
                  onClick={(event) => event.stopPropagation()}
                  rel="noopener noreferrer"
                  target="_blank"
                  variant="body2"
                >
                  Open in new tab
                </Typography>
              );
            }}
            tokenScope={scope}
            viewMode={TOKEN_LIST_VIEW_MODE}
          />
        ))}
      </TokenObjectItemList>
    );
  }

  function renderScopeProjectsTab() {
    if (!selectedScopeToken) {
      return <Alert severity="warning">Scoped token not found.</Alert>;
    }
    return (
      <Stack spacing={1.25}>
        <Box border={1} borderColor="divider" borderRadius={1.5} p={1.5}>
          <Stack spacing={1}>
            <Typography variant="body2">
              Add a project from your currently accessible project list.
            </Typography>
            <Autocomplete
              getOptionLabel={(option) => `${option.name} (#${option.id})`}
              onChange={(_, value) => setSelectedProjectScopeCandidate(value)}
              options={selectableScopeProjects}
              renderInput={(params) => <TextField {...params} label="Search projects" />}
              value={selectedProjectScopeCandidate}
            />
            <Button
              disabled={!selectedProjectScopeCandidate}
              onClick={() => void handleAddProjectScopeFromModal()}
              variant="contained"
            >
              Add selected project
            </Button>
          </Stack>
        </Box>
      </Stack>
    );
  }

  function renderScopeModalContent() {
    if (scopeModalTab === "currently-accessible-objects") {
      return renderCurrentScopeObjectsTab();
    }
    if (scopeModalTab === "projects") {
      return renderScopeProjectsTab();
    }
    if (scopeModalTab === "teams" || scopeModalTab === "organizations") {
      return <Alert severity="info">Coming soon.</Alert>;
    }
    return null;
  }

  function renderMainContent() {
    if (props.userId === null) {
      return <Alert severity="info">Provide a valid userId to view a user profile.</Alert>;
    }
    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.25}>
          <CircularProgress size={20} />
          <Typography>Loading user profile...</Typography>
        </Stack>
      );
    }
    if (!userResponse) {
      return <Alert severity="error">{errorMessage ?? "Unable to load user profile."}</Alert>;
    }

    switch (resolvedTopTab) {
      case "details":
        return renderDetailsContent();
      case "associations":
        return renderAssociationsContent();
      case "settings":
        return isSelfView
          ? <Alert severity="info">Settings are coming soon.</Alert>
          : <Alert severity="info">Settings are only available on your own profile.</Alert>;
      case "credentials":
        return renderCredentialsContent();
    }
  }

  return (
    <Stack spacing={2}>
      <div>
        <Typography color="text.secondary" variant="overline">User SPA</Typography>
        <Typography variant="h4">User Profile</Typography>
        <Typography color="text.secondary" variant="body2">
          Selected user: {props.userId ?? "None"}
        </Typography>
      </div>

      <UserTopNavigation
        isSelfView={isSelfView}
        onChange={navigateTopTab}
        value={resolvedTopTab}
      />

      {resolvedTopTab === "credentials" && isSelfView ? (
        <UserCredentialsTabs
          onChange={navigateCredentialsTab}
          value={props.credentialsTab}
        />
      ) : null}

      {renderMainContent()}

      <UserPasswordChangeModal
        isBusy={isChangingPassword}
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={handleChangePassword}
        requireCurrentPassword={isSelfView}
      />
      <Dialog fullWidth maxWidth="md" onClose={handleCloseScopeModal} open={isScopeModalOpen}>
        <DialogTitle>Edit Token Scope</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          <Tabs
            onChange={(_, value: TokenScopeTab) => setScopeModalTab(value)}
            value={scopeModalTab}
            variant="scrollable"
          >
            <Tab label="Currently Accessible Objects" value="currently-accessible-objects" />
            <Tab label="Projects" value="projects" />
            <Tab label="Teams" value="teams" />
            <Tab label="Organizations" value="organizations" />
          </Tabs>
          {renderScopeModalContent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseScopeModal}>Done</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={() => setIsMintedTokenModalOpen(false)}
        open={isMintedTokenModalOpen}
      >
        <DialogTitle>Scoped Token Minted</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 1.5 }}>
          <Alert severity="warning">
            Copy this token now. This value is shown once and cannot be recovered after page reload.
          </Alert>
          <TextField
            InputProps={{ readOnly: true }}
            label="Token Value"
            value={mintedTokenModalValue ?? ""}
          />
          <Button
            disabled={!mintedTokenModalValue}
            onClick={() => mintedTokenModalValue && void handleCopyTokenValue(mintedTokenModalValue)}
            variant="outlined"
          >
            Copy to clipboard
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsMintedTokenModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
