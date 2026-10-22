/**
 * "My Submissions" status sync — pure helpers (unit-tested).
 *
 * The device keeps its own list of submissions (local only). Statuses come
 * from GET /api/submit/status, which answers with status words only.
 */
export type LocalSubmissionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface StatusTracked {
  id: string;
  submittedAt: string;
  knownStatus: LocalSubmissionStatus;
}

/** How long an expired entry stays visible before it is tidied away. */
export const EXPIRED_VISIBLE_MS = 7 * 24 * 3600 * 1000;

/** Only pending items can still change (accepted / rejected / expired are final). */
export function idsToCheck(list: StatusTracked[]): string[] {
  return list.filter((s) => s.knownStatus === 'pending').map((s) => s.id).slice(0, 50);
}

/** Apply the server's answer. Items the server did not answer keep their status. */
export function applyServerStatuses<T extends StatusTracked>(
  list: T[],
  statuses: Record<string, LocalSubmissionStatus>,
): { list: T[]; changed: boolean } {
  let changed = false;
  const next = list.map((s) => {
    const st = statuses[s.id];
    if (!st || st === s.knownStatus) return s;
    changed = true;
    return { ...s, knownStatus: st };
  });
  return { list: next, changed };
}

/**
 * Drop only long-expired entries. Pending items are NEVER dropped by age any
 * more (that used to hide ideas that had actually been accepted); accepted
 * and rejected stay as a record.
 */
export function pruneSubmissions<T extends StatusTracked>(list: T[], now = Date.now()): T[] {
  return list.filter(
    (s) => !(s.knownStatus === 'expired' && now - new Date(s.submittedAt).getTime() > EXPIRED_VISIBLE_MS),
  );
}
