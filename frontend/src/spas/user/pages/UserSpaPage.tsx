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
import { authApi } from "../../../common/session/api/auth-api.js";
import { useAuthSessionContext } from "../../../common/session/context/AuthSessionContext.js";
import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { OrganizationListItem } from "../../../common/components/entity-list/OrganizationListItem.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import { SessionItemList } from "../../../common/components/entity-list/SessionItemList.js";
import { SessionListItem } from "../../../common/components/entity-list/SessionListItem.js";
import { TeamListItem } from "../../../common/components/entity-list/TeamListItem.js";
import { TokenItemList } from "../../../common/components/entity-list/TokenItemList.js";
import { TokenListItem } from "../../../common/components/entity-list/TokenListItem.js";
import { TokenObjectItemList } from "../../../common/components/entity-list/TokenObjectItemList.js";
import { TokenObjectListItem } from "../../../common/components/entity-list/TokenObjectListItem.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type {
  GetUserResponse,
  LobbyOrganization,
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
import { UserLobbyPage } from "../../../lobby/components/UserLobbyPage.js";
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
  isScopedAccessSession: boolean;
  onSelfPasswordRevoked?(): Promise<void>;
  token: string;
  topTab: UserTopTab;
  userId: number | null;
}

const SYSTEM_ADMIN_ROLE_CODE = "GGTC_SYSTEMROLE_ADMIN";
const USER_SELF_ONLY_TOP_TABS: readonly UserTopTab[] = ["credentials", "sessions", "settings"];
const ASSOCIATIONS_LIST_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const SESSION_LIST_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const TOKEN_LIST_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const TOKEN_SCOPE_TAB_VALUES = [
  "currently-accessible-objects",
  "projects",
  "teams",
  "organizations",
] as const;
type TokenScopeTab = typeof TOKEN_SCOPE_TAB_VALUES[number];
const SCOPED_ACCESS_LOGIN_PATH = "/auth/scoped-token-login";
const SCOPED_ACCESS_OBJECT_TYPE_PROJECT = "SCOPED_ACCESS_OBJECT_TYPE_PROJECT";
const SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION = "SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION";
const SCOPED_ACCESS_OBJECT_TYPE_TEAM = "SCOPED_ACCESS_OBJECT_TYPE_TEAM";

function resolveUserTopTab(
  topTab: UserTopTab,
  isSelfView: boolean,
  isScopedAccessSession: boolean,
): UserTopTab {
  if (!isSelfView && (topTab === "lobby" || USER_SELF_ONLY_TOP_TABS.includes(topTab))) {
    return "details";
  }
  if (isScopedAccessSession && USER_SELF_ONLY_TOP_TABS.includes(topTab)) {
    return "details";
  }
  return topTab;
}

export function UserSpaPage(props: UserSpaPageProps) {
  const navigate = useNavigate();
  const { actions: authActions, authState } = useAuthSessionContext();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(props.userId !== null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);
  const [tokenActionError, setTokenActionError] = useState<string | null>(null);
  const [tokenActionSuccess, setTokenActionSuccess] = useState<string | null>(null);
  const [tokenIssueMessage, setTokenIssueMessage] = useState<string | null>(null);
  const [sessionIssueMessage, setSessionIssueMessage] = useState<string | null>(null);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [sessions, setSessions] = useState<Array<import("../../../common/session/contracts/auth.contracts.js").SessionSummary>>([]);
  const [retainedMintedTokenValues, setRetainedMintedTokenValues] = useState<Record<number, string>>({});
  const [isMintedTokenModalOpen, setIsMintedTokenModalOpen] = useState(false);
  const [mintedTokenModalValue, setMintedTokenModalValue] = useState<string | null>(null);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [scopeModalTokenId, setScopeModalTokenId] = useState<number | null>(null);
  const [scopeModalTab, setScopeModalTab] = useState<TokenScopeTab>("currently-accessible-objects");
  const [selectedProjectScopeCandidate, setSelectedProjectScopeCandidate] = useState<LobbyProject | null>(null);
  const [selectedOrganizationScopeCandidate, setSelectedOrganizationScopeCandidate] = useState<LobbyOrganization | null>(
    null,
  );
  const [tokens, setTokens] = useState<ScopedAccessToken[]>([]);
  const [userResponse, setUserResponse] = useState<GetUserResponse | null>(null);

  const isSelfView = props.userId !== null && props.currentUserId === props.userId;
  const showLobbyTab = isSelfView;
  const showSelfOnlyTabs = isSelfView && !props.isScopedAccessSession;
  const resolvedTopTab: UserTopTab = resolveUserTopTab(
    props.topTab,
    isSelfView,
    props.isScopedAccessSession,
  );
  const selectedScopeToken = useMemo(
    () => tokens.find((token) => token.id === scopeModalTokenId) ?? null,
    [scopeModalTokenId, tokens],
  );
  const selectedScopeProjectIds = useMemo(
    () => new Set(
      selectedScopeToken?.scopes
        .filter((scope) => scope.objectTypeCode === SCOPED_ACCESS_OBJECT_TYPE_PROJECT)
        .map((scope) => scope.objectId) ?? [],
    ),
    [selectedScopeToken],
  );
  const selectableScopeProjects = useMemo(
    () => userResponse?.projects.filter((project) => !selectedScopeProjectIds.has(project.id)) ?? [],
    [selectedScopeProjectIds, userResponse?.projects],
  );
  const selectedScopeOrganizationIds = useMemo(
    () => new Set(
      selectedScopeToken?.scopes
        .filter((scope) => scope.objectTypeCode === SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION)
        .map((scope) => scope.objectId) ?? [],
    ),
    [selectedScopeToken],
  );
  const selectableScopeOrganizations = useMemo(
    () => userResponse?.organizations.filter((organization) => !selectedScopeOrganizationIds.has(organization.id)) ??
      [],
    [selectedScopeOrganizationIds, userResponse?.organizations],
  );

  function createScopedLoginLink(tokenValue: string): string {
    const loginPathWithQuery = `${SCOPED_ACCESS_LOGIN_PATH}?token=${encodeURIComponent(tokenValue)}`;
    if (typeof window === "undefined" || !window.location.origin) {
      return loginPathWithQuery;
    }
    return `${window.location.origin}${loginPathWithQuery}`;
  }

  useEffect(() => {
    if (props.userId === null) {
      setUserResponse(null);
      setIsLoading(false);
      return;
    }
    if (props.topTab === "lobby") {
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
  }, [props.token, props.userId, props.topTab]);

  useEffect(() => {
    if (props.userId === null) {
      return;
    }
    const nextTab = resolveUserTopTab(props.topTab, isSelfView, props.isScopedAccessSession);
    if (nextTab !== props.topTab) {
      navigate(createUserRoute(props.userId, nextTab), { replace: true });
    }
  }, [isSelfView, navigate, props.isScopedAccessSession, props.topTab, props.userId]);

  useEffect(() => {
    if (!showSelfOnlyTabs || resolvedTopTab !== "credentials" || props.credentialsTab !== "scoped-access-tokens") {
      return;
    }

    void refreshTokens();
  }, [showSelfOnlyTabs, props.credentialsTab, resolvedTopTab, props.token]);

  useEffect(() => {
    if (!showSelfOnlyTabs || resolvedTopTab !== "sessions" || props.userId === null) {
      return;
    }
    void refreshSessions();
  }, [showSelfOnlyTabs, props.token, props.userId, resolvedTopTab]);

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

  async function refreshSessions(): Promise<void> {
    if (props.userId === null) {
      return;
    }
    setIsRefreshingSessions(true);
    setSessionIssueMessage(null);
    try {
      const response = await authApi.listSessions(props.token, props.userId);
      setSessions(response.sessions);
    } catch (error) {
      setSessionIssueMessage(getApiErrorMessage(error, "Unable to load active sessions."));
      setSessions([]);
    } finally {
      setIsRefreshingSessions(false);
    }
  }

  function navigateTopTab(nextTab: UserTopTab): void {
    if (nextTab === "lobby") {
      navigate(createUserRoute(props.currentUserId, "lobby"));
      return;
    }
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

  async function handleRevokeSession(sessionId: string): Promise<void> {
    setSessionIssueMessage(null);
    try {
      await authApi.revokeCurrentSession(props.token, sessionId);
      await refreshSessions();
      setTokenActionSuccess(`Revoked session ${sessionId}.`);
    } catch (error) {
      setSessionIssueMessage(getApiErrorMessage(error, "Unable to revoke session."));
    }
  }

  async function handleRevokeAllSessions(): Promise<void> {
    setSessionIssueMessage(null);
    try {
      const allSessionIds = sessions.map((session) => session.id);
      const response = await authApi.revokeSessions(props.token, allSessionIds);
      const currentSessionId = authState.status === "authenticated" ? authState.auth.session.id : null;
      if (currentSessionId && response.revokedSessionIds.includes(currentSessionId)) {
        await authActions.logout();
        return;
      }
      await refreshSessions();
      setTokenActionSuccess("Revoked all active sessions.");
    } catch (error) {
      setSessionIssueMessage(getApiErrorMessage(error, "Unable to revoke all sessions."));
    }
  }

  function openScopeModal(tokenId: number): void {
    setScopeModalTokenId(tokenId);
    setScopeModalTab("currently-accessible-objects");
    setSelectedProjectScopeCandidate(null);
    setSelectedOrganizationScopeCandidate(null);
    setIsScopeModalOpen(true);
  }

  function handleCloseScopeModal(): void {
    setIsScopeModalOpen(false);
    setScopeModalTokenId(null);
    setScopeModalTab("currently-accessible-objects");
    setSelectedProjectScopeCandidate(null);
    setSelectedOrganizationScopeCandidate(null);
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

  async function handleAddOrganizationScopeFromModal(): Promise<void> {
    if (!selectedScopeToken || !selectedOrganizationScopeCandidate) {
      setTokenActionError("Select an organization to add to this token scope.");
      return;
    }
    try {
      await scopedTokensApi.addOrganizationScope(
        props.token,
        selectedScopeToken.id,
        selectedOrganizationScopeCandidate.id,
      );
      await refreshTokens();
      setSelectedOrganizationScopeCandidate(null);
      setTokenActionSuccess(`Added organization ${selectedOrganizationScopeCandidate.id} to token scope.`);
    } catch (error) {
      setTokenActionError(getApiErrorMessage(error, "Unable to add organization scope."));
    }
  }

  async function handleRemoveScopeObject(
    objectTypeCode: string,
    objectId: number,
  ): Promise<void> {
    if (!selectedScopeToken) {
      return;
    }
    if (objectTypeCode === SCOPED_ACCESS_OBJECT_TYPE_PROJECT) {
      try {
        await scopedTokensApi.removeProjectScope(props.token, selectedScopeToken.id, objectId);
        await refreshTokens();
        setTokenActionSuccess(`Removed project ${objectId} from token scope.`);
      } catch (error) {
        setTokenActionError(getApiErrorMessage(error, "Unable to remove project scope."));
      }
      return;
    }
    if (objectTypeCode === SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION) {
      try {
        await scopedTokensApi.removeOrganizationScope(props.token, selectedScopeToken.id, objectId);
        await refreshTokens();
        setTokenActionSuccess(`Removed organization ${objectId} from token scope.`);
      } catch (error) {
        setTokenActionError(getApiErrorMessage(error, "Unable to remove organization scope."));
      }
      return;
    }
    setTokenActionError("Only project and organization scope removal is currently supported.");
  }

  async function handleCopyLoginLink(tokenValue: string): Promise<void> {
    const loginLink = createScopedLoginLink(tokenValue);
    if (!navigator.clipboard) {
      setTokenActionError("Clipboard access is unavailable in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(loginLink);
      setTokenActionSuccess("Login link copied to clipboard.");
    } catch {
      setTokenActionError("Unable to copy login link to clipboard.");
    }
  }

  function createObjectHref(objectTypeCode: string, objectId: number): string | null {
    if (objectTypeCode === SCOPED_ACCESS_OBJECT_TYPE_PROJECT) {
      return createProjectDetailRoute(objectId);
    }
    if (objectTypeCode === SCOPED_ACCESS_OBJECT_TYPE_TEAM) {
      return createProjectManagerTeamRoute(objectId);
    }
    if (objectTypeCode === SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION) {
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
          Minted token values are only shown once. Copy login links immediately after minting. Reloading this
          SPA permanently loses any un-copied token values.
        </Alert>
        <Alert severity="info">
          Login links use this format: <code>{`<origin>${SCOPED_ACCESS_LOGIN_PATH}?token=<token-value>`}</code>.
          Replace <code>{`<origin>`}</code> with this app base URL and <code>{`<token-value>`}</code> with
          the minted token.
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
              onCopyLoginLink={() => void handleCopyLoginLink(retainedMintedTokenValues[tokenCredential.id]!)}
              onEditScope={() => openScopeModal(tokenCredential.id)}
              onRevoke={() => void handleRevokeToken(tokenCredential.id)}
              retainedLoginLink={retainedMintedTokenValues[tokenCredential.id]
                ? createScopedLoginLink(retainedMintedTokenValues[tokenCredential.id]!)
                : undefined}
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

  function renderScopeOrganizationsTab() {
    if (!selectedScopeToken) {
      return <Alert severity="warning">Scoped token not found.</Alert>;
    }
    return (
      <Stack spacing={1.25}>
        <Box border={1} borderColor="divider" borderRadius={1.5} p={1.5}>
          <Stack spacing={1}>
            <Typography variant="body2">
              Add an organization from your currently accessible organization list.
            </Typography>
            <Autocomplete
              getOptionLabel={(option) => `${option.name} (#${option.id})`}
              onChange={(_, value) => setSelectedOrganizationScopeCandidate(value)}
              options={selectableScopeOrganizations}
              renderInput={(params) => <TextField {...params} label="Search organizations" />}
              value={selectedOrganizationScopeCandidate}
            />
            <Button
              disabled={!selectedOrganizationScopeCandidate}
              onClick={() => void handleAddOrganizationScopeFromModal()}
              variant="contained"
            >
              Add selected organization
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
    if (scopeModalTab === "organizations") {
      return renderScopeOrganizationsTab();
    }
    if (scopeModalTab === "teams") {
      return <Alert severity="info">Coming soon.</Alert>;
    }
    return null;
  }

  function renderMainContent() {
    if (props.userId === null) {
      return <Alert severity="info">Provide a valid userId to view a user profile.</Alert>;
    }
    if (resolvedTopTab === "lobby") {
      return (
        <UserLobbyPage
          currentUserId={props.currentUserId}
          token={props.token}
        />
      );
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
      case "sessions":
        if (!isSelfView) {
          return <Alert severity="info">Sessions are only available on your own profile.</Alert>;
        }
        return (
          <Stack spacing={1.25}>
            <Alert
              severity="warning"
              sx={{ "& .MuiAlert-message": { width: "100%" } }}
            >
              <Stack
                alignItems={{ md: "center", xs: "flex-start" }}
                direction={{ md: "row", xs: "column" }}
                justifyContent="space-between"
                spacing={1.25}
              >
                <Typography variant="body2">
                  Revoking all sessions will log you out on all devices, including this current session.
                </Typography>
                <Button
                  color="warning"
                  disabled={sessions.length === 0}
                  onClick={() => void handleRevokeAllSessions()}
                  variant="contained"
                >
                  Revoke all
                </Button>
              </Stack>
            </Alert>
            {sessionIssueMessage ? <Alert severity="error">{sessionIssueMessage}</Alert> : null}
            {isRefreshingSessions ? <CircularProgress size={20} /> : null}
            <SessionItemList viewMode={SESSION_LIST_VIEW_MODE}>
              {sessions.map((session) => (
                <SessionListItem
                  key={session.id}
                  onRevoke={() => void handleRevokeSession(session.id)}
                  session={session}
                  viewMode={SESSION_LIST_VIEW_MODE}
                />
              ))}
            </SessionItemList>
          </Stack>
        );
      case "credentials":
        return renderCredentialsContent();
    }
  }

  return (
    <Stack spacing={2}>
      <div>
        <Typography color="text.secondary" variant="overline">User SPA</Typography>
        <Typography variant="h4">
          {resolvedTopTab === "lobby" ? "Lobby" : "User Profile"}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Selected user: {props.userId ?? "None"}
        </Typography>
      </div>

      <UserTopNavigation
        onChange={navigateTopTab}
        showLobbyTab={showLobbyTab}
        showSelfOnlyTabs={showSelfOnlyTabs}
        value={resolvedTopTab}
      />

      {resolvedTopTab === "credentials" && showSelfOnlyTabs ? (
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
            Copy this login link now. This token value is shown once and cannot be recovered after page reload.
          </Alert>
          <TextField
            InputProps={{ readOnly: true }}
            label="Scoped Login Link"
            value={mintedTokenModalValue ? createScopedLoginLink(mintedTokenModalValue) : ""}
          />
          <Button
            disabled={!mintedTokenModalValue}
            onClick={() => mintedTokenModalValue && void handleCopyLoginLink(mintedTokenModalValue)}
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
