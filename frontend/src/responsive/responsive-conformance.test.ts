import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CURRENT_DIRECTORY = path.dirname(new URL(import.meta.url).pathname);
const FRONTEND_SOURCE_DIRECTORY = path.resolve(CURRENT_DIRECTORY, "..");
const AUTH_COMPONENTS_DIRECTORY = path.resolve(
  FRONTEND_SOURCE_DIRECTORY,
  "auth/components",
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
const STYLES_DIRECTORY = path.resolve(FRONTEND_SOURCE_DIRECTORY, "styles");

function readFrontendFile(...relativeSegments: string[]) {
  return fs.readFileSync(
    path.resolve(FRONTEND_SOURCE_DIRECTORY, ...relativeSegments),
    "utf8",
  );
}

function readAuthComponentFile(filename: string) {
  return fs.readFileSync(
    path.resolve(AUTH_COMPONENTS_DIRECTORY, filename),
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

function readStylesFile(filename: string) {
  return fs.readFileSync(path.resolve(STYLES_DIRECTORY, filename), "utf8");
}

describe("responsive layout contracts", () => {
  it("uses mobile-safe viewport sizing and overflow guards in the app shell css", () => {
    const stylesheet = readStylesFile("app.css");

    expect(stylesheet).toContain("box-sizing: border-box;");
    expect(stylesheet).toContain("overflow-x: hidden;");
    expect(stylesheet).toContain("min-height: 100dvh;");
    expect(stylesheet).toContain("width: 100%;");
  });

  it("keeps hero content wrappable and defines a narrow-screen media rule", () => {
    const stylesheet = readStylesFile("app.css");

    expect(stylesheet).toContain(".home-hero__content");
    expect(stylesheet).toContain("overflow-wrap: anywhere;");
    expect(stylesheet).toContain("@media (max-width: 640px)");
    expect(stylesheet).toContain("font-size: clamp(2.35rem, 12vw, 3.8rem);");
  });

  it("makes the navbar toolbar wrap and release width pressure on small screens", () => {
    const source = readAuthComponentFile("HeaderNavbar.tsx");

    expect(source).toContain('flexWrap: "wrap"');
    expect(source).toContain('alignItems: { sm: "center", xs: "flex-start" }');
    expect(source).toContain('minHeight: { sm: 80, xs: "auto" }');
    expect(source).toContain('width: { xs: "100%", sm: "auto" }');
    expect(source).toContain("minWidth: 0");
  });

  it("stacks logged-out auth controls vertically on narrow screens", () => {
    const source = readAuthComponentFile("LoggedOutSessionManager.tsx");

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
