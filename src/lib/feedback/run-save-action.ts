import { unstable_rethrow } from "next/navigation";
import { toast } from "sonner";

import { connectionErrorMessage } from "./messages";

/**
 * Runs a server action from a form. When the request itself fails, shows the connection toast
 * and returns `failedState`, so the form stays as it is. Errors the server reports are normal
 * results and pass through. A redirect reaches the client as a rejected action (for example an
 * expired session), so Next.js control-flow errors are rethrown first.
 */
export async function runSaveAction<S>(call: () => Promise<S>, failedState: S): Promise<S> {
  try {
    return await call();
  } catch (error) {
    unstable_rethrow(error);
    toast.error(connectionErrorMessage());
    return failedState;
  }
}
