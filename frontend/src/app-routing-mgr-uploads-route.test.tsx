/**
 * Pins `useMgrUploadsTabVisibility` to `"allowed"` via `app-routing-mgr-uploads-route-vi-mocks` so the
 * mgr-uploads route matches without a one-frame MUI `Tabs` warning. For behavior with the real hook,
 * see `app-routing-mgr-uploads-tab-visibility-hook.test.tsx`.
 */
import React from "react";
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "./app-routing-mgr-uploads-route-vi-mocks.js";
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

  it("renders the shared mgr-uploads SPA for authenticated users (production-shaped URL and basename)", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      basename: "/",
      initialEntries: ["/pm/pm/mgr-uploads"],
    });

    const root = await screen.findByTestId(PROJECT_MANAGER_MGR_UPLOADS_PAGE_TEST_ID);
    expect(root).toBeVisible();
    expect(
      within(root).getByRole("heading", { name: "Shared instance uploads", level: 1 }),
    ).toBeVisible();
  });
});
