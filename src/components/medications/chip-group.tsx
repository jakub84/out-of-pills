"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ChipOption = { value: string; label: string };

type ChipGroupProps = {
  /** Id of the element that labels the group. */
  labelledBy: string;
  describedBy?: string;
  options: readonly ChipOption[];
  /** Selected value; "" selects none. */
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  /** Id of the group element (used to move focus into it). */
  id?: string;
};

/**
 * Single-choice chips (mock 177:601): a radio group with arrow-key navigation.
 * Clicking the selected chip keeps it selected.
 */
export function ChipGroup({
  labelledBy,
  describedBy,
  options,
  value,
  onValueChange,
  invalid,
  id,
}: ChipGroupProps) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      variant="outline"
      spacing={3}
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
      className="w-full flex-wrap"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="h-9 min-w-12 rounded-full border-border bg-card px-3.5 text-[13px] font-semibold text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Focuses the selected chip of a group, or its first chip. */
export function focusChipGroup(groupId: string) {
  const group = document.getElementById(groupId);
  const target =
    group?.querySelector<HTMLElement>('[data-state="on"]') ??
    group?.querySelector<HTMLElement>("button");
  target?.focus();
}
