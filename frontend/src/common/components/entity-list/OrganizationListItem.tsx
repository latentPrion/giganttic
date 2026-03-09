import React from "react";
import type { LobbyOrganization } from "../../../lobby/contracts/lobby.contracts.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface OrganizationListItemProps {
  actionContent?: React.ReactNode;
  onNavigate?(): void;
  organization: LobbyOrganization;
  viewMode: EntityListItemViewMode;
}

export function OrganizationListItem(props: OrganizationListItemProps) {
  return (
    <EntityListItemCard
      actionContent={props.actionContent}
      description={props.organization.description}
      onNavigate={props.onNavigate}
      title={props.organization.name}
      viewMode={props.viewMode}
    />
  );
}
