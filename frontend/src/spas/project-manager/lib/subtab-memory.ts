import type { IssueStatus } from "../contracts/issue.contracts.js";

export type IssueFilterTab = IssueStatus;

const issueTabByProjectId = new Map<number, IssueFilterTab>();
const taskTabByProjectId = new Map<number, IssueStatus>();

export function getIssueStatusTab(projectId: number): IssueFilterTab | null {
  return issueTabByProjectId.get(projectId) ?? null;
}

export function setIssueStatusTab(projectId: number, tab: IssueFilterTab): void {
  issueTabByProjectId.set(projectId, tab);
}

export function getTaskStatusTab(projectId: number): IssueStatus | null {
  return taskTabByProjectId.get(projectId) ?? null;
}

export function setTaskStatusTab(projectId: number, tab: IssueStatus): void {
  taskTabByProjectId.set(projectId, tab);
}

export function clearSubtabMemory(): void {
  issueTabByProjectId.clear();
  taskTabByProjectId.clear();
}

