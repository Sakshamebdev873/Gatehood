/** Firestore answers that mean "you will never get this", as opposed to "not right now". */
const GONE_CODES = new Set(['permission-denied', 'not-found', 'invalid-argument']);

/**
 * True when a notice read failed for good: removed, never existed, or outside the buyer's
 * audience (the rules deny a missing doc too, so a guessed id lands here). Anything else,
 * such as `unavailable` while offline, is worth retrying.
 */
export function isGoneError(err: unknown): boolean {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  return typeof code === 'string' && GONE_CODES.has(code);
}
