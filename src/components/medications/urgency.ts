import { AlarmClockCheck, ClockAlert, MessageCircleWarning, type LucideIcon } from "lucide-react";

import type { Urgency } from "@/lib/medications/stock";

/** Background of the urgency dot / bar fill (tokens from `globals.css`). */
export const urgencyBgClass: Record<Urgency, string> = {
  "ran-out": "bg-urgency-red",
  red: "bg-urgency-red",
  yellow: "bg-urgency-yellow",
  green: "bg-urgency-green",
};

/** Text in the urgency colour (days-left number, group headers). */
export const urgencyTextClass: Record<Urgency, string> = {
  "ran-out": "text-urgency-red",
  red: "text-urgency-red",
  yellow: "text-urgency-yellow",
  green: "text-urgency-green",
};

/** Light urgency background with a matching soft border (e.g. the "After adding" preview). */
export const urgencyTintClass: Record<Urgency, string> = {
  "ran-out": "border-urgency-red/40 bg-urgency-red-tint",
  red: "border-urgency-red/40 bg-urgency-red-tint",
  yellow: "border-urgency-yellow/40 bg-urgency-yellow-tint",
  green: "border-urgency-green/40 bg-urgency-green-tint",
};

/** Short label of the urgency group (PRD FR-015 thresholds). */
export const urgencyLabel: Record<Urgency, string> = {
  "ran-out": "Not enough for a day",
  red: "14 days or less",
  yellow: "30 days or less",
  green: "More than 30 days",
};

export type UrgencyGroup = "red" | "yellow" | "green";

/** The overview's groups in display order (tiles and grouped cards, mock 176:226). */
export const URGENCY_GROUPS: {
  key: UrgencyGroup;
  label: string;
  Icon: LucideIcon;
  textClass: string;
  borderClass: string;
}[] = [
  {
    key: "red",
    label: urgencyLabel.red,
    Icon: MessageCircleWarning,
    textClass: urgencyTextClass.red,
    borderClass: "border-urgency-red",
  },
  {
    key: "yellow",
    label: urgencyLabel.yellow,
    Icon: ClockAlert,
    textClass: urgencyTextClass.yellow,
    borderClass: "border-urgency-yellow",
  },
  {
    key: "green",
    label: urgencyLabel.green,
    Icon: AlarmClockCheck,
    textClass: urgencyTextClass.green,
    borderClass: "border-urgency-green",
  },
];
