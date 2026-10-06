/**
 * Renders the real Kissa UI (v2.6 design pass) to a static HTML page so the
 * layout can be reviewed in a browser without a device build.
 *
 * Panels: Home · Story Detail · Chat · Component gallery.
 * Output: docs/ui-preview/live.html
 */
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

import { NavScrollProvider } from '../src/navigation/NavScrollContext';
import { Home } from '../src/screens/Home';
import { StoryDetail } from '../src/screens/StoryDetail';
import { Chat } from '../src/screens/Chat';
import { HeroCard, GridCard, ContinueCard, WideCard } from '../src/components/StoryCard';
import { AgeBadge, GenreChip, SectionHeader, SelectableChip, IconButton, Avatar } from '../src/components/bits';
import { EmptyState, ErrorState, OfflineState } from '../src/components/states';
import { KissaBottomTabBar } from '../src/components/BottomNavigation';
import { ChatBubble, ChoiceChips, TypingIndicator } from '../src/components/chat';
import { PREVIEW_STORIES, PREVIEW_BUNDLE, PREVIEW_MESSAGES, SafeAreaProvider } from './stubs/all';
import { COLORS } from '../src/theme';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => undefined;
const nav = {
  navigate: noop,
  push: noop,
  goBack: noop,
  addListener: () => noop,
  dispatch: noop,
  emit: () => ({ defaultPrevented: false }),
  setOptions: noop,
} as any;

const FRAME_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #06060A; color: #F2F0EB;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .page { max-width: 1320px; margin: 0 auto; padding: 26px 20px 90px; }
  .head { max-width: 780px; }
  .kicker { font-size: 11px; font-weight: 900; letter-spacing: 1.8px; color: #E9435E; }
  h1 { font-size: 30px; letter-spacing: -.8px; margin: 6px 0 10px; }
  .lede { color: #A09CA8; font-size: 14.5px; line-height: 1.7; margin: 0; }
  .lede code { background: rgba(255,251,245,.07); padding: 2px 6px; border-radius: 5px; font-size: 12.5px; }
  .grid { display: flex; flex-wrap: wrap; gap: 34px; margin-top: 30px; align-items: flex-start; }
  .panel { width: 340px; }
  .panel > h2 { font-size: 13px; letter-spacing: 1.2px; text-transform: uppercase; color: #A09CA8; margin: 0 0 10px; }
  .phone {
    width: 340px; height: 700px; border-radius: 38px; background: #000;
    border: 1px solid rgba(242,240,235,.12);
    box-shadow: 0 26px 60px rgba(0,0,0,.6), 0 0 0 7px rgba(255,255,255,.02);
    overflow: hidden; position: relative;
  }
  .phone-inner { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; background: #06060A; }
  .phone-inner > div { flex: 1; min-height: 0; }
  .gallery { width: 640px; }
  .gcard { border: 1px solid rgba(242,240,235,.09); border-radius: 20px; padding: 18px; background: rgba(20,20,29,.55); margin-bottom: 16px; }
  .gcard h3 { margin: 0 0 4px; font-size: 15px; }
  .gcard p { margin: 0 0 14px; color: #A09CA8; font-size: 12.5px; line-height: 1.6; }
  .row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
  .stack { width: 300px; }
  .note { color: #6F6B78; font-size: 11.5px; margin-top: 12px; line-height: 1.6; }
`;

function Frame({ title, children, width = 340, height = 700, gallery = false }: any) {
  return (
    <div className={gallery ? 'panel gallery' : 'panel'}>
      <h2>{title}</h2>
      <div className="phone" style={{ width, height }}>
        <div className="phone-inner" data-frame="">
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
}

/* Fake tab-bar state: renders the real KissaBottomTabBar with preview labels. */
const TAB_STATE = {
  index: 0,
  routes: [
    { key: 'Home', name: 'Home' },
    { key: 'Discover', name: 'Discover' },
    { key: 'Library', name: 'Library' },
    { key: 'Settings', name: 'Settings' },
  ],
} as any;
const TAB_DESCRIPTORS = Object.fromEntries(
  TAB_STATE.routes.map((r: any) => [r.key, { options: { tabBarAccessibilityLabel: r.name } }]),
) as any;

function GalleryPanel() {
  return (
    <div className="phone" style={{ width: 660, height: 700 }}>
      <div className="phone-inner" style={{ padding: 18, overflowY: 'auto' }}>
        <div className="gcard">
          <h3>Story cards</h3>
          <p>Hero (Tonight's lead), rail card, wide card, continue card — fixed art frames, artwork contained, never cropped.</p>
          <HeroCard meta={PREVIEW_STORIES[0] as any} onPress={noop} />
          <div className="row" style={{ marginTop: 16 }}>
            <GridCard meta={PREVIEW_STORIES[3] as any} onPress={noop} />
            <div className="stack">
              <ContinueCard meta={PREVIEW_STORIES[1] as any} progress={0.38} subtitle="Journey 1 • 2h ago" onPress={noop} />
              <div style={{ height: 10 }} />
              <ContinueCard meta={PREVIEW_STORIES[2] as any} progress={0.64} subtitle="Journey 2 • yesterday" onPress={noop} />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <WideCard meta={PREVIEW_STORIES[4] as any} onPress={noop} />
          </div>
        </div>

        <div className="gcard">
          <h3>Chips, badges, headers</h3>
          <p>Canonical type scale — active chip is rose-tinted, kicker sits in a micro pill, action is a rose text link.</p>
          <SectionHeader title="For you" kicker="Recommended" action="See all" onAction={noop} />
          <div className="row" style={{ marginBottom: 12 }}>
            <SelectableChip label="For you" selected onPress={noop} />
            <SelectableChip label="Mystery" selected={false} onPress={noop} />
          </div>
          <div className="row">
            <AgeBadge ageRating="18+" />
            <AgeBadge ageRating="12-17" />
            <GenreChip genre="Romance" />
            <GenreChip genre="Mystery" />
            <IconButton name="heart-outline" accessibilityLabel="Save" />
            <Avatar id="poonam" name="Poonam" size={36} />
          </div>
        </div>

        <div className="gcard">
          <h3>Chat bubbles — narration / character / player</h3>
          <p>One shared layout, three treatments: narration whispers (faded italic, quiet surface), character dialogue is named with a rose edge, the player speaks in a rose bubble.</p>
          {[...PREVIEW_MESSAGES].reverse().map((m: any) => (
            <ChatBubble key={m.id} message={m as any} />
          ))}
          <TypingIndicator label="Story continues…" />
          <ChoiceChips choices={PREVIEW_BUNDLE.scenes.scenes[0].choices as any} onPick={noop} />
        </div>

        <div className="gcard">
          <h3>Floating tab bar + states</h3>
          <p>Glass nav bar with 48px targets; empty / offline states use the same tokens.</p>
          <div style={{ position: 'relative', height: 90 }}>
            <KissaBottomTabBar state={TAB_STATE} descriptors={TAB_DESCRIPTORS} navigation={nav} insets={{ top: 0, bottom: 0, left: 0, right: 0 }} />
          </div>
          <EmptyState icon="library-outline" title="Your library is empty" subtitle="Explore stories and start journeys — they live here." action="Explore" onAction={noop} />
          <OfflineState retry="Retry" onRetry={noop} secondary="Go back" onSecondary={noop} />
        </div>
      </div>
    </div>
  );
}

function Preview() {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 340, height: 700 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      }}
    >
      <NavScrollProvider>
        <div className="page">
          <div className="head">
            <div className="kicker">KISSA UI v2.6 · LIVE RENDER</div>
            <h1>Design pass — rendered from the real source</h1>
            <p className="lede">
              Ye page <code>src/screens</code> aur <code>src/components</code> ke actual components ko
              <code>react-native-web</code> ke through render karta hai — koi mockup nahi. Device-only modules
              (SQLite, keystore, network loader) preview stubs se replace hote hain, isliye jo dikh raha hai
              wahi code app mein chalta hai. Artwork apne asli ratio mein contain-fit hai (<code>NaturalImage</code> rule).
            </p>
          </div>

          <div className="grid">
            <Frame title="Home — focal hero + rails">
              <Home navigation={nav} route={{ key: 'Home', name: 'Home', params: {} } as any} />
            </Frame>

            <Frame title="Story Detail — hero, stats, cast, gallery">
              <StoryDetail navigation={nav} route={{ params: { storyId: 'arranged-marriage-wala-love' } } as any} />
            </Frame>

            <Frame title="Chat — cinematic stage, live content">
              <Chat navigation={nav} route={{ params: { playthroughId: 'pt_1' } } as any} />
            </Frame>

            <GalleryPanel />
          </div>

          <p className="note">
            Generated by <code>npm run preview:ui</code> (preview/jest.preview.config.js). Frames are real
            screen trees: scroll position starts at the top, animations are at their resting state.
          </p>
        </div>
      </NavScrollProvider>
    </SafeAreaProvider>
  );
}

async function renderToHtml(node: React.ReactElement): Promise<string> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(node);
  });
  // Let async screen loads (stubbed getBundle/getPlaythrough) settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 250));
  });
  return host.innerHTML;
}

jest.setTimeout(120000);

test('render UI preview', async () => {
  const html = await renderToHtml(<Preview />);

  // react-native-web injects its rules through the CSSOM, so read the rules
  // (textContent is empty for programmatically inserted stylesheets).
  const css = Array.from(document.styleSheets)
    .flatMap((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText);
      } catch {
        return [];
      }
    })
    .join('\n');

  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kissa UI v2.6 — live render</title>
<style>${css}</style>
<style>${FRAME_CSS}</style>
</head>
<body>
${html}
</body>
</html>`;

  const fs = require('fs');
  const path = require('path');
  const out = path.join(__dirname, '..', 'docs', 'ui-preview', 'live.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, page, 'utf8');

  expect(page).toContain('Tonight');
  expect(page.length).toBeGreaterThan(20000);
  expect(COLORS.midnight.bg).toBe('#06060A');
});
