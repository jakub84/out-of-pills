import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCaregiver, listProfiles } from "@/lib/profiles/dal";
import { DisplayNameForm } from "../_components/display-name-form";
import { Stepper } from "../_components/stepper";

export const metadata: Metadata = { title: "Your name · Out of Pills" };

/** Onboarding step 2 (mock 164:172). */
export default function OnboardingNamePage() {
  return (
    <div className="flex flex-col gap-8">
      <Stepper current="name" />
      <div className="flex flex-col gap-3">
        <p className="font-heading text-2xl font-light text-brand-ink">
          <span className="font-medium">Account ready</span> — welcome!
        </p>
        <h1 className="font-heading text-4xl font-normal text-foreground sm:text-[54px]">
          What&apos;s your <span className="text-primary">first name?</span>
        </h1>
        <p className="text-base leading-6 text-brand-subtle">
          This is how we&apos;ll greet you in the app.
        </p>
      </div>
      <Suspense fallback={null}>
        <NameStep />
      </Suspense>
    </div>
  );
}

/** Reads the session and the caregiver: must stay inside the Suspense boundary above. */
async function NameStep() {
  const [caregiver, profiles] = await Promise.all([getCaregiver(), listProfiles()]);

  // Onboarding is finished once a name and at least one profile exist.
  if (caregiver && profiles.length > 0) redirect("/");

  return <DisplayNameForm defaultName={caregiver?.displayName ?? ""} />;
}
