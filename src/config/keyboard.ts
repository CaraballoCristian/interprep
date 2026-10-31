/**
 * Central keyboard shortcut configuration for the study screen.
 * Change the keys here to remap them everywhere.
 */
export const KEYBOARD_SHORTCUTS = {
  flip: [" ", "Enter"],
  success: ["ArrowRight", "2"],
  fail: ["ArrowLeft", "1"],
  hide: ["h", "H", "ArrowUp"],
  undo: ["z", "Z"],
} as const;

export type ShortcutAction = keyof typeof KEYBOARD_SHORTCUTS;

export function matchesShortcut(
  event: Pick<KeyboardEvent, "key">,
  action: ShortcutAction,
): boolean {
  return (KEYBOARD_SHORTCUTS[action] as readonly string[]).includes(event.key);
}
