/** State shared by the auth forms (`useActionState`) and their server actions. */
export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  email?: string;
  /** Set when sign-in failed because the address is not confirmed yet. */
  reason?: "email_not_confirmed";
};

export const initialAuthFormState: AuthFormState = { status: "idle" };
