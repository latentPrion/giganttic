import React from "react";
import type { LobbyProject } from "../../../lobby/contracts/lobby.contracts.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface ProjectListItemProps {
  actionContent?: React.ReactNode;
  onNavigate?(): void;
  project: LobbyProject;
  viewMode: EntityListItemViewMode;
}

export function ProjectListItem(props: ProjectListItemProps) {
  return (
    <EntityListItemCard
      actionContent={props.actionContent}
      description={props.project.description}
      onNavigate={props.onNavigate}
      title={props.project.name}
      viewMode={props.viewMode}
    />
  );
}
