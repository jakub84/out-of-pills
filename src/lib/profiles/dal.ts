import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  isAvatarColor,
  isProfileKind,
  type AvatarColor,
  type ProfileKind,
} from "./validation";

export type Caregiver = { displayName: string };

export type Profile = {
  id: string;
  name: string;
  kind: ProfileKind;
  avatarColor: AvatarColor;
};

/**
 * The signed-in caregiver's row, or `null` before onboarding saved a name.
 * Reads the session: call it inside `<Suspense>`, never inside `use cache`.
 * Cached per request, so the header and the page share one query.
 */
export const getCaregiver = cache(async (): Promise<Caregiver | null> => {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("caregivers")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load caregiver: ${error.message}`);
  return data ? { displayName: data.display_name } : null;
});

/**
 * The profiles the signed-in caregiver belongs to, oldest first.
 * RLS limits the rows to the caller's memberships; no extra filter here.
 * Reads the session: call it inside `<Suspense>`, never inside `use cache`.
 */
export const listProfiles = cache(async (): Promise<Profile[]> => {
  await getCurrentUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, kind, avatar_color")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(`Failed to load profiles: ${error.message}`);

  // The migration's check constraints guarantee the values; the guards only narrow the types.
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    kind: isProfileKind(row.kind) ? row.kind : "other",
    avatarColor: isAvatarColor(row.avatar_color) ? row.avatar_color : "mint",
  }));
});
