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
  onNavigate?(): void;
  user: UserListItemUser;
  viewMode: EntityListItemViewMode;
}

export function UserListItem(props: UserListItemProps) {
  return (
    <EntityListItemCard
      actionContent={props.actionContent}
      description={props.user.description ?? null}
      onNavigate={props.onNavigate}
      title={props.user.username}
      viewMode={props.viewMode}
    />
  );
}
