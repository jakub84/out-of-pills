import { Check } from "lucide-react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

const STEPS = [
  { id: "account", label: "Account" },
  { id: "name", label: "Your name" },
  { id: "profile", label: "First profile" },
] as const;

export type OnboardingStepId = (typeof STEPS)[number]["id"];

/**
 * Onboarding progress (Figma component 167:109): completed steps are teal with a check,
 * the current one is white with a teal ring and its number, upcoming ones are dashed and grey.
 */
export function Stepper({ current }: { current: OnboardingStepId }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <nav aria-label="Onboarding progress">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {STEPS.map((step, index) => {
          const state =
            index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming";
          return (
            <Fragment key={step.id}>
              {index > 0 ? (
                <li aria-hidden className="hidden w-10 border-t border-dashed border-border sm:block" />
              ) : null}
              <li
                className="flex items-center gap-2.5"
                aria-current={state === "current" ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                    state === "completed" && "border-2 border-primary bg-primary text-primary-foreground",
                    state === "current" && "border-2 border-primary bg-card text-primary",
                    state === "upcoming" && "border border-dashed border-border bg-card text-muted-foreground",
                  )}
                >
                  {state === "completed" ? <Check aria-hidden className="size-4" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm whitespace-nowrap",
                    state === "completed" && "font-medium text-brand-ink",
                    state === "current" && "font-semibold text-brand-ink",
                    state === "upcoming" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                  {state === "completed" ? <span className="sr-only"> (done)</span> : null}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
