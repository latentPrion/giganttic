import type { Issue } from "../../contracts/issue.contracts.js";
import type { ParsedGanttKanbanTask } from "../../lib/project-kanban-gantt-parser.js";
import {
  KANBAN_COLUMN_VALUES,
} from "./kanban.constants.js";
import type {
  KanbanCardModel,
  KanbanColumnModel,
  KanbanColumnValue,
} from "./kanban.types.js";

function sortIssuesForKanban(issues: Issue[]): Issue[] {
  return [...issues].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if (right.progressPercentage !== left.progressPercentage) {
      return right.progressPercentage - left.progressPercentage;
    }

    return left.id - right.id;
  });
}

function sortTasksForKanban(tasks: ParsedGanttKanbanTask[]): ParsedGanttKanbanTask[] {
  return [...tasks].sort((left, right) => {
    const startDateDifference =
      new Date(left.startDate).getTime() - new Date(right.startDate).getTime();

    if (startDateDifference !== 0) {
      return startDateDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

function createIssueCards(issues: Issue[]): KanbanCardModel[] {
  return sortIssuesForKanban(issues).map((issue) => ({
    column: issue.status,
    id: `issue:${issue.id}`,
    issue,
    kind: "issue",
    title: issue.name,
  }));
}

function createTaskCards(tasks: ParsedGanttKanbanTask[]): KanbanCardModel[] {
  return sortTasksForKanban(tasks).map((task) => ({
    column: task.column,
    id: `ganttTask:${task.id}`,
    kind: "ganttTask",
    task,
    title: task.title,
  }));
}

function filterCardsForColumn(
  cards: KanbanCardModel[],
  column: KanbanColumnValue,
): KanbanCardModel[] {
  return cards.filter((card) => card.column === column);
}

export function createKanbanColumns(
  issues: Issue[],
  tasks: ParsedGanttKanbanTask[],
): KanbanColumnModel[] {
  const cards = [...createIssueCards(issues), ...createTaskCards(tasks)];

  return KANBAN_COLUMN_VALUES.map((column) => ({
    cards: filterCardsForColumn(cards, column),
    value: column,
  }));
}
