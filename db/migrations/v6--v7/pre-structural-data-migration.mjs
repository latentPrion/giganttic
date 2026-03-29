import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function createProjectJournalFilePath(projectRoot, projectId) {
  return path.join(
    projectRoot,
    "untrusted-content",
    "project-journals",
    `${projectId}.md`,
  );
}

function createIssueJournalFilePath(projectRoot, projectId, issueId) {
  return path.join(
    projectRoot,
    "untrusted-content",
    "issue-journals",
    `${projectId}-${issueId}.md`,
  );
}

async function ensureParentDirectory(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeJournalFile(filePath, markdown) {
  await ensureParentDirectory(filePath);
  await writeFile(filePath, markdown ?? "", "utf8");
}

async function exportProjectJournals(db, projectRoot) {
  const rows = db.prepare(
    "SELECT id, journal FROM Projects WHERE journal IS NOT NULL",
  ).all();

  for (const row of rows) {
    await writeJournalFile(
      createProjectJournalFilePath(projectRoot, row.id),
      row.journal,
    );
  }
}

async function exportIssueJournals(db, projectRoot) {
  const rows = db.prepare(
    "SELECT id, projectId, journal FROM Issues WHERE journal IS NOT NULL",
  ).all();

  for (const row of rows) {
    await writeJournalFile(
      createIssueJournalFilePath(projectRoot, row.projectId, row.id),
      row.journal,
    );
  }
}

async function importRuntimeDbState(runtimeRoot) {
  const moduleUrl = pathToFileURL(
    path.join(runtimeRoot, "db", "runtime-db-state.mjs"),
  );
  return import(moduleUrl.href);
}

export async function runPreStructuralDataMigrationHook({
  projectRoot,
  runtimeRoot,
  targetDbPath,
}) {
  if (!runtimeRoot || !targetDbPath) {
    throw new Error("Missing runtime root or target DB path for journal export.");
  }

  const { openDatabaseFromPath } = await importRuntimeDbState(runtimeRoot);
  const db = await openDatabaseFromPath(targetDbPath);

  try {
    await exportProjectJournals(db, projectRoot);
    await exportIssueJournals(db, projectRoot);
  } finally {
    db.close();
  }
}
