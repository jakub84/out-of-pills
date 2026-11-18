import { describe, expect, it } from "vitest";

import {
  parseAmount,
  validateDailyDose,
  validateMedication,
  validateMedicationName,
  validatePackageAmount,
  validatePackageSize,
  validatePillsLeft,
  validateResultingCount,
} from "@/lib/medications/validation";

describe("parseAmount", () => {
  it("parses whole, half and comma-decimal amounts", () => {
    expect(parseAmount("18")).toBe(18);
    expect(parseAmount(" 12.5 ")).toBe(12.5);
    expect(parseAmount("1,5")).toBe(1.5);
  });

  it("rejects non-numbers, negatives and exponents", () => {
    for (const value of ["", "abc", "-1", "1e3", "1.", ".5", "1.5.5"]) {
      expect(parseAmount(value)).toBeNull();
    }
  });
});

describe("validateMedicationName", () => {
  it("requires a non-blank name", () => {
    expect(validateMedicationName("")).toBe("Enter the medication name");
    expect(validateMedicationName("   ")).toBe("Enter the medication name");
  });

  it("accepts 1 to 80 characters after trimming", () => {
    expect(validateMedicationName("B")).toBeUndefined();
    expect(validateMedicationName(`  ${"a".repeat(80)}  `)).toBeUndefined();
    expect(validateMedicationName("a".repeat(81))).toBe("Use at most 80 characters");
  });
});

describe("validatePackageSize", () => {
  it("accepts whole numbers from 1 to 1000", () => {
    expect(validatePackageSize("1")).toBeUndefined();
    expect(validatePackageSize("30")).toBeUndefined();
    expect(validatePackageSize("1000")).toBeUndefined();
  });

  it("rejects empty, 0, 1001 and fractions", () => {
    expect(validatePackageSize("")).toBeDefined();
    expect(validatePackageSize("0")).toBeDefined();
    expect(validatePackageSize("1001")).toBeDefined();
    expect(validatePackageSize("28.5")).toBeDefined();
  });
});

describe("validatePillsLeft", () => {
  it("accepts 0 to 9999 in halves", () => {
    expect(validatePillsLeft("0")).toBeUndefined();
    expect(validatePillsLeft("18")).toBeUndefined();
    expect(validatePillsLeft("17.5")).toBeUndefined();
    expect(validatePillsLeft("9999")).toBeUndefined();
  });

  it("rejects empty, negative, above 9999 and non-halves", () => {
    expect(validatePillsLeft("")).toBeDefined();
    expect(validatePillsLeft("-1")).toBeDefined();
    expect(validatePillsLeft("9999.5")).toBeDefined();
    expect(validatePillsLeft("10000")).toBeDefined();
    expect(validatePillsLeft("0.3")).toBeDefined();
  });
});

describe("validateDailyDose", () => {
  it("accepts 0.5 to 50 in halves", () => {
    expect(validateDailyDose("0.5")).toBeUndefined();
    expect(validateDailyDose("1.5")).toBeUndefined();
    expect(validateDailyDose("50")).toBeUndefined();
  });

  it("rejects empty, 0, 0.3 and 50.5", () => {
    expect(validateDailyDose("")).toBeDefined();
    expect(validateDailyDose("0")).toBeDefined();
    expect(validateDailyDose("0.3")).toBeDefined();
    expect(validateDailyDose("50.5")).toBeDefined();
  });
});

describe("validatePackageAmount", () => {
  it("accepts 0.5 to 1000 in halves, with a comma decimal", () => {
    expect(validatePackageAmount("0.5")).toBeUndefined();
    expect(validatePackageAmount("30")).toBeUndefined();
    expect(validatePackageAmount("30,5")).toBeUndefined();
    expect(validatePackageAmount("1000")).toBeUndefined();
  });

  it("rejects empty, 0, 1000.5 and non-numbers with the range message", () => {
    expect(validatePackageAmount("")).toBeDefined();
    expect(validatePackageAmount("0")).toBe("Use a number from 0.5 to 1000");
    expect(validatePackageAmount("1000.5")).toBe("Use a number from 0.5 to 1000");
    expect(validatePackageAmount("-1")).toBe("Use a number from 0.5 to 1000");
    expect(validatePackageAmount("abc")).toBe("Use a number from 0.5 to 1000");
  });

  it("rejects non-halves", () => {
    expect(validatePackageAmount("1.3")).toBe("Use whole or half tablets, e.g. 30 or 30.5");
    expect(validatePackageAmount("30.25")).toBe("Use whole or half tablets, e.g. 30 or 30.5");
  });
});

describe("validateResultingCount", () => {
  it("accepts up to 9999 tablets", () => {
    expect(validateResultingCount(0)).toBeUndefined();
    expect(validateResultingCount(9999)).toBeUndefined();
  });

  it("rejects anything above 9999", () => {
    expect(validateResultingCount(9999.5)).toBe("That would be more than 9999 tablets");
    expect(validateResultingCount(10000)).toBe("That would be more than 9999 tablets");
  });
});

describe("validateMedication", () => {
  it("returns trimmed name and numeric values when valid", () => {
    expect(
      validateMedication({
        name: "  Bisocard 5 mg ",
        packageSize: "30",
        pillsLeft: "18",
        dailyDose: "2",
      }),
    ).toEqual({
      ok: true,
      values: { name: "Bisocard 5 mg", packageSize: 30, pillsLeft: 18, dailyDose: 2 },
    });
  });

  it("returns an error per invalid field", () => {
    const result = validateMedication({ name: "", packageSize: "0", pillsLeft: "5", dailyDose: "0.3" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.name).toBe("Enter the medication name");
    expect(result.fieldErrors.packageSize).toBeDefined();
    expect(result.fieldErrors.pillsLeft).toBeUndefined();
    expect(result.fieldErrors.dailyDose).toBeDefined();
  });
});
