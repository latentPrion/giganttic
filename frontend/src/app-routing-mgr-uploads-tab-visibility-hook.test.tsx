/**
 * Exercises the real `useMgrUploadsTabVisibility` hook (no mock): listFiles succeeds → tab becomes
 * allowed → "Shared uploads" appears. Complements `app-routing-mgr-uploads-route.test.tsx`, which pins
 * visibility to avoid a one-frame MUI `Tabs` mismatch during `"loading"`.
 *
 * While `mgrUploadsAccess === "loading"`, MUI may log a `Tabs` value mismatch on stderr; that resolves
 * once the probe completes (same transient as production on a slow network).
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

describe("app routing — mgr-uploads route (real tab visibility hook)", () => {
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

  it("shows the Shared uploads tab after the visibility probe lists files", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      basename: "/",
      initialEntries: ["/pm/pm/mgr-uploads"],
    });

    expect(
      await screen.findByRole("tab", { name: "Shared uploads" }),
    ).toBeVisible();

    const root = screen.getByTestId(PROJECT_MANAGER_MGR_UPLOADS_PAGE_TEST_ID);
    expect(
      within(root).getByRole("heading", { name: "Shared instance uploads" }),
    ).toBeVisible();
  });
});
