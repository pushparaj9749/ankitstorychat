import { startStatic, launch, sleep, shot, texts, tap, typeInto, go, ai } from './harness.mts';
const OUT = process.env.OUT ?? '/tmp/shots';
ai.replies = [
  `*Kaashvi ki aankhein dheere se khulti hain. Ek pal ke liye woh bilkul chup ho jaati hai — jaise duniya ki sabse khatarnak aurat ko kisi ne pehli baar hara diya ho.*\nKaashvi: "Phir se bolo. Dheere. Main record nahi kar rahi... bas yaad rakh rahi hoon."\n*Uske gaal laal ho jaate hain. Woh tumhare seene mein chehra chhupa leti hai aur uski hansi kaanp jaati hai.*\nKaashvi: "Pati dev, aaj tumne ek supari killer ko sharma diya. Ye kisi ko mat batana."`,
  `*Kaashvi ka haath tumhare baalon mein ruk jaata hai. Phir woh muskura kar phone uthati hai aur bina dekhe drawer mein daal deti hai.*\nKaashvi: "Mausi hain. Bank ki overtime wali baat. Thursday ko thodi der ho jaayegi."\n*Uski awaaz bilkul normal hai. Bas uski ungliyan ek pal ke liye tumhari kalaai par kas jaati hain — jaise koi tumhe usse cheen lega.*\nKaashvi: "Tum na, sawaal kam poocha karo... aur pyaar zyada kiya karo."`,
];
const srv = await startStatic();
const { browser, page } = await launch();
await go(page, '/');
await tap(page, 'Explore shows'); await sleep(1200);
await tap(page, 'Biwi Ek Supari Killer', { exact: true }); await sleep(1500);
await tap(page, /^(Start Story|Resume Journey|Continue)/); await sleep(4000);
console.log(await texts(page));
await shot(page, '40_chat', OUT);
await tap(page, 'Promise poora karo'); await sleep(1200);
await shot(page, '41_chip', OUT);
console.log(await texts(page));
// if chip only filled the input, send it
if (await tap(page, 'Send')) await sleep(300);
await shot(page, '42_thinking', OUT);
await sleep(3500);
await shot(page, '43_reply', OUT);
console.log(await texts(page));
await typeInto(page, /next move/i, 'Woh doosra phone kiska hai, Kaashvi?');
await shot(page, '44_typing', OUT);
await tap(page, 'Send'); await sleep(4500);
await shot(page, '45_reply2', OUT);
console.log('AI LOG', ai.log);
await tap(page, 'Story actions'); await sleep(1200);
console.log(await texts(page));
await shot(page, '46_actions', OUT);
await browser.close(); srv.close();
