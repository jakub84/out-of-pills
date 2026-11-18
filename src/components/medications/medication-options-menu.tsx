"use client";

import { Ellipsis, Pencil, Scale, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CorrectCountDialog } from "./correct-count-dialog";
import type { StockDialogProps } from "./stock-dialog-parts";

/**
 * The card's "⋯" menu (mock 45:1930): "Correct count" opens its dialog; "Edit" (S-07) and
 * "Remove" (S-08) are disabled placeholders until their slices land.
 */
export function MedicationOptionsMenu({ medication, today }: StockDialogProps) {
  const [correcting, setCorrecting] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label={`Options for ${medication.name}`}>
            <Ellipsis className="size-6" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setCorrecting(true)}>
            <Scale aria-hidden />
            Correct count
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Pencil aria-hidden />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem disabled variant="destructive">
            <Trash2 aria-hidden />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CorrectCountDialog
        medication={medication}
        today={today}
        open={correcting}
        onOpenChange={setCorrecting}
      />
    </>
  );
}
