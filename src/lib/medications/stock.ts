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

export type Urgency = "ran-out" | "red" | "yellow" | "green" | "paused";

export type StockInput = {
  /** Tablets counted, a multiple of 0.5. */
  pillsCounted: number;
  /** Calendar day of the count, `YYYY-MM-DD` (Europe/Warsaw). */
  countedOn: string;
  /** Tablets per day, a positive multiple of 0.5. */
  dailyDose: number;
  /**
   * Day the medication was paused, `YYYY-MM-DD` (Europe/Warsaw); null while
   * active. A paused stock stays frozen at `pillsCounted`.
   */
  pausedOn: string | null;
};

export type Stock = {
  /** Tablets left today, never negative. */
  pillsLeft: number;
  /**
   * Full daily doses left, today included; 0 means ran out. While paused: the
   * supply after resuming.
   */
  daysLeft: number;
  /** Last day with a full dose; null once ran out and while paused. */
  runOutDate: string | null;
  /**
   * Only when ran out: the last day the counted stock covered a full dose.
   * Null while stock lasts, while paused, and when the count never covered one full day.
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

function toDoseHalves(dailyDose: number): number {
  const halves = toHalves(dailyDose);
  if (halves <= 0) throw new RangeError("dailyDose must be positive");
  return halves;
}

function urgencyFor(daysLeft: number): Urgency {
  if (daysLeft === 0) return "ran-out";
  if (daysLeft <= 14) return "red";
  if (daysLeft <= 30) return "yellow";
  return "green";
}

export function computeStock(
  { pillsCounted, countedOn, dailyDose, pausedOn }: StockInput,
  today: string,
): Stock {
  const countedHalves = toHalves(pillsCounted);
  const doseHalves = toDoseHalves(dailyDose);
  if (countedHalves < 0) throw new RangeError("pillsCounted must not be negative");

  // Paused: nothing is taken, so the count stays frozen and there is no date.
  if (pausedOn !== null) {
    return {
      pillsLeft: countedHalves / 2,
      daysLeft: Math.floor(countedHalves / doseHalves),
      runOutDate: null,
      lastCoveredDay: null,
      urgency: "paused",
    };
  }

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

function toTabletHalves(tablets: number): number {
  const halves = toHalves(tablets);
  if (halves < 0) throw new RangeError("tablets must not be negative");
  return halves;
}

/** Today's tablets left (frozen count while paused), in halves. */
function leftHalvesToday(input: StockInput, today: string): number {
  return toHalves(computeStock(input, today).pillsLeft);
}

/**
 * New baseline after adding a package: today's tablets left plus `tablets`,
 * counted today. Today's dose still comes out of the new count (today is day
 * 1), so the date never moves later than the real one. A deficit from having
 * run out is not carried over — pills left never go below zero. The pause
 * state is kept.
 */
export function addPackage(input: StockInput, today: string, tablets: number): StockInput {
  const addedHalves = toTabletHalves(tablets);
  const leftHalves = leftHalvesToday(input, today);
  return {
    pillsCounted: (leftHalves + addedHalves) / 2,
    countedOn: today,
    dailyDose: input.dailyDose,
    pausedOn: input.pausedOn,
  };
}

/** New baseline after a recount: exactly `tablets`, counted today; the pause state is kept. */
export function correctCount(input: StockInput, today: string, tablets: number): StockInput {
  return {
    pillsCounted: toTabletHalves(tablets) / 2,
    countedOn: today,
    dailyDose: input.dailyDose,
    pausedOn: input.pausedOn,
  };
}

/**
 * New baseline after editing the daily dose, counted today, pause state kept.
 * A count entered by hand (`pillsLeft`) is taken as is. Otherwise today's
 * tablets left still hold today's dose at the old rate; on a dose decrease the
 * difference comes out too, so today's dose at the new rate stays in the count
 * (today is day 1) and the date never moves later than the real one. A paused
 * stock keeps its frozen count: nothing was taken while paused. With the same
 * dose and no count entered the stock is returned as stored, so a rename or a
 * package-size change keeps the count day (and the day a run-out stock ran out).
 */
export function editStock(
  input: StockInput,
  today: string,
  { dailyDose, pillsLeft }: { dailyDose: number; pillsLeft: number | null },
): StockInput {
  const newDoseHalves = toDoseHalves(dailyDose);
  if (pillsLeft === null && newDoseHalves === toDoseHalves(input.dailyDose)) {
    return { ...input };
  }
  let countedHalves: number;
  if (pillsLeft !== null) {
    countedHalves = toTabletHalves(pillsLeft);
  } else if (input.pausedOn !== null) {
    countedHalves = leftHalvesToday(input, today);
  } else {
    const decreaseHalves = Math.max(0, toDoseHalves(input.dailyDose) - newDoseHalves);
    countedHalves = Math.max(0, leftHalvesToday(input, today) - decreaseHalves);
  }
  return {
    pillsCounted: countedHalves / 2,
    countedOn: today,
    dailyDose: newDoseHalves / 2,
    pausedOn: input.pausedOn,
  };
}

/**
 * New baseline after pausing: today's dose is still taken, then the stock is
 * frozen from today. Only for an active stock; throws when already paused.
 */
export function pauseStock(input: StockInput, today: string): StockInput {
  if (input.pausedOn !== null) throw new RangeError("Medication is already paused");
  const frozenHalves = Math.max(0, leftHalvesToday(input, today) - toDoseHalves(input.dailyDose));
  return {
    pillsCounted: frozenHalves / 2,
    countedOn: today,
    dailyDose: input.dailyDose,
    pausedOn: today,
  };
}

/**
 * New baseline after resuming: the frozen count, counted today, so today is
 * day 1 again. Only for a paused stock; throws when active.
 */
export function resumeStock(input: StockInput, today: string): StockInput {
  if (input.pausedOn === null) throw new RangeError("Medication is not paused");
  return {
    pillsCounted: input.pillsCounted,
    countedOn: today,
    dailyDose: input.dailyDose,
    pausedOn: null,
  };
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Name (case-insensitive), then id. */
function compareByName(a: StockItem, b: StockItem): number {
  const byName = compareText(a.name.toLowerCase(), b.name.toLowerCase());
  if (byName !== 0) return byName;
  return compareText(a.id, b.id);
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
  return compareByName(a, b);
}

/**
 * Splits items by urgency, each group sorted; ran-out items lead `red`. Paused
 * items go only to `paused`, sorted by name, then id.
 */
export function groupByUrgency<T extends StockItem>(
  items: readonly T[],
): { red: T[]; yellow: T[]; green: T[]; paused: T[] } {
  const groups: { red: T[]; yellow: T[]; green: T[]; paused: T[] } = {
    red: [],
    yellow: [],
    green: [],
    paused: [],
  };
  for (const item of [...items].sort(compareByRunOut)) {
    const urgency = item.stock.urgency;
    groups[urgency === "ran-out" ? "red" : urgency].push(item);
  }
  groups.paused.sort(compareByName);
  return groups;
}

/**
 * The most urgent colour among `items`; ran-out counts as red, paused items are
 * ignored, no items (or only paused ones) count as green.
 */
export function overallUrgency(items: readonly StockItem[]): "red" | "yellow" | "green" {
  const urgencies = items.map((item) => item.stock.urgency);
  if (urgencies.includes("ran-out") || urgencies.includes("red")) return "red";
  return urgencies.includes("yellow") ? "yellow" : "green";
}
