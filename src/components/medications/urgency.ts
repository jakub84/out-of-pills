import type { Urgency } from "@/lib/medications/stock";

/** Background of the urgency dot / bar fill (tokens from `globals.css`). */
export const urgencyBgClass: Record<Urgency, string> = {
  "ran-out": "bg-urgency-red",
  red: "bg-urgency-red",
  yellow: "bg-urgency-yellow",
  green: "bg-urgency-green",
};

/** Short label of the urgency group (PRD FR-015 thresholds). */
export const urgencyLabel: Record<Urgency, string> = {
  "ran-out": "Not enough for a day",
  red: "14 days or less",
  yellow: "30 days or less",
  green: "More than 30 days",
};
