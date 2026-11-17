import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { MedicationCard, type OverviewItem } from "./medication-card";
import { URGENCY_GROUPS, type UrgencyGroup } from "./urgency";

export type UrgencyGroups = Record<UrgencyGroup, OverviewItem[]>;

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

/** Cards grouped red → yellow → green; empty groups are left out. */
export function MedicationGroups({ groups }: { groups: UrgencyGroups }) {
  return (
    <div className="flex flex-col gap-10">
      {URGENCY_GROUPS.filter(({ key }) => groups[key].length > 0).map(
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
                  <MedicationCard item={item} />
                </li>
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  );
}

/** Empty profile: illustration card with the add button. */
export function NoMedications({ action }: { action: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[16px] border bg-card px-6 py-8 text-center">
      <div className="relative h-[160px] w-[136px] shrink-0 overflow-hidden">
        <Image src="/brand/mascot.png" alt="" fill sizes="286px" className="object-cover" />
      </div>
      <p className="text-base text-brand-subtle">No medications yet.</p>
      {action}
    </div>
  );
}
