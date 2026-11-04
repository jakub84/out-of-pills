"use server";

import { redirect } from "next/navigation";

import type { AuthFormState } from "@/lib/auth/form-state";
import {
  readField,
  readPassword,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Something went wrong. Please try again.";
const CHECK_EMAIL = "Check your email to confirm your account";
const WEAK_PASSWORD =
  "This password is too weak. Use at least 8 characters with at least one letter and one digit";
const RATE_LIMITED = "Please wait a minute before requesting another email";

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email");
  const password = readPassword(formData, "password");

  const fieldErrors: AuthFormState["fieldErrors"] = {
    email: validateEmail(email),
    password: validatePassword(password),
  };
  if (fieldErrors.email || fieldErrors.password) {
    return { status: "error", fieldErrors, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  // With confirmations on, an already-registered address returns an obfuscated
  // user and no error; any "already exists" or email rate-limit error is mapped
  // to the same success state so the response never reveals an account.
  if (
    !error ||
    error.code === "user_already_exists" ||
    error.code === "email_exists" ||
    error.code === "over_email_send_rate_limit"
  ) {
    return { status: "success", message: CHECK_EMAIL, email };
  }

  if (error.code === "weak_password") {
    return {
      status: "error",
      fieldErrors: { password: WEAK_PASSWORD },
      email,
    };
  }

  if (error.code === "email_address_invalid") {
    return {
      status: "error",
      fieldErrors: { email: "Enter a valid email address" },
      email,
    };
  }

  return { status: "error", message: GENERIC_ERROR, email };
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email");
  const password = readPassword(formData, "password");

  const fieldErrors: AuthFormState["fieldErrors"] = {
    email: validateEmail(email),
    password: password ? undefined : "Enter your password",
  };
  if (fieldErrors.email || fieldErrors.password) {
    return { status: "error", fieldErrors, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        reason: "email_not_confirmed",
        message: "Confirm your email first",
        email,
      };
    }
    if (error.code === "invalid_credentials") {
      return { status: "error", message: "Invalid email or password", email };
    }
    return { status: "error", message: GENERIC_ERROR, email };
  }

  redirect("/");
}

export async function resendConfirmation(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, "email");

  if (validateEmail(email)) {
    return { status: "error", message: "Enter a valid email address", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });

  if (error?.code === "over_email_send_rate_limit") {
    return { status: "error", message: RATE_LIMITED, email };
  }

  // Neutral on success and on any other error: never reveal whether an account exists.
  return {
    status: "success",
    message: "If this email needs confirming, we sent a new link",
    email,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
