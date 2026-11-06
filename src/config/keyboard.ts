/**
 * Central keyboard shortcut configuration for the study screen.
 * Change the keys here to remap them everywhere.
 */
export const KEYBOARD_SHORTCUTS = {
  flip: [" ", "Enter"],
  easy: ["ArrowRight"],
  hard: ["ArrowLeft"],
  learned: ["ArrowUp"],
  new: ["ArrowDown"],
  hide: ["h", "H", "-"],
  undo: ["z", "Z", "Backspace"],
  audio: ["0", "r", "R"],
  help: ["?"],
} as const;

export type ShortcutAction = keyof typeof KEYBOARD_SHORTCUTS;

/**
 * Shortcuts never fire with Ctrl, Meta or Alt held. Shift is allowed because
 * `?` requires it on most layouts; this explicitly rejects `Ctrl+?`.
 */
export function matchesShortcut(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
  action: ShortcutAction,
): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  return (KEYBOARD_SHORTCUTS[action] as readonly string[]).includes(event.key);
}
