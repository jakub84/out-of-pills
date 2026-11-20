import { describe, expect, it } from "vitest";

import {
  addDays,
  addPackage,
  compareByRunOut,
  computeStock,
  correctCount,
  daysBetween,
  editStock,
  groupByUrgency,
  overallUrgency,
  pauseStock,
  resumeStock,
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
    expect(computeStock({ pillsCounted: 18, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, NOV_5)).toEqual({
      pillsLeft: 18,
      daysLeft: 9,
      runOutDate: "2026-11-13",
      lastCoveredDay: null,
      urgency: "red",
    });
  });

  it("counts today as day 1 for a same-day entry", () => {
    const stock = computeStock({ pillsCounted: 2, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, NOV_5);
    expect(stock.daysLeft).toBe(1);
    expect(stock.runOutDate).toBe(NOV_5);
  });

  it("one day later: 16 left, 8 days, still 13 Nov", () => {
    const stock = computeStock({ pillsCounted: 18, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, "2026-11-06");
    expect(stock.pillsLeft).toBe(16);
    expect(stock.daysLeft).toBe(8);
    expect(stock.runOutDate).toBe("2026-11-13");
  });

  it("treats a count dated after today as not yet consumed", () => {
    const stock = computeStock({ pillsCounted: 4, countedOn: "2026-11-07", dailyDose: 2, pausedOn: null }, NOV_5);
    expect(stock.pillsLeft).toBe(4);
    expect(stock.daysLeft).toBe(2);
  });

  it.each([
    [14, "red"],
    [15, "yellow"],
    [30, "yellow"],
    [31, "green"],
  ] as const)("daysLeft %i is %s", (days, urgency) => {
    const stock = computeStock({ pillsCounted: days * 2, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, NOV_5);
    expect(stock.daysLeft).toBe(days);
    expect(stock.urgency).toBe(urgency);
  });

  it("ran out: 10 at 2/day counted 5 Nov, today 10 Nov — last covered 9 Nov", () => {
    expect(computeStock({ pillsCounted: 10, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, "2026-11-10")).toEqual({
      pillsLeft: 0,
      daysLeft: 0,
      runOutDate: null,
      lastCoveredDay: "2026-11-09",
      urgency: "ran-out",
    });
  });

  it("the day before running out is still covered", () => {
    const stock = computeStock({ pillsCounted: 10, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, "2026-11-09");
    expect(stock.daysLeft).toBe(1);
    expect(stock.runOutDate).toBe("2026-11-09");
  });

  it("below one dose when entered: not enough, no date", () => {
    expect(computeStock({ pillsCounted: 1, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, NOV_5)).toEqual({
      pillsLeft: 1,
      daysLeft: 0,
      runOutDate: null,
      lastCoveredDay: null,
      urgency: "ran-out",
    });
  });

  it("never reports negative pills long after running out", () => {
    const stock = computeStock({ pillsCounted: 10, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, "2027-06-01");
    expect(stock.pillsLeft).toBe(0);
    expect(stock.daysLeft).toBe(0);
    expect(stock.lastCoveredDay).toBe("2026-11-09");
  });

  it("leftover below a dose rounds days down (5 at 2/day → 2 days)", () => {
    const stock = computeStock({ pillsCounted: 5, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, NOV_5);
    expect(stock.daysLeft).toBe(2);
    expect(stock.runOutDate).toBe("2026-11-06");
  });

  it("handles halves: 7 at 1.5/day → 4 days; after 1 day 5.5 left", () => {
    const first = computeStock({ pillsCounted: 7, countedOn: NOV_5, dailyDose: 1.5, pausedOn: null }, NOV_5);
    expect(first.daysLeft).toBe(4);
    expect(first.runOutDate).toBe("2026-11-08");

    const next = computeStock({ pillsCounted: 7, countedOn: NOV_5, dailyDose: 1.5, pausedOn: null }, "2026-11-06");
    expect(next.pillsLeft).toBe(5.5);
    expect(next.daysLeft).toBe(3);
    expect(next.runOutDate).toBe("2026-11-08");
  });

  it("handles 0.5/day: 3 tablets last 6 days", () => {
    const stock = computeStock({ pillsCounted: 3, countedOn: NOV_5, dailyDose: 0.5, pausedOn: null }, NOV_5);
    expect(stock.daysLeft).toBe(6);
    expect(stock.runOutDate).toBe("2026-11-10");
  });

  it("rejects counts that are not multiples of 0.5 and non-positive doses", () => {
    expect(() => computeStock({ pillsCounted: 1.3, countedOn: NOV_5, dailyDose: 1, pausedOn: null }, NOV_5)).toThrow(RangeError);
    expect(() => computeStock({ pillsCounted: 4, countedOn: NOV_5, dailyDose: 0, pausedOn: null }, NOV_5)).toThrow(RangeError);
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
    const soon = item("Zeta", "1", { pillsCounted: 4, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, NOV_5);
    const later = item("Alpha", "2", { pillsCounted: 40, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, NOV_5);
    expect([later, soon].sort(compareByRunOut)).toEqual([soon, later]);
  });

  it("breaks ties on days left by the earlier date", () => {
    // Both ran out (0 days left); one ran out earlier.
    const earlier = item("Zeta", "1", { pillsCounted: 2, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, "2026-11-10");
    const later = item("Alpha", "2", { pillsCounted: 6, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, "2026-11-10");
    expect(earlier.stock.lastCoveredDay).toBe(NOV_5);
    expect(later.stock.lastCoveredDay).toBe("2026-11-07");
    expect([later, earlier].sort(compareByRunOut)).toEqual([earlier, later]);
  });

  it("puts 'not enough for a day' before dated ran-out items", () => {
    const notEnough = item("Zeta", "1", { pillsCounted: 1, countedOn: NOV_5, dailyDose: 2, pausedOn: null }, NOV_5);
    const ranOut = item("Alpha", "2", { pillsCounted: 2, countedOn: "2026-11-01", dailyDose: 2, pausedOn: null }, NOV_5);
    expect([ranOut, notEnough].sort(compareByRunOut)).toEqual([notEnough, ranOut]);
  });

  it("then by name, case-insensitive, then by id", () => {
    const input = { pillsCounted: 10, countedOn: NOV_5, dailyDose: 2, pausedOn: null };
    const bravo = item("bravo", "1", input, NOV_5);
    const alphaB = item("Alpha", "b", input, NOV_5);
    const alphaA = item("alpha", "a", input, NOV_5);
    expect([bravo, alphaB, alphaA].sort(compareByRunOut)).toEqual([alphaA, alphaB, bravo]);
  });
});

describe("groupByUrgency", () => {
  it("splits into red, yellow and green with ran-out items first in red", () => {
    const red = item("Red", "1", { pillsCounted: 10, countedOn: NOV_5, dailyDose: 1, pausedOn: null }, NOV_5);
    const ranOut = item("Ran out", "2", { pillsCounted: 2, countedOn: "2026-11-01", dailyDose: 2, pausedOn: null }, NOV_5);
    const yellow = item("Yellow", "3", { pillsCounted: 20, countedOn: NOV_5, dailyDose: 1, pausedOn: null }, NOV_5);
    const green = item("Green", "4", { pillsCounted: 60, countedOn: NOV_5, dailyDose: 1, pausedOn: null }, NOV_5);

    expect(groupByUrgency([green, red, yellow, ranOut])).toEqual({
      red: [ranOut, red],
      yellow: [yellow],
      green: [green],
      paused: [],
    });
  });

  it("returns empty groups for no items", () => {
    expect(groupByUrgency([])).toEqual({ red: [], yellow: [], green: [], paused: [] });
  });
});

describe("overallUrgency", () => {
  const withDaysLeft = (days: number, id = String(days)) =>
    item(id, id, { pillsCounted: days, countedOn: NOV_5, dailyDose: 1, pausedOn: null }, NOV_5);

  it("is green when every medication has more than 30 days left", () => {
    expect(overallUrgency([withDaysLeft(31), withDaysLeft(90)])).toBe("green");
  });

  it("is yellow when the most urgent medication has 15 to 30 days left", () => {
    expect(overallUrgency([withDaysLeft(60), withDaysLeft(30)])).toBe("yellow");
    expect(overallUrgency([withDaysLeft(60), withDaysLeft(15)])).toBe("yellow");
  });

  it("is red when any medication has 14 days or fewer left", () => {
    expect(overallUrgency([withDaysLeft(60), withDaysLeft(20), withDaysLeft(14)])).toBe("red");
  });

  it("treats a medication that ran out as red", () => {
    expect(overallUrgency([withDaysLeft(60), withDaysLeft(0)])).toBe("red");
  });

  it("is green when there are no medications", () => {
    expect(overallUrgency([])).toBe("green");
  });
});

describe("addPackage", () => {
  const NOV_8 = "2026-11-08";
  const counted18 = { pillsCounted: 18, countedOn: NOV_5, dailyDose: 2, pausedOn: null };

  it("worked example: 12 left on 8 Nov + 30 → 42 counted 8 Nov, 21 days, until 28 Nov", () => {
    const next = addPackage(counted18, NOV_8, 30);
    expect(next).toEqual({ pillsCounted: 42, countedOn: NOV_8, dailyDose: 2, pausedOn: null });
    const stock = computeStock(next, NOV_8);
    expect(stock.daysLeft).toBe(21);
    expect(stock.runOutDate).toBe("2026-11-28");
  });

  it("same-day restock keeps today's dose in the stock: 18 + 30 → 48, 24 days", () => {
    const next = addPackage(counted18, NOV_5, 30);
    expect(next).toEqual({ pillsCounted: 48, countedOn: NOV_5, dailyDose: 2, pausedOn: null });
    expect(computeStock(next, NOV_5).daysLeft).toBe(24);
  });

  it("does not carry a deficit over: ran out + 30 → 30, 15 days", () => {
    const ranOut = { pillsCounted: 10, countedOn: NOV_5, dailyDose: 2, pausedOn: null };
    expect(computeStock(ranOut, "2026-11-20").pillsLeft).toBe(0);
    const next = addPackage(ranOut, "2026-11-20", 30);
    expect(next.pillsCounted).toBe(30);
    expect(computeStock(next, "2026-11-20").daysLeft).toBe(15);
  });

  it("handles halves: 5.5 left + 0.5 → 6", () => {
    const input = { pillsCounted: 7, countedOn: NOV_5, dailyDose: 1.5, pausedOn: null };
    expect(addPackage(input, "2026-11-06", 0.5).pillsCounted).toBe(6);
  });

  it("always dates the new baseline today", () => {
    const future = { pillsCounted: 4, countedOn: "2026-11-07", dailyDose: 2, pausedOn: null };
    expect(addPackage(future, NOV_5, 30).countedOn).toBe(NOV_5);
  });

  it("rejects negative and non-half amounts", () => {
    expect(() => addPackage(counted18, NOV_5, -1)).toThrow(RangeError);
    expect(() => addPackage(counted18, NOV_5, 0.3)).toThrow(RangeError);
  });
});

describe("correctCount", () => {
  const NOV_8 = "2026-11-08";
  const counted18 = { pillsCounted: 18, countedOn: NOV_5, dailyDose: 2, pausedOn: null };

  it("worked example: correct to 7 on 8 Nov → 3 days, until 10 Nov", () => {
    const next = correctCount(counted18, NOV_8, 7);
    expect(next).toEqual({ pillsCounted: 7, countedOn: NOV_8, dailyDose: 2, pausedOn: null });
    const stock = computeStock(next, NOV_8);
    expect(stock.daysLeft).toBe(3);
    expect(stock.runOutDate).toBe("2026-11-10");
  });

  it("correct to 0 → ran out with no last covered day", () => {
    expect(computeStock(correctCount(counted18, NOV_8, 0), NOV_8)).toEqual({
      pillsLeft: 0,
      daysLeft: 0,
      runOutDate: null,
      lastCoveredDay: null,
      urgency: "ran-out",
    });
  });

  it("rejects negative and non-half counts", () => {
    expect(() => correctCount(counted18, NOV_8, -0.5)).toThrow(RangeError);
    expect(() => correctCount(counted18, NOV_8, 2.2)).toThrow(RangeError);
  });
});

describe("computeStock while paused", () => {
  const pausedSince5Nov = { pillsCounted: 8, countedOn: NOV_5, dailyDose: 2, pausedOn: NOV_5 };

  it("paused 8 at 2/day: still 8 left 10 days later, no date, 4 days after resuming", () => {
    expect(computeStock(pausedSince5Nov, "2026-11-15")).toEqual({
      pillsLeft: 8,
      daysLeft: 4,
      runOutDate: null,
      lastCoveredDay: null,
      urgency: "paused",
    });
  });

  it("paused with 0 left: 0 days, still paused rather than ran out", () => {
    const stock = computeStock({ ...pausedSince5Nov, pillsCounted: 0 }, "2026-11-15");
    expect(stock.daysLeft).toBe(0);
    expect(stock.urgency).toBe("paused");
  });

  it("paused halves: 5.5 at 1.5/day stays 5.5, 3 days after resuming", () => {
    const stock = computeStock(
      { pillsCounted: 5.5, countedOn: NOV_5, dailyDose: 1.5, pausedOn: NOV_5 },
      "2026-11-20",
    );
    expect(stock.pillsLeft).toBe(5.5);
    expect(stock.daysLeft).toBe(3);
  });
});

describe("editStock", () => {
  const NOV_9 = "2026-11-09";
  // 18 at 2/day counted 5 Nov → 10 left on 9 Nov.
  const tenLeftAt2 = { pillsCounted: 18, countedOn: NOV_5, dailyDose: 2, pausedOn: null };
  // 14 at 1/day counted 5 Nov → 10 left on 9 Nov.
  const tenLeftAt1 = { pillsCounted: 14, countedOn: NOV_5, dailyDose: 1, pausedOn: null };

  it("dose decrease 2 → 1 with 10 left counts 9 today and runs out today + 8", () => {
    expect(computeStock(tenLeftAt2, NOV_9).pillsLeft).toBe(10);
    const next = editStock(tenLeftAt2, NOV_9, { dailyDose: 1, pillsLeft: null });
    expect(next).toEqual({ pillsCounted: 9, countedOn: NOV_9, dailyDose: 1, pausedOn: null });
    const stock = computeStock(next, NOV_9);
    expect(stock.daysLeft).toBe(9);
    expect(stock.runOutDate).toBe(addDays(NOV_9, 8));
  });

  it("dose increase 1 → 2 with 10 left counts 10 today and runs out today + 4", () => {
    expect(computeStock(tenLeftAt1, NOV_9).pillsLeft).toBe(10);
    const next = editStock(tenLeftAt1, NOV_9, { dailyDose: 2, pillsLeft: null });
    expect(next).toEqual({ pillsCounted: 10, countedOn: NOV_9, dailyDose: 2, pausedOn: null });
    expect(computeStock(next, NOV_9).runOutDate).toBe(addDays(NOV_9, 4));
  });

  it("same dose, pills left not typed: the stock is kept as stored (rename only)", () => {
    const next = editStock(tenLeftAt2, NOV_9, { dailyDose: 2, pillsLeft: null });
    expect(next).toEqual(tenLeftAt2);
    expect(computeStock(next, NOV_9).runOutDate).toBe(computeStock(tenLeftAt2, NOV_9).runOutDate);
  });

  it("same dose on a run-out stock keeps the day it ran out", () => {
    // 4 at 2/day counted 5 Nov → last covered day 6 Nov, ran out by 9 Nov.
    const ranOut = { pillsCounted: 4, countedOn: NOV_5, dailyDose: 2, pausedOn: null };
    const next = editStock(ranOut, NOV_9, { dailyDose: 2, pillsLeft: null });
    expect(next).toEqual(ranOut);
    expect(computeStock(next, NOV_9).lastCoveredDay).toBe("2026-11-06");
  });

  it("same dose with pills left typed still counts today", () => {
    const next = editStock(tenLeftAt2, NOV_9, { dailyDose: 2, pillsLeft: 10 });
    expect(next).toEqual({ pillsCounted: 10, countedOn: NOV_9, dailyDose: 2, pausedOn: null });
  });

  it("manual pills left wins: dose 2 → 1 with 20 counted by hand counts 20 today, not 19", () => {
    const next = editStock(tenLeftAt2, NOV_9, { dailyDose: 1, pillsLeft: 20 });
    expect(next).toEqual({ pillsCounted: 20, countedOn: NOV_9, dailyDose: 1, pausedOn: null });
  });

  it("dose edit while paused keeps the frozen 8 and the pause", () => {
    const paused = { pillsCounted: 8, countedOn: NOV_5, dailyDose: 2, pausedOn: NOV_5 };
    const next = editStock(paused, NOV_9, { dailyDose: 1, pillsLeft: null });
    expect(next).toEqual({ pillsCounted: 8, countedOn: NOV_9, dailyDose: 1, pausedOn: NOV_5 });
    expect(computeStock(next, "2026-11-20").urgency).toBe("paused");
  });

  it("dose decrease 4 → 1 with 2 left clamps at 0, not −1", () => {
    const twoLeftAt4 = { pillsCounted: 2, countedOn: NOV_9, dailyDose: 4, pausedOn: null };
    expect(editStock(twoLeftAt4, NOV_9, { dailyDose: 1, pillsLeft: null }).pillsCounted).toBe(0);
  });

  it("halves: 5.5 left at 1.5/day, dose → 1 counts 5 today", () => {
    const input = { pillsCounted: 7, countedOn: NOV_5, dailyDose: 1.5, pausedOn: null };
    expect(editStock(input, "2026-11-06", { dailyDose: 1, pillsLeft: null }).pillsCounted).toBe(5);
  });

  it("rejects a non-positive or non-half dose and a negative or non-half count", () => {
    expect(() => editStock(tenLeftAt2, NOV_9, { dailyDose: 0, pillsLeft: null })).toThrow(RangeError);
    expect(() => editStock(tenLeftAt2, NOV_9, { dailyDose: 1.2, pillsLeft: null })).toThrow(RangeError);
    expect(() => editStock(tenLeftAt2, NOV_9, { dailyDose: 1, pillsLeft: -1 })).toThrow(RangeError);
    expect(() => editStock(tenLeftAt2, NOV_9, { dailyDose: 1, pillsLeft: 2.3 })).toThrow(RangeError);
  });
});

describe("pauseStock / resumeStock", () => {
  const NOV_9 = "2026-11-09";
  const NOV_14 = "2026-11-14";
  // 18 at 2/day counted 5 Nov → 10 left on 9 Nov.
  const tenLeftAt2 = { pillsCounted: 18, countedOn: NOV_5, dailyDose: 2, pausedOn: null };

  it("pause with 10 left at 2/day freezes 8: today's dose is taken first", () => {
    expect(pauseStock(tenLeftAt2, NOV_9)).toEqual({
      pillsCounted: 8,
      countedOn: NOV_9,
      dailyDose: 2,
      pausedOn: NOV_9,
    });
  });

  it("pause after running out freezes 0", () => {
    const next = pauseStock(tenLeftAt2, "2026-11-20");
    expect(next.pillsCounted).toBe(0);
    expect(next.pausedOn).toBe("2026-11-20");
  });

  it("pause on 9 Nov, resume 5 days later: 8 counted on 14 Nov, day 1 is 14 Nov, until 17 Nov", () => {
    const paused = pauseStock(tenLeftAt2, NOV_9);
    const resumed = resumeStock(paused, NOV_14);
    expect(resumed).toEqual({ pillsCounted: 8, countedOn: NOV_14, dailyDose: 2, pausedOn: null });
    const stock = computeStock(resumed, NOV_14);
    expect(stock.daysLeft).toBe(4);
    expect(stock.runOutDate).toBe("2026-11-17");
  });

  it("same-day pause + resume loses exactly one dose: 10 → 8", () => {
    const resumed = resumeStock(pauseStock(tenLeftAt2, NOV_9), NOV_9);
    expect(computeStock(tenLeftAt2, NOV_9).pillsLeft).toBe(10);
    expect(computeStock(resumed, NOV_9).pillsLeft).toBe(8);
  });

  it("halves: pause with 5.5 left at 1.5/day freezes 4", () => {
    const input = { pillsCounted: 7, countedOn: NOV_5, dailyDose: 1.5, pausedOn: null };
    expect(pauseStock(input, "2026-11-06").pillsCounted).toBe(4);
  });

  it("pausing a paused medication or resuming an active one throws", () => {
    const paused = pauseStock(tenLeftAt2, NOV_9);
    expect(() => pauseStock(paused, NOV_14)).toThrow(RangeError);
    expect(() => resumeStock(tenLeftAt2, NOV_9)).toThrow(RangeError);
  });
});

describe("restock and correction keep the pause", () => {
  const paused = { pillsCounted: 8, countedOn: NOV_5, dailyDose: 2, pausedOn: NOV_5 };

  it("adding 30 to a paused 8 counts 38 today and stays paused since 5 Nov", () => {
    expect(addPackage(paused, "2026-11-09", 30)).toEqual({
      pillsCounted: 38,
      countedOn: "2026-11-09",
      dailyDose: 2,
      pausedOn: NOV_5,
    });
  });

  it("correcting a paused medication to 5 stays paused since 5 Nov", () => {
    expect(correctCount(paused, "2026-11-09", 5).pausedOn).toBe(NOV_5);
  });
});

describe("paused items in groups and overall urgency", () => {
  const pausedItem = (name: string, id: string, pillsCounted: number) =>
    item(name, id, { pillsCounted, countedOn: NOV_5, dailyDose: 1, pausedOn: NOV_5 }, NOV_5);

  it("groupByUrgency puts paused items only in paused, sorted by name then id", () => {
    const red = item("Red", "1", { pillsCounted: 10, countedOn: NOV_5, dailyDose: 1, pausedOn: null }, NOV_5);
    const bravo = pausedItem("bravo", "2", 5);
    const alphaB = pausedItem("Alpha", "b", 90);
    const alphaA = pausedItem("alpha", "a", 40);

    expect(groupByUrgency([bravo, red, alphaB, alphaA])).toEqual({
      red: [red],
      yellow: [],
      green: [],
      paused: [alphaA, alphaB, bravo],
    });
  });

  it("overallUrgency ignores a paused item with only 5 days of supply", () => {
    const green = item("Green", "1", { pillsCounted: 60, countedOn: NOV_5, dailyDose: 1, pausedOn: null }, NOV_5);
    expect(overallUrgency([green, pausedItem("Paused", "2", 5)])).toBe("green");
  });

  it("overallUrgency is green when every item is paused", () => {
    expect(overallUrgency([pausedItem("Paused", "1", 0)])).toBe("green");
  });
});
