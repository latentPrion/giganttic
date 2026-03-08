import {
  Controller,
  Delete,
  Inject,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";

import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { BearerAuthGuard } from "../auth/auth.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import {
  deleteUserResponseSchema,
  userIdParamSchema,
} from "./users.contracts.js";
import { UsersService } from "./users.service.js";

@UseGuards(BearerAuthGuard)
@Controller("users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Delete(":userId")
  async deleteUser(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(userIdParamSchema)) params: unknown,
  ) {
    const { userId } = userIdParamSchema.parse(params);

    return deleteUserResponseSchema.parse(
      await this.usersService.deleteUser(request.authContext!, userId),
    );
  }
}
