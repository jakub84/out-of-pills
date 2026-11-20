// Wording of every save toast, kept in one place.

import { formatTablets } from "@/lib/medications/format";

/** "Aspirin added" */
export function medicationAddedMessage(name: string): string {
  return `${name} added`;
}

/** "Aspirin updated" */
export function medicationUpdatedMessage(name: string): string {
  return `${name} updated`;
}

/** "Aspirin paused" */
export function medicationPausedMessage(name: string): string {
  return `${name} paused`;
}

/** "Aspirin resumed" */
export function medicationResumedMessage(name: string): string {
  return `${name} resumed`;
}

/** "+28 tabl. added to Aspirin" */
export function packageAddedMessage(name: string, tablets: number): string {
  return `+${formatTablets(tablets)} tabl. added to ${name}`;
}

/** "Aspirin count set to 18 tabl." */
export function countCorrectedMessage(name: string, tablets: number): string {
  return `${name} count set to ${formatTablets(tablets)} tabl.`;
}

/** "Profile Mom created" */
export function profileCreatedMessage(name: string): string {
  return `Profile ${name} created`;
}

export function passwordChangedMessage(): string {
  return "Password changed";
}

/** Shown when this tab's code no longer matches the deployed server. */
export function appUpdatedMessage(): string {
  return "A new version is available. Reload the page and try again.";
}

/** Shown when the request failed: the save may or may not have reached the server. */
export function connectionErrorMessage(): string {
  return "Couldn't confirm the save. Check your connection and reload the page before trying again.";
}
