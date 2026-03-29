import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";

import {
  listNotificationsQuerySchema,
  listNotificationsResponseSchema,
  listUnnoticedNotificationsResponseSchema,
  notificationSummaryResponseSchema,
  toggleNotificationNoticedResponseSchema,
} from "../../../common/notifications/notification.contracts.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { Authenticated } from "../auth/authenticated.decorator.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DEFAULT_NOTIFICATIONS_DROPDOWN_LIMIT } from "./notifications.constants.js";
import { NotificationsService } from "./notifications.service.js";

const notificationIdParamSchema = z.object({
  notificationId: z.coerce.number().int().positive(),
});

const listUnnoticedNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(DEFAULT_NOTIFICATIONS_DROPDOWN_LIMIT),
});

const backendListNotificationsQuerySchema = z.object({
  eventTypes: z
    .preprocess(
      (value) =>
        typeof value === "string"
          ? value.split(",").map((item) => item.trim()).filter(Boolean)
          : value,
      listNotificationsQuerySchema.shape.eventTypes,
    )
    .default([]),
  includeNoticed: z
    .preprocess((value) => value === "true" || value === true, z.boolean())
    .default(false),
  limit: z.coerce.number().int().positive().default(DEFAULT_NOTIFICATIONS_DROPDOWN_LIMIT),
  offset: z.coerce.number().int().nonnegative().default(0),
  sort: listNotificationsQuerySchema.shape.sort.default("desc"),
});

@Authenticated()
@Controller("notifications")
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get("summary")
  async getSummary(@Req() request: AuthenticatedRequest) {
    return notificationSummaryResponseSchema.parse(
      await this.notificationsService.getNotificationSummary(request.authContext!),
    );
  }

  @Get("unnoticed")
  async listUnnoticed(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(listUnnoticedNotificationsQuerySchema)) query: unknown,
  ) {
    const { limit } = listUnnoticedNotificationsQuerySchema.parse(query);
    return listUnnoticedNotificationsResponseSchema.parse(
      await this.notificationsService.listUnnoticedNotifications(
        request.authContext!,
        limit,
      ),
    );
  }

  @Get()
  async listNotifications(
    @Req() request: AuthenticatedRequest,
    @Query(new ZodValidationPipe(backendListNotificationsQuerySchema)) query: unknown,
  ) {
    return listNotificationsResponseSchema.parse(
      await this.notificationsService.listNotifications(
        request.authContext!,
        backendListNotificationsQuerySchema.parse(query),
      ),
    );
  }

  @Post(":notificationId/toggle-noticed")
  @HttpCode(200)
  async toggleNotificationNoticed(
    @Req() request: AuthenticatedRequest,
    @Param(new ZodValidationPipe(notificationIdParamSchema)) params: unknown,
  ) {
    const { notificationId } = notificationIdParamSchema.parse(params);
    return toggleNotificationNoticedResponseSchema.parse(
      await this.notificationsService.toggleNotificationNoticed(
        request.authContext!,
        notificationId,
      ),
    );
  }
}
