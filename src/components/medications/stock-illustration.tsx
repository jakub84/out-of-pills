import Image from "next/image";

import type { overallUrgency } from "@/lib/medications/stock";

const ILLUSTRATION_BY_URGENCY: Record<ReturnType<typeof overallUrgency>, string> = {
  green: "/brand/stock-happy.png",
  yellow: "/brand/stock-poor.png",
  red: "/brand/stock-very-sad.png",
};

/**
 * Header illustration (mock 176:228, images 78:43) whose mood follows the most urgent medication.
 * Flush top-right of the nearest positioned ancestor, behind the content; left and bottom edges
 * fade into the page.
 */
export function StockIllustration({ urgency }: { urgency: ReturnType<typeof overallUrgency> }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 right-0 -z-10 hidden w-[min(806px,50%)] [mask-image:linear-gradient(to_right,transparent,black_30%),linear-gradient(to_top,transparent,black_25%)] [mask-composite:intersect] lg:block"
    >
      <Image
        src={ILLUSTRATION_BY_URGENCY[urgency]}
        alt=""
        width={1024}
        height={572}
        className="h-auto w-full"
      />
    </div>
  );
}
