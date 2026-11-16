// Run-out calculation: the single place that turns a stored medication into
// today's figures, urgency and order. Pure — no React, no Supabase — so it runs
// on the server and in the browser.
//
// Guardrail (PRD, Business Logic): the run-out date must never be later than
// the real one. Counts are handled as half-tablet integers, so no floating
// point rounding can push a date later.

const WARSAW_TIME_ZONE = "Europe/Warsaw";
const MS_PER_DAY = 86_400_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type Urgency = "ran-out" | "red" | "yellow" | "green";

export type StockInput = {
  /** Tablets counted, a multiple of 0.5. */
  pillsCounted: number;
  /** Calendar day of the count, `YYYY-MM-DD` (Europe/Warsaw). */
  countedOn: string;
  /** Tablets per day, a positive multiple of 0.5. */
  dailyDose: number;
};

export type Stock = {
  /** Tablets left today, never negative. */
  pillsLeft: number;
  /** Full daily doses left, today included; 0 means ran out. */
  daysLeft: number;
  /** Last day with a full dose; null once ran out. */
  runOutDate: string | null;
  /**
   * Only when ran out: the last day the counted stock covered a full dose.
   * Null while stock lasts, and null when the count never covered one full day.
   */
  lastCoveredDay: string | null;
  urgency: Urgency;
};

export type StockItem = {
  name: string;
  id: string;
  stock: Stock;
};

/** Today's calendar date in Europe/Warsaw as `YYYY-MM-DD`. */
export function todayInWarsaw(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WARSAW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function toEpochDay(date: string): number {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`Invalid date: ${date}`);
  const [, y, m, d] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) / MS_PER_DAY;
}

function fromEpochDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** `date` plus `n` calendar days (n may be negative). */
export function addDays(date: string, n: number): string {
  return fromEpochDay(toEpochDay(date) + n);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

function toHalves(tablets: number): number {
  const halves = tablets * 2;
  if (!Number.isInteger(halves)) {
    throw new RangeError(`Not a multiple of 0.5: ${tablets}`);
  }
  return halves;
}

function urgencyFor(daysLeft: number): Urgency {
  if (daysLeft === 0) return "ran-out";
  if (daysLeft <= 14) return "red";
  if (daysLeft <= 30) return "yellow";
  return "green";
}

export function computeStock(
  { pillsCounted, countedOn, dailyDose }: StockInput,
  today: string,
): Stock {
  const countedHalves = toHalves(pillsCounted);
  const doseHalves = toHalves(dailyDose);
  if (doseHalves <= 0) throw new RangeError("dailyDose must be positive");
  if (countedHalves < 0) throw new RangeError("pillsCounted must not be negative");

  const elapsed = Math.max(0, daysBetween(countedOn, today));
  const leftHalves = Math.max(0, countedHalves - doseHalves * elapsed);
  // Today's dose comes out of the stock, so today counts as day 1.
  const daysLeft = Math.floor(leftHalves / doseHalves);
  const pillsLeft = leftHalves / 2;

  if (daysLeft >= 1) {
    return {
      pillsLeft,
      daysLeft,
      runOutDate: addDays(today, daysLeft - 1),
      lastCoveredDay: null,
      urgency: urgencyFor(daysLeft),
    };
  }

  const coveredDays = Math.floor(countedHalves / doseHalves);
  return {
    pillsLeft,
    daysLeft: 0,
    runOutDate: null,
    lastCoveredDay: coveredDays >= 1 ? addDays(countedOn, coveredDays - 1) : null,
    urgency: "ran-out",
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Order: days left ascending, then run-out / last-covered date ascending
 * ("not enough for a day" — no date — comes first), then name
 * (case-insensitive), then id.
 */
export function compareByRunOut(a: StockItem, b: StockItem): number {
  if (a.stock.daysLeft !== b.stock.daysLeft) {
    return a.stock.daysLeft - b.stock.daysLeft;
  }
  const dateA = a.stock.runOutDate ?? a.stock.lastCoveredDay;
  const dateB = b.stock.runOutDate ?? b.stock.lastCoveredDay;
  if (dateA !== dateB) {
    if (dateA === null) return -1;
    if (dateB === null) return 1;
    return compareText(dateA, dateB);
  }
  const byName = compareText(a.name.toLowerCase(), b.name.toLowerCase());
  if (byName !== 0) return byName;
  return compareText(a.id, b.id);
}

/** Splits items by urgency, each group sorted; ran-out items lead `red`. */
export function groupByUrgency<T extends StockItem>(
  items: readonly T[],
): { red: T[]; yellow: T[]; green: T[] } {
  const groups: { red: T[]; yellow: T[]; green: T[] } = {
    red: [],
    yellow: [],
    green: [],
  };
  for (const item of [...items].sort(compareByRunOut)) {
    const urgency = item.stock.urgency;
    groups[urgency === "ran-out" ? "red" : urgency].push(item);
  }
  return groups;
}
