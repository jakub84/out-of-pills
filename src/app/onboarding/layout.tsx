import { Suspense, type ReactNode } from "react";

import { SignOutButton } from "@/app/_components/sign-out-button";
import { Logo } from "@/components/brand/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCaregiver } from "@/lib/profiles/dal";
import { initialOf } from "@/lib/profiles/validation";

/** Onboarding shell (mocks 164:172, 162:73): app header, then a centred column. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* The mock's header shape is ~108px tall with 41px above the viewport; the taller
          ::before layer reproduces that geometry so the shadow band is as dark as designed. */}
      <header className="relative isolate z-10 border-b border-header-border bg-background before:pointer-events-none before:absolute before:inset-x-0 before:-top-12 before:bottom-0 before:-z-10 before:shadow-header before:content-['']">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-3.5 sm:px-10">
          <Logo className="w-[161px]" />
          {/* Reads the session: keep it behind Suspense so the shell stays static. */}
          <div className="flex items-center gap-3">
            <Suspense fallback={null}>
              <HeaderAvatar />
            </Suspense>
            {/* Signed-in users can't reach /sign-in, so onboarding needs its own exit. */}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-[760px] pb-14">
          {children}
        </div>
      </main>
    </div>
  );
}

/** The caregiver's initial, shown once a first name exists. */
async function HeaderAvatar() {
  const caregiver = await getCaregiver();
  if (!caregiver) return null;

  return (
    <Avatar title={caregiver.displayName}>
      <AvatarFallback className="bg-primary text-sm text-primary-foreground">
        {initialOf(caregiver.displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
