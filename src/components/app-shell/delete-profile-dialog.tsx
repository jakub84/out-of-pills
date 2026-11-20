"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";

import { useSaveGuard, type GuardSave } from "@/components/medications/use-save-guard";
import { useNavigationPending } from "@/components/navigation/navigation-pending";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSidebar } from "@/components/ui/sidebar";
import { profileDeletedMessage } from "@/lib/feedback/messages";
import { runSaveAction } from "@/lib/feedback/run-save-action";
import { deleteProfile } from "@/lib/profiles/actions";
import { initialProfileFormState, type ProfileFormState } from "@/lib/profiles/form-state";
import type { ProfileNavItem } from "./profile-nav";

type DeleteDialogProfile = Pick<ProfileNavItem, "id" | "name" | "medicationCount">;

/** What goes with the profile; without a count (failed to load) it never claims a number. */
function deletionImpact(medicationCount: number | null): string {
  if (medicationCount === null) return "This deletes the profile and all its medications.";
  if (medicationCount === 0) return "This deletes the profile.";
  const noun = medicationCount === 1 ? "medication" : "medications";
  return `This deletes the profile and its ${medicationCount} ${noun}.`;
}

/**
 * Delete confirmation (FR-005): the caller leaves the profile, and the last caregiver to leave
 * deletes it with its medications. Controlled — the sidebar row's options menu opens it.
 */
export function DeleteProfileDialog({
  profile,
  open,
  onOpenChange,
}: {
  profile: DeleteDialogProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const guard = useSaveGuard(onOpenChange);

  return (
    <Dialog open={open} onOpenChange={guard.onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto p-5 sm:max-w-md sm:p-6">
        {/* Content unmounts when closed, so every opening starts without an old error. */}
        <DeleteProfileForm
          profile={profile}
          guardSave={guard.guardSave}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function DeleteProfileForm({
  profile,
  guardSave,
  onSaved,
}: {
  profile: DeleteDialogProfile;
  guardSave: GuardSave;
  onSaved: () => void;
}) {
  const { navigate } = useNavigationPending();
  const { setOpenMobile } = useSidebar();
  // Frozen once the deletion succeeds, so the dialog keeps the name it opened with while it
  // closes, even if the sidebar re-renders before it unmounts.
  const [frozen, setFrozen] = useState<DeleteDialogProfile | null>(null);
  const shown = frozen ?? profile;

  const [state, formAction, isPending] = useActionState(
    async (prev: ProfileFormState, formData: FormData) => {
      // A failed request keeps the dialog open.
      const result = await runSaveAction(
        () => guardSave(() => deleteProfile(prev, formData)),
        initialProfileFormState,
      );
      if (result.status === "success") {
        setFrozen(shown);
        // First: the row unmounts after the revalidation, taking the dialog with it.
        toast.success(profileDeletedMessage(shown.name));
        onSaved();
        // On phones the sidebar is a sheet: close it along with the dialog.
        setOpenMobile(false);
        // Leaves `?profile=<id>` or the edit page: `/` shows the oldest remaining profile,
        // or sends the caregiver to onboarding when none remain.
        navigate("/");
      }
      return result;
    },
    initialProfileFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="profileId" value={shown.id} />

      <DialogHeader className="gap-1.5 pr-8">
        <DialogTitle className="font-heading text-2xl font-normal break-words">
          Delete {shown.name}?
        </DialogTitle>
        <DialogDescription className="text-brand-subtle">
          {deletionImpact(shown.medicationCount)} This can&apos;t be undone.
        </DialogDescription>
      </DialogHeader>

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3 sm:justify-end">
        <DialogClose asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          variant="destructive"
          size="lg"
          disabled={isPending}
          className="flex-1 sm:flex-none"
        >
          {isPending ? "Deleting…" : "Delete profile"}
        </Button>
      </div>
    </form>
  );
}
