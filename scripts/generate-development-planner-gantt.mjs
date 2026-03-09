#!/usr/bin/env node
/**
 * Reads docs/3rdParty/pm/development-planner.md and emits a DHTMLX Gantt 2.0+ XML
 * chart with Completed (session-dated tasks), P0 (current), and P1 (phase 2) tasks.
 * Output: charts/development-planner-chart.xml
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLANNER_PATH = path.join(ROOT, "docs/3rdParty/pm/development-planner.md");
const CHARTS_DIR = path.join(ROOT, "charts");
const OUT_PATH = path.join(CHARTS_DIR, "development-planner-chart.xml");

function escapeCdata(text) {
  return String(text).replace(/]]>/g, "]]]]><![CDATA[>");
}

function parsePlanner(content) {
  const sessions = [];
  const p0Tasks = [];
  const p1Tasks = [];

  const sessionRe = /^## Session (\d{4}-\d{2}-\d{2}) \((.+)\)\s*$/gm;
  for (const m of content.matchAll(sessionRe)) {
    sessions.push({ date: m[1], title: m[2].trim() });
  }

  const taskRe = /^### (P[01]-[0-9]+) — (.+)\s*$/gm;
  let taskMatch;
  while ((taskMatch = taskRe.exec(content)) !== null) {
    const [_, id, title] = taskMatch;
    const titleTrim = title.trim();
    if (id.startsWith("P0-")) {
      p0Tasks.push({ id, title: titleTrim });
    } else {
      p1Tasks.push({ id, title: titleTrim });
    }
  }

  return { sessions, p0Tasks, p1Tasks };
}

function buildXml({ sessions, p0Tasks, p1Tasks }) {
  // Sort sessions by date ascending (oldest first)
  sessions.sort((a, b) => a.date.localeCompare(b.date));

  const tasks = [];
  const links = [];
  let linkId = 1;

  // Root
  const projectStart = sessions.length ? sessions[0].date : "2026-01-01";
  const projectEnd = "2026-04-30";
  tasks.push({
    id: 1,
    parent: 0,
    text: "Development planner (development-planner.md)",
    start_date: `${projectStart} 00:00`,
    duration: 1,
    open: true,
    progress: 0.5,
    type: "project",
  });

  // Completed (section 10)
  tasks.push({
    id: 10,
    parent: 1,
    text: "Completed",
    start_date: `${sessions[0]?.date ?? projectStart} 00:00`,
    duration: sessions.length || 1,
    open: true,
    progress: 1,
    type: "project",
  });

  let sessionId = 1001;
  for (const s of sessions) {
    tasks.push({
      id: sessionId,
      parent: 10,
      text: `${s.date}: ${s.title}`,
      start_date: `${s.date} 00:00`,
      duration: 1,
      progress: 1,
    });
    if (sessionId > 1001) {
      links.push({ id: linkId++, source: sessionId - 1, target: sessionId, type: "0" });
    }
    sessionId++;
  }

  // P0 (current) – in progress
  const p0Start = "2026-03-05";
  tasks.push({
    id: 20,
    parent: 1,
    text: "P0 (current)",
    start_date: `${p0Start} 00:00`,
    duration: 14,
    open: true,
    progress: 0.2,
    type: "project",
  });

  const p0Ids = [201, 202, 203, 204, 205, 206, 207];
  p0Tasks.slice(0, 7).forEach((t, i) => {
    const id = p0Ids[i];
    tasks.push({
      id,
      parent: 20,
      text: `${t.id} — ${t.title}`,
      start_date: `${p0Start} 00:00`,
      duration: 2,
      progress: 0,
    });
    if (i > 0) {
      links.push({ id: linkId++, source: p0Ids[i - 1], target: id, type: "0" });
    }
  });

  if (sessions.length) {
    links.push({ id: linkId++, source: 10, target: 20, type: "0" });
  }
  links.push({ id: linkId++, source: 20, target: 30, type: "0" });

  // P1 (phase 2) – not started
  const p1Start = "2026-03-19";
  tasks.push({
    id: 30,
    parent: 1,
    text: "P1 (phase 2)",
    start_date: `${p1Start} 00:00`,
    duration: 30,
    open: true,
    progress: 0,
    type: "project",
  });

  const p1Ids = [301, 302, 303, 304, 305, 306, 307, 308, 309, 310];
  p1Tasks.slice(0, 10).forEach((t, i) => {
    const id = p1Ids[i];
    tasks.push({
      id,
      parent: 30,
      text: `${t.id} — ${t.title}`,
      start_date: `${p1Start} 00:00`,
      duration: 3,
      progress: 0,
    });
    if (i > 0) {
      links.push({ id: linkId++, source: p1Ids[i - 1], target: id, type: "0" });
    }
  });

  const taskLines = tasks.map((t) => {
    const attrs = [
      `id="${t.id}"`,
      `parent="${t.parent}"`,
      `start_date="${t.start_date}"`,
      `duration="${t.duration}"`,
      t.progress !== undefined ? `progress="${t.progress}"` : "",
      t.open ? `open="true"` : "",
      t.type ? `type="${t.type}"` : "",
    ].filter(Boolean);
    return `  <task ${attrs.join(" ")}><![CDATA[${escapeCdata(t.text)}]]></task>`;
  });

  const linkLines = links.map(
    (l) => `    <item id="${l.id}" source="${l.source}" target="${l.target}" type="${l.type}" />`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<data>
${taskLines.join("\n")}
  <coll_options for="links">
${linkLines.join("\n")}
  </coll_options>
</data>
`;
}

const content = fs.readFileSync(PLANNER_PATH, "utf8");
const parsed = parsePlanner(content);
const xml = buildXml(parsed);

if (!fs.existsSync(CHARTS_DIR)) {
  fs.mkdirSync(CHARTS_DIR, { recursive: true });
}
fs.writeFileSync(OUT_PATH, xml, "utf8");
console.log("Wrote", OUT_PATH);
