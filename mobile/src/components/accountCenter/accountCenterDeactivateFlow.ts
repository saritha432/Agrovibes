export type DeactivateDeleteAction = "deactivate" | "delete";

let pendingAction: DeactivateDeleteAction | null = null;

export function setPendingDeactivateAction(action: DeactivateDeleteAction) {
  pendingAction = action;
}

export function getPendingDeactivateAction(): DeactivateDeleteAction | null {
  return pendingAction;
}

export function clearPendingDeactivateAction() {
  pendingAction = null;
}
