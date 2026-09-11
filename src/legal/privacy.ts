/**
 * Privacy Policy — displayed in-app (Settings -> About -> Privacy)
 * and on the website. Honest local-first disclosure.
 */

export const PRIVACY_UPDATED = '11 September 2026';

export interface LegalSection {
  heading: string;
  body: string[];
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'The short version',
    body: [
      'No account. No login. No cloud user database. Your nickname, age selection, chats, memories, progress, favorites, downloads, and settings live ONLY on your device.',
      'Two exceptions: (1) public story files are downloaded from GitHub when you ask for updates, and (2) if YOU configure a third-party AI provider, your chat requests go to THAT provider so it can reply.',
    ],
  },
  {
    heading: '1. Data that stays on your device',
    body: [
      'Local profile (nickname + age group), chats and messages, story/character/world memories, story state and saves, favorites, downloaded stories, statistics, settings, and AI configuration metadata are stored in a local on-device database.',
      'Your API keys are stored in secure device storage (Android Keystore / iOS Keychain), never in the regular database.',
      'We cannot see, access, or recover this data — there is no backend and no account system.',
    ],
  },
  {
    heading: '2. Data that leaves your device',
    body: [
      'GitHub content distribution: when you check for updates or download stories, the app fetches public files (manifest.json, story JSON) from the configured public content URL (GitHub by default). This is a plain file download — no personal data is sent.',
      'Your AI provider: ONLY if you configure one, the text needed for a reply (your message, recent conversation, story state, relevant memories) is sent to that provider over the network. This is how every cloud AI works — the model must read your words to answer.',
      'We do NOT send your API key or chats to any Kissa-owned server, because no such server exists.',
    ],
  },
  {
    heading: '3. Third-party AI providers',
    body: [
      'If you add your own provider (OpenAI-compatible or custom), that provider\'s privacy policy governs what happens to your requests on their side. Common examples log, retain, or train on data differently — read your provider\'s policy.',
      'Tip: use Offline Story Mode (no key needed) if you want zero network requests during story play.',
    ],
  },
  {
    heading: '4. Analytics & tracking',
    body: [
      'Kissa ships with NO analytics SDK, NO crash reporting SDK, NO advertising SDK, and NO cross-app tracking. Statistics shown in the app (stories started, messages sent) are computed locally for you.',
      'If analytics are ever added, this policy will be updated first and the feature will be opt-in and disclosed.',
    ],
  },
  {
    heading: '5. Notifications',
    body: [
      'Reminders and update alerts are LOCAL notifications scheduled on your device. No push server, no push tokens, no registration with any service.',
    ],
  },
  {
    heading: '6. Export / import',
    body: [
      'Export My Data writes a JSON backup to a file YOU control (via the OS share sheet). Nothing is uploaded automatically. Keep backups private — they contain your chats.',
      'Backups intentionally exclude API keys.',
    ],
  },
  {
    heading: '7. Children & teens',
    body: [
      'The 12–17 age setting restricts the catalog to teen-appropriate stories and blocks mature stories app-wide, including direct opens. AI chat remains open-ended, so guardian supervision is recommended for younger readers.',
      'We collect no personal information from anyone — including children — because there is no account or server to send it to.',
    ],
  },
  {
    heading: '8. Your control',
    body: [
      'View usage, clear cache, delete downloads, delete chats, or wipe everything in Settings → Storage. Uninstalling removes all on-device data.',
    ],
  },
  {
    heading: '9. Changes',
    body: [
      'If this policy changes materially, the "updated" date below changes and the new text ships in-app and on the website.',
    ],
  },
];
