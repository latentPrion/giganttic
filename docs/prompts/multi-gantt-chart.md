Ok: here's what:

We'll add a new ProjectGanttCharts table which has its own PK `id` and has a FK ref to Projects.id for its containing parent project. We will not be making Project comments or attachments chart-specific. They will remain project-scoped.

TaskMirror will now have its FK ref to Projects.id updated to point to Charts.id. This eases the data migration by ensuring that the migration pre-structural migration script can just do a simple select on all TaskMirror rows, and for each Task, just leave the TaskId alone, but upsert a row into ProjectGanttCharts for its parent chart (use ID=0 for ProjectGanttCharts.chartId), and insert the RETURNING ProjectGanttCharts.id for that upserted row into that TaskMirror row's Projectid. Then the structural migration will simply rename the TaskMirror.Projectid field to TaskMirror.ProjectGanttChartsId.

TaskComments can be pre-structurally migrated by setting all fields' IDs to 0, and in the structural migration, rename TaskComments.PRojectId => ProjectGanttChartId.
The same form of migration should do well for TaskAttachments.
The same form of migration shuold work for TaskComments_Attachments. These will now be unique on chartId and taskId and commentId.

From there, we should be able to do a hard cutover. No compatibility nonsense. I don't wanna have to think about legacy cruft.

For the rest of it, The ProjectGanttCharts table should have a "name" field for each chart. When doing the upserts in the pre-structural migration work, just set the name to "default". There is no task right now that has more than one chart (obv). Put a drop-down next to the <h1> that says "Project Manager Gantt", and let the user choose which Gantt chart is to be displayed and manipulated in the Gantt tab of the Projects SPA. Load all charts for a project at page load. Integrate all charts for the project into the shared events bus, etc, and have the Kanban board display and manipulate all of them. Same for the "Tasks" tab.

Ensure that you cleanly and aggressively split code into modules, subfunctions and that you doggedly and religiously reuse code where possible and don't duplicate code.

Put a little chip with the number of Gantt charts for this project on the "Gantt" tab to the right of the "Gantt" text.

Naturally, ensure that the Gantt controls state for each chart is separate and maintained when the user switches from one chart to another, and then switches back.

Of course, adding new charts, editing current tasks/milstones, etc, should all work as they do now. Moreover, ensure that the dhtmlx-gantt renderer and editor is properly integrated to switch between charts when the user switches with the dropdown.

All the same logic we have right now for determining task and especially milestone status (i.e: if one dependency milestone/task is blocked, then the dependent milestones should also blocked, etc) is should be properly propagated for the multi-chart features.

I have updated the local prod database to be a copy of the upstream live DB, so you can see exactly what target DB you'll need to write your migration scripts against and you can loop to ensure that your migrations produce the desired preservation of the rows in the prod DB.