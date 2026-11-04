import type { ReactNode } from "react";

/** Centred card with the app name; the shared shell of the auth and password-reset screens. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <p className="mb-6 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Out of Pills
      </p>
      <main className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-950">
        {children}
      </main>
    </div>
  );
}
