import { CirclePause } from "lucide-react";

import { dateTileParts, formatShortDate, formatTablets } from "@/lib/medications/format";
import type { Stock, StockItem, Urgency } from "@/lib/medications/stock";
import { cn } from "@/lib/utils";
import { AddPackageDialog } from "./add-package-dialog";
import { MedicationOptionsMenu } from "./medication-options-menu";
import { urgencyBgClass, urgencyTextClass } from "./urgency";

/** A medication with today's figures and its stored baseline, as the overview renders it. */
export type OverviewItem = StockItem & {
  dailyDose: number;
  packageSize: number;
  pillsCounted: number;
  countedOn: string;
  pausedOn: string | null;
};

/** Bar segments in days (0–14, 15–30, 31–60); the fill stops at 60 days. */
const BAR_SEGMENTS = [
  { start: 0, length: 14 },
  { start: 14, length: 16 },
  { start: 30, length: 30 },
];
const BAR_MAX_DAYS = 60;

/**
 * One medication card (mock 176:226): date tile, urgency dot, details, days left, bar, the
 * add-package button and the "⋯" options menu (mock 45:1930). A paused medication is muted:
 * a dash in the date tile and "Paused since …" instead of days left, bar and add-package.
 * `today` is the server's Warsaw date for the dialogs.
 */
export function MedicationCard({ item, today }: { item: OverviewItem; today: string }) {
  const { stock } = item;
  const ranOut = stock.urgency === "ran-out";
  const paused = item.pausedOn !== null;
  // Null while paused, so the tile shows a dash.
  const tileDate = stock.runOutDate ?? stock.lastCoveredDay;

  return (
    <article className="@container flex items-stretch gap-3 sm:gap-6">
      <DateTile date={tileDate} />
      {/* Timeline (mock 45:1937 / 45:1938): a dashed line through an 18px urgency dot. */}
      <div aria-hidden className="relative hidden w-[18px] shrink-0 items-center @lg:flex">
        <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-border" />
        <span className={cn("relative size-[18px] rounded-full", urgencyBgClass[stock.urgency])} />
      </div>
      <div
        className={cn(
          // Details, days left and the button share one row, bottom-aligned, once the row is wide
          // enough (@3xl of the article); narrower, they stack. The "⋯" sits top-right, its right
          // edge in line with the button's; the one-row min height keeps ~16px between them.
          "relative flex min-w-0 flex-1 flex-wrap items-end justify-between gap-x-6 gap-y-3 rounded-[16px] border bg-card px-4 py-[18px] @3xl:min-h-[108px] @3xl:flex-nowrap @3xl:px-5",
          ranOut && "border-urgency-red bg-urgency-red-tint",
          paused && "border-dashed bg-muted",
        )}
      >
        <div className="flex min-w-0 flex-col gap-2 pr-8 @3xl:pr-0">
          <h4 className="font-heading text-xl leading-6 font-bold break-words text-foreground">
            {item.name}
          </h4>
          <div className="text-sm text-muted-foreground">
            <p className="leading-[18px] font-medium">
              {formatTablets(item.dailyDose)} tabl. daily ·{" "}
              <span className="font-bold text-foreground">
                {formatTablets(stock.pillsLeft)} tabl.
              </span>{" "}
              left
            </p>
          </div>
        </div>
        {item.pausedOn !== null ? (
          // Paused: no days left, no bar and no restock; the count stays frozen.
          <p className="flex w-fit items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs font-semibold text-muted-foreground @3xl:mb-1 @3xl:shrink-0">
            <CirclePause className="size-3.5" aria-hidden />
            Paused since {formatShortDate(item.pausedOn)}
          </p>
        ) : (
          <>
            <StockSummary stock={stock} />
            <div className="flex w-full @3xl:w-auto @3xl:shrink-0">
              <AddPackageDialog medication={item} today={today} />
            </div>
          </>
        )}
        <div className="absolute top-3.5 right-4 @3xl:right-5">
          <MedicationOptionsMenu medication={item} today={today} />
        </div>
      </div>
    </article>
  );
}

/** Days left (or the "Ran out" badge) above the stock bar. */
function StockSummary({ stock }: { stock: Stock }) {
  const ranOut = stock.urgency === "ran-out";
  return (
    <div className="flex w-full flex-col gap-2 @3xl:mb-1 @3xl:w-auto @3xl:shrink-0">
      {ranOut ? (
        <span className="w-fit rounded-full bg-urgency-red px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
          Ran out
        </span>
      ) : (
        <p
          className={cn(
            "flex items-baseline gap-1 font-heading font-semibold",
            urgencyTextClass[stock.urgency],
          )}
        >
          <span className="text-2xl leading-5">{stock.daysLeft}</span>
          <span className="text-sm leading-5">
            {stock.daysLeft === 1 ? "day left" : "days left"}
          </span>
        </p>
      )}
      <StockBar daysLeft={stock.daysLeft} urgency={stock.urgency} />
    </div>
  );
}

/** Weekday and day.month of the run-out (or last covered) day; a dash when there is none. */
function DateTile({ date }: { date: string | null }) {
  const parts = date ? dateTileParts(date) : null;
  return (
    <div
      aria-hidden
      className="flex w-[84px] shrink-0 flex-col items-center justify-center gap-1 rounded-[16px] border bg-card px-1 py-3 text-center @lg:w-[106px]"
    >
      {parts ? (
        <>
          <span className="text-sm leading-5 text-brand-subtle">{parts.weekday}</span>
          <span className="font-heading text-2xl leading-6 font-bold text-foreground">
            {parts.dayMonth}
          </span>
        </>
      ) : (
        <span className="font-heading text-2xl font-bold text-brand-subtle">–</span>
      )}
    </div>
  );
}

/** Three-segment stock bar; the fill is proportional to min(daysLeft, 60). */
function StockBar({ daysLeft, urgency }: { daysLeft: number; urgency: Urgency }) {
  const days = Math.min(daysLeft, BAR_MAX_DAYS);
  return (
    <div aria-hidden className="flex w-full gap-1.5 @3xl:w-[221px]">
      {BAR_SEGMENTS.map(({ start, length }) => {
        const fill = Math.min(Math.max((days - start) / length, 0), 1);
        return (
          <div
            key={start}
            className="h-1.5 overflow-hidden rounded-full bg-urgency-track"
            style={{ flexGrow: length, flexBasis: 0 }}
          >
            <div
              className={cn("h-full rounded-full", urgencyBgClass[urgency])}
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
