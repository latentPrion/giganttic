import React from "react";
import type { LobbyProject } from "../../../lobby/contracts/lobby.contracts.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface ProjectListItemProps {
  actionContent?: React.ReactNode;
  onOpenSummary(): void;
  project: LobbyProject;
  viewMode: EntityListItemViewMode;
}

export function ProjectListItem(props: ProjectListItemProps) {
  return (
    <EntityListItemCard
      actionContent={props.actionContent}
      description={props.project.description}
      onOpenSummary={props.onOpenSummary}
      title={props.project.name}
      viewMode={props.viewMode}
    />
  );
}
