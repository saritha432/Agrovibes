let isOpen = false;
let closeHandler: (() => void) | null = null;

export function setCreateModalOpen(open: boolean, onClose?: () => void) {
  isOpen = open;
  closeHandler = open && onClose ? onClose : null;
}

export function tryCloseCreateModal(): boolean {
  if (!isOpen || !closeHandler) return false;
  closeHandler();
  return true;
}
