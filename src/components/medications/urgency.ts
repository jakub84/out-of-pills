import {
  AlarmClockCheck,
  CirclePause,
  ClockAlert,
  MessageCircleWarning,
  type LucideIcon,
} from "lucide-react";

import type { Urgency } from "@/lib/medications/stock";

/** Background of the urgency dot / bar fill (tokens from `globals.css`). */
export const urgencyBgClass: Record<Urgency, string> = {
  "ran-out": "bg-urgency-red",
  red: "bg-urgency-red",
  yellow: "bg-urgency-yellow",
  green: "bg-urgency-green",
  paused: "bg-muted-foreground",
};

/** Text in the urgency colour (days-left number, group headers). */
export const urgencyTextClass: Record<Urgency, string> = {
  "ran-out": "text-urgency-red",
  red: "text-urgency-red",
  yellow: "text-urgency-yellow",
  green: "text-urgency-green",
  paused: "text-muted-foreground",
};

/** Light urgency background with a matching soft border (e.g. the "After adding" preview). */
export const urgencyTintClass: Record<Urgency, string> = {
  "ran-out": "border-urgency-red/40 bg-urgency-red-tint",
  red: "border-urgency-red/40 bg-urgency-red-tint",
  yellow: "border-urgency-yellow/40 bg-urgency-yellow-tint",
  green: "border-urgency-green/40 bg-urgency-green-tint",
  paused: "border-border bg-muted",
};

/** Short label of the urgency group (PRD FR-015 thresholds). */
export const urgencyLabel: Record<Urgency, string> = {
  "ran-out": "Not enough for a day",
  red: "14 days or less",
  yellow: "30 days or less",
  green: "More than 30 days",
  paused: "Paused",
};

export type UrgencyGroup = "red" | "yellow" | "green";

/** Groups of cards on the overview: the run-out groups, then paused medications. */
export type CardGroup = UrgencyGroup | "paused";

type GroupStyle<K extends CardGroup> = {
  key: K;
  label: string;
  Icon: LucideIcon;
  textClass: string;
};

/** The run-out groups in display order (tiles and grouped cards, mock 176:226). */
export const URGENCY_GROUPS: (GroupStyle<UrgencyGroup> & { borderClass: string })[] = [
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

/** Card groups in display order: the run-out groups, then paused (which has no run-out tile). */
export const CARD_GROUPS: GroupStyle<CardGroup>[] = [
  ...URGENCY_GROUPS,
  {
    key: "paused",
    label: urgencyLabel.paused,
    Icon: CirclePause,
    textClass: urgencyTextClass.paused,
  },
];
