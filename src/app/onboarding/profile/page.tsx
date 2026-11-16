import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ProfileForm } from "@/components/profiles/profile-form";
import { createProfile } from "@/lib/profiles/actions";
import { getCaregiver, listProfiles } from "@/lib/profiles/dal";
import { Stepper } from "../_components/stepper";

export const metadata: Metadata = { title: "First profile · Out of Pills" };

/** Onboarding step 3 (mock 162:73). */
export default function OnboardingProfilePage() {
  return (
    <div className="flex flex-col gap-8">
      <Stepper current="profile" />
      <Suspense fallback={null}>
        <ProfileStep />
      </Suspense>
    </div>
  );
}

/** Reads the session, caregiver and profiles: must stay inside the Suspense boundary above. */
async function ProfileStep() {
  const [caregiver, profiles] = await Promise.all([getCaregiver(), listProfiles()]);

  if (!caregiver) redirect("/onboarding/name");
  if (profiles.length > 0) redirect("/");

  return (
    <ProfileForm
      displayName={caregiver.displayName}
      action={createProfile}
      backHref="/onboarding/name"
      submitLabel="Create profile"
      liveHeading={{
        eyebrow: (
          <>
            <span className="font-medium">Hi:</span> {caregiver.displayName}
          </>
        ),
        intro:
          "Create your first profile — a folder for the person whose medications you look after. They don't need an account; you keep track of everything.",
      }}
    />
  );
}
