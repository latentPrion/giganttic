import { describe, expect, it, vi } from "vitest";

import { mgrUploadsApi } from "./mgr-uploads-api.js";

describe("mgrUploadsApi", () => {
  it("lists files using the mgr-uploads path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          files: [],
          storage: {
            availableBytes: 100,
            availableMib: 0.0,
            devicePath: "/dev/sda1",
          },
        }),
      ),
    });
    vi.stubGlobal("fetch", fetchMock);

    await mgrUploadsApi.listFiles("token");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/stc-proj-mgmt/api/mgr-uploads"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
        }),
        method: "GET",
      }),
    );

    vi.unstubAllGlobals();
  });
});
