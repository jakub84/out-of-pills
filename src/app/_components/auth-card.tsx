import Image from "next/image";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

/**
 * Shared shell of the auth and password-reset screens (mock 176:552): thin teal top border,
 * centred white card with the wordmark and mascot, then the screen's content.
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col border-t-[3px] border-primary bg-background sm:items-center sm:justify-center sm:px-4 sm:py-10">
      <main className="flex w-full flex-1 flex-col items-center gap-9 bg-card px-6 py-12 sm:max-w-[469px] sm:flex-none sm:rounded-[35px] sm:px-[46px] sm:pt-[52px] sm:pb-14">
        <Logo />
        {/* The mascot is a crop of a wider illustration; object-cover reproduces the mock's crop. */}
        <div className="relative h-[202px] w-[172px] shrink-0 overflow-hidden">
          <Image
            src="/brand/mascot.png"
            alt=""
            fill
            sizes="362px"
            className="object-cover"
          />
        </div>
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
