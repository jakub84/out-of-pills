import Image from "next/image";

import { cn } from "@/lib/utils";

/** "Out of Pills soon?" wordmark from the mocks, rendered at its intrinsic size. */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo.svg"
      alt="Out of Pills soon?"
      width={240}
      height={28.85}
      className={cn("h-auto max-w-full", className)}
    />
  );
}
