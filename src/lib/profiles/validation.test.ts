import { describe, expect, it } from "vitest";

import {
  AVATARS_BY_KIND,
  isAvatarForKind,
  isProfileAvatar,
  PROFILE_AVATARS,
  PROFILE_KINDS,
  validateProfileFields,
} from "@/lib/profiles/validation";

describe("AVATARS_BY_KIND", () => {
  it("lists each kind's avatars in display order", () => {
    expect(AVATARS_BY_KIND).toEqual({
      me: ["woman", "man"],
      parent: ["mom", "dad", "grandma", "grandpa"],
      child: ["son", "daughter"],
      other: ["woman", "man", "grandma", "grandpa", "cat", "dog"],
    });
  });

  it("uses every catalogue avatar at least once", () => {
    const used = new Set(PROFILE_KINDS.flatMap((kind) => [...AVATARS_BY_KIND[kind]]));
    expect([...used].sort()).toEqual([...PROFILE_AVATARS].sort());
  });
});

describe("isProfileAvatar", () => {
  it("accepts every catalogue avatar", () => {
    for (const avatar of PROFILE_AVATARS) {
      expect(isProfileAvatar(avatar)).toBe(true);
    }
  });

  it("rejects unknown values and the empty string", () => {
    expect(isProfileAvatar("robot")).toBe(false);
    expect(isProfileAvatar("Mom")).toBe(false);
    expect(isProfileAvatar("")).toBe(false);
  });
});

describe("isAvatarForKind", () => {
  it("accepts every avatar listed for a kind", () => {
    for (const kind of PROFILE_KINDS) {
      for (const avatar of AVATARS_BY_KIND[kind]) {
        expect(isAvatarForKind(kind, avatar)).toBe(true);
      }
    }
  });

  it("rejects every catalogue avatar not listed for a kind", () => {
    for (const kind of PROFILE_KINDS) {
      const allowed: readonly string[] = AVATARS_BY_KIND[kind];
      for (const avatar of PROFILE_AVATARS.filter((value) => !allowed.includes(value))) {
        expect(isAvatarForKind(kind, avatar)).toBe(false);
      }
    }
  });

  it("rejects an unknown value and the empty string for every kind", () => {
    for (const kind of PROFILE_KINDS) {
      expect(isAvatarForKind(kind, "robot")).toBe(false);
      expect(isAvatarForKind(kind, "")).toBe(false);
    }
  });
});

describe("validateProfileFields", () => {
  const valid = { name: "Mom", kind: "parent", avatarColor: "rose", avatar: "grandma" };

  it("accepts a valid set of fields", () => {
    expect(validateProfileFields(valid)).toEqual({});
  });

  it("accepts an empty avatar as no avatar", () => {
    expect(validateProfileFields({ ...valid, avatar: "" })).toEqual({});
  });

  it("rejects an empty or too long name", () => {
    expect(validateProfileFields({ ...valid, name: "   " })).toEqual({
      name: "Enter a profile name",
    });
    expect(validateProfileFields({ ...valid, name: "a".repeat(41) })).toEqual({
      name: "Use at most 40 characters",
    });
  });

  it("rejects an unknown kind without checking the avatar against it", () => {
    expect(validateProfileFields({ ...valid, kind: "pet" })).toEqual({
      kind: "Choose whose medications these are",
    });
  });

  it("rejects an unknown avatar colour", () => {
    expect(validateProfileFields({ ...valid, avatarColor: "red" })).toEqual({
      avatarColor: "Choose an avatar colour",
    });
  });

  it("rejects an avatar not allowed for the kind, or unknown", () => {
    expect(validateProfileFields({ ...valid, avatar: "son" })).toEqual({
      avatar: "Choose an avatar from the list",
    });
    expect(validateProfileFields({ ...valid, avatar: "robot" })).toEqual({
      avatar: "Choose an avatar from the list",
    });
  });
});
