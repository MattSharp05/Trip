/**
 * The app's clock. Everything date-dependent ("today", "upcoming", countdowns) asks `now()`
 * instead of `new Date()`, so a scenario can pin "today" to a fixed instant and tests stay
 * deterministic.
 */
let fixed: number | null = null;

/** The current instant: the fixed one while a scenario (or test) has pinned it, else real time. */
export function now(): Date {
  return new Date(fixed ?? Date.now());
}

/** Pin the clock to an instant (ISO string with offset, or a Date). `null` unpins it. */
export function setNow(instant: Date | string | null): void {
  if (instant === null) {
    fixed = null;
    return;
  }
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant.getTime();
  if (Number.isNaN(ms)) throw new Error(`Invalid instant: ${String(instant)}`);
  fixed = ms;
}

export function isClockFixed(): boolean {
  return fixed !== null;
}
