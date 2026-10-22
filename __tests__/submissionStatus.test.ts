/**
 * v2.10.1 — "My Submissions" shows the real review status (synced from the
 * server) instead of "Pending" forever.
 */
import fs from 'fs';
import path from 'path';
import { applyServerStatuses, idsToCheck, pruneSubmissions, EXPIRED_VISIBLE_MS } from '../src/lib/submissionStatus';

const now = Date.parse('2026-10-23T12:00:00Z');
const item = (id: string, knownStatus: any, hoursAgo: number) => ({
  id,
  knownStatus,
  submittedAt: new Date(now - hoursAgo * 3600 * 1000).toISOString(),
});

describe('submission status helpers', () => {
  it('only asks about pending items', () => {
    const list = [item('idea_a', 'pending', 1), item('idea_b', 'accepted', 2), item('story_c', 'rejected', 3), item('idea_d', 'expired', 30)];
    expect(idsToCheck(list)).toEqual(['idea_a']);
  });

  it('applies accepted / rejected / expired from the server', () => {
    const list = [item('idea_a', 'pending', 1), item('idea_b', 'pending', 2), item('idea_c', 'pending', 30)];
    const res = applyServerStatuses(list, { idea_a: 'accepted', idea_b: 'rejected', idea_c: 'expired' });
    expect(res.changed).toBe(true);
    expect(res.list.map((s) => s.knownStatus)).toEqual(['accepted', 'rejected', 'expired']);
  });

  it('keeps the old status when the server gave no answer', () => {
    const list = [item('idea_a', 'pending', 1)];
    const res = applyServerStatuses(list, {});
    expect(res.changed).toBe(false);
    expect(res.list[0].knownStatus).toBe('pending');
  });

  it('never drops a pending item just because 24h passed', () => {
    const list = [item('idea_a', 'pending', 30), item('idea_b', 'accepted', 24 * 40)];
    expect(pruneSubmissions(list, now)).toHaveLength(2);
  });

  it('tidies away only long-expired items', () => {
    const old = item('idea_old', 'expired', EXPIRED_VISIBLE_MS / 3600000 + 1);
    const recent = item('idea_new', 'expired', 30);
    expect(pruneSubmissions([old, recent], now).map((s) => s.id)).toEqual(['idea_new']);
  });
});

describe('My Submissions screen wiring', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/screens/MySubmissions.tsx'), 'utf8');
  it('syncs statuses from the server', () => {
    expect(src).toMatch(/fetchSubmissionStatuses\(/);
    expect(src).toMatch(/'Expired'/);
  });
  it('no longer filters out pending items older than 24h', () => {
    expect(src).not.toMatch(/knownStatus === 'pending' && now - new Date/);
  });
  it('the API client calls the public status route', () => {
    const api = fs.readFileSync(path.join(__dirname, '..', 'src/content/submissions.ts'), 'utf8');
    expect(api).toMatch(/submit\/status\?ids=/);
  });
});
