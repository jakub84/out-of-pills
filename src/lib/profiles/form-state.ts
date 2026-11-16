/** State shared by the onboarding/profile forms (`useActionState`) and their server actions. */
export type ProfileFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"displayName" | "name" | "kind" | "avatarColor", string>>;
  /** The submitted display name, so the field keeps it after an error. */
  displayName?: string;
};

export const initialProfileFormState: ProfileFormState = { status: "idle" };
