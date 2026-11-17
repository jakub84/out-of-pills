import { describe, expect, it } from "vitest";

import {
  addDays,
  compareByRunOut,
  computeStock,
  daysBetween,
  groupByUrgency,
  todayInWarsaw,
  type StockInput,
  type StockItem,
} from "@/lib/medications/stock";

const NOV_5 = "2026-11-05";

function item(name: string, id: string, input: StockInput, today: string): StockItem {
  return { name, id, stock: computeStock(input, today) };
}

describe("computeStock", () => {
  it("worked example: 18 at 2/day counted 5 Nov lasts 9 days, until 13 Nov", () => {
    expect(computeStock({ pillsCounted: 18, countedOn: NOV_5, dailyDose: 2 }, NOV_5)).toEqual({
      pillsLeft: 18,
      daysLeft: 9,
      runOutDate: "2026-11-13",
      lastCoveredDay: null,
      urgency: "red",
    });
  });

  it("counts today as day 1 for a same-day entry", () => {
    const stock = computeStock({ pillsCounted: 2, countedOn: NOV_5, dailyDose: 2 }, NOV_5);
    expect(stock.daysLeft).toBe(1);
    expect(stock.runOutDate).toBe(NOV_5);
  });

  it("one day later: 16 left, 8 days, still 13 Nov", () => {
    const stock = computeStock({ pillsCounted: 18, countedOn: NOV_5, dailyDose: 2 }, "2026-11-06");
    expect(stock.pillsLeft).toBe(16);
    expect(stock.daysLeft).toBe(8);
    expect(stock.runOutDate).toBe("2026-11-13");
  });

  it("treats a count dated after today as not yet consumed", () => {
    const stock = computeStock({ pillsCounted: 4, countedOn: "2026-11-07", dailyDose: 2 }, NOV_5);
    expect(stock.pillsLeft).toBe(4);
    expect(stock.daysLeft).toBe(2);
  });

  it.each([
    [14, "red"],
    [15, "yellow"],
    [30, "yellow"],
    [31, "green"],
  ] as const)("daysLeft %i is %s", (days, urgency) => {
    const stock = computeStock({ pillsCounted: days * 2, countedOn: NOV_5, dailyDose: 2 }, NOV_5);
    expect(stock.daysLeft).toBe(days);
    expect(stock.urgency).toBe(urgency);
  });

  it("ran out: 10 at 2/day counted 5 Nov, today 10 Nov — last covered 9 Nov", () => {
    expect(computeStock({ pillsCounted: 10, countedOn: NOV_5, dailyDose: 2 }, "2026-11-10")).toEqual({
      pillsLeft: 0,
      daysLeft: 0,
      runOutDate: null,
      lastCoveredDay: "2026-11-09",
      urgency: "ran-out",
    });
  });

  it("the day before running out is still covered", () => {
    const stock = computeStock({ pillsCounted: 10, countedOn: NOV_5, dailyDose: 2 }, "2026-11-09");
    expect(stock.daysLeft).toBe(1);
    expect(stock.runOutDate).toBe("2026-11-09");
  });

  it("below one dose when entered: not enough, no date", () => {
    expect(computeStock({ pillsCounted: 1, countedOn: NOV_5, dailyDose: 2 }, NOV_5)).toEqual({
      pillsLeft: 1,
      daysLeft: 0,
      runOutDate: null,
      lastCoveredDay: null,
      urgency: "ran-out",
    });
  });

  it("never reports negative pills long after running out", () => {
    const stock = computeStock({ pillsCounted: 10, countedOn: NOV_5, dailyDose: 2 }, "2027-06-01");
    expect(stock.pillsLeft).toBe(0);
    expect(stock.daysLeft).toBe(0);
    expect(stock.lastCoveredDay).toBe("2026-11-09");
  });

  it("leftover below a dose rounds days down (5 at 2/day → 2 days)", () => {
    const stock = computeStock({ pillsCounted: 5, countedOn: NOV_5, dailyDose: 2 }, NOV_5);
    expect(stock.daysLeft).toBe(2);
    expect(stock.runOutDate).toBe("2026-11-06");
  });

  it("handles halves: 7 at 1.5/day → 4 days; after 1 day 5.5 left", () => {
    const first = computeStock({ pillsCounted: 7, countedOn: NOV_5, dailyDose: 1.5 }, NOV_5);
    expect(first.daysLeft).toBe(4);
    expect(first.runOutDate).toBe("2026-11-08");

    const next = computeStock({ pillsCounted: 7, countedOn: NOV_5, dailyDose: 1.5 }, "2026-11-06");
    expect(next.pillsLeft).toBe(5.5);
    expect(next.daysLeft).toBe(3);
    expect(next.runOutDate).toBe("2026-11-08");
  });

  it("handles 0.5/day: 3 tablets last 6 days", () => {
    const stock = computeStock({ pillsCounted: 3, countedOn: NOV_5, dailyDose: 0.5 }, NOV_5);
    expect(stock.daysLeft).toBe(6);
    expect(stock.runOutDate).toBe("2026-11-10");
  });

  it("rejects counts that are not multiples of 0.5 and non-positive doses", () => {
    expect(() => computeStock({ pillsCounted: 1.3, countedOn: NOV_5, dailyDose: 1 }, NOV_5)).toThrow(RangeError);
    expect(() => computeStock({ pillsCounted: 4, countedOn: NOV_5, dailyDose: 0 }, NOV_5)).toThrow(RangeError);
  });
});

describe("todayInWarsaw", () => {
  it("is already the next day in Warsaw late in the UTC evening", () => {
    expect(todayInWarsaw(new Date("2026-11-05T23:30:00Z"))).toBe("2026-11-06");
  });

  it("keeps the date across the DST start", () => {
    expect(todayInWarsaw(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
  });
});

describe("addDays / daysBetween", () => {
  it("rolls over months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("is not shifted by DST changes", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("counts whole days, negative when going back", () => {
    expect(daysBetween(NOV_5, "2026-11-13")).toBe(8);
    expect(daysBetween("2026-11-13", NOV_5)).toBe(-8);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});

describe("compareByRunOut", () => {
  it("orders by days left first", () => {
    const soon = item("Zeta", "1", { pillsCounted: 4, countedOn: NOV_5, dailyDose: 2 }, NOV_5);
    const later = item("Alpha", "2", { pillsCounted: 40, countedOn: NOV_5, dailyDose: 2 }, NOV_5);
    expect([later, soon].sort(compareByRunOut)).toEqual([soon, later]);
  });

  it("breaks ties on days left by the earlier date", () => {
    // Both ran out (0 days left); one ran out earlier.
    const earlier = item("Zeta", "1", { pillsCounted: 2, countedOn: NOV_5, dailyDose: 2 }, "2026-11-10");
    const later = item("Alpha", "2", { pillsCounted: 6, countedOn: NOV_5, dailyDose: 2 }, "2026-11-10");
    expect(earlier.stock.lastCoveredDay).toBe(NOV_5);
    expect(later.stock.lastCoveredDay).toBe("2026-11-07");
    expect([later, earlier].sort(compareByRunOut)).toEqual([earlier, later]);
  });

  it("puts 'not enough for a day' before dated ran-out items", () => {
    const notEnough = item("Zeta", "1", { pillsCounted: 1, countedOn: NOV_5, dailyDose: 2 }, NOV_5);
    const ranOut = item("Alpha", "2", { pillsCounted: 2, countedOn: "2026-11-01", dailyDose: 2 }, NOV_5);
    expect([ranOut, notEnough].sort(compareByRunOut)).toEqual([notEnough, ranOut]);
  });

  it("then by name, case-insensitive, then by id", () => {
    const input = { pillsCounted: 10, countedOn: NOV_5, dailyDose: 2 };
    const bravo = item("bravo", "1", input, NOV_5);
    const alphaB = item("Alpha", "b", input, NOV_5);
    const alphaA = item("alpha", "a", input, NOV_5);
    expect([bravo, alphaB, alphaA].sort(compareByRunOut)).toEqual([alphaA, alphaB, bravo]);
  });
});

describe("groupByUrgency", () => {
  it("splits into red, yellow and green with ran-out items first in red", () => {
    const red = item("Red", "1", { pillsCounted: 10, countedOn: NOV_5, dailyDose: 1 }, NOV_5);
    const ranOut = item("Ran out", "2", { pillsCounted: 2, countedOn: "2026-11-01", dailyDose: 2 }, NOV_5);
    const yellow = item("Yellow", "3", { pillsCounted: 20, countedOn: NOV_5, dailyDose: 1 }, NOV_5);
    const green = item("Green", "4", { pillsCounted: 60, countedOn: NOV_5, dailyDose: 1 }, NOV_5);

    expect(groupByUrgency([green, red, yellow, ranOut])).toEqual({
      red: [ranOut, red],
      yellow: [yellow],
      green: [green],
    });
  });

  it("returns empty groups for no items", () => {
    expect(groupByUrgency([])).toEqual({ red: [], yellow: [], green: [] });
  });
});
