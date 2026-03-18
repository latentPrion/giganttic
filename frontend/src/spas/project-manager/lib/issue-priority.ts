import {
  IssuePriorityCode,
  issuePriorityLabels,
  issuePriorityValues,
} from "../../../../../db/v3/schema.js";

export {
  IssuePriorityCode,
};

interface IssuePriorityOption {
  label: string;
  value: IssuePriorityCode;
}

export function createIssuePriorityOptions(): IssuePriorityOption[] {
  return issuePriorityValues.map((value: IssuePriorityCode) => ({
    label: issuePriorityLabels[value],
    value,
  }));
}

export function getIssuePriorityLabel(priority: number): string {
  return issuePriorityLabels[priority as IssuePriorityCode] ?? `${priority}`;
}
