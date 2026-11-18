import type { AvatarColor, ProfileAvatar } from "@/lib/profiles/validation";

/** Background utility per stored avatar colour (tokens in globals.css); full class names so Tailwind sees them. */
export const avatarBgClass: Record<AvatarColor, string> = {
  mint: "bg-avatar-mint",
  slate: "bg-avatar-slate",
  sand: "bg-avatar-sand",
  rose: "bg-avatar-rose",
  lavender: "bg-avatar-lavender",
  stone: "bg-avatar-stone",
};

/** Human-readable colour names for screen readers. */
export const avatarColorLabel: Record<AvatarColor, string> = {
  mint: "Mint",
  slate: "Slate",
  sand: "Sand",
  rose: "Rose",
  lavender: "Lavender",
  stone: "Stone",
};

/** Human-readable avatar names for the picker. */
export const avatarLabel: Record<ProfileAvatar, string> = {
  woman: "Woman",
  man: "Man",
  mom: "Mom",
  dad: "Dad",
  grandma: "Grandma",
  grandpa: "Grandpa",
  son: "Son",
  daughter: "Daughter",
  cat: "Cat",
  dog: "Dog",
};
