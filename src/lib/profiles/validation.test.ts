import { describe, expect, it } from "vitest";

import {
  AVATARS_BY_KIND,
  isAvatarForKind,
  isProfileAvatar,
  PROFILE_AVATARS,
  PROFILE_KINDS,
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
