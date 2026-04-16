/**
 * Shared uploads remains a direct route (`/project/mgr-uploads`) and is intentionally not shown as a
 * tab in project navigation for any user. This test ensures the route renders while the tab stays hidden.
 */
import React from "react";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./app-routing-test-vi-mocks.js";
import { authApi } from "./common/session/api/auth-api.js";
import { authTokenStorage } from "./common/session/storage/auth-token-storage.js";
import { createAuthenticatedResponse } from "./app-routing-test-auth-helpers.js";
import { listMgrUploadsFilesMock } from "./app-routing-test-vi-mocks.js";
import { PROJECT_MANAGER_MGR_UPLOADS_PAGE_TEST_ID } from "./spas/project-manager/pages/ProjectManagerMgrUploadsPage.js";
import { renderWithTheme } from "./test/render-with-theme.js";
import { App } from "./App.js";

const authApiMock = vi.mocked(authApi);
const authTokenStorageMock = vi.mocked(authTokenStorage);

describe("app routing — mgr-uploads route", () => {
  beforeEach(() => {
    authTokenStorageMock.read.mockReturnValue(null);
    authApiMock.getCurrentSession.mockReset();
    listMgrUploadsFilesMock.mockReset();
    listMgrUploadsFilesMock.mockResolvedValue({
      files: [],
      storage: {
        availableBytes: 100,
        availableMib: 0.0,
        devicePath: "/dev/sda1",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders mgr-uploads route and keeps Shared uploads tab hidden", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      basename: "/",
      initialEntries: ["/project/mgr-uploads"],
    });

    const root = await screen.findByTestId(PROJECT_MANAGER_MGR_UPLOADS_PAGE_TEST_ID);
    expect(
      within(root).getByRole("heading", { name: "Shared instance uploads" }),
    ).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Shared uploads" })).not.toBeInTheDocument();
  });
});
