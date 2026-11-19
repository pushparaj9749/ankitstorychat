#!/usr/bin/env node
/**
 * Turn the pending-submissions dump into a mail (subject on line 1, body after).
 *
 *   node scripts/format-ideas-mail.mjs out/pending-ideas.txt > out/mail.txt
 *
 * Kept separate from the sender so the text can be tested without SMTP.
 */
import { readFileSync, existsSync } from 'node:fs';

const file = process.argv[2] ?? 'out/pending-ideas.txt';
const raw = existsSync(file) ? readFileSync(file, 'utf8') : '';
const base = process.env.BASE ?? 'https://beyondredeye.site';

const ideas = Number((raw.match(/ideas:\s*(\d+)/) ?? [])[1] ?? 0);
const stories = Number((raw.match(/stories:\s*(\d+)/) ?? [])[1] ?? 0);
const left = Number((raw.match(/submissions left today:\s*(\d+)/) ?? [])[1] ?? NaN);
const rejected = /HTTP 401|HTTP 403/.test(raw);
const empty = raw.trim() === '';
const total = ideas + stories;

const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });

let subject;
if (empty) subject = '⚠️ Kissa: pending list nahi mili';
else if (rejected) subject = '⚠️ Kissa: admin token rejected';
else if (total === 1) subject = '📩 Kissa: 1 naya idea review ke liye';
else if (total > 1) subject = `📩 Kissa: ${total} naye ideas review ke liye`;
else subject = '✅ Kissa: koi pending idea nahi';

const lines = [];
lines.push(subject);
lines.push('');
lines.push(`Check: ${now} IST   ·   ${base}`);
lines.push(`Pending: ${ideas} idea${ideas === 1 ? '' : 's'} · ${stories} full stor${stories === 1 ? 'y' : 'ies'}` +
  (Number.isFinite(left) ? `   ·   aaj aur ${left} submissions allowed (per user)` : ''));
lines.push('');

if (empty) {
  lines.push('Pending list khaali hai — fetch fail hua lagta hai (network / worker down).');
  lines.push('');
  lines.push('Dekho: Actions → "Ideas check" → latest run ka log aur summary.');
} else if (rejected) {
  lines.push('Admin token galat hai ya rotate ho gaya.');
  lines.push('Fix: repo → Settings → Secrets and variables → Actions → ADMIN_TOKEN update karo.');
} else if (!total) {
  lines.push('Sab clear hai — koi pending submission nahi.');
  lines.push('');
  lines.push('Note: pending submissions 24 ghante baad expire ho jaate hain, isliye ye check din mein');
  lines.push('do baar chalta hai (6:00 AM aur 6:00 PM IST).');
} else {
  lines.push('Review karo — 24h TTL hai, iske baad idea apne aap expire ho jaayega.');
  lines.push('');
  lines.push('─'.repeat(60));
  // drop the header lines of the dump, keep the submission blocks
  const body = raw
    .split('\n')
    .filter((l, i) => !(i < 4 && /^(Kissa —|ideas:|$)/.test(l)))
    .filter((l) => l.trim() !== '─'.repeat(46))
    .join('\n')
    .trim();
  lines.push(body);
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('Accept / reject: Kissa app → Settings → Admin, ya:');
  lines.push(`  GET  ${base}/api/admin/pending`);
  lines.push(`  POST ${base}/api/admin/idea/:id/accept   |   .../reject`);
  lines.push(`  POST ${base}/api/admin/story/:id/accept  |   .../reject`);
  lines.push('');
  lines.push('Poori list run summary mein bhi hai: Actions → "Ideas check" → latest run.');
}

lines.push('');
lines.push('— Kissa automation (scripts/admin-ideas.mjs)');

process.stdout.write(lines.join('\n') + '\n');
