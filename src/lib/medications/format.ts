// English (en-GB) display of calendar dates and tablet counts. Dates are plain
// `YYYY-MM-DD` Warsaw calendar days, formatted at UTC midnight so the viewer's
// own time zone cannot shift the day.

type DateStyle = "short" | "long";

function dateParts(date: string, month: DateStyle, weekday: DateStyle = "short") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday,
    day: "numeric",
    month,
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: part("weekday"), day: part("day"), month: part("month") };
}

/** "Fri 13 Nov" */
export function formatShortDate(date: string): string {
  const { weekday, day, month } = dateParts(date, "short");
  return `${weekday} ${day} ${month}`;
}

/** "Fri, 13 November" */
export function formatLongDate(date: string): string {
  const { weekday, day, month } = dateParts(date, "long");
  return `${weekday}, ${day} ${month}`;
}

/** "Friday, 13 November" */
export function formatFullDate(date: string): string {
  const { weekday, day, month } = dateParts(date, "long", "long");
  return `${weekday}, ${day} ${month}`;
}

/** Parts of the card's date tile: { weekday: "Friday", dayMonth: "13.11" } (5 March → "5.03"). */
export function dateTileParts(date: string): { weekday: string; dayMonth: string } {
  const [, month, day] = date.split("-");
  return { weekday: dateParts(date, "long", "long").weekday, dayMonth: `${Number(day)}.${month}` };
}

/** Tablet count with halves as "1.5". */
export function formatTablets(amount: number): string {
  return String(amount);
}

/** "1 day" / "9 days" */
export function formatDays(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}
