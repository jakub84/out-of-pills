"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";
import { PageLoader } from "./page-loader";

type NavigationPending = {
  /** A navigation started here has not finished yet. */
  pending: boolean;
  /** Where that navigation is going; `null` when none is in progress. */
  pendingHref: string | null;
  navigate: (href: string) => void;
};

const NavigationPendingContext = createContext<NavigationPending | null>(null);

/**
 * Owns in-app navigation through a transition, which stays pending until the destination is
 * ready, whether or not it was prefetched. Must not read `useSearchParams()`: it sits in the
 * root layout, outside any `<Suspense>`.
 */
export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Falls back to `null` by itself when the transition ends.
  const [pendingHref, setPendingHref] = useOptimistic<string | null>(null);

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        setPendingHref(href);
        router.push(href);
      });
    },
    [router, setPendingHref],
  );

  const value = useMemo(
    () => ({ pending, pendingHref, navigate }),
    [pending, pendingHref, navigate],
  );

  return <NavigationPendingContext value={value}>{children}</NavigationPendingContext>;
}

export function useNavigationPending() {
  const context = use(NavigationPendingContext);
  if (!context) {
    throw new Error("useNavigationPending must be used inside NavigationPendingProvider.");
  }
  return context;
}

/**
 * For a form that navigates away after saving. Next.js keeps a left page mounted but hidden
 * (`cacheComponents`), so the form would come back filled in with its submit still disabled.
 * Use `formKey` as the form's `key` and call `markSaved` on success: the form starts fresh
 * once its page is hidden. A form left unsaved keeps its draft.
 */
export function useSavedFormReset() {
  const [formKey, setFormKey] = useState(0);
  const saved = useRef(false);

  // Layout effects are cleaned up when the page is hidden, as well as on unmount.
  useLayoutEffect(
    () => () => {
      if (!saved.current) return;
      saved.current = false;
      setFormKey((key) => key + 1);
    },
    [],
  );

  const markSaved = useCallback(() => {
    saved.current = true;
  }, []);

  return { formKey, markSaved };
}

// `navigate` takes a plain href and pushes, so the link options it can't honour are left out.
type PendingLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "replace" | "scroll" | "onNavigate"
> & {
  href: string;
  /** `false` keeps a plain link, e.g. when it points at the current page. */
  trackPending?: boolean;
};

/**
 * `next/link` that reports its navigation. `onNavigate` only fires for client-side
 * navigation, so modified clicks and `target` links stay with the browser.
 */
export function PendingLink({ href, trackPending = true, ...props }: PendingLinkProps) {
  const { navigate } = useNavigationPending();

  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        if (!trackPending) return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}

/**
 * Bar growing along the header's bottom line during navigation; solid under reduced motion.
 * Decorative: `PageLoader` announces the loading state.
 */
export function NavigationProgressBar() {
  const { pending } = useNavigationPending();
  if (!pending) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -bottom-px left-0 h-0.5 w-full animate-loader-bar bg-primary motion-reduce:animate-none"
    />
  );
}

/** Page content that gives way to the loader during navigation; it stays mounted meanwhile. */
export function PendingRegion({ children }: { children: ReactNode }) {
  const { pending } = useNavigationPending();

  return (
    <>
      {/* `contents`: the wrapper must not change the layout around the page. */}
      <div className={cn("contents", pending && "hidden")}>{children}</div>
      {pending ? <PageLoader /> : null}
    </>
  );
}
