"use client";

import { Ellipsis, Pause, Pencil, Play, Scale, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CorrectCountDialog } from "./correct-count-dialog";
import { EditMedicationDialog } from "./edit-medication-dialog";
import { PauseMedicationDialog } from "./pause-medication-dialog";
import type { StockDialogProps } from "./stock-dialog-parts";

type OpenDialog = "correct" | "edit" | "pause" | null;

/**
 * The card's "⋯" menu (mock 45:1930): "Correct count", "Edit" and "Pause" (or "Resume" while
 * paused) open their dialogs; "Remove" (S-08) is a disabled placeholder until its slice lands.
 */
export function MedicationOptionsMenu({ medication, today }: StockDialogProps) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const paused = medication.pausedOn !== null;

  /** Open state of one dialog; closing it closes whichever dialog is open. */
  function dialogProps(name: Exclude<OpenDialog, null>) {
    return {
      open: dialog === name,
      onOpenChange: (open: boolean) => setDialog(open ? name : null),
    };
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Options for ${medication.name}`}>
            <Ellipsis className="size-6" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setDialog("correct")}>
            <Scale aria-hidden />
            Correct count
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil aria-hidden />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("pause")}>
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
            {paused ? "Resume" : "Pause"}
          </DropdownMenuItem>
          <DropdownMenuItem disabled variant="destructive">
            <Trash2 aria-hidden />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CorrectCountDialog medication={medication} today={today} {...dialogProps("correct")} />
      <EditMedicationDialog medication={medication} today={today} {...dialogProps("edit")} />
      <PauseMedicationDialog medication={medication} today={today} {...dialogProps("pause")} />
    </>
  );
}
