/**
 * Pure validation helpers shared by the auth server actions.
 * They mirror the Supabase auth policy in `supabase/config.toml`
 * (minimum_password_length = 8, password_requirements = "letters_digits").
 */

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Reads a form field as a trimmed string ("" when missing or not a string). */
export function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Reads a password field without trimming (spaces are valid password characters). */
export function readPassword(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Returns an error message, or `undefined` when the email is acceptable. */
export function validateEmail(email: string): string | undefined {
  if (!email) return "Enter your email address";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address";
  return undefined;
}

/** Returns an error message, or `undefined` when the password meets the policy. */
export function validatePassword(password: string): string | undefined {
  if (!password) return "Enter a password";
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    !/[A-Za-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters with at least one letter and one digit`;
  }
  return undefined;
}

/** Returns an error message, or `undefined` when the confirmation matches the password. */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | undefined {
  if (!confirmation) return "Confirm your new password";
  if (confirmation !== password) return "Passwords do not match";
  return undefined;
}
