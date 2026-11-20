import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PageLoader } from "@/components/navigation/page-loader";
import { ProfileForm } from "@/components/profiles/profile-form";
import { updateProfile } from "@/lib/profiles/actions";
import { getCaregiver, listProfiles } from "@/lib/profiles/dal";

export const metadata: Metadata = { title: "Edit profile · Out of Pills" };

type EditProfilePageProps = { params: Promise<{ id: string }> };

/** Opened from "Edit profile" in the sidebar row's ⋯; lands back on the profile. */
export default function EditProfilePage({ params }: EditProfilePageProps) {
  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-10 sm:py-12 lg:px-20">
      <div className="flex max-w-[760px] flex-col gap-8">
        <h1 className="font-heading text-4xl font-normal text-foreground sm:text-[54px]">
          Edit profile
        </h1>
        <Suspense fallback={<PageLoader />}>
          <EditProfileForm params={params} />
        </Suspense>
      </div>
    </div>
  );
}

/** Reads the session, caregiver and profiles: must stay inside the Suspense boundary above. */
async function EditProfileForm({ params }: EditProfilePageProps) {
  const { id } = await params;
  const caregiver = await getCaregiver();
  if (!caregiver) redirect("/onboarding/name");

  // RLS lists only the caller's profiles: an unknown, foreign or deleted id isn't here.
  const profile = (await listProfiles()).find((candidate) => candidate.id === id);
  if (!profile) redirect("/");

  const profileHref = `/?profile=${encodeURIComponent(profile.id)}`;

  return (
    <ProfileForm
      displayName={caregiver.displayName}
      action={updateProfile}
      backHref={profileHref}
      backLabel="Cancel"
      submitLabel="Save changes"
      initial={{
        profileId: profile.id,
        name: profile.name,
        kind: profile.kind,
        avatarColor: profile.avatarColor,
        avatar: profile.avatar,
      }}
    />
  );
}
