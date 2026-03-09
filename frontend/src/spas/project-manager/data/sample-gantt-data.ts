const SAMPLE_TASKS = [
  {
    duration: 4,
    id: 1,
    open: true,
    progress: 0.6,
    start_date: "2026-03-09 00:00",
    text: "Sample Discovery",
  },
  {
    duration: 3,
    id: 2,
    parent: 1,
    progress: 0.3,
    start_date: "2026-03-13 00:00",
    text: "Initial Buildout",
  },
  {
    duration: 5,
    id: 3,
    progress: 0.15,
    start_date: "2026-03-17 00:00",
    text: "Stakeholder Review",
  },
] as const;

const SAMPLE_LINKS = [
  {
    id: 1,
    source: 1,
    target: 2,
    type: "0",
  },
  {
    id: 2,
    source: 2,
    target: 3,
    type: "0",
  },
] as const;

export function createSampleGanttData() {
  return {
    data: [...SAMPLE_TASKS],
    links: [...SAMPLE_LINKS],
  };
}
