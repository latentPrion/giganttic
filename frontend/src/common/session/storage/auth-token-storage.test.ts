import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authTokenStorage } from "./auth-token-storage.js";

const TEST_TOKEN = "frontend-token";

describe("authTokenStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips the bearer token", () => {
    authTokenStorage.write(TEST_TOKEN);

    expect(authTokenStorage.read()).toBe(TEST_TOKEN);

    authTokenStorage.clear();

    expect(authTokenStorage.read()).toBeNull();
  });
});
