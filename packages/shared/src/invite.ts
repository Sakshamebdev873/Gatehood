/** No 0, O, 1 or I, so codes can be read out loud and typed without mix-ups. */
export const INVITE_SUFFIX_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Units are padded to at least 4 digits, so every real code has 4 to 6 digits.
const PREFIX = '[A-Z]{1,3}\\d{4,6}';
const SUFFIX = `[${INVITE_SUFFIX_ALPHABET}]{3}`;
const CODE_PATTERN = new RegExp(`^(${PREFIX})(${SUFFIX})$`);
const DASHED_PATTERN = new RegExp(`^(${PREFIX})-(${SUFFIX})$`);

function cleanTower(tower: string): string {
  return tower.trim().toUpperCase();
}

function cleanUnit(unit: string): string {
  return unit.trim().padStart(4, '0');
}

/** `unitIdOf('A', '1204')` → `A-1204`; `unitIdOf('B', '302')` → `B-0302`. */
export function unitIdOf(tower: string, unit: string): string {
  return `${cleanTower(tower)}-${cleanUnit(unit)}`;
}

function secureRandom(): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) {
    return c.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
  }
  return Math.random();
}

/** `generateInviteCode('A', '1204')` → `A1204-7KQ`. `rand` must return [0, 1). */
export function generateInviteCode(tower: string, unit: string, rand: () => number = secureRandom): string {
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    const index = Math.min(INVITE_SUFFIX_ALPHABET.length - 1, Math.floor(rand() * INVITE_SUFFIX_ALPHABET.length));
    suffix += INVITE_SUFFIX_ALPHABET[index];
  }
  return `${cleanTower(tower)}${cleanUnit(unit)}-${suffix}`;
}

/** Cleans what a buyer typed: `' a1204 7kq '` → `A1204-7KQ`. Returns null if it can't be a code. */
export function normalizeInviteCode(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, '').replace(/-+/g, '-');
  // A dash the buyer typed marks where the suffix starts; without one, the suffix is the last 3 characters.
  const match = compact.includes('-') ? DASHED_PATTERN.exec(compact) : CODE_PATTERN.exec(compact);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}
