/**
 * Extends `app-routing-test-vi-mocks` for the mgr-uploads route integration test only: the real hook
 * starts as "loading", which leaves `Tabs` value `mgr-uploads` without a matching tab and triggers
 * MUI warnings. Production resolves via `listFiles`; this file pins visibility for a stable route test.
 */
import "./app-routing-test-vi-mocks.js";

import { vi } from "vitest";

vi.mock("./spas/project-manager/hooks/use-mgr-uploads-tab-visibility.js", () => ({
  useMgrUploadsTabVisibility: () => "allowed",
}));
