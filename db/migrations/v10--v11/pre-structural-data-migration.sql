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

INSERT OR IGNORE INTO "ProjectGanttCharts" ("projectId", "chartId", "name")
SELECT DISTINCT "projectId", 0, 'default'
FROM (
  SELECT "projectId" FROM "TaskMirror"
  UNION
  SELECT "projectId" FROM "TaskAttachments"
  UNION
  SELECT "projectId" FROM "TaskComments"
  UNION
  SELECT "projectId" FROM "TaskComments_Attachments"
);
