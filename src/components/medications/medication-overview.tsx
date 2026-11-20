import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { MedicationCard, type OverviewItem } from "./medication-card";
import { CARD_GROUPS, URGENCY_GROUPS, type CardGroup } from "./urgency";

/** Cards per group, as `groupByUrgency` returns them; paused items are only in `paused`. */
export type UrgencyGroups = Record<CardGroup, OverviewItem[]>;

/** "What's running out?" tiles (mock 176:460 / 176:456 / 176:464); counts are the group sizes. */
export function RunOutTiles({ groups }: { groups: UrgencyGroups }) {
  return (
    <section aria-labelledby="running-out-heading" className="flex flex-col gap-5">
      <h2
        id="running-out-heading"
        className="font-heading text-2xl font-normal text-foreground sm:text-[32px]"
      >
        What&apos;s running out?
      </h2>
      <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap sm:gap-[30px]">
        {URGENCY_GROUPS.map(({ key, label, Icon, textClass, borderClass }) => (
          <li
            key={key}
            className={cn(
              "flex flex-col items-center gap-[5px] rounded-[16px] border border-dashed bg-card px-2 pt-3 pb-2.5 text-center sm:w-[153px]",
              borderClass,
            )}
          >
            <Icon className={cn("size-6", textClass)} aria-hidden />
            <span className="font-heading text-2xl leading-6 font-bold text-foreground">
              {groups[key].length}
            </span>
            <span className="text-sm leading-5 text-brand-subtle">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Cards grouped red → yellow → green, then paused; empty groups are left out. */
export function MedicationGroups({ groups, today }: { groups: UrgencyGroups; today: string }) {
  return (
    <div className="flex flex-col gap-10">
      {CARD_GROUPS.filter(({ key }) => groups[key].length > 0).map(
        ({ key, label, Icon, textClass }) => (
          <section key={key} aria-labelledby={`group-${key}`} className="flex flex-col gap-4">
            <h3
              id={`group-${key}`}
              className={cn("flex items-center gap-2 text-sm font-bold", textClass)}
            >
              <Icon className="size-5" aria-hidden />
              {label}
              <span className="font-normal">({groups[key].length})</span>
            </h3>
            <ul className="flex flex-col gap-4">
              {groups[key].map((item) => (
                <li key={item.id}>
                  <MedicationCard item={item} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

const EMPTY_STATE_BENEFITS = [
  "See how many tablets are left, without opening the box.",
  "Know the day each medication runs out.",
  "Spot what needs a refill: anything with 14 days or less turns red.",
];

/** Empty profile: what tracking gives you, then the add button. Sits directly on the page. */
export function NoMedications({ action }: { action: ReactNode }) {
  return (
    <div className="flex max-w-lg flex-col items-start gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-xl font-medium text-foreground">
          This shelf is empty. For now.
        </h3>
        <p className="text-base text-brand-ink">
          Add the first medication and we&apos;ll do the counting, so a refill never catches you
          on the last pill.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm text-brand-ink">
        {EMPTY_STATE_BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {benefit}
          </li>
        ))}
      </ul>
      {action}
    </div>
  );
}
