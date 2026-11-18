import { User } from "lucide-react";
import Image from "next/image";

import type { AvatarColor, ProfileAvatar as ProfileAvatarId } from "@/lib/profiles/validation";
import { cn } from "@/lib/utils";
import { avatarBgClass } from "./avatar-colors";

const SIZES = {
  list: { frame: "size-8 rounded-full p-0.5 text-sm", image: "rounded-full", sizes: "32px" },
  picker: { frame: "size-16 rounded-full p-1 text-2xl", image: "rounded-full", sizes: "64px" },
  header: {
    frame: "size-16 rounded-2xl p-1 text-2xl sm:size-20 sm:text-3xl",
    image: "rounded-xl",
    sizes: "(min-width: 640px) 80px, 64px",
  },
} as const;

/**
 * The profile's portrait inside a frame of its colour, or its initial on that colour.
 * Round on the list and in the picker, square in the main-screen header.
 * Decorative: the profile name or radio label is always adjacent.
 */
export function ProfileAvatar({
  initial,
  avatarColor,
  avatar,
  size,
}: {
  initial: string;
  avatarColor: AvatarColor;
  avatar: ProfileAvatarId | null;
  size: keyof typeof SIZES;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold text-foreground",
        avatarBgClass[avatarColor],
        SIZES[size].frame,
      )}
    >
      {avatar ? (
        <Image
          src={`/avatars/${avatar}.webp`}
          alt=""
          width={256}
          height={256}
          sizes={SIZES[size].sizes}
          className={cn("size-full object-cover", SIZES[size].image)}
        />
      ) : (
        // No initial yet: the profile form before a name is typed.
        initial || <User className="size-1/2 text-foreground/60" />
      )}
    </span>
  );
}
