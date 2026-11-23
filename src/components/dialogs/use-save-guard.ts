import { useRef } from "react";

/** Runs a save during which the dialog stays open. */
export type GuardSave = <T>(save: () => Promise<T>) => Promise<T>;

/**
 * Keeps a dialog open while its form is saving, so a failed save still has its values and an
 * error from the server has somewhere to appear. Escape, an outside click, the close icon and
 * Cancel all go through `onOpenChange`; closing after a successful save does not.
 */
export function useSaveGuard(setOpen: (open: boolean) => void) {
  const saving = useRef(false);

  function onOpenChange(open: boolean) {
    if (open || !saving.current) setOpen(open);
  }

  const guardSave: GuardSave = async (save) => {
    saving.current = true;
    try {
      return await save();
    } finally {
      saving.current = false;
    }
  };

  return { onOpenChange, guardSave };
}
