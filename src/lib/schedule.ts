/**
 * Runs `run` once, `milliseconds` of real time from now, and gives back the
 * call that cancels it.
 *
 * The platform's timer is reached here and nowhere else. An animation frame
 * would be the tidier primitive and it stops entirely in a tab nobody is
 * looking at, which for a world left running in the background means coming
 * back to a calendar that never moved.
 */
export const afterMilliseconds = (
  milliseconds: number,
  run: () => void
): (() => void) => {
  const timer = setTimeout(run, milliseconds);
  return () => {
    clearTimeout(timer);
  };
};
