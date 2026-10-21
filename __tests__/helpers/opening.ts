/**
 * Test helper: the REAL opening messages a new journey saves
 * (src/lib/opening.ts), split the way the chat shows them — *action* lines as
 * narration, `Name: "line"` as that character's dialogue.
 */
import type { StoryBundle } from '../../src/types';
import { openingMessages } from '../../src/lib/opening';
import { isFullyFadedLine, splitSpeakerLine, stripStoryMarkup } from '../../src/lib/markup';

export interface RenderedLine {
  role: 'assistant' | 'narration';
  speaker: string | null;
  text: string;
}

export function renderOpening(bundle: StoryBundle, playerName?: string | null): { lines: RenderedLine[]; sceneId: string } {
  const names = bundle.characters.characters.map((c) => c.name);
  const msgs = openingMessages(bundle, playerName);
  const lines: RenderedLine[] = [];
  for (const m of msgs) {
    const line = m.text.trim();
    if (!line) continue;
    if (isFullyFadedLine(line)) {
      lines.push({ role: 'narration', speaker: null, text: stripStoryMarkup(line) });
      continue;
    }
    const { speaker, text } = splitSpeakerLine(line, names);
    lines.push({ role: 'assistant', speaker, text: text || line });
  }
  return { lines, sceneId: msgs[0]?.sceneId ?? bundle.story.openingSceneId };
}
