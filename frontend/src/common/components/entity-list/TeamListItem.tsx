import React from "react";
import type { LobbyTeam } from "../../../lobby/contracts/lobby.contracts.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface TeamListItemProps {
  actionContent?: React.ReactNode;
  onNavigate?(): void;
  team: LobbyTeam;
  viewMode: EntityListItemViewMode;
}

export function TeamListItem(props: TeamListItemProps) {
  return (
    <EntityListItemCard
      actionContent={props.actionContent}
      description={props.team.description}
      onNavigate={props.onNavigate}
      title={props.team.name}
      viewMode={props.viewMode}
    />
  );
}
