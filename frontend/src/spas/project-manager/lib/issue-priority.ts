import {
  IssuePriorityCode,
  issuePriorityMaximum,
  issuePriorityMinimum,
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

export function clampIssuePriorityValue(value: number): IssuePriorityCode {
  if (value <= issuePriorityMinimum) {
    return issuePriorityMinimum;
  }
  if (value >= issuePriorityMaximum) {
    return issuePriorityMaximum;
  }

  return value as IssuePriorityCode;
}

export function getIssuePriorityLabel(priority: number): string {
  return issuePriorityLabels[clampIssuePriorityValue(priority)] ?? `${priority}`;
}
