import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CURRENT_DIRECTORY = path.dirname(new URL(import.meta.url).pathname);
const FRONTEND_SOURCE_DIRECTORY = path.resolve(CURRENT_DIRECTORY, "..");
const COMMON_COMPONENTS_DIRECTORY = path.resolve(
  FRONTEND_SOURCE_DIRECTORY,
  "common/components",
);
const SESSION_COMPONENTS_DIRECTORY = path.resolve(
  FRONTEND_SOURCE_DIRECTORY,
  "common/session/components",
);
const HOME_COMPONENTS_DIRECTORY = path.resolve(
  FRONTEND_SOURCE_DIRECTORY,
  "home/components",
);
const PUBLIC_HOME_LAYOUTS_DIRECTORY = path.resolve(
  FRONTEND_SOURCE_DIRECTORY,
  "spas/public-home/layouts",
);
const USER_LOBBY_ROUTES_DIRECTORY = path.resolve(
  FRONTEND_SOURCE_DIRECTORY,
  "spas/user-lobby/routes",
);
const THEME_DIRECTORY = path.resolve(FRONTEND_SOURCE_DIRECTORY, "theme");

function readFrontendFile(...relativeSegments: string[]) {
  return fs.readFileSync(
    path.resolve(FRONTEND_SOURCE_DIRECTORY, ...relativeSegments),
    "utf8",
  );
}

function readCommonComponentFile(filename: string) {
  return fs.readFileSync(
    path.resolve(COMMON_COMPONENTS_DIRECTORY, filename),
    "utf8",
  );
}

function readSessionComponentFile(filename: string) {
  return fs.readFileSync(
    path.resolve(SESSION_COMPONENTS_DIRECTORY, filename),
    "utf8",
  );
}

function readHomeComponentFile(filename: string) {
  return fs.readFileSync(
    path.resolve(HOME_COMPONENTS_DIRECTORY, filename),
    "utf8",
  );
}

function readPublicHomeLayoutFile(filename: string) {
  return fs.readFileSync(
    path.resolve(PUBLIC_HOME_LAYOUTS_DIRECTORY, filename),
    "utf8",
  );
}

function readUserLobbyRouteFile(filename: string) {
  return fs.readFileSync(
    path.resolve(USER_LOBBY_ROUTES_DIRECTORY, filename),
    "utf8",
  );
}

function readThemeFile(filename: string) {
  return fs.readFileSync(path.resolve(THEME_DIRECTORY, filename), "utf8");
}

describe("responsive layout contracts", () => {
  it("uses theme CssBaseline for viewport sizing and overflow guards", () => {
    const appShellSource = readFrontendFile("app/shell/AppShell.tsx");
    const themeSource = readThemeFile("app-theme.ts");

    expect(themeSource).toContain("MuiCssBaseline");
    expect(themeSource).toContain("overflowX");
    expect(themeSource).toContain("minHeight");
    expect(appShellSource).toContain("100dvh");
    expect(appShellSource).toContain("flex");
  });

  it("keeps hero content wrappable and responsive via sx", () => {
    const source = readHomeComponentFile("HomeHero.tsx");

    expect(source).toContain("overflowWrap");
    expect(source).toContain("anywhere");
    expect(source).toContain("clamp(");
    expect(source).toContain("xs");
    expect(source).toContain("sm");
  });

  it("makes the navbar toolbar wrap and release width pressure on small screens", () => {
    const source = readCommonComponentFile("HeaderNavbar.tsx");

    expect(source).toContain('flexWrap: "wrap"');
    expect(source).toContain('alignItems: { sm: "center", xs: "flex-start" }');
    expect(source).toContain('minHeight: { sm: 80, xs: "auto" }');
    expect(source).toContain('width: { xs: "100%", sm: "auto" }');
    expect(source).toContain("minWidth: 0");
  });

  it("stacks logged-out auth controls vertically on narrow screens", () => {
    const source = readSessionComponentFile("LoggedOutSessionManager.tsx");

    expect(source).toContain('direction={{ sm: "row", xs: "column" }}');
    expect(source).toContain('sx={{ width: { sm: "auto", xs: "100%" } }}');
  });

  it("keeps the hero link row and auth cta responsive", () => {
    const source = readHomeComponentFile("HomeHero.tsx");

    expect(source).toContain('direction={{ sm: "row", xs: "column" }}');
    expect(source).toContain('buttonSize="large"');
  });

  it("wires the landing shell through the shared app entry point", () => {
    const appSource = readFrontendFile("App.tsx");
    const publicLayoutSource = readPublicHomeLayoutFile("PublicHomeLayout.tsx");
    const lobbyRouteSource = readUserLobbyRouteFile("LobbyRoute.tsx");

    expect(appSource).toContain("<AppRoutes />");
    expect(publicLayoutSource).toContain("<AppShell");
    expect(lobbyRouteSource).toContain("<UserLobbyPage");
  });
});
