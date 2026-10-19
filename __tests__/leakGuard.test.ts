/**
 * v2.7.0 — Leak guard: no internal memory / state / hidden truth may ever be
 * rendered as story text, in ANY shape the model can produce. Story-format
 * lines must survive untouched.
 */
import { guardVisibleText, hiddenLinesOf, sanitizeStoredText } from '../src/lib/leakGuard';
import { finalizeAssistantText, parseAssistantResponse, stripStateLeakage } from '../src/lib/engine';

const CAST = ['Mahi', 'Sameer', 'Ira'];
const STORY = '*Mahi muskurati hai.*\nMahi: "Kal library mein milna."';

/** Every internal word that must never be visible. */
const SECRET_WORDS = /important objects?|memory|memories|relationships?|unresolved|world state|hidden truth|kissa|trust \d|affection|yaadein|threads|inventory|\[state\]|story state|location memory|key facts|narrator notes/i;

const LEAKS: Record<string, string> = {
  plain_heading: `${STORY}\n\nImportant Objects: earbud (Mahi), notebook\nMemory: Mahi ne note likha`,
  bold_markdown: `${STORY}\n\n**Important Objects:** earbud — Mahi ke paas\n**Memory:** Mahi ne dare liya hai`,
  markdown_heading_list: `${STORY}\n\n## Memory\n- Mahi ne dare accept kiya\n- Earbud Mahi ke paas hai`,
  world_state_echo: `${STORY}\n\nCURRENT WORLD STATE:\n- Location: Class\n- Important objects: earbud (Mahi)\n- Unresolved threads:\n  * The dare (Mahi)`,
  yaml_marker: `${STORY}\nkissa-state:\nlocation: Class\nmemory: Mahi ka dare\nimportantObjects:\n  - earbud`,
  bracket_tags: `${STORY}\n[STATE] location=Class; importantObjects=earbud\n[MEMORY] Mahi ne dare accept kiya`,
  hidden_truth_narration: `${STORY}\n*(HIDDEN TRUTH: Mahi ne Sameer ka dare accept kiya hai.)*`,
  hidden_truth_plain: `${STORY}\nHidden truth: Mahi ne Sameer ka dare accept kiya hai.`,
  html_comment: `${STORY}\n<!-- state: {"memory":["dare"]} -->`,
  html_comment_unterminated: `${STORY}\n<!-- memory: Mahi ka dare`,
  relationships_numbers: `${STORY}\nRelationships:\n  * Mahi: trust 40, affection 55, tension 10`,
  hinglish_labels: `${STORY}\nYaadein: Mahi ne earbud diya\nRishte: Mahi — dosti`,
  ooc_paren: `${STORY}\n(OOC: memory updated — Mahi trusts the reader more)`,
  state_update_heading: `${STORY}\n\nSTATE UPDATE\nlocation: library\nmood: shy`,
  narration_wrapped_label: `${STORY}\n*Important objects: earbud (Mahi)*`,
  quoted_label_value: `${STORY}\nMemory: "Mahi ne dare accept kiya"`,
  key_facts_block: `${STORY}\n\nKey facts:\n1. Mahi ke paas earbud hai\n2. Sameer ne dare diya`,
  inventory_line: `${STORY}\nInventory: earbud, chitthi`,
  story_so_far: `${STORY}\nStory so far: Mahi aur reader library mein mile.`,
  narrator_notes: `${STORY}\nNarrator notes: Mahi secretly likes the reader.`,
  leading_leak: `Important objects: earbud (Mahi)\n${STORY}`,
  separator_then_state: `${STORY}\n\n---\nWorld state:\n- Location: Canteen`,
  numbered_memory_heading: `${STORY}\n**Memory #2:** Mahi ne chitthi chhupayi`,
  character_knowledge: `${STORY}\nCharacter knowledge:\n- Sameer: dare ke baare mein jaanta hai`,
  present_characters: `${STORY}\nPresent characters: Mahi, Sameer`,
  story_time: `${STORY}\nStory time: 8:42 PM (evening, Day 2)`,
  past_choices: `${STORY}\nPast choices: q1→help`,
  location_memory: `${STORY}\nLocation memory (Library): visited 3×`,
  memory_update_tag: `${STORY}\n(Memory updated)`,
  fenced_json_lang: `${STORY}\n\`\`\`json\n{"importantObjects":[{"name":"earbud"}]}\n\`\`\``,
  fenced_kissa_json: `${STORY}\n\`\`\`kissa-state\n{"location":"Class","importantObjects":[{"name":"earbud"}]}\n\`\`\``,
  fenced_kissa_yaml: `${STORY}\n\`\`\`kissa-state\nlocation: Class\nimportantObjects:\n  - earbud\n\`\`\``,
  bare_json_single_key: `${STORY}\n{"importantObjects":[{"name":"earbud","holder":"Mahi"}]}`,
};

describe('leak guard — every non-JSON leak shape is removed', () => {
  for (const [name, raw] of Object.entries(LEAKS)) {
    test(name, () => {
      const out = finalizeAssistantText(parseAssistantResponse(raw));
      expect(out).not.toMatch(SECRET_WORDS);
      // The real story survives.
      expect(out).toContain('Kal library mein milna.');
      expect(out).toContain('Mahi muskurati hai.');
    });
  }

  test('guardVisibleText reports the leak so the chat can retry once', () => {
    const r = guardVisibleText(LEAKS.plain_heading, { protectedNames: CAST });
    expect(r.leaked).toBe(true);
    expect(r.reasons.join(',')).toMatch(/label:important objects/);
  });

  test('idempotent', () => {
    for (const raw of Object.values(LEAKS)) {
      const once = guardVisibleText(raw, { protectedNames: CAST }).text;
      expect(guardVisibleText(once, { protectedNames: CAST }).text).toBe(once);
    }
  });
});

describe('leak guard — normal story is never damaged', () => {
  const SAFE = [
    '*Mahi muskurati hai.*\nMahi: "Mera important object? Tumhara earbud!"',
    'Mahi: "Yaad hai? Pichhli baar tumne promise kiya tha."',
    '*Library mein sannata hai. Sameer ki aankhon mein ek raaz chhupa hai.*',
    'Sameer: "Relationship? Bro, abhi toh dosti bhi nahi hui."',
    '*Ira ne notebook band ki — uske peeche kuch likha tha.*\nIra: "Ye memory mat banana, okay?"',
    'Mahi: "Location? Canteen ke peeche, 5 baje."',
    '*Ghadi mein 8:42 baj rahe the.*',
    '*Ek pal ke liye sab ruk gaya...*\n\nMahi: "Bolo na... kuch toh bolo."',
  ];
  for (const s of SAFE) {
    test(s.slice(0, 40), () => {
      const r = guardVisibleText(s, { protectedNames: CAST });
      expect(r.text).toBe(s.trim());
      expect(r.leaked).toBe(false);
    });
  }

  test('a cast member whose name equals a label is protected', () => {
    const s = 'Raaz: "Main sab jaanta hoon."\n*Raaz muskuraya.*';
    expect(guardVisibleText(s, { protectedNames: ['Raaz'] }).text).toBe(s);
  });

  test('stripStateLeakage keeps normal prose that mentions JSON-ish words', () => {
    const s = '*Mahi ne kaha ki memory weak hai.*\nMahi: "Mujhe kuch yaad nahi."';
    expect(stripStateLeakage(s)).toBe(s);
  });
});

describe('leak guard — copy detection and reader lines', () => {
  const notes = [
    'STORY SO FAR:',
    '- Mahi ne Sameer ka dare accept kiya tha, reader ko pata nahi.',
    'KEY FACTS:',
    '- Important objects: blue earbud (Mahi), torn chit (Sameer)',
    'HIDDEN TRUTH: Mahi secretly writes poems about the reader.',
  ].join('\n');

  test('a plain line copied from the private notes is removed', () => {
    const raw = `${STORY}\nMahi ne Sameer ka dare accept kiya tha, reader ko pata nahi.`;
    const r = guardVisibleText(raw, { protectedNames: CAST, hiddenNotes: notes });
    expect(r.text).not.toContain('reader ko pata nahi');
    expect(r.leaked).toBe(true);
  });

  test('story-format lines are not treated as copies', () => {
    const raw = '*Mahi ne dheere se earbud wapas diya.*\nMahi: "Thanks."';
    const r = guardVisibleText(raw, { protectedNames: CAST, hiddenNotes: notes });
    expect(r.text).toBe(raw);
  });

  test('hiddenLinesOf peels labels and bullets', () => {
    const lines = hiddenLinesOf(notes);
    expect(lines).toContain('Mahi secretly writes poems about the reader.');
    expect(lines.some((l) => l.startsWith('blue earbud'))).toBe(true);
  });

  test('dialogue written for the reader is removed and flagged', () => {
    const raw = `${STORY}\nAnkit: "Haan, main aaunga."`;
    const r = guardVisibleText(raw, { protectedNames: CAST, readerName: 'Ankit' });
    expect(r.text).not.toContain('main aaunga');
    expect(r.spokeForReader).toBe(true);
  });

  test('sanitizeStoredText cleans previously saved leaky messages', () => {
    const saved = 'Kal library mein milna.\n\nImportant Objects: earbud (Mahi)';
    expect(sanitizeStoredText(saved, CAST)).toBe('Kal library mein milna.');
  });
});
