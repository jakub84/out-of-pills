import { Suspense, type ReactNode } from "react";

import { SignOutButton } from "@/app/_components/sign-out-button";
import { AppHeader } from "@/components/app-shell/app-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getCaregiver } from "@/lib/profiles/dal";
import { initialOf } from "@/lib/profiles/validation";

/** Onboarding shell (mocks 164:172, 162:73): app header, then a centred column. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <AppHeader>
        {/* Reads the session: keep it behind Suspense so the shell stays static. */}
        <Suspense fallback={null}>
          <HeaderAvatar />
        </Suspense>
        {/* Signed-in users can't reach /sign-in, so onboarding needs its own exit. */}
        <SignOutButton />
      </AppHeader>
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
