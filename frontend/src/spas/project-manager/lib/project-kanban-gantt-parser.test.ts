import { describe, expect, it } from "vitest";

import { parseProjectKanbanTasksFromXml } from "./project-kanban-gantt-parser.js";

const MIXED_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="1" start_date="2026-03-05 09:00" progress="0.4" ggtc_task_status="ISSUE_STATUS_IN_PROGRESS"><![CDATA[Active task]]></task>
  <task id="2" start_date="2026-03-20 09:00" progress="0" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[Future open task]]></task>
  <task id="3" start_date="2026-03-03 09:00" progress="1" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[Done task]]></task>
  <task id="4" start_date="2026-03-20 09:00" progress="0" ggtc_task_status="ISSUE_STATUS_BLOCKED"><![CDATA[Future blocked task]]></task>
</data>
`;
const NOW = new Date("2026-03-10T12:00:00.000Z");

describe("project kanban gantt parser", () => {
  it("maps gantt tasks into columns from ggtc status", () => {
    const tasks = parseProjectKanbanTasksFromXml(MIXED_TASK_XML, NOW);

    expect(tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        column: "ISSUE_STATUS_IN_PROGRESS",
        id: "1",
        status: "ISSUE_STATUS_IN_PROGRESS",
        progressPercentage: 40,
        title: "Active task",
      }),
      expect.objectContaining({
        column: "ISSUE_STATUS_CLOSED",
        id: "3",
        status: "ISSUE_STATUS_CLOSED",
      }),
    ]));
  });

  it("ignores task nodes that are missing ids, titles, or parseable start dates", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task start_date="2026-03-05 09:00" progress="0.2"><![CDATA[Missing id]]></task>
  <task id="10" start_date="2026-03-05 09:00" progress="0.2"><![CDATA[]]></task>
  <task id="11" progress="0.2"><![CDATA[Missing start]]></task>
  <task id="12" start_date="not-a-date" progress="0.2"><![CDATA[Bad start]]></task>
  <task id="13" start_date="2026-03-05 09:00" progress="0.2"><![CDATA[Valid task]]></task>
</data>
`;

    const tasks = parseProjectKanbanTasksFromXml(xml, NOW);

    expect(tasks).toEqual([
      expect.objectContaining({
        id: "13",
        title: "Valid task",
      }),
    ]);
  });

  it("treats invalid and negative progress values as zero for started tasks", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="20" start_date="2026-03-05 09:00" progress="-1"><![CDATA[Negative progress]]></task>
  <task id="21" start_date="2026-03-05 09:00" progress="oops"><![CDATA[Invalid progress]]></task>
</data>
`;

    const tasks = parseProjectKanbanTasksFromXml(xml, NOW);

    expect(tasks).toEqual([
      expect.objectContaining({
        id: "20",
        progressPercentage: 0,
        title: "Negative progress",
      }),
      expect.objectContaining({
        id: "21",
        progressPercentage: 0,
        title: "Invalid progress",
      }),
    ]);
  });

  it("normalizes ratio and percent-like progress values consistently", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="ratio" start_date="2026-03-05 09:00" progress="0.42" ggtc_task_status="ISSUE_STATUS_IN_PROGRESS"><![CDATA[Ratio task]]></task>
  <task id="percent" start_date="2026-03-05 09:00" progress="42" ggtc_task_status="ISSUE_STATUS_IN_PROGRESS"><![CDATA[Percent task]]></task>
</data>
`;

    const tasks = parseProjectKanbanTasksFromXml(xml, NOW);

    expect(tasks.find((task) => task.id === "ratio")?.progressPercentage).toBe(42);
    expect(tasks.find((task) => task.id === "percent")?.progressPercentage).toBe(42);
  });

  it("hides future open tasks but keeps future non-open tasks", () => {
    const tasks = parseProjectKanbanTasksFromXml(MIXED_TASK_XML, NOW);

    expect(tasks.find((task) => task.id === "2")).toBeUndefined();
    expect(tasks.find((task) => task.id === "4")).toEqual(
      expect.objectContaining({
        column: "ISSUE_STATUS_BLOCKED",
        id: "4",
      }),
    );
  });

  it("hides future milestones while still including started milestones", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="task-1" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[Task 1]]></task>
  <task id="future-m" type="milestone" start_date="2026-03-20 09:00"><![CDATA[Future Milestone]]></task>
  <task id="started-m" type="milestone" start_date="2026-03-02 09:00"><![CDATA[Started Milestone]]></task>
  <link id="1" source="task-1" target="future-m" />
  <link id="2" source="task-1" target="started-m" />
</data>
`;

    const tasks = parseProjectKanbanTasksFromXml(xml, NOW);

    expect(tasks.find((task) => task.id === "future-m")).toBeUndefined();
    expect(tasks.find((task) => task.id === "started-m")).toEqual(
      expect.objectContaining({
        id: "started-m",
        isMilestone: true,
        status: "ISSUE_STATUS_CLOSED",
      }),
    );
  });

  it("parses valid tasks from nested task structures and ignores unrelated xml nodes", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <metadata>
    <title>Sample chart</title>
  </metadata>
  <task id="40" start_date="2026-03-05 09:00" progress="0.4">
    <![CDATA[Parent task]]>
    <task id="41" start_date="2026-03-06 10:00" progress="0.5"><![CDATA[Child task]]></task>
  </task>
  <links>
    <link id="1" source="40" target="41" />
  </links>
</data>
`;

    const tasks = parseProjectKanbanTasksFromXml(xml, NOW);

    expect(tasks).toHaveLength(2);
    expect(tasks).toEqual([
      expect.objectContaining({
        id: "40",
        title: "Parent task",
      }),
      expect.objectContaining({
        id: "41",
        title: "Child task",
      }),
    ]);
  });

  it("throws when the chart XML is malformed", () => {
    expect(() => parseProjectKanbanTasksFromXml("<data><task")).toThrow(
      /could not be parsed/i,
    );
  });
});
