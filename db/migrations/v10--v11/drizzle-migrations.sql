PRAGMA defer_foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "ProjectGanttCharts" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "projectId" integer NOT NULL,
  "chartId" integer DEFAULT 0 NOT NULL,
  "name" text DEFAULT 'default' NOT NULL,
  "createdAt" integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
  "updatedAt" integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
  FOREIGN KEY ("projectId") REFERENCES "Projects"("id") ON UPDATE cascade ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectGanttCharts_projectId_chartId_unique"
  ON "ProjectGanttCharts" ("projectId", "chartId");

CREATE TABLE "TaskMirror__new" (
  "projectGanttChartId" integer NOT NULL,
  "taskId" text NOT NULL,
  "createdAt" integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
  "updatedAt" integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
  PRIMARY KEY ("projectGanttChartId", "taskId"),
  FOREIGN KEY ("projectGanttChartId") REFERENCES "ProjectGanttCharts"("id") ON UPDATE cascade ON DELETE cascade
);
INSERT INTO "TaskMirror__new" ("projectGanttChartId", "taskId", "createdAt", "updatedAt")
SELECT c."id", tm."taskId", tm."createdAt", tm."updatedAt"
FROM "TaskMirror" tm
INNER JOIN "ProjectGanttCharts" c
  ON c."projectId" = tm."projectId"
 AND c."chartId" = 0;

CREATE TABLE "TaskAttachments__new" (
  "projectGanttChartId" integer NOT NULL,
  "taskId" text NOT NULL,
  "attachmentId" text NOT NULL,
  PRIMARY KEY ("projectGanttChartId", "taskId", "attachmentId"),
  FOREIGN KEY ("projectGanttChartId") REFERENCES "ProjectGanttCharts"("id") ON UPDATE cascade ON DELETE cascade,
  FOREIGN KEY ("attachmentId") REFERENCES "Attachments"("id") ON UPDATE cascade ON DELETE cascade,
  FOREIGN KEY ("projectGanttChartId", "taskId") REFERENCES "TaskMirror__new"("projectGanttChartId", "taskId") ON UPDATE cascade ON DELETE cascade
);
INSERT INTO "TaskAttachments__new" ("projectGanttChartId", "taskId", "attachmentId")
SELECT c."id", ta."taskId", ta."attachmentId"
FROM "TaskAttachments" ta
INNER JOIN "ProjectGanttCharts" c
  ON c."projectId" = ta."projectId"
 AND c."chartId" = 0;
DROP TABLE "TaskAttachments";

CREATE TABLE "TaskComments__new" (
  "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  "projectGanttChartId" integer NOT NULL,
  "taskId" text NOT NULL,
  "createdByUserId" integer NOT NULL,
  "parentCommentId" integer,
  "thumbsUpCount" integer DEFAULT 0 NOT NULL,
  "thumbsDownCount" integer DEFAULT 0 NOT NULL,
  "createdAt" integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
  "updatedAt" integer DEFAULT (CAST(unixepoch('subsec') * 1000 AS INTEGER)) NOT NULL,
  FOREIGN KEY ("createdByUserId") REFERENCES "Users"("id") ON UPDATE cascade ON DELETE restrict,
  FOREIGN KEY ("projectGanttChartId", "taskId") REFERENCES "TaskMirror__new"("projectGanttChartId", "taskId") ON UPDATE cascade ON DELETE cascade,
  FOREIGN KEY ("projectGanttChartId") REFERENCES "ProjectGanttCharts"("id") ON UPDATE cascade ON DELETE cascade
);
INSERT INTO "TaskComments__new" (
  "id",
  "projectGanttChartId",
  "taskId",
  "createdByUserId",
  "parentCommentId",
  "thumbsUpCount",
  "thumbsDownCount",
  "createdAt",
  "updatedAt"
)
SELECT
  tc."id",
  c."id",
  tc."taskId",
  tc."createdByUserId",
  tc."parentCommentId",
  tc."thumbsUpCount",
  tc."thumbsDownCount",
  tc."createdAt",
  tc."updatedAt"
FROM "TaskComments" tc
INNER JOIN "ProjectGanttCharts" c
  ON c."projectId" = tc."projectId"
 AND c."chartId" = 0;
CREATE TABLE "TaskComments_Attachments__new" (
  "projectGanttChartId" integer NOT NULL,
  "taskId" text NOT NULL,
  "commentId" integer NOT NULL,
  "attachmentId" text NOT NULL,
  PRIMARY KEY ("projectGanttChartId", "taskId", "commentId", "attachmentId"),
  FOREIGN KEY ("projectGanttChartId") REFERENCES "ProjectGanttCharts"("id") ON UPDATE cascade ON DELETE cascade,
  FOREIGN KEY ("commentId") REFERENCES "TaskComments__new"("id") ON UPDATE cascade ON DELETE cascade,
  FOREIGN KEY ("attachmentId") REFERENCES "Attachments"("id") ON UPDATE cascade ON DELETE cascade,
  FOREIGN KEY ("projectGanttChartId", "taskId") REFERENCES "TaskMirror__new"("projectGanttChartId", "taskId") ON UPDATE cascade ON DELETE cascade
);
INSERT INTO "TaskComments_Attachments__new" (
  "projectGanttChartId",
  "taskId",
  "commentId",
  "attachmentId"
)
SELECT c."id", tca."taskId", tca."commentId", tca."attachmentId"
FROM "TaskComments_Attachments" tca
INNER JOIN "ProjectGanttCharts" c
  ON c."projectId" = tca."projectId"
 AND c."chartId" = 0;
DROP TABLE "TaskComments_Attachments";
DROP TABLE "TaskComments";
DROP TABLE "TaskMirror";

ALTER TABLE "TaskMirror__new" RENAME TO "TaskMirror";
ALTER TABLE "TaskComments__new" RENAME TO "TaskComments";
ALTER TABLE "TaskAttachments__new" RENAME TO "TaskAttachments";
ALTER TABLE "TaskComments_Attachments__new" RENAME TO "TaskComments_Attachments";

PRAGMA defer_foreign_keys = OFF;
