/**
 * Story markup: *faded* action spans, speaker prefixes, colour fading.
 * These are the pure helpers behind the chat UI's formatting.
 */
import {
  hasFadedMarkup,
  isFullyFadedLine,
  matchSpeakerPrefix,
  parseStoryMarkup,
  splitSpeakerLine,
  stripStoryMarkup,
} from '../src/lib/markup';
import { FADED_TEXT_OPACITY, withAlpha } from '../src/theme';

describe('parseStoryMarkup', () => {
  test('splits a line into faded and plain spans', () => {
    const spans = parseStoryMarkup(
      '*Beena ke honton par halki si muskaan ubharti hai.* Beena muskurati hai.',
    );
    expect(spans).toEqual([
      { text: 'Beena ke honton par halki si muskaan ubharti hai.', faded: true },
      { text: ' Beena muskurati hai.', faded: false },
    ]);
  });

  test('plain dialogue has no faded spans', () => {
    const spans = parseStoryMarkup('Myra: "Umm... lagta hai ye coffee meri nahi hai."');
    expect(spans).toHaveLength(1);
    expect(spans[0].faded).toBe(false);
  });

  test('multiple faded spans in one line', () => {
    const spans = parseStoryMarkup('*Pehla.* beech *Doosra.*');
    expect(spans.map((s) => s.faded)).toEqual([true, false, true]);
    expect(spans.map((s) => s.text)).toEqual(['Pehla.', ' beech ', 'Doosra.']);
  });

  test('an asterisk with no closing partner stays literal', () => {
    expect(parseStoryMarkup('*Doosra. ke baad kuch nahi')).toEqual([
      { text: '*Doosra. ke baad kuch nahi', faded: false },
    ]);
  });

  test('**bold** is faded too, with no stray markers left', () => {
    const spans = parseStoryMarkup('**Zor se**');
    expect(spans).toEqual([{ text: 'Zor se', faded: true }]);
    expect(stripStoryMarkup('**Zor se**')).toBe('Zor se');
  });

  test('an unmatched asterisk stays literal', () => {
    expect(parseStoryMarkup('Woh * aadmi')).toEqual([{ text: 'Woh * aadmi', faded: false }]);
    expect(parseStoryMarkup('3 * 4 = 12')).toEqual([{ text: '3 * 4 = 12', faded: false }]);
  });

  test('empty input is safe', () => {
    expect(parseStoryMarkup('')).toEqual([]);
    expect(parseStoryMarkup(undefined as unknown as string)).toEqual([]);
  });
});

describe('faded-line helpers', () => {
  test('hasFadedMarkup', () => {
    expect(hasFadedMarkup('*Woh cup badha deti hai.*')).toBe(true);
    expect(hasFadedMarkup('Myra: "Haan?"')).toBe(false);
  });

  test('isFullyFadedLine only for whole-line action text', () => {
    expect(isFullyFadedLine('*Woh cup badha deti hai.*')).toBe(true);
    expect(isFullyFadedLine('  *Woh cup badha deti hai.*  ')).toBe(true);
    expect(isFullyFadedLine('*Woh cup badha deti hai.* Myra hansti hai.')).toBe(false);
    expect(isFullyFadedLine('Beena: "Achchha."')).toBe(false);
  });

  test('stripStoryMarkup removes only the markers', () => {
    expect(stripStoryMarkup('*Halki si muskaan.* Phir boli.')).toBe(
      'Halki si muskaan. Phir boli.',
    );
  });
});

describe('speaker prefixes', () => {
  const names = ['Myra', 'Beena', 'Raj', 'Sunny'];

  test('matchSpeakerPrefix', () => {
    expect(matchSpeakerPrefix('Myra: "Umm... lagta hai ye coffee meri nahi hai."')).toEqual({
      name: 'Myra',
      rest: '"Umm... lagta hai ye coffee meri nahi hai."',
    });
    expect(matchSpeakerPrefix('Woh muskurati hai.')).toBeNull();
  });

  test('splitSpeakerLine only accepts known character names', () => {
    expect(splitSpeakerLine('Beena: "Achchha. Zubaan mein dum toh hai."', names)).toEqual({
      speaker: 'Beena',
      text: '"Achchha. Zubaan mein dum toh hai."',
    });
    // "Problem:" is not a character — stays plain narration.
    expect(splitSpeakerLine('Problem: sab kuch bigad gaya', names)).toEqual({
      speaker: null,
      text: 'Problem: sab kuch bigad gaya',
    });
  });

  test('without a name list any capitalised prefix counts', () => {
    expect(splitSpeakerLine('Raja: "Rukiye."')).toEqual({ speaker: 'Raja', text: '"Rukiye."' });
  });
});

describe('withAlpha (faded colour)', () => {
  test('hex to rgba at the faded opacity', () => {
    expect(withAlpha('#B9AEE0', FADED_TEXT_OPACITY)).toBe(
      `rgba(185, 174, 224, ${FADED_TEXT_OPACITY})`,
    );
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });

  test('unknown colour formats pass through untouched', () => {
    expect(withAlpha('rgba(10, 10, 10, 0.4)', 0.6)).toBe('rgba(10, 10, 10, 0.4)');
  });

  test('faded text is clearly dimmer than full-strength text', () => {
    expect(FADED_TEXT_OPACITY).toBeLessThan(1);
    expect(FADED_TEXT_OPACITY).toBeGreaterThanOrEqual(0.5);
  });
});
