export const ENTITY_LIST_VIEW_MODES = [
  "main-listing-view",
  "side-nav-narrow-view",
] as const;

export type EntityListItemViewMode = typeof ENTITY_LIST_VIEW_MODES[number];
