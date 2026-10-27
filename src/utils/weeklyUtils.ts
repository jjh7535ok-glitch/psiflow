import LZString from 'lz-string';
import { ProductItem, PsiDataStore } from '../types/psi';

export interface WeekInfo {
  weekId: string;       // e.g. "2026-W43"
  year: number;
  weekNumber: number;
  startDateStr: string; // "YYYY-MM-DD"
  endDateStr: string;   // "YYYY-MM-DD"
  weekLabel: string;    // e.g. "2026년 W43차 (10/19 ~ 10/25)"
}

export interface WeeklySharePayload {
  version: number;
  isWeeklySnapshot: true;
  weekId: string;
  weekLabel: string;
  publishedAt: string;
  publisherEmail: string;
  products: ProductItem[];
  dataStore: PsiDataStore;
}

/**
 * Calculate ISO Week number and year for a given date
 */
export function getISOWeekInfo(d: Date = new Date()): WeekInfo {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7; // Monday = 0
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = target.getFullYear();

  // Find Monday of this ISO week
  const monday = new Date(d.valueOf());
  monday.setDate(d.getDate() - dayNr);
  const sunday = new Date(monday.valueOf());
  sunday.setDate(monday.getDate() + 6);

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatYMD = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const startDateStr = formatYMD(monday);
  const endDateStr = formatYMD(sunday);

  const weekId = `${year}-W${pad(weekNumber)}`;
  const weekLabel = `${year}년 W${pad(weekNumber)}차 (${pad(monday.getMonth() + 1)}/${pad(
    monday.getDate()
  )} ~ ${pad(sunday.getMonth() + 1)}/${pad(sunday.getDate())})`;

  return {
    weekId,
    year,
    weekNumber,
    startDateStr,
    endDateStr,
    weekLabel,
  };
}

/**
 * Generate a list of recent and upcoming weeks for easy selection
 */
export function generateWeeklyOptions(centerDate: Date = new Date()): WeekInfo[] {
  const weeks: WeekInfo[] = [];
  // 3 weeks before to 4 weeks ahead
  for (let offset = -3; offset <= 4; offset++) {
    const d = new Date(centerDate.valueOf());
    d.setDate(d.getDate() + offset * 7);
    weeks.push(getISOWeekInfo(d));
  }
  // Deduplicate by weekId
  const uniqueMap = new Map<string, WeekInfo>();
  weeks.forEach((w) => uniqueMap.set(w.weekId, w));
  return Array.from(uniqueMap.values());
}

export const SHARED_APP_URL =
  'https://ais-pre-3pmbmv3vg6sltnh3k7fqci-77782448162.asia-northeast1.run.app';
export const DEV_APP_URL =
  'https://ais-dev-3pmbmv3vg6sltnh3k7fqci-77782448162.asia-northeast1.run.app';

/**
 * Returns the real public application URL for sharing with users/stakeholders.
 * Automatically aligns with current origin (ais-pre or ais-dev).
 */
export function getPublicShareUrl(): string {
  if (typeof window !== 'undefined' && window.location.origin) {
    const origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      return origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin;
  }
  return SHARED_APP_URL;
}

/**
 * Create a compressed URL specifically for this week's plan (legacy fallback)
 */
export function createWeeklyShareUrl(
  week: WeekInfo,
  products: ProductItem[],
  dataStore: PsiDataStore,
  publisherEmail: string = 'jjh7535ok@gmail.com'
): string {
  const payload: WeeklySharePayload = {
    version: 2,
    isWeeklySnapshot: true,
    weekId: week.weekId,
    weekLabel: week.weekLabel,
    publishedAt: new Date().toISOString(),
    publisherEmail,
    products,
    dataStore,
  };

  const jsonStr = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(jsonStr);
  return `${SHARED_APP_URL}#week=${encodeURIComponent(week.weekId)}&snapshot=${compressed}`;
}

/**
 * Parse weekly share snapshot from current URL hash
 */
export function parseWeeklyShareUrl(): WeeklySharePayload | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.includes('snapshot=')) return null;

  try {
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const snapshot = params.get('snapshot');
    if (!snapshot) return null;

    const decompressed = LZString.decompressFromEncodedURIComponent(snapshot);
    if (!decompressed) return null;

    const parsed = JSON.parse(decompressed);
    if (parsed && parsed.products && parsed.dataStore) {
      return {
        version: parsed.version || 2,
        isWeeklySnapshot: true,
        weekId: parsed.weekId || 'UNKNOWN-WEEK',
        weekLabel: parsed.weekLabel || '주차별 확정 계획',
        publishedAt: parsed.publishedAt || new Date().toISOString(),
        publisherEmail: parsed.publisherEmail || 'jjh7535ok@gmail.com',
        products: parsed.products,
        dataStore: parsed.dataStore,
      };
    }
  } catch (err) {
    console.error('Failed to parse weekly snapshot from URL:', err);
  }
  return null;
}
