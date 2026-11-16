import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ProfileForm } from "@/components/profiles/profile-form";
import { createProfile } from "@/lib/profiles/actions";
import { getCaregiver } from "@/lib/profiles/dal";

export const metadata: Metadata = { title: "Add a profile · Out of Pills" };

/** Further profiles, opened from "+ Add new" in the sidebar; lands on the new profile. */
export default function NewProfilePage() {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-10 sm:py-12 lg:px-20">
      <div className="flex max-w-[760px] flex-col gap-8">
        <h1 className="font-heading text-4xl font-normal text-foreground sm:text-[54px]">
          Add a profile
        </h1>
        <Suspense fallback={null}>
          <NewProfileForm />
        </Suspense>
      </div>
    </div>
  );
}

/** Reads the session and caregiver: must stay inside the Suspense boundary above. */
async function NewProfileForm() {
  const caregiver = await getCaregiver();
  if (!caregiver) redirect("/onboarding/name");

  return (
    <ProfileForm
      displayName={caregiver.displayName}
      action={createProfile}
      backHref="/"
      backLabel="Cancel"
      submitLabel="Create profile"
    />
  );
}
