/**
 * Central keyboard shortcut configuration for the study screen.
 * Change the keys here to remap them everywhere.
 */
export const KEYBOARD_SHORTCUTS = {
  flip: [" ", "Enter"],
  easy: ["ArrowRight", "2"],
  hard: ["ArrowLeft", "1"],
  learned: ["ArrowUp", "3"],
  new: ["ArrowDown", "4"],
  hide: ["h", "H"],
  undo: ["z", "Z"],
} as const;

export type ShortcutAction = keyof typeof KEYBOARD_SHORTCUTS;

export function matchesShortcut(
  event: Pick<KeyboardEvent, "key">,
  action: ShortcutAction,
): boolean {
  return (KEYBOARD_SHORTCUTS[action] as readonly string[]).includes(event.key);
}
