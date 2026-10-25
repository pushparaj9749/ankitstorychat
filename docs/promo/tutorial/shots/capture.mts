/**
 * Full tutorial capture from a FRESH profile. Writes PNGs to $OUT (default
 * docs/promo/tutorial/shots/raw) and a texts log for each shot.
 *   PROFILE=/tmp/prof-tut tsx capture.mts [section,section,...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { startStatic, launch, sleep, texts, tap, typeInto, go, ai, REPO } from './harness.mts';
import type { Page } from 'puppeteer-core';

const OUT = process.env.OUT ?? path.join(REPO, 'docs/promo/tutorial/shots/raw');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2]?.split(',');
const log: string[] = [];
const RECTS: Record<string, { t: string; r: number[] }[]> = {};
const DPR = 2.5;

let page: Page;
async function snap(name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  RECTS[name] = await page.evaluate((dpr: number) => {
    const out: { t: string; r: number[] }[] = [];
    const ok = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) return null;
      const h = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
      if (!h || !(el.contains(h) || h.contains(el))) return null;
      return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * dpr));
    };
    document.querySelectorAll('[aria-label]').forEach((el) => { const r = ok(el); if (r) out.push({ t: '@' + el.getAttribute('aria-label'), r }); });
    document.querySelectorAll('input,textarea').forEach((el) => { const r = ok(el); if (r) out.push({ t: '#' + (el.getAttribute('placeholder') || ''), r }); });
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const tx = n.textContent?.trim(); const el = n.parentElement;
      if (!tx || !el) continue;
      const r = ok(el); if (r) out.push({ t: tx, r });
    }
    return out;
  }, DPR);
  const t = await texts(page);
  log.push(`## ${name}\n${t}\n`);
  console.log('shot', name, '::', t.slice(0, 160));
}
async function t(m: string | RegExp, exact = false, wait = 1300) {
  const ok = await tap(page, m, { exact });
  if (!ok) console.log('  !! tap failed', String(m));
  await sleep(wait);
  return ok;
}
async function back() {
  if (!(await tap(page, 'Go back'))) await go(page, '/');
  await sleep(1300);
}
async function toSettings(dy = 0) {
  await go(page, '/');
  await t('Profile and Settings');
  await scrollTop();
  if (dy) await scroll(dy);
}
async function scroll(dy: number) {
  await page.mouse.move(206, 450);
  await page.mouse.wheel({ deltaY: dy });
  await sleep(1000);
}
async function scrollTop() { for (let i = 0; i < 4; i++) await scroll(-1500); }

ai.replies = [
  `Kaashvi: *Uski aankhein dheere se khulti hain. Ek pal ke liye woh bilkul chup ho jaati hai — jaise Mumbai ki sabse khatarnak aurat ko kisi ne pehli baar hara diya ho.* "Phir se bolo. Dheere. Main record nahi kar rahi... bas yaad rakh rahi hoon."\n\n*Uske gaal laal ho jaate hain. Woh tumhare seene mein chehra chhupa leti hai, aur uski hansi kaanp jaati hai.*\n\n"Pati dev, aaj tumne ek supari killer ko sharma diya. Ye baat kisi ko mat batana."`,
  `Kaashvi: *Uska haath tumhare baalon mein ek pal ke liye ruk jaata hai. Phir woh muskura kar phone uthati hai aur bina dekhe drawer mein daal deti hai.* "Mausi hain. Bank ki overtime wali baat. Thursday ko thodi der ho jaayegi."\n\n*Awaaz bilkul normal hai. Bas uski ungliyan tumhari kalaai par kas jaati hain — jaise koi tumhe usse cheen lega.*\n\n"Tum na, sawaal kam poocha karo... aur pyaar zyada kiya karo."`,
  `Kaashvi: *Woh tumhari taraf palat-ti hai, aankhon mein wahi shararat.* "Achha? Toh aaj itni himmat kahan se aa gayi, jaanu?"\n\n*Bahar baarish tez ho jaati hai. Fairy lights ki roshni mein uska chehra aur bhi narm lagta hai.*`,
];

const sections: Record<string, () => Promise<void>> = {
  async onboarding() {
    await snap('01_name_empty');
    await typeInto(page, 'Nickname', 'Rahul', 90);
    await snap('02_name_typed');
    await t('Continue');
    await snap('03_age');
    await t('18+', true);
    await snap('04_age_selected');
    await t('Get Started', false, 3500);
    await snap('05_home');
    await scroll(700);
    await snap('06_home_top10');
    await scroll(900);
    await snap('07_home_more');
    await scrollTop();
  },
  async aisetup() {
    await t('Profile and Settings');
    await scrollTop();
    await snap('10_settings_top');
    await t('Connect your own AI');
    await snap('11_ai_setup_empty');
    await t('+ Add AI Provider');
    await snap('12_editor_blank');
    await t('Groq', true);
    await snap('13_editor_groq');
    await typeInto(page, 'sk-', 'gsk_7fQ2xLm9RtVb4KpZ8nWc3YhJdE1s', 40);
    await snap('14_editor_key');
    await t('Test Connection', false, 2200);
    await snap('15_test_ok');
    await t('Save Provider', false, 1800);
    await snap('16_provider_saved');
    await toSettings();
    await snap('17_settings_after');
    await go(page, '/');
  },
  async discover() {
    await t('Explore shows', false, 1800);
    await scrollTop();
    await snap('20_explore');
    await scroll(700);
    await snap('21_explore_scrolled');
    await scrollTop();
    await t('Action', true, 1500);
    await snap('22_explore_genre');
    await t('All', true, 1500);
    await t('Biwi Ek Supari Killer', true, 2200);
    await snap('23_detail_top');
    await scroll(750);
    await snap('24_detail_cast');
    await scroll(800);
    await snap('25_detail_media');
    await scroll(800);
    await snap('26_detail_creator');
    await scrollTop();
  },
  async chat() {
    await t(/^(Start Story|Resume Journey)$/, false, 4500);
    await snap('30_chat_open');
    await t('Promise poora karo', false, 250);
    await snap('31_chat_thinking');
    await sleep(3500);
    await snap('32_chat_reply1');
    await typeInto(page, /next move/i, 'Woh doosra phone kiska hai, Kaashvi?', 45);
    await snap('33_chat_typing');
    await t('Send', false, 4500);
    await snap('34_chat_reply2');
    await t('Story actions', false, 1300);
    await snap('35_chat_actions');
    await t('Close story actions', false, 900);
    await scroll(-500);
    await snap('36_chat_scrolled');
    await back();
    await sleep(800);
  },
  async library() {
    await go(page, '/');
    await t('Story Library', false, 1800);
    await snap('40_library');
    await scroll(700);
    await snap('41_library_more');
    await scrollTop();
    // Saves screen via story detail
    await t('Explore shows', false, 1500);
    await t('Biwi Ek Supari Killer', true, 2000);
    await t(/^Saves/, false, 1800);
    await snap('42_saves');
  },
  async create() {
    await go(page, '/');
    await t('Create a story', false, 1800);
    await snap('50_create');
  },
  async idea() {
    await go(page, '/');
    await t('Create a story', false, 3500);
    await snap('54_idea_blank');
    await typeInto(page, 'Title of your story', 'Meri Pehredaar Biwi', 60);
    await typeInto(page, 'story premise', 'Main ek shy librarian hoon. Shaadi ke baad pata chalta hai ki meri biwi Mumbai ki sabse tez bodyguard hai — aur woh mujhe kisi ki nazar bhi nahi lagne deti.', 18);
    await typeInto(page, 'Names and personalities', 'Tanvi — tez, protective, bahut romantic', 25);
    await snap('55_idea_filled');
    await scroll(700);
    await snap('56_idea_bottom');
    await t('Send Idea', false, 3000);
    await snap('57_idea_success');
    await scroll(600);
    await snap('58_idea_success_more');
    await toSettings();
    await t('My Submissions', false, 2500);
    await snap('59_my_submissions_pending');
  },
  async submit() {
    await go(page, '/');
    await t('Profile and Settings');
    await scrollTop();
    await t('Suggest an Idea', false, 1800);
    await snap('51_idea_form');
    await toSettings();
    await t('Submit a Story', false, 1800);
    await snap('52_story_form');
    await toSettings();
    await t('My Submissions', false, 1800);
    await snap('53_my_submissions');
    await toSettings();
  },
  async template() {
    await toSettings();
    await t('Theme & Typography', false, 1500);
    await t('Kissa Night template', false, 2000);
    await snap('70_appearance_night');
    await go(page, '/');
    await snap('71_home_night');
    await t('Profile and Settings');
    await scrollTop();
    await snap('72_settings_night');
    await t('Theme & Typography', false, 1500);
    await t('Kissa Noir template', false, 2000);
    await snap('73_appearance_noir');
  },
  async soundrem() {
    await toSettings(500);
    await t('Sound & Haptics', false, 1500);
    await snap('62_sound');
    await toSettings(500);
    await t('Reminders & Updates', false, 1500);
    await snap('63_reminders');
  },
  async settings() {
    await go(page, '/');
    await t('Profile and Settings');
    await scrollTop();
    await t('Theme & Typography', false, 1500);
    await snap('60_appearance');
    await scroll(700);
    await snap('61_appearance_more');
    await scrollTop();
    await toSettings(500);
    await t('Sound & Haptics', false, 1500);
    await snap('62_sound');
    await toSettings(500);
    await t('Reminders & Updates', false, 1500);
    await snap('63_reminders');
    await toSettings(700);
    await t('App Lock', false, 1500);
    await snap('64_applock');
    await toSettings(700);
    await t('Storage & Backup', false, 1500);
    await snap('65_storage');
    await toSettings(1600);
    await t('About Kissa', false, 1500);
    await snap('66_about');
    await scroll(800);
    await snap('67_about_more');
    await toSettings();
    await t('Edit profile', false, 1500);
    await snap('68_profile');
    await toSettings();
  },
};

const srv = await startStatic();
const L = await launch();
page = L.page;
await go(page, '/');
for (const [k, fn] of Object.entries(sections)) {
  if (only && !only.includes(k)) continue;
  console.log('== section', k);
  try { await fn(); } catch (e) { console.log('section failed', k, e); }
}
fs.appendFileSync(path.join(OUT, '_texts.md'), log.join('\n'));
const rf = path.join(OUT, '_rects.json');
const prev = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : {};
fs.writeFileSync(rf, JSON.stringify({ ...prev, ...RECTS }));
console.log('AI LOG', ai.log);
await L.browser.close();
srv.close();
