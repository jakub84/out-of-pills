import { redirect } from "next/navigation";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { connectionErrorMessage } from "@/lib/feedback/messages";
import { runSaveAction } from "@/lib/feedback/run-save-action";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const FAILED = { status: "idle" };

describe("runSaveAction", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("returns the action result without a toast", async () => {
    const result = { status: "error", message: "The stock just changed" };

    await expect(runSaveAction(async () => result, FAILED)).resolves.toBe(result);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows the connection toast and returns the failed state on a network error", async () => {
    const call = async () => {
      throw new TypeError("Failed to fetch");
    };

    await expect(runSaveAction(call, FAILED)).resolves.toBe(FAILED);
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(connectionErrorMessage());
  });

  it("rethrows a Next.js redirect without a toast", async () => {
    const call = async () => redirect("/sign-in");

    await expect(runSaveAction(call, FAILED)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});
