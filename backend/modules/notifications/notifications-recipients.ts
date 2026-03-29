import { and, eq, isNull } from "drizzle-orm";

import { users } from "../../../db/index.js";
import type { DatabaseService } from "../database/database.service.js";
import { hasProjectAccess } from "../access-control/access-control.utils.js";

type AppDatabase = DatabaseService["db"];

function listActiveUserIds(database: AppDatabase): number[] {
  return database
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
    .all()
    .map((row) => row.id);
}

export function listProjectNotificationRecipientUserIds(
  database: AppDatabase,
  projectId: number,
  actorUserId: number,
): number[] {
  return listActiveUserIds(database).filter((userId) =>
    userId !== actorUserId && hasProjectAccess(database, projectId, userId)
  );
}

