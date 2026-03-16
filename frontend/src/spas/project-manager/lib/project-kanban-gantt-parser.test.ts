import { describe, expect, it } from "vitest";

import { parseProjectKanbanTasksFromXml } from "./project-kanban-gantt-parser.js";

const MIXED_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="1" start_date="2026-03-05 09:00" progress="0.4"><![CDATA[Active task]]></task>
  <task id="2" start_date="2026-03-20 09:00" progress="0"><![CDATA[Future task]]></task>
  <task id="3" start_date="2026-03-03 09:00" progress="1"><![CDATA[Done task]]></task>
</data>
`;
const NOW = new Date("2026-03-10T12:00:00.000Z");

describe("project kanban gantt parser", () => {
  it("keeps only started and incomplete gantt tasks in the in-progress column", () => {
    const tasks = parseProjectKanbanTasksFromXml(MIXED_TASK_XML, NOW);

    expect(tasks).toEqual([
      expect.objectContaining({
        column: "ISSUE_STATUS_IN_PROGRESS",
        id: "1",
        progressPercentage: 40,
        title: "Active task",
      }),
    ]);
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

  it("filters out tasks whose progress is complete in ratio or percent-like form", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="30" start_date="2026-03-05 09:00" progress="1.0"><![CDATA[Ratio complete]]></task>
  <task id="31" start_date="2026-03-05 09:00" progress="100"><![CDATA[Percent complete]]></task>
  <task id="32" start_date="2026-03-05 09:00" progress="0.99"><![CDATA[Almost done]]></task>
</data>
`;

    const tasks = parseProjectKanbanTasksFromXml(xml, NOW);

    expect(tasks).toEqual([
      expect.objectContaining({
        id: "32",
        progressPercentage: 99,
        title: "Almost done",
      }),
    ]);
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
