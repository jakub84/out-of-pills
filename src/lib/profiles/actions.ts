"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/dal";
import { readField } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileFormState } from "./form-state";
import { validateDisplayName, validateProfileFields } from "./validation";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** The profile form's fields; readField trims, and an empty `avatar` means "No avatar". */
function readProfileFields(formData: FormData) {
  return {
    name: readField(formData, "name"),
    kind: readField(formData, "kind"),
    avatarColor: readField(formData, "avatarColor"),
    avatar: readField(formData, "avatar"),
  };
}

function hasErrors(fieldErrors: object): boolean {
  return Object.keys(fieldErrors).length > 0;
}

/** Creates a profile linked to the caller (`create_profile` RPC); the form then confirms and opens it. */
export async function createProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await getCurrentUser();

  // create_profile stores the name exactly as passed.
  const { name, kind, avatarColor, avatar } = readProfileFields(formData);

  const fieldErrors = validateProfileFields({ name, kind, avatarColor, avatar });
  if (hasErrors(fieldErrors)) {
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
  return { status: "success", profileId };
}

/** Saves an edited profile's name, type, avatar colour and avatar; the form then confirms and opens it. */
export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  await getCurrentUser();

  const profileId = readField(formData, "profileId");
  const { name, kind, avatarColor, avatar } = readProfileFields(formData);

  const fieldErrors = validateProfileFields({ name, kind, avatarColor, avatar });
  if (hasErrors(fieldErrors)) {
    return { status: "error", fieldErrors };
  }
  if (!UUID_PATTERN.test(profileId)) {
    return { status: "error", message: GENERIC_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ name, kind, avatar_color: avatarColor, avatar: avatar || null })
    .eq("id", profileId)
    .select("id");

  if (error) {
    // Keep the failure visible in the server logs; the user only sees the generic message.
    console.error("updateProfile update failed", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  // RLS hides profiles the caller doesn't belong to: 0 rows means deleted or not theirs.
  if (data.length === 0) {
    return { status: "error", message: GENERIC_ERROR };
  }

  // Refresh the app shell so the sidebar and the profile page show the new details.
  revalidatePath("/", "layout");
  return { status: "success", profileId };
}
