import React from "react";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface UserListItemUser {
  description?: string | null;
  id: number;
  username: string;
}

interface UserListItemProps {
  actionContent?: React.ReactNode;
  onOpenSummary(): void;
  user: UserListItemUser;
  viewMode: EntityListItemViewMode;
}

export function UserListItem(props: UserListItemProps) {
  return (
    <EntityListItemCard
      actionContent={props.actionContent}
      description={props.user.description ?? null}
      onOpenSummary={props.onOpenSummary}
      title={props.user.username}
      viewMode={props.viewMode}
    />
  );
}
