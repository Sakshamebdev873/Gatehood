import type { Notice } from '@gatehood/shared';

type Me = { towerId: string; unitId: string };

/** Row eyebrow: "Pinned · all towers", "Tower A", "Your unit · A-1204". */
export function audienceLabel(notice: Notice, me: Me): string {
  const { target, pinned } = notice;
  if (target.type === 'all') return pinned ? 'Pinned · all towers' : 'All towers';
  if (target.type === 'towers') {
    const tower = `Tower ${me.towerId}`;
    return pinned ? `Pinned · ${tower}` : tower;
  }
  return pinned ? 'Pinned · your unit' : `Your unit · ${me.unitId}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Full post time for the notice screen: "24 Nov 2026 · 9:12 am". */
export function fullDate(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const clock = `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${clock}`;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Short age of a post: "now", "5m", "2h", "3d", then "12 Nov". */
export function relativeTime(ms: number, now: number): string {
  const age = now - ms;
  if (age < MIN) return 'now';
  if (age < HOUR) return `${Math.floor(age / MIN)}m`;
  if (age < DAY) return `${Math.floor(age / HOUR)}h`;
  if (age < 7 * DAY) return `${Math.floor(age / DAY)}d`;
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
