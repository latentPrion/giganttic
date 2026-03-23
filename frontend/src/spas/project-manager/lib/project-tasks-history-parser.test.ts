import { describe, expect, it } from "vitest";

import { parseProjectTasksHistoryFromXml } from "./project-tasks-history-parser.js";

const NOW = new Date("2026-03-20T10:00:00.000Z");

describe("project tasks history parser", () => {
  it("filters out project nodes and future-start tasks", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="p1" type="project" start_date="2026-03-01 00:00"><![CDATA[Project node]]></task>
  <task id="t1" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[Visible task]]></task>
  <task id="t2" type="task" start_date="2099-03-01 00:00" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[Future task]]></task>
</data>`;

    const tasks = parseProjectTasksHistoryFromXml(xml, NOW);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: "t1",
      status: "ISSUE_STATUS_OPEN",
      title: "Visible task",
      type: "task",
    });
  });

  it("uses explicit task status for normal tasks", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="t-open" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[Open task]]></task>
  <task id="t-ip" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_IN_PROGRESS"><![CDATA[IP task]]></task>
  <task id="t-blocked" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_BLOCKED"><![CDATA[Blocked task]]></task>
  <task id="t-closed" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[Closed task]]></task>
</data>`;

    const tasks = parseProjectTasksHistoryFromXml(xml, NOW);
    const statusById = new Map(tasks.map((task) => [task.id, task.status]));

    expect(statusById.get("t-open")).toBe("ISSUE_STATUS_OPEN");
    expect(statusById.get("t-ip")).toBe("ISSUE_STATUS_IN_PROGRESS");
    expect(statusById.get("t-blocked")).toBe("ISSUE_STATUS_BLOCKED");
    expect(statusById.get("t-closed")).toBe("ISSUE_STATUS_CLOSED");
  });

  it("infers milestone blocked when any dependency is blocked", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="a" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_BLOCKED"><![CDATA[A]]></task>
  <task id="b" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[B]]></task>
  <task id="m" type="milestone" start_date="2026-03-02 00:00"><![CDATA[Milestone]]></task>
  <link id="1" source="a" target="m" />
  <link id="2" source="b" target="m" />
</data>`;

    const tasks = parseProjectTasksHistoryFromXml(xml, NOW);
    const milestone = tasks.find((task) => task.id === "m");

    expect(milestone?.status).toBe("ISSUE_STATUS_BLOCKED");
  });

  it("infers milestone closed only when all dependencies are closed", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="a" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[A]]></task>
  <task id="b" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[B]]></task>
  <task id="m" type="milestone" start_date="2026-03-02 00:00"><![CDATA[Milestone]]></task>
  <link id="1" source="a" target="m" />
  <link id="2" source="b" target="m" />
</data>`;

    const tasks = parseProjectTasksHistoryFromXml(xml, NOW);
    const milestone = tasks.find((task) => task.id === "m");

    expect(milestone?.status).toBe("ISSUE_STATUS_CLOSED");
  });

  it("infers milestone in progress when deps are not all closed and none blocked", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="a" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[A]]></task>
  <task id="b" type="task" start_date="2026-03-01 00:00" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[B]]></task>
  <task id="m" type="milestone" start_date="2026-03-02 00:00"><![CDATA[Milestone]]></task>
  <link id="1" source="a" target="m" />
  <link id="2" source="b" target="m" />
</data>`;

    const tasks = parseProjectTasksHistoryFromXml(xml, NOW);
    const milestone = tasks.find((task) => task.id === "m");

    expect(milestone?.status).toBe("ISSUE_STATUS_IN_PROGRESS");
  });

  it("throws when chart xml is malformed", () => {
    expect(() => parseProjectTasksHistoryFromXml("<data><task")).toThrow(
      /could not be parsed/i,
    );
  });
});
