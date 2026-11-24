import { unitIdOf, type BuyerStatus, type CreateNoticeRequest, type NoticeTarget } from '@gatehood/shared';

/** `part` as a whole percent of `whole`, kept to 0–100. 0 when `whole` is 0. */
export function pct(part: number, whole: number): number {
  if (!(whole > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

/** The joined status of one invited buyer, as the buyers list returns it. */
type InvitedBuyer = { towerId: string; unitId: string; status: BuyerStatus };

/**
 * Joined buyers a notice reaches: the "of N" in "3 of 7 read". Same rule as the stats screen,
 * which only counts buyers who have joined.
 */
export function joinedInAudience(target: NoticeTarget, buyers: readonly InvitedBuyer[]): number {
  return buyers.filter((b) => {
    if (b.status !== 'joined') return false;
    if (target.type === 'towers') return target.towers.includes(b.towerId);
    if (target.type === 'units') return target.unitIds.includes(b.unitId);
    return true;
  }).length;
}

/** More units than this are counted ("4 units") rather than listed. */
const LISTED_UNITS = 3;

/** Who a notice went to: "All towers", "Towers A, B", "Unit A-1204", "12 units". */
export function targetLabel(target: NoticeTarget): string {
  switch (target.type) {
    case 'all':
      return 'All towers';
    case 'towers':
      return target.towers.length === 1 ? `Tower ${target.towers[0]}` : `Towers ${target.towers.join(', ')}`;
    case 'units':
      if (target.unitIds.length === 1) return `Unit ${target.unitIds[0]}`;
      if (target.unitIds.length <= LISTED_UNITS) return `Units ${target.unitIds.join(', ')}`;
      return `${target.unitIds.length} units`;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Stats eyebrow: "Towers A, B · posted 21 Nov". */
export function postedLabel(target: NoticeTarget, createdAt: number): string {
  const d = new Date(createdAt);
  return `${targetLabel(target)} · posted ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export const STATUS_LABEL: Record<BuyerStatus, string> = {
  joined: 'Joined',
  pending: 'Pending',
  expired: 'Expired',
};

/** A tower of 1–3 letters, an optional dash, and a unit number of up to 6 digits. */
const LOOSE_UNIT = /^([A-Z]{1,3})-?(\d{1,6})$/;

/**
 * Reads typed unit ids separated by commas, spaces or new lines. Accepts `a1204` or `b-302`
 * and writes them as `A-1204` and `B-0302`. Repeats are dropped; anything unreadable is in `bad`.
 */
export function parseUnitIds(text: string): { ids: string[]; bad: string[] } {
  const ids: string[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const m = LOOSE_UNIT.exec(token.toUpperCase());
    if (!m) {
      bad.push(token);
      continue;
    }
    const id = unitIdOf(m[1]!, m[2]!);
    if (!ids.includes(id)) ids.push(id);
  }
  return { ids, bad };
}

export type AudienceMode = 'all' | 'towers' | 'units';

export type NoticeDraft = {
  title: string;
  body: string;
  pinned: boolean;
  mode: AudienceMode;
  /** Picked tower ids, used when mode is 'towers'. */
  towers: string[];
  /** Typed unit ids, used when mode is 'units'. */
  unitsText: string;
};

export type DraftErrors = Partial<Record<'title' | 'body' | 'audience', string>>;

/** Same limits as CreateNoticeRequest on the server. */
const MAX_TITLE = 120;
const MAX_BODY = 4000;

/** Checks the new-notice form and builds the request, or says what to fix, per field. */
export function buildNoticeRequest(
  draft: NoticeDraft,
): { ok: true; request: CreateNoticeRequest } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const title = draft.title.trim();
  const body = draft.body.trim();

  if (!title) errors.title = 'Add a title.';
  else if (title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;
  if (!body) errors.body = 'Add the notice text.';
  else if (body.length > MAX_BODY) errors.body = `Keep the text under ${MAX_BODY} characters.`;

  let target: NoticeTarget = { type: 'all' };
  if (draft.mode === 'towers') {
    const towers = [...new Set(draft.towers)].sort();
    if (towers.length === 0) errors.audience = 'Pick at least one tower.';
    target = { type: 'towers', towers };
  } else if (draft.mode === 'units') {
    const { ids, bad } = parseUnitIds(draft.unitsText);
    if (bad.length > 0) errors.audience = `These aren't unit ids: ${bad.join(', ')}. Use the form A-1204.`;
    else if (ids.length === 0) errors.audience = 'Type at least one unit, like A-1204.';
    target = { type: 'units', unitIds: ids };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, request: { title, body, target, pinned: draft.pinned } };
}
