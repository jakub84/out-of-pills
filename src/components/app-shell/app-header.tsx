import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  /** Rendered before the logo (e.g. the mobile sidebar trigger). */
  leading?: ReactNode;
  /** Right-hand side: avatar, menu, actions. */
  children?: ReactNode;
  className?: string;
};

/**
 * Signed-in app header (mocks 164:176, 176:226): logo left, account controls right,
 * hairline border and a soft, wide shadow. Height is `--header-height` (globals.css).
 */
export function AppHeader({ leading, children, className }: AppHeaderProps) {
  return (
    // The mock's header shape is ~108px tall with 41px above the viewport; the taller
    // ::before layer reproduces that geometry so the shadow band is as dark as designed.
    <header
      className={cn(
        "relative isolate z-10 h-(--header-height) border-b border-header-border bg-background before:pointer-events-none before:absolute before:inset-x-0 before:-top-12 before:bottom-0 before:-z-10 before:shadow-header before:content-['']",
        className,
      )}
    >
      <div className="flex h-full w-full items-center justify-between gap-4 px-4 sm:px-10">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <Logo className="w-[161px]" />
        </div>
        <div className="flex items-center gap-3">{children}</div>
      </div>
    </header>
  );
}
