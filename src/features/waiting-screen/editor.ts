export function shouldDeleteSelectedWidget({
  key,
  hasSelection,
  modalOpen,
  editableTarget,
}: {
  key: string;
  hasSelection: boolean;
  modalOpen: boolean;
  editableTarget: boolean;
}): boolean {
  return key === "Delete" && hasSelection && !modalOpen && !editableTarget;
}
