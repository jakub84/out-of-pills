"use client";

import { ArrowLeft, Baby, Heart, Plus, User, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState, type ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { initialProfileFormState, type ProfileFormState } from "@/lib/profiles/form-state";
import {
  AVATAR_COLORS,
  initialOf,
  isAvatarColor,
  isProfileKind,
  type AvatarColor,
  type ProfileKind,
} from "@/lib/profiles/validation";
import { cn } from "@/lib/utils";
import { avatarBgClass, avatarColorLabel } from "./avatar-colors";

type ProfileFormAction = (
  prevState: ProfileFormState,
  formData: FormData,
) => Promise<ProfileFormState>;

type ProfileFormProps = {
  /** The caregiver's first name: default profile name for "For me" and its first chip. */
  displayName: string;
  action: ProfileFormAction;
  /** Where the secondary button leads; omitted → no secondary button. */
  backHref?: string;
  backLabel?: string;
  /** Verb of the submit button; the typed name is appended, e.g. `Create profile "Mom"`. */
  submitLabel: string;
  /** Onboarding header: rendered above a live "Profile: <typed name>" heading. */
  liveHeading?: { eyebrow: ReactNode; intro: ReactNode };
};

const KIND_OPTIONS: { value: ProfileKind; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "me", label: "For me", hint: "my medications", icon: User },
  { value: "parent", label: "For a parent", hint: "mom, dad, grandparents", icon: Users },
  { value: "child", label: "For a child", hint: "son, daughter", icon: Baby },
  { value: "other", label: "For someone else", hint: "partner, someone in your care", icon: Heart },
];

function nameChips(kind: ProfileKind, displayName: string): string[] {
  switch (kind) {
    case "me":
      return displayName ? [displayName, "Me"] : ["Me"];
    case "parent":
      return ["Mom", "Dad"];
    case "child":
      return ["Son", "Daughter"];
    case "other":
      return ["Partner"];
  }
}

/** Profile type, name (with suggestion chips) and avatar colour; posts `name`, `kind`, `avatarColor`. */
export function ProfileForm({
  displayName,
  action,
  backHref,
  backLabel = "Back",
  submitLabel,
  liveHeading,
}: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialProfileFormState);
  const [kind, setKind] = useState<ProfileKind>("me");
  // Starts empty: the user types a name or picks a chip.
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState<AvatarColor>("mint");

  const ids = useId();
  const kindHeadingId = `${ids}-kind`;
  const nameId = `${ids}-name`;
  const nameHintId = `${ids}-name-hint`;
  const nameErrorId = `${ids}-name-error`;
  const colorLabelId = `${ids}-color`;

  const trimmedName = name.trim();
  const initial = initialOf(name);
  const nameError = state.fieldErrors?.name;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="avatarColor" value={avatarColor} />

      {liveHeading ? (
        <div className="flex flex-col gap-3">
          <p className="font-heading text-2xl font-light text-brand-ink">{liveHeading.eyebrow}</p>
          <h1 className="font-heading text-4xl font-normal break-words text-foreground sm:text-[54px]">
            Profile: <span className="text-primary">{trimmedName || "…"}</span>
          </h1>
          <p className="max-w-[526px] text-base leading-6 text-brand-subtle">
            {liveHeading.intro}
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-5">
        <h2 id={kindHeadingId} className="font-heading text-2xl font-normal text-foreground sm:text-[32px]">
          Whose medications are we keeping an eye on?
        </h2>
        <RadioGroup
          aria-labelledby={kindHeadingId}
          value={kind}
          onValueChange={(value) => {
            if (isProfileKind(value)) setKind(value);
          }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          {KIND_OPTIONS.map((option) => {
            const selected = option.value === kind;
            const Icon = option.icon;
            const itemId = `${ids}-kind-${option.value}`;
            return (
              <Label
                key={option.value}
                htmlFor={itemId}
                className={cn(
                  "flex min-h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border bg-card px-2 py-5 text-center transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  selected
                    ? "border-primary bg-primary-tint shadow-[inset_0_0_0_1px_var(--primary)]"
                    : "border-border hover:bg-muted",
                )}
              >
                <RadioGroupItem id={itemId} value={option.value} className="sr-only" />
                <Icon aria-hidden className={cn("size-6", selected ? "text-primary" : "text-foreground")} />
                <span className="text-[15px] font-semibold text-foreground">{option.label}</span>
                <span className="text-[13px] leading-5 font-normal text-muted-foreground">
                  {option.hint}
                </span>
              </Label>
            );
          })}
        </RadioGroup>
        {state.fieldErrors?.kind ? (
          <p className="text-sm text-destructive">{state.fieldErrors.kind}</p>
        ) : null}
      </section>

      <div className="flex flex-col gap-8 sm:flex-row sm:gap-10">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor={nameId} className="font-light">
            Profile name
          </Label>
          <Input
            id={nameId}
            name="name"
            autoComplete="off"
            aria-required
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameErrorId} ${nameHintId}` : nameHintId}
            className="sm:max-w-[367px]"
          />
          {nameError ? (
            <p id={nameErrorId} className="text-sm text-destructive">
              {nameError}
            </p>
          ) : null}
          <div role="group" aria-label="Name suggestions" className="flex flex-wrap gap-2">
            {nameChips(kind, displayName).map((chip) => {
              const selected = trimmedName === chip;
              return (
                <Button
                  key={chip}
                  type="button"
                  variant="outline"
                  aria-pressed={selected}
                  onClick={() => setName(chip)}
                  className={cn(
                    "h-auto max-w-full rounded-full px-3.5 py-2 text-[13px] font-semibold",
                    selected
                      ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "bg-card text-foreground",
                  )}
                >
                  <span className="truncate">{chip}</span>
                </Button>
              );
            })}
          </div>
          <p id={nameHintId} className="text-[13px] text-brand-subtle">
            Use the name you say every day. You can add more profiles later.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label id={colorLabelId} asChild className="font-light">
            <span>Avatar colour</span>
          </Label>
          <RadioGroup
            aria-labelledby={colorLabelId}
            value={avatarColor}
            onValueChange={(value) => {
              if (isAvatarColor(value)) setAvatarColor(value);
            }}
            className="grid w-fit grid-cols-3 gap-2"
          >
            {AVATAR_COLORS.map((color) => {
              const selected = color === avatarColor;
              const itemId = `${ids}-color-${color}`;
              return (
                <Label
                  key={color}
                  htmlFor={itemId}
                  className={cn(
                    "relative flex size-12 cursor-pointer items-center justify-center rounded-full text-sm font-semibold text-foreground has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring/50",
                    avatarBgClass[color],
                    selected
                      ? "ring-[3px] ring-primary ring-offset-2 ring-offset-card"
                      : "border border-border",
                  )}
                >
                  {/* Invisible but focusable; the label itself is the visible swatch. */}
                  <RadioGroupItem
                    id={itemId}
                    value={color}
                    aria-label={avatarColorLabel[color]}
                    className="absolute inset-0 size-full border-0 opacity-0"
                  />
                  <span aria-hidden>{selected ? initial : null}</span>
                </Label>
              );
            })}
          </RadioGroup>
          {state.fieldErrors?.avatarColor ? (
            <p className="text-sm text-destructive">{state.fieldErrors.avatarColor}</p>
          ) : null}
        </div>
      </div>

      <Separator />

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {backHref ? (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-2 border-brand-subtle bg-card text-brand-ink hover:bg-muted"
          >
            <Link href={backHref}>
              <ArrowLeft data-icon="inline-start" aria-hidden />
              {backLabel}
            </Link>
          </Button>
        ) : null}
        <Button type="submit" size="lg" disabled={isPending} className="max-w-full min-w-0">
          <Plus data-icon="inline-start" aria-hidden />
          <span className="truncate">
            {isPending
              ? "Creating…"
              : trimmedName
                ? `${submitLabel} “${trimmedName}”`
                : submitLabel}
          </span>
        </Button>
      </div>
    </form>
  );
}
