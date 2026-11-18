import { describe, expect, it } from "vitest";

import {
  appUpdatedMessage,
  connectionErrorMessage,
  countCorrectedMessage,
  medicationAddedMessage,
  packageAddedMessage,
  passwordChangedMessage,
  profileCreatedMessage,
} from "@/lib/feedback/messages";

describe("toast messages", () => {
  it("confirms an added medication", () => {
    expect(medicationAddedMessage("Aspirin")).toBe("Aspirin added");
  });

  it("confirms an added package, with whole and half tablets", () => {
    expect(packageAddedMessage("Aspirin", 28)).toBe("+28 tabl. added to Aspirin");
    expect(packageAddedMessage("Aspirin", 10.5)).toBe("+10.5 tabl. added to Aspirin");
  });

  it("confirms a corrected count, with whole, half and zero tablets", () => {
    expect(countCorrectedMessage("Aspirin", 18)).toBe("Aspirin count set to 18 tabl.");
    expect(countCorrectedMessage("Aspirin", 12.5)).toBe("Aspirin count set to 12.5 tabl.");
    expect(countCorrectedMessage("Aspirin", 0)).toBe("Aspirin count set to 0 tabl.");
  });

  it("confirms a created profile", () => {
    expect(profileCreatedMessage("Mom")).toBe("Profile Mom created");
  });

  it("confirms a changed password", () => {
    expect(passwordChangedMessage()).toBe("Password changed");
  });

  it("asks an outdated tab to reload", () => {
    expect(appUpdatedMessage()).toBe("A new version is available. Reload the page and try again.");
  });

  it("explains a failed request", () => {
    expect(connectionErrorMessage()).toBe(
      "Couldn't confirm the save. Check your connection and reload the page before trying again.",
    );
  });
});
