# Kissa — cover guide (every new story from now on)

Owner's decision (Oct 2026). Existing covers stay as they are; this applies to
every **new** story.

Reference look (owner-picked): [`docs/design/cover_style_sample.jpg`](design/cover_style_sample.jpg)
(demo only — the live Arranged Marriage cover is unchanged).

## The rules

1. **Style: a real story moment, shot like a film still.** Not an abstract
   poster — the heroine (and the MC when the moment needs him) in the story's
   own place, doing something from the opening moment. Cinematic, warm,
   shallow depth of field, rich but restrained colours (no neon / rainbow).
2. **Story title written on the cover.** Clean, elegant, readable typography —
   spelled *exactly* like `story.json` `title`. No tagline, no credits, no
   watermark, no other text.
3. **Portrait only: 2:3** (render 1024×1536 or larger, e.g. 896×1344).
   `__tests__/coverGuide.test.ts` fails if a new cover is not portrait.
4. **Leave the app's overlay zones clean.**
   - Top ~8%: the app puts NEW / rating badges in the corners.
   - Bottom ~30%: the app overlays its own title, tagline and buttons on hero
     cards.
   - So put the painted title in the **upper third** (below the top 8%), and
     keep faces in the middle band.
5. **Heroine look:** glamorous Bollywood-heroine face, long wavy hair, adult
   (18–19). Write "no sindoor" when she is unmarried.
6. **MC look:** handsome and shy, clean-shaven, T-shirt + jacket. Never nerdy
   glasses, grey hoodie or library.
7. JPEG, ~150–300 KB, saved as `content/stories/<id>/assets/cover.jpg`.

## Prompt template

```
Cinematic portrait film still, 2:3 vertical. <place + time + light from the
opening moment>. <heroine: glamorous Bollywood-heroine face, long wavy dark
hair, outfit, expression, action>, <MC if present: handsome shy clean-shaven
Indian young man, T-shirt and jacket>. Shallow depth of field, warm restrained
colour grade. The title "<EXACT TITLE>" in elegant cinematic serif lettering
across the upper third. No other text, no watermark. Bottom third kept simple
and darker.
```

Always check the generated title spelling letter by letter; regenerate if any
letter is wrong.
