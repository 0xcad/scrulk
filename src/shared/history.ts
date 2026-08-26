import { type DBSchema, type IDBPDatabase, openDB } from "idb";

/**
 * Time-series history of past wake-days. One row per wake-day, keyed on a
 * 'YYYY-MM-DD' string derived from the wake-day start (local time).
 *
 * Two write moments:
 *   1. Survey submit — fills notes (and totalMs at that moment).
 *   2. Day-reset alarm — persists outgoing day's totalMs (notes stays
 *      null if the user never filled the survey).
 */

export interface DayRecord {
  date: string;
  totalMs: number;
  /** Active time on all HTTP(S) sites; absent for records from before this feature. */
  allSitesMs?: number;
  /** Active all-sites time accrued while a focus window was foreground. */
  focusMs?: number;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ScrUlkHistoryDB extends DBSchema {
  days: {
    key: string;
    value: DayRecord;
  };
}

const DB_NAME = "scrulk-history";
const DB_VERSION = 1;
const STORE = "days";

let dbPromise: Promise<IDBPDatabase<ScrUlkHistoryDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ScrUlkHistoryDB>> {
  if (dbPromise === null) {
    dbPromise = openDB<ScrUlkHistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "date" });
        }
      },
    });
  }
  return dbPromise;
}

export async function getDay(date: string): Promise<DayRecord | null> {
  const db = await getDB();
  const row = await db.get(STORE, date);
  return row ?? null;
}

export async function getAllDays(): Promise<DayRecord[]> {
  const db = await getDB();
  const rows = await db.getAll(STORE);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

export async function upsertDay(
  date: string,
  patch: Partial<Omit<DayRecord, "date" | "createdAt" | "updatedAt">>,
): Promise<DayRecord> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  const existing = await tx.store.get(date);
  const now = Date.now();
  const next: DayRecord = existing
    ? { ...existing, ...patch, updatedAt: now }
    : {
        date,
        totalMs: 0,
        notes: null,
        createdAt: now,
        updatedAt: now,
        ...patch,
      };
  await tx.store.put(next);
  await tx.done;
  return next;
}

export async function getRunningAverageMs(
  excludeDate?: string,
): Promise<number> {
  const all = await getAllDays();
  const filtered = excludeDate
    ? all.filter((d) => d.date !== excludeDate)
    : all;
  if (filtered.length === 0) return 0;
  const sum = filtered.reduce((acc, d) => acc + d.totalMs, 0);
  return sum / filtered.length;
}

/**
 * Convert a wake-day-start epoch ms (already aligned to the wake-up boundary
 * via `currentWakeDayStart`) into a 'YYYY-MM-DD' key in local time. The wake-
 * day "owns" the calendar date of its start.
 */
export function dateKey(wakeDayStartMs: number): string {
  const d = new Date(wakeDayStartMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Heat-color bucket for calendar cells. Fixed thresholds (not relative to
 * average) so colors stay stable as history grows.
 *   <30m → 1, <60m → 2, <120m → 3, ≥120m → 4
 */
export function heatBucket(totalMs: number): 0 | 1 | 2 | 3 | 4 {
  if (totalMs <= 0) return 0;
  if (totalMs < 30 * 60_000) return 1;
  if (totalMs < 60 * 60_000) return 2;
  if (totalMs < 120 * 60_000) return 3;
  return 4;
}
