import { describe, expect, it, vi } from "vite-plus/test";
import { afterMilliseconds } from "./schedule";

describe(afterMilliseconds, () => {
  it("should run the call when the time has passed", () => {
    vi.useFakeTimers();
    const run = vi.fn<() => void>();

    afterMilliseconds(500, run);
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(run).toHaveBeenCalledOnce();
  });

  it("should leave the call unrun when the cancel comes first", () => {
    vi.useFakeTimers();
    const run = vi.fn<() => void>();

    afterMilliseconds(500, run)();
    vi.advanceTimersByTime(500);
    vi.useRealTimers();

    expect(run).not.toHaveBeenCalled();
  });
});
