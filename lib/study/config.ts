import type { SideField } from "../types";
import type { StudyConfig } from "./types";

/**
 * Toggles a field on one side of the card. Selecting a field on one side
 * moves it there from the other side, so A and B stay mutually exclusive
 * without requiring an intermediate uncheck.
 */
export function toggleSideField(
  config: StudyConfig,
  side: "sideA" | "sideB",
  field: SideField,
): StudyConfig {
  const other = side === "sideA" ? "sideB" : "sideA";
  const selected = config[side].includes(field);

  if (selected) {
    return {
      ...config,
      [side]: config[side].filter((item) => item !== field),
    };
  }

  return {
    ...config,
    [other]: config[other].filter((item) => item !== field),
    [side]: [...config[side], field],
  };
}

/**
 * Puts the description last while keeping the chosen order of the remaining
 * fields. Sides are stored in click order, so this guarantees translations are
 * always shown above the description regardless of how the config was built.
 */
export function orderSideFields(fields: readonly SideField[]): SideField[] {
  return [
    ...fields.filter((field) => field !== "description"),
    ...fields.filter((field) => field === "description"),
  ];
}
