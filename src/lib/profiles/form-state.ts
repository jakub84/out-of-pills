/** State shared by the onboarding/profile forms (`useActionState`) and their server actions. */
export type ProfileFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"displayName" | "name" | "kind" | "avatarColor" | "avatar", string>>;
  /** The submitted display name, so the field keeps it after an error. */
  displayName?: string;
  /** The profile just created, so the form can open it. */
  profileId?: string;
};

export const initialProfileFormState: ProfileFormState = { status: "idle" };
