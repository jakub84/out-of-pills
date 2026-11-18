import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appUpdatedMessage, connectionErrorMessage } from "@/lib/feedback/messages";
import { runSaveAction } from "@/lib/feedback/run-save-action";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const FAILED = { status: "idle" };

describe("runSaveAction", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the action result without a toast", async () => {
    const result = { status: "error", message: "The stock just changed" };

    await expect(runSaveAction(async () => result, FAILED)).resolves.toBe(result);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the connection toast and returns the failed state on a network error", async () => {
    const failure = new TypeError("Failed to fetch");
    const call = async () => {
      throw failure;
    };

    await expect(runSaveAction(call, FAILED)).resolves.toBe(FAILED);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(connectionErrorMessage());
    expect(console.error).toHaveBeenCalledWith("Save request failed", failure);
  });

  it("asks a tab from an older deployment to reload", async () => {
    const call = async () => {
      throw new UnrecognizedActionError("Server Action was not found");
    };

    await expect(runSaveAction(call, FAILED)).resolves.toBe(FAILED);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(appUpdatedMessage());
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rethrows a Next.js redirect without a toast", async () => {
    const call = async () => redirect("/sign-in");

    await expect(runSaveAction(call, FAILED)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
