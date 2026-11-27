/**
 * The bell badge is the ONLY way a reader learns a notification arrived.
 *
 * Two regressions are pinned here:
 *
 *  1. The count was fetched exactly once, during boot. A notification that
 *     arrived while the app was open never lit the badge — the bell stayed
 *     plain and the message was invisible until the reader opened the screen
 *     by accident. Now it refreshes on foreground + on a slow timer.
 *
 *  2. The badge itself was 16px with a 9px glyph — unreadable at arm's length.
 *
 * These are source-level guards (the repo has no RN jest preset); the comment
 * stripping matters because the fix is documented in the same files.
 */
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

describe('notification bell badge', () => {
  test('the badge is rendered with the real count, capped at 9+', () => {
    const home = code('src/screens/Home.tsx');
    expect(home).toMatch(/unread > 0 \?/);
    expect(home).toMatch(/unread > 9 \? '9\+'/);
    expect(home).toMatch(/styles\.bellBadge/);
    // screen readers hear the count too, not just sighted users
    expect(home).toMatch(/Notifications, \$\{unread\} unread/);
  });

  test('the badge is large enough to read', () => {
    const home = code('src/screens/Home.tsx');
    const minWidth = /bellBadge:\s*\{[\s\S]*?minWidth:\s*(\d+)/.exec(home)?.[1];
    const font = /bellBadgeText:\s*\{[\s\S]*?fontSize:\s*(\d+)/.exec(home)?.[1];
    expect(Number(minWidth)).toBeGreaterThanOrEqual(18);
    expect(Number(font)).toBeGreaterThanOrEqual(10);
  });

  test('the count is refreshed while the app is open, not only at boot', () => {
    const ctx = code('src/state/AppContext.tsx');
    // foreground
    expect(ctx).toMatch(/RNAppState\.addEventListener\('change'/);
    expect(ctx).toMatch(/next === 'active'/);
    // while it stays open
    expect(ctx).toMatch(/setInterval\(\(\) => void refreshUnreadBadge\(\), 60_000\)/);
    // and cleaned up, or a signed-out user keeps polling forever
    expect(ctx).toMatch(/sub\.remove\(\)/);
    expect(ctx).toMatch(/clearInterval\(timer\)/);
    // signed out = no polling, no badge
    expect(ctx).toMatch(/if \(!account\) return;/);
  });

  test('opening the feed clears the badge', () => {
    const feed = code('src/screens/Notifications.tsx');
    expect(feed).toMatch(/markAllNotificationsRead/);
    expect(feed).toMatch(/refreshUnread\(\)/);
  });
});
