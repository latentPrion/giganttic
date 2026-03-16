import type {
  Issue,
  IssueStatus,
} from "../../contracts/issue.contracts.js";

export type KanbanColumnValue = IssueStatus;

export interface GanttTaskCardData {
  id: string;
  progressPercentage: number;
  startDate: string;
  title: string;
}

export interface KanbanIssueCardData {
  column: KanbanColumnValue;
  id: string;
  issue: Issue;
  kind: "issue";
  title: string;
}

export interface KanbanTaskCardModel {
  column: KanbanColumnValue;
  id: string;
  kind: "ganttTask";
  task: GanttTaskCardData;
  title: string;
}

export type KanbanCardModel =
  | KanbanIssueCardData
  | KanbanTaskCardModel;

export interface KanbanColumnModel {
  cards: KanbanCardModel[];
  value: KanbanColumnValue;
}
