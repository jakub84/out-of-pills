/**
 * Four-ring page loader; the animations live in `globals.css`.
 * Adapted from Uiverse.io by Nawsome (MIT), recoloured with project tokens. Never use the
 * urgency colours here: red and yellow mean a medication is running out.
 * The delayed fade keeps it from flashing on fast navigation.
 */
export function PageLoader() {
  return (
    <div
      role="status"
      className="flex min-h-64 w-full flex-1 animate-loader-fade-in items-center justify-center"
    >
      <svg
        aria-hidden
        width="240"
        height="240"
        viewBox="0 0 240 240"
        fill="none"
        strokeWidth="20"
        strokeLinecap="round"
        className="size-18 motion-reduce:hidden"
      >
        <circle
          cx="120"
          cy="120"
          r="105"
          strokeDasharray="0 660"
          strokeDashoffset="-330"
          className="animate-loader-ring-a stroke-primary"
        />
        <circle
          cx="120"
          cy="120"
          r="35"
          strokeDasharray="0 220"
          strokeDashoffset="-110"
          className="animate-loader-ring-b stroke-brand-ink"
        />
        <circle
          cx="85"
          cy="120"
          r="70"
          strokeDasharray="0 440"
          className="animate-loader-ring-c stroke-brand-subtle"
        />
        <circle
          cx="155"
          cy="120"
          r="70"
          strokeDasharray="0 440"
          className="animate-loader-ring-d stroke-primary/50"
        />
      </svg>
      {/* Screen-reader text; replaces the animation under reduced motion. */}
      <span className="sr-only text-sm text-brand-subtle motion-reduce:not-sr-only">
        Loading…
      </span>
    </div>
  );
}
