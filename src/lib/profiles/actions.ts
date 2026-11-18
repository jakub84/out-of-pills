"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";
import { readField } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileFormState } from "./form-state";
import {
  isAvatarColor,
  isAvatarForKind,
  isProfileKind,
  validateDisplayName,
  validateProfileName,
} from "./validation";

const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Onboarding step 2: saves (or updates) the caller's first name, then opens step 3. */
export async function saveDisplayName(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getCurrentUser();

  const displayName = readField(formData, "displayName");
  const nameError = validateDisplayName(displayName);
  if (nameError) {
    return { status: "error", fieldErrors: { displayName: nameError }, displayName };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("caregivers")
    .upsert({ user_id: user.id, display_name: displayName }, { onConflict: "user_id" });

  if (error) {
    return { status: "error", message: GENERIC_ERROR, displayName };
  }

  // Refresh the onboarding layout so the header shows the new initial.
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/profile");
}

/** Creates a profile linked to the caller (`create_profile` RPC) and opens it. */
export async function createProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await getCurrentUser();

  // readField trims; create_profile stores the name exactly as passed.
  const name = readField(formData, "name");
  const kind = readField(formData, "kind");
  const avatarColor = readField(formData, "avatarColor");
  // Empty means "No avatar".
  const avatar = readField(formData, "avatar");

  const fieldErrors: ProfileFormState["fieldErrors"] = {
    name: validateProfileName(name),
    kind: isProfileKind(kind) ? undefined : "Choose whose medications these are",
    avatarColor: isAvatarColor(avatarColor) ? undefined : "Choose an avatar colour",
    // An invalid kind is already an error, and has no avatar list to check against.
    avatar:
      avatar && isProfileKind(kind) && !isAvatarForKind(kind, avatar)
        ? "Choose an avatar from the list"
        : undefined,
  };
  if (fieldErrors.name || fieldErrors.kind || fieldErrors.avatarColor || fieldErrors.avatar) {
    return { status: "error", fieldErrors };
  }

  const supabase = await createClient();
  const profileArgs = { p_name: name, p_kind: kind, p_avatar_color: avatarColor };
  const { data: profileId, error } = avatar
    ? await supabase.rpc("create_profile", { ...profileArgs, p_avatar: avatar })
    : await supabase.rpc("create_profile", profileArgs);

  if (error) {
    // P0001 "Caregiver name is not set": the name step was skipped.
    if (error.code === "P0001") redirect("/onboarding/name");
    // 42501 "Not authenticated": the session ended between the check above and the call.
    if (error.code === "42501") redirect("/sign-in");
    return { status: "error", message: GENERIC_ERROR };
  }

  // Refresh the app shell so the sidebar lists the new profile.
  revalidatePath("/", "layout");
  redirect(`/?profile=${encodeURIComponent(profileId)}`);
}
