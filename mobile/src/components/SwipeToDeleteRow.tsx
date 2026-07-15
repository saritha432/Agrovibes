import React from "react";
import type { ViewStyle } from "react-native";
import { SwipeActionsRow } from "./SwipeActionsRow";

type SwipeToDeleteRowProps = {
  children: React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
  style?: ViewStyle;
};

/** Swipe left to reveal a delete action on the right (Instagram-style). */
export function SwipeToDeleteRow({ children, onDelete, deleteLabel = "Delete", style }: SwipeToDeleteRowProps) {
  return (
    <SwipeActionsRow
      style={style}
      actions={[{ key: "delete", label: deleteLabel, backgroundColor: "#dc2626", onPress: onDelete }]}
    >
      {children}
    </SwipeActionsRow>
  );
}
