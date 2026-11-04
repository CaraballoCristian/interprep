import {
  DEFAULT_SILENCE_SECONDS,
  clampSilenceSeconds,
} from "./config";

export type SilenceTimerStatus = "idle" | "armed" | "running" | "alerted";

export type SilenceTimerState = {
  status: SilenceTimerStatus;
  durationMs: number;
  remainingMs: number;
};

export function createSilenceTimer(
  seconds: number = DEFAULT_SILENCE_SECONDS,
): SilenceTimerState {
  const durationMs = clampSilenceSeconds(seconds) * 1000;
  return { status: "idle", durationMs, remainingMs: durationMs };
}

/** Ready to start as soon as the TTS ends. */
export function armSilenceTimer(
  state: SilenceTimerState,
): SilenceTimerState {
  return { ...state, status: "armed", remainingMs: state.durationMs };
}

export function startSilenceTimer(
  state: SilenceTimerState,
): SilenceTimerState {
  return { ...state, status: "running", remainingMs: state.durationMs };
}

export function tickSilenceTimer(
  state: SilenceTimerState,
  deltaMs: number,
): SilenceTimerState {
  if (state.status !== "running" || deltaMs <= 0) {
    return state;
  }

  const remainingMs = Math.max(0, state.remainingMs - deltaMs);

  return remainingMs === 0
    ? { ...state, status: "alerted", remainingMs: 0 }
    : { ...state, remainingMs };
}

export function stopSilenceTimer(
  state: SilenceTimerState,
): SilenceTimerState {
  return { ...state, status: "idle", remainingMs: state.durationMs };
}

export function resetSilenceTimer(
  state: SilenceTimerState,
  seconds: number,
): SilenceTimerState {
  const durationMs = clampSilenceSeconds(seconds) * 1000;
  return { status: "idle", durationMs, remainingMs: durationMs };
}

/** Seconds left, rounded up so the last second is shown as 1. */
export function silenceSecondsLeft(state: SilenceTimerState): number {
  return Math.ceil(state.remainingMs / 1000);
}

/** Seconds elapsed since the countdown started. */
export function silenceSecondsElapsed(state: SilenceTimerState): number {
  return Math.max(
    0,
    Math.round((state.durationMs - state.remainingMs) / 1000),
  );
}
