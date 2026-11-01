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
