/**
 * Pure validation helpers and constants for caregivers and profiles.
 * They mirror the checks in `supabase/migrations/20261116165228_profiles.sql`
 * and `supabase/migrations/20261118124439_profile_avatars.sql`;
 * safe to import from client components.
 */

/** Allowed `profiles.kind` values (migration check). */
export const PROFILE_KINDS = ["me", "parent", "child", "other"] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];

/** Allowed `profiles.avatar_color` values (migration check), in display order. */
export const AVATAR_COLORS = ["mint", "slate", "sand", "rose", "lavender", "stone"] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** Allowed non-null `profiles.avatar` values (migration check). */
export const PROFILE_AVATARS = [
  "woman",
  "man",
  "mom",
  "dad",
  "grandma",
  "grandpa",
  "son",
  "daughter",
  "cat",
  "dog",
] as const;
export type ProfileAvatar = (typeof PROFILE_AVATARS)[number];

/** Avatars each profile kind may use (migration check), in display order. */
export const AVATARS_BY_KIND = {
  me: ["woman", "man"],
  parent: ["mom", "dad", "grandma", "grandpa"],
  child: ["son", "daughter"],
  other: ["woman", "man", "grandma", "grandpa", "cat", "dog"],
} as const satisfies Record<ProfileKind, readonly ProfileAvatar[]>;

/** Upper bound of `caregivers.display_name` and `profiles.name` after trimming. */
export const NAME_MAX_LENGTH = 40;

export function isProfileKind(value: string): value is ProfileKind {
  return (PROFILE_KINDS as readonly string[]).includes(value);
}

export function isAvatarColor(value: string): value is AvatarColor {
  return (AVATAR_COLORS as readonly string[]).includes(value);
}

export function isProfileAvatar(value: string): value is ProfileAvatar {
  return (PROFILE_AVATARS as readonly string[]).includes(value);
}

export function isAvatarForKind(kind: ProfileKind, value: string): value is ProfileAvatar {
  return (AVATARS_BY_KIND[kind] as readonly string[]).includes(value);
}

function validateName(name: string, emptyMessage: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return emptyMessage;
  if (trimmed.length > NAME_MAX_LENGTH) return `Use at most ${NAME_MAX_LENGTH} characters`;
  return undefined;
}

/** Returns an error message, or `undefined` when the caregiver's first name is acceptable. */
export function validateDisplayName(name: string): string | undefined {
  return validateName(name, "Enter your first name");
}

/** Returns an error message, or `undefined` when the profile name is acceptable. */
export function validateProfileName(name: string): string | undefined {
  return validateName(name, "Enter a profile name");
}

/** First letter of a name, upper-cased, for avatars ("" for an empty name). */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0] ?? "";
  return first.toLocaleUpperCase();
}
