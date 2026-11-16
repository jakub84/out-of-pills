import { dateTileParts, formatFullDate, formatTablets } from "@/lib/medications/format";
import type { Stock, StockItem, Urgency } from "@/lib/medications/stock";
import { cn } from "@/lib/utils";
import { urgencyBgClass, urgencyTextClass } from "./urgency";

/** A medication with today's figures, as the overview renders it. */
export type OverviewItem = StockItem & { dailyDose: number };

/** Bar segments in days (0–14, 15–30, 31–60); the fill stops at 60 days. */
const BAR_SEGMENTS = [
  { start: 0, length: 14 },
  { start: 14, length: 16 },
  { start: 30, length: 30 },
];
const BAR_MAX_DAYS = 60;

/** One medication card (mock 176:226): date tile, urgency dot, details, days left and bar. */
export function MedicationCard({ item }: { item: OverviewItem }) {
  const { stock } = item;
  const ranOut = stock.urgency === "ran-out";
  const tileDate = stock.runOutDate ?? stock.lastCoveredDay;

  return (
    <article className="flex items-stretch gap-3 sm:gap-5">
      <DateTile date={tileDate} />
      <span
        aria-hidden
        className={cn("hidden size-2.5 shrink-0 self-center rounded-full sm:block", urgencyBgClass[stock.urgency])}
      />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[16px] border bg-card px-4 py-3.5 sm:px-5",
          ranOut && "border-urgency-red bg-urgency-red-tint",
        )}
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <h4 className="font-heading text-lg font-semibold break-words text-foreground">
            {item.name}
          </h4>
          <p className="text-[13px] text-brand-subtle">
            {formatTablets(item.dailyDose)} tabl. daily ·{" "}
            <span className="font-bold text-foreground">{formatTablets(stock.pillsLeft)} tabl.</span>{" "}
            left
          </p>
          <p className="text-[13px] text-brand-subtle">{runOutLine(stock)}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {ranOut ? (
            <span className="w-fit rounded-full bg-urgency-red px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              Ran out
            </span>
          ) : (
            <p className={cn("flex items-baseline gap-1.5", urgencyTextClass[stock.urgency])}>
              <span className="font-heading text-2xl leading-none font-semibold">{stock.daysLeft}</span>
              <span className="text-xs">{stock.daysLeft === 1 ? "day left" : "days left"}</span>
            </p>
          )}
          <StockBar daysLeft={stock.daysLeft} urgency={stock.urgency} />
        </div>
      </div>
    </article>
  );
}

function runOutLine(stock: Stock): string {
  if (stock.runOutDate) return `Runs out on ${formatFullDate(stock.runOutDate)}`;
  if (stock.lastCoveredDay) return `Ran out on ${formatFullDate(stock.lastCoveredDay)}`;
  return "Not enough for a full day's dose";
}

/** Weekday / day / month of the run-out (or last covered) day; a dash when there is none. */
function DateTile({ date }: { date: string | null }) {
  const parts = date ? dateTileParts(date) : null;
  return (
    <div
      aria-hidden
      className="flex w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[12px] border bg-card px-1 py-2.5 text-center sm:w-[80px]"
    >
      {parts ? (
        <>
          <span className="text-[11px] text-brand-subtle">{parts.weekday}</span>
          <span className="font-heading text-xl leading-6 font-bold text-foreground">{parts.day}</span>
          <span className="text-xs text-brand-subtle">{parts.month}</span>
        </>
      ) : (
        <span className="font-heading text-xl font-bold text-brand-subtle">–</span>
      )}
    </div>
  );
}

/** Three-segment stock bar; the fill is proportional to min(daysLeft, 60). */
function StockBar({ daysLeft, urgency }: { daysLeft: number; urgency: Urgency }) {
  const days = Math.min(daysLeft, BAR_MAX_DAYS);
  return (
    <div aria-hidden className="flex w-[166px] gap-1">
      {BAR_SEGMENTS.map(({ start, length }) => {
        const fill = Math.min(Math.max((days - start) / length, 0), 1);
        return (
          <div
            key={start}
            className="h-1 overflow-hidden rounded-full bg-urgency-track"
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
