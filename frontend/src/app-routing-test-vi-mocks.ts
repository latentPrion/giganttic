/**
 * Shared `vi.mock` registrations for `app-routing*.test.tsx`. When adding a mocked module used from the
 * real `App` tree, register it here so every routing integration test file stays aligned (avoid
 * duplicating `./spas/...` mock paths in multiple test entrypoints).
 */
import { vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  ROUTING_TEST_CHART_XML:
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"1001\"><![CDATA[Test chart]]></task></data>",
  listMgrUploadsFilesMock: vi.fn(),
}));

export const ROUTING_TEST_CHART_XML = hoisted.ROUTING_TEST_CHART_XML;
export const listMgrUploadsFilesMock = hoisted.listMgrUploadsFilesMock;

vi.mock("./spas/project-manager/lib/dhtmlx-gantt-adapter.js", () => ({
  getDhtmlxGantt: () => ({
    attachEvent: vi.fn(() => 1),
    clearAll: vi.fn(),
    config: {
      columns: [],
      date_format: "",
      grid_width: 0,
      keep_grid_width: false,
      layout: null,
      show_chart: true,
      show_grid: true,
    },
    destructor: vi.fn(),
    detachEvent: vi.fn(),
    getSelectedId: vi.fn(() => null),
    init: vi.fn(),
    parse: vi.fn(),
    render: vi.fn(),
    resetLayout: vi.fn(),
    serialize: vi.fn(() => hoisted.ROUTING_TEST_CHART_XML),
    setSizes: vi.fn(),
  }),
}));

vi.mock("./common/session/api/auth-api.js", () => ({
  authApi: {
    getCurrentSession: vi.fn(),
    login: vi.fn(),
    loginWithScopedAccessToken: vi.fn(),
    register: vi.fn(),
    revokeCurrentSession: vi.fn(),
    revokeSessions: vi.fn(),
  },
}));

vi.mock("./common/session/storage/auth-token-storage.js", () => ({
  authTokenStorage: {
    clear: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
  },
}));

vi.mock("./lobby/api/lobby-api.js", () => ({
  lobbyApi: {
    createOrganization: vi.fn(),
    createProject: vi.fn(),
    createTeam: vi.fn(),
    deleteOrganization: vi.fn(),
    deleteProject: vi.fn(),
    deleteTeam: vi.fn(),
    getOrganization: vi.fn(),
    getProject: vi.fn(),
    getTeam: vi.fn(),
    getUser: vi.fn(),
    listOrganizations: vi.fn(),
    listProjects: vi.fn(),
    listTeams: vi.fn(),
    associateProjectOrganization: vi.fn(),
    associateProjectTeam: vi.fn(),
    replaceOrganizationUsers: vi.fn(),
    replaceTeamMembers: vi.fn(),
    updateOrganization: vi.fn(),
    updateProject: vi.fn(),
    updateTeam: vi.fn(),
  },
}));

vi.mock("./spas/project-manager/api/issues-api.js", () => ({
  issuesApi: {
    createIssue: vi.fn(),
    deleteIssue: vi.fn(),
    getIssue: vi.fn(),
    listIssues: vi.fn(),
    updateIssue: vi.fn(),
  },
}));

vi.mock("./spas/project-manager/api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChart: vi.fn(),
    getProjectChartExportCapabilities: vi.fn(),
    getProjectChartOrNull: vi.fn(),
    putProjectChart: vi.fn(),
  },
}));

vi.mock("./spas/project-manager/api/mgr-uploads-api.js", () => ({
  mgrUploadsApi: {
    deleteFile: vi.fn(),
    listFiles: hoisted.listMgrUploadsFilesMock,
    uploadFile: vi.fn(),
  },
}));
