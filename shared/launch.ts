// When gameplay opens to the public (Friday, October 30, 2026, 4:00 PM UTC). Before this the site shows a countdown and the
// server refuses farm actions. Override with LAUNCH_OPENS_AT / NEXT_PUBLIC_LAUNCH_OPENS_AT.
export const LAUNCH_OPENS_AT = Date.parse('2026-10-30T16:00:00Z');
/** $HRV launches on Robinhood Chain (Friday, October 30, 2026, 3:00 PM UTC). */
export const TOKEN_LAUNCH_AT = Date.parse('2026-10-30T15:00:00Z');

/**
 * Temporary windows when the doors are open early; the gate returns on its own when one ends.
 * Monday, October 26: open 4:30–9:45 PM UTC (about five hours).
 */
export const OPEN_WINDOWS: { from: number; to: number }[] = [
  { from: Date.parse('2026-10-26T16:30:00Z'), to: Date.parse('2026-10-26T21:45:00Z') },
];

/** Whether the farm is open at `t`: after launch, or inside an early-access window. */
export const isOpenAt = (t: number, opensAt = LAUNCH_OPENS_AT) => t >= opensAt || OPEN_WINDOWS.some(w => t >= w.from && t < w.to);
/** When the current window closes (null when none is active). */
export const windowEndsAt = (t: number) => OPEN_WINDOWS.find(w => t >= w.from && t < w.to)?.to ?? null;
