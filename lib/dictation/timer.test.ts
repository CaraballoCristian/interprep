import { describe, expect, it } from "vitest";
import {
  armSilenceTimer,
  createSilenceTimer,
  resetSilenceTimer,
  silenceSecondsElapsed,
  silenceSecondsLeft,
  startSilenceTimer,
  stopSilenceTimer,
  tickSilenceTimer,
} from "./timer";

describe("silence timer", () => {
  it("clamps the duration and starts idle", () => {
    expect(createSilenceTimer(1).durationMs).toBe(3_000);
    expect(createSilenceTimer(99).durationMs).toBe(30_000);
    expect(createSilenceTimer(5).status).toBe("idle");
  });

  it("arms and starts with a full duration", () => {
    const armed = armSilenceTimer(createSilenceTimer(5));
    expect(armed.status).toBe("armed");
    expect(armed.remainingMs).toBe(5_000);

    const running = startSilenceTimer(armed);
    expect(running.status).toBe("running");
    expect(running.remainingMs).toBe(5_000);
  });

  it("counts down and alerts exactly at zero", () => {
    let timer = startSilenceTimer(createSilenceTimer(3));

    timer = tickSilenceTimer(timer, 1_000);
    expect(timer.status).toBe("running");
    expect(timer.remainingMs).toBe(2_000);

    timer = tickSilenceTimer(timer, 1_500);
    expect(timer.remainingMs).toBe(500);

    timer = tickSilenceTimer(timer, 500);
    expect(timer.status).toBe("alerted");
    expect(timer.remainingMs).toBe(0);
  });

  it("does not tick while idle or armed", () => {
    const idle = createSilenceTimer(5);
    expect(tickSilenceTimer(idle, 1_000)).toBe(idle);

    const armed = armSilenceTimer(idle);
    expect(tickSilenceTimer(armed, 1_000)).toBe(armed);
  });

  it("stops and resets", () => {
    const running = tickSilenceTimer(
      startSilenceTimer(createSilenceTimer(5)),
      2_000,
    );

    const stopped = stopSilenceTimer(running);
    expect(stopped.status).toBe("idle");
    expect(stopped.remainingMs).toBe(5_000);

    const reset = resetSilenceTimer(running, 10);
    expect(reset.durationMs).toBe(10_000);
    expect(reset.remainingMs).toBe(10_000);
  });

  it("reports seconds left and elapsed", () => {
    const running = tickSilenceTimer(
      startSilenceTimer(createSilenceTimer(5)),
      1_500,
    );

    expect(silenceSecondsLeft(running)).toBe(4);
    expect(silenceSecondsElapsed(running)).toBe(2);
  });
});
