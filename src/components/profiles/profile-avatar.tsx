import Image from "next/image";

import type { AvatarColor, ProfileAvatar as ProfileAvatarId } from "@/lib/profiles/validation";
import { cn } from "@/lib/utils";
import { avatarBgClass } from "./avatar-colors";

const SIZES = {
  list: { frame: "size-8 p-0.5 text-sm", image: "32px" },
  picker: { frame: "size-16 p-1 text-2xl", image: "64px" },
  header: { frame: "size-16 p-1 text-2xl sm:size-20 sm:text-3xl", image: "(min-width: 640px) 80px, 64px" },
} as const;

/**
 * The profile's portrait inside a ring of its colour, or its initial on that colour.
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
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-foreground",
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
          sizes={SIZES[size].image}
          className="size-full rounded-full object-cover"
        />
      ) : (
        initial
      )}
    </span>
  );
}
