import {
  CONCEPT_LEXICON,
  conceptTokens,
  detectRelationshipSignal,
  detectEvents,
  scoreEvent,
  rankArchive,
  renderMemoryBlock,
  semanticOverlap,
  buildQueryProfileV2,
  type MemoryContextRef,
} from '../src/lib/storyMemoryCore';
import type { StoryEventRecord, RelationshipStateRecord, CharacterKnowledgeRecord } from '../src/types';

describe('Long-term Memory Enhancements', () => {
  const ctx: MemoryContextRef = {
    playerId: 'player',
    playerName: 'Ankit',
    characters: [
      { id: 'poonam', name: 'Poonam', aliases: ['Poonamji'] },
      { id: 'bhabhi', name: 'Bhabhi', aliases: ['Bhabi'] },
    ],
    locations: ['Rampur veranda', 'Bazaar'],
    objects: ['purani diary', 'tasveer'],
  };

  describe('1. Negation & Hypothetical Guards', () => {
    test('negated wedding statement does not trigger married relationship', () => {
      const signal = detectRelationshipSignal('Meri Poonam se shaadi nahi hui.', ctx, ['poonam']);
      expect(signal).toBeNull();
    });

    test('refusal to marry does not trigger married relationship', () => {
      const signal = detectRelationshipSignal('Maine Poonam se shaadi karne se mana kar diya.', ctx, ['poonam']);
      expect(signal).toBeNull();
    });

    test('hypothetical statement with agar/kash does not trigger relationship advancement', () => {
      const signalAgar = detectRelationshipSignal('Agar hum shaadi kar lein toh?', ctx, ['poonam']);
      expect(signalAgar).toBeNull();

      const signalKash = detectRelationshipSignal('Kash hum dono dost hote.', ctx, ['poonam']);
      expect(signalKash).toBeNull();

      const signalMazak = detectRelationshipSignal('Main sirf mazak kar raha tha, hum date par nahi hain.', ctx, ['poonam']);
      expect(signalMazak).toBeNull();
    });

    test('legitimate positive relationship statements still detect cleanly', () => {
      const signal = detectRelationshipSignal('Aaj humari shaadi ho gayi, Poonam meri biwi hai.', ctx, ['poonam']);
      expect(signal).not.toBeNull();
      expect(signal?.status).toBe('married');
      expect(signal?.tier).toBe(7);

      const friendSignal = detectRelationshipSignal('Hum dono ache dost hain.', ctx, ['poonam']);
      expect(friendSignal).not.toBeNull();
      expect(friendSignal?.status).toBe('friend');
      expect(friendSignal?.tier).toBe(2);
    });
  });

  describe('2. Trigram Fuzzy Fallback & Expanded Vocabulary', () => {
    test('concept tokens include extended family and emotional Hinglish vocabulary', () => {
      const tokensFamily = conceptTokens('meri saali aur jija ghar aaye');
      expect(tokensFamily).toContain('c:family');

      const tokensEmotion = conceptTokens('mujhe bahut jalan hui aur pachtawa bhi hua');
      expect(tokensEmotion).toContain('c:enmity');
      expect(tokensEmotion).toContain('c:apology');

      const tokensBetrayal = conceptTokens('woh ek dhokhebaj insaan tha');
      expect(tokensBetrayal).toContain('c:betrayal');
    });

    test('fuzzy trigram matches Hinglish spelling variations even when exact score is 0', () => {
      const profile = buildQueryProfileV2('bhabie ki baat', ctx);
      // 'bhabie' should match 'bhabhi' in keywords via trigram similarity
      const overlap = semanticOverlap(profile, ['bhabhi', 'purani'], 'bhabhi ki tasveer');
      expect(overlap).toBeGreaterThan(0.5);
    });
  });

  describe('3. Turn-based Sequence Decay & Permanent Milestones', () => {
    const oldMilestone: StoryEventRecord = {
      id: 'e1',
      storyId: 'arranged-marriage',
      playthroughId: 'pt1',
      seq: 2,
      occurredAt: new Date(Date.now() - 30 * 86400000).toISOString(), // 30 days ago in real time
      type: 'marriage',
      summary: 'Ankit aur Poonam ki shaadi ho gayi.',
      importance: 4,
      importanceLabel: 'VERY_HIGH',
      confidence: 'high',
      source: 'narrator',
      sourceMessageIds: ['m1'],
      sceneId: 's1',
      location: 'Rampur',
      objectNames: [],
      participants: ['poonam'],
      pairKeys: ['player::poonam'],
      keywords: ['shaadi', 'c:wedding', 'poonam'],
      status: 'active',
      storyDay: 1,
      createdAt: new Date().toISOString(),
      archived: false,
    };

    const recentTrivia: StoryEventRecord = {
      id: 'e2',
      storyId: 'arranged-marriage',
      playthroughId: 'pt1',
      seq: 15,
      occurredAt: new Date().toISOString(),
      type: 'conversation',
      summary: 'Poonam ne chai banayi.',
      importance: 1,
      importanceLabel: 'LOW',
      confidence: 'high',
      source: 'narrator',
      sourceMessageIds: ['m2'],
      sceneId: 's1',
      location: 'Rampur',
      objectNames: [],
      participants: ['poonam'],
      pairKeys: ['player::poonam'],
      keywords: ['chai', 'poonam'],
      status: 'active',
      storyDay: 2,
      createdAt: new Date().toISOString(),
      archived: false,
    };

    test('permanent milestone maintains strong priority even after real-world calendar gap', () => {
      const profile = buildQueryProfileV2('humare rishte ke baare me batao', ctx);
      // At current turn 20, turn delta for milestone is 18 turns, which is well within turn memory
      const scoreMilestone = scoreEvent(oldMilestone, profile, { currentSeq: 20 });
      const scoreTrivia = scoreEvent(recentTrivia, profile, { currentSeq: 20 });
      expect(scoreMilestone).toBeGreaterThan(scoreTrivia);
    });

    test('permanent milestone receives [PERMANENT CANON] tag in rendered block', () => {
      const block = renderMemoryBlock({
        relationships: [],
        events: [oldMilestone],
        knowledge: [],
        currentSeq: 25,
      });
      expect(block).toContain('PERMANENT CANON');
      expect(block).toContain('VERY_HIGH, PERMANENT CANON');
    });
  });
});
