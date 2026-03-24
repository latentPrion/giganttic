import { applyDecorators, UseGuards } from "@nestjs/common";

import { BearerAuthGuard } from "./auth.guard.js";
import { ScopedAccessRouteGuard } from "./scoped-access-route.guard.js";

export function Authenticated() {
  return applyDecorators(UseGuards(BearerAuthGuard, ScopedAccessRouteGuard));
}
