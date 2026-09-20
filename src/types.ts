/**
 * Kissa — core domain types.
 * This file is intentionally dependency-free so it can be imported
 * from pure-logic modules and unit-tested in plain Node (jest).
 */

/** Age bucket chosen by the user at onboarding. */
export type AgeGroup = '12-17' | '18+';

/** Age rating attached to every story package. */
export type AgeRating = '12-17' | '18+';

/** Maturity level attached to every story package. */
export type ContentLevel = 'teen' | 'mature';

/** Supported story languages. v1 ships Hinglish; the schema is ready for more. */
export type StoryLanguage = 'hinglish' | 'english';

/* ------------------------------------------------------------------ */
/* Creator attribution                                                  */
/* ------------------------------------------------------------------ */

/**
 * Story creator metadata. Lives inside each story package.
 *
 * - `name` is mandatory; the admin sets/overrides it at publish time.
 * - `verified` is controlled only by the admin/system; users can never grant
 *   it to themselves via a submission.
 * - `avatar` is optional (reserved for future use) and must never come from
 *   untrusted user input without sanitisation.
 */
export interface StoryCreator {
  name: string;
  avatar?: string | null;
  verified?: boolean;
}

/** Default creator for all Kissa owner/admin-produced stories. */
export const KISSA_OWNER_CREATOR: StoryCreator = {
  name: 'Ankit',
  avatar: null,
  verified: true,
};

/* ------------------------------------------------------------------ */
/* User submissions (ideas + complete stories)                          */
/* ------------------------------------------------------------------ */

export type SubmissionType = 'idea' | 'story';
export type SubmissionStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface IdeaPayload {
  title: string;
  concept: string;
  genre: string;
  characters?: string;
  notes?: string;
}

/**
 * A complete story submission in JSON form. Mirrors the bundle structure the
 * Kissa runtime already understands so that an accepted submission can be
 * merged into the published catalog without transformation.
 */
export interface StorySubmissionPayload {
  story: Partial<StoryFile>;
  characters?: Partial<CharactersFile>;
  world?: Partial<WorldFile>;
  scenes?: Partial<ScenesFile>;
  memory?: Partial<MemoryFile>;
}

export interface StorySubmission {
  id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  creator: StoryCreator;
  title: string;
  /** Submission timestamp (UTC ISO). */
  submittedAt: string;
  /** Auto-expiry timestamp, exactly 24h after submittedAt (UTC ISO). */
  expiresAt: string;
  /** Genre declared by submitter. */
  genre?: string;
  /** Submitter client metadata (never trusted, for logging). */
  client?: string;
  /** Type-specific payload. */
  payload: IdeaPayload | StorySubmissionPayload;
}

/** Server response shape for the submission endpoints. */
export interface SubmitResponse {
  ok: boolean;
  id?: string;
  message?: string;
  /** Present when the global daily limit has been reached. */
  limitReached?: boolean;
  /** Unix-epoch ms when the current 24h window resets (informational). */
  resetsAt?: number;
  /** Validation issues, if any. */
  issues?: { path: string; message: string }[];
}

/** Admin-panel list response. */
export interface PendingListResponse {
  ok: boolean;
  ideas: StorySubmission[];
  stories: StorySubmission[];
  remaining: number;
  resetsAt: number;
}

/**
 * Where a story bundle came from.
 * V2: playback always STREAMS the package from the story API, so the only
 * runtime source is 'remote'. 'bundled'/'downloaded' are retained only so
 * older in-memory fixtures and migrations keep type-checking; they are no
 * longer used for playback.
 */
export type StorySource = 'bundled' | 'downloaded' | 'remote' | 'community';

/* ------------------------------------------------------------------ */
/* Content manifest                                                    */
/* ------------------------------------------------------------------ */

/** One entry in content/manifest.json */
export interface StoryMeta {
  id: string;
  title: string;
  tagline: string;
  description: string;
  genres: string[];
  tags: string[];
  characters: string[];
  ageRating: AgeRating;
  contentLevel: ContentLevel;
  language: StoryLanguage;
  /** Per-story content version. Bump when the story package changes. */
  version: number;
  /** Key into the bundled-cover registry (bundled stories). */
  coverBundled?: string;
  /** Remote cover URL (stories added later through GitHub). */
  coverUrl?: string;
  accentColor: string;
  userRole: string;
  setting: string;
  estimatedMinutes: number;
  featured?: boolean;
  isNew?: boolean;
  popularity: number;
  /** Directory name under content/stories (and under the remote repo). */
  storyDir: string;
  /** Story creator (defaults to Ankit for owner-produced content). */
  creator?: StoryCreator;
  /** Community-submitted story accepted by admin (served from KV package). */
  community?: boolean;
  updatedAt: string;
}

export interface ContentManifest {
  contentVersion: number;
  minAppVersion?: string;
  updatedAt: string;
  stories: StoryMeta[];
}

/* ------------------------------------------------------------------ */
/* Story package files                                                 */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Story media (Media Library)                                          */
/* ------------------------------------------------------------------ */

/** What a gallery image depicts. */
export type StoryMediaKind = 'cover' | 'character-portrait' | 'scene' | 'other';

/**
 * One entry in a story's Media Library.
 *
 * `file` is a SAFE, allowlisted relative asset path — never an absolute
 * path, never a URL. The app resolves it against the story API
 * (`stories/<storyDir>/<file>`), and the Worker only ever serves the exact
 * allowlisted shapes below, so a story cannot point at another story's
 * files or at arbitrary server paths.
 *
 * Two legal shapes exist:
 *   - published content:  `assets/cover.jpg|png|webp`,
 *                         `assets/gallery/image-01.jpg|png|webp` … `image-08`
 *   - pending submissions: `media/<mediaId>` — a server-generated id returned
 *     by the upload endpoint; the Worker rewrites these to published shapes
 *     when an admin accepts & publishes the story.
 */
export interface StoryMediaItem {
  /** Stable id, `^[a-z0-9][a-z0-9-]{0,31}$`. */
  id: string;
  /** Safe relative asset reference (see above). */
  file: string;
  /** What the image is. */
  kind: StoryMediaKind;
  /** Optional display label (sanitised, max 80 chars). */
  label?: string;
  /** Optional link to a character id (character portraits). */
  characterId?: string;
  /** Optional link to a scene id (scene stills). */
  sceneId?: string;
}

/**
 * The story's Media Library metadata. The cover entry must be part of
 * `gallery` (the gallery always includes the cover), so the detail screen
 * renders everything from one ordered list.
 */
export interface StoryMedia {
  /** Safe reference to the cover image (required for published stories). */
  cover: string;
  /** Ordered gallery (cover first). Max 8 entries. */
  gallery: StoryMediaItem[];
}

export interface StoryFile {
  id: string;
  title: string;
  description: string;
  version: number;
  language: StoryLanguage;
  ageRating: AgeRating;
  contentLevel: ContentLevel;
  genres: string[];
  tags: string[];
  userRole: string;
  setting: string;
  openingSceneId: string;
  tone: string;
  /** Safety guidance for the AI narrator, e.g. "no gore". */
  safetyNotes: string[];
  /** Story creator (defaults to Ankit for owner-produced content). */
  creator?: StoryCreator;
  /** Media Library: cover + gallery (character portraits, scene stills…). */
  media?: StoryMedia;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  personality: string;
  background: string;
  goals: string[];
  fears: string[];
  likes: string[];
  dislikes: string[];
  speakingStyle: string;
  /** Example Hinglish line showing how this character talks. */
  sampleLine: string;
  relationshipWithUser: string;
  knowledge: string[];
}

export interface CharactersFile {
  storyId: string;
  version: number;
  characters: StoryCharacter[];
}

export interface WorldLocation {
  id: string;
  name: string;
  description: string;
}

export interface WorldFile {
  storyId: string;
  version: number;
  premise: string;
  locations: WorldLocation[];
  factions: { id: string; name: string; description: string }[];
  lore: string[];
  /** Hard rules the AI narrator must never break. */
  rules: string[];
  importantObjects: { id: string; name: string; description: string }[];
  timeline: string[];
}

export interface ChoiceEffects {
  relationships?: Record<string, number>;
  flags?: Record<string, boolean | number | string>;
  choicesRecord?: Record<string, string | boolean>;
  inventoryAdd?: string[];
  inventoryRemove?: string[];
  location?: string;
  /** Force a scene jump (normally the choice's `next` field is used). */
  scene?: string;
  /** End the story with this ending id. */
  endStory?: string;
  /** Memories the narrator should remember. */
  memory?: string[];
}

export interface SceneChoice {
  id: string;
  text: string;
  /** Keywords used by the offline engine + smart-reply matching. */
  keywords: string[];
  next: string | null;
  /** If set, this choice is only offered when the flag expression holds. */
  requiresFlag?: string;
  effects?: ChoiceEffects;
  /** Short label for smart-reply chips. Defaults to `text`. */
  shortLabel?: string;
}

export interface StoryScene {
  id: string;
  title: string;
  /** Opening narration shown when the scene starts (offline mode + AI seed). */
  narration: string[];
  /** Lines the offline narrator uses when free text matches no choice. */
  fallbackLines: string[];
  choices: SceneChoice[];
  /** True for terminal scenes. */
  isEnding?: boolean;
  endingId?: string;
}

export interface StoryEnding {
  id: string;
  title: string;
  description: string;
  tone: 'happy' | 'bittersweet' | 'dark' | 'mysterious' | 'heroic' | 'funny';
}

export interface ScenesFile {
  storyId: string;
  version: number;
  scenes: StoryScene[];
  endings: StoryEnding[];
}

export interface MemoryFile {
  storyId: string;
  version: number;
  shortTermWindow: number;
  /** Facts the narrator knows from the very first message. */
  seedMemories: string[];
  /** Hints for what counts as memorable in this story. */
  extractionHints: string[];
  /** Things the narrator must never "remember" (privacy / consistency). */
  neverRemember: string[];
}

export interface StoryBundle {
  meta: StoryMeta;
  story: StoryFile;
  characters: CharactersFile;
  world: WorldFile;
  scenes: ScenesFile;
  memory: MemoryFile;
  source: StorySource;
  /** Effective creator (meta.creator preferred, story.creator fallback, owner default). */
  creator: StoryCreator;
}

/* ------------------------------------------------------------------ */
/* Local profile / settings                                            */
/* ------------------------------------------------------------------ */

export interface LocalProfile {
  nickname: string;
  ageGroup: AgeGroup;
  createdAt: string;
}

export interface NotificationSettings {
  enabled: boolean;
  storyReminders: boolean;
  contentUpdates: boolean;
  reminderHour: number;
}

export interface AppSettings {
  theme: 'midnight' | 'amoled';
  textSize: 'small' | 'medium' | 'large';
  animations: boolean;
  reducedMotion: boolean;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  notifications: NotificationSettings;
  /** Active AI provider id, or null for Offline Story Mode. */
  activeProviderId: string | null;
  /**
   * Story API base override (e.g. a self-hosted worker). Empty string means
   * "use the app default" (KISSA_CONTENT_API_BASE_URL / production API).
   */
  contentApiBaseUrl: string;
  installedContentVersion: number;
  lastContentCheckAt: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'midnight',
  textSize: 'medium',
  animations: true,
  reducedMotion: false,
  sound: false,
  music: false,
  haptics: true,
  notifications: {
    enabled: false,
    storyReminders: true,
    contentUpdates: true,
    reminderHour: 20,
  },
  activeProviderId: null,
  contentApiBaseUrl: '',
  installedContentVersion: 0,
  lastContentCheckAt: null,
};

/* ------------------------------------------------------------------ */
/* AI providers (metadata only — keys live in SecureStore)             */
/* ------------------------------------------------------------------ */

export type ProviderType = 'openai-compatible';

export interface AIProvider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  model: string;
  /** Temperature 0..2 */
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
}

export type AIErrorCode =
  | 'invalid_key'
  | 'invalid_model'
  | 'rate_limit'
  | 'network'
  | 'timeout'
  | 'provider_error'
  | 'bad_response'
  | 'empty_response'
  | 'disabled';

export interface AIError {
  code: AIErrorCode;
  /** Human-readable, safe to show in UI. Never contains the API key. */
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

/* ------------------------------------------------------------------ */
/* Playthrough / messages / state / memory                             */
/* ------------------------------------------------------------------ */

export interface StoryState {
  relationships: Record<string, number>;
  inventory: string[];
  location: string;
  flags: Record<string, boolean | number | string>;
  choices: Record<string, string | boolean>;
  visits: Record<string, number>;
}

export function createInitialState(startLocation = ''): StoryState {
  return {
    relationships: {},
    inventory: [],
    location: startLocation,
    flags: {},
    choices: {},
    visits: {},
  };
}

export type PlaythroughStatus = 'active' | 'completed' | 'abandoned';

export interface Playthrough {
  id: string;
  storyId: string;
  label: string;
  status: PlaythroughStatus;
  currentSceneId: string;
  state: StoryState;
  /** 0..1 rough progress estimate. */
  progress: number;
  messageCount: number;
  endingId: string | null;
  /** 'ai' when a provider generated replies, 'offline' for scripted mode. */
  mode: 'ai' | 'offline';
  providerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'narration' | 'system';

export interface ChatMessage {
  id: string;
  playthroughId: string;
  role: MessageRole;
  /** Character name when the assistant speaks as someone. */
  speaker: string | null;
  text: string;
  sceneId: string | null;
  createdAt: string;
}

/**
 * 'episode'  = one-line trace of a turn (auto-logged, so nothing is ever lost)
 * 'summary'  = rolling compressed digest of everything folded before it
 */
export type MemoryKind = 'story' | 'character' | 'world' | 'preference' | 'episode' | 'summary';

/** How certain the narrator is that a memory is true. */
export type MemoryConfidence = 'low' | 'medium' | 'high';

/** Where a memory came from. This lets retrieval prefer reader-authored facts. */
export type MemorySource = 'seed' | 'user' | 'narrator' | 'derived' | 'episode' | 'manual';

export interface MemoryEntry {
  id: string;
  /** Playthrough id, or '*' for cross-story (global) memories. */
  playthroughId: string;
  kind: MemoryKind;
  text: string;
  /** 1..9. Reinforced whenever the memory actually gets used in a turn. */
  importance: number;
  createdAt: string;
  /** Normalized content key — dedupes repeated facts on insert. */
  hash?: string;
  /** Times this memory was selected into a prompt. */
  hits?: number;
  /** Last time this memory was actually injected into a prompt. */
  lastUsedAt?: string;
  /** Confidence is separate from importance: a dramatic guess can still be uncertain. */
  confidence?: MemoryConfidence;
  /** Provenance used for ranking, diagnostics and future migrations. */
  source?: MemorySource;
  /** Optional canonical entities mentioned by this memory (character/location/object ids). */
  entities?: string[];
  /** Optional expiry for temporary facts (for example, an active disguise). */
  expiresAt?: string | null;
  /** Folded into the digest: kept on disk, excluded from retrieval. */
  archived?: boolean;
}

export interface Favorite {
  storyId: string;
  createdAt: string;
}

export interface DownloadRecord {
  storyId: string;
  version: number;
  downloadedAt: string;
}

export interface LocalStats {
  storiesStarted: number;
  storiesCompleted: number;
  messagesSent: number;
  choicesMade: number;
  minutesPlayed: number;
}

/* ------------------------------------------------------------------ */
/* Export / import                                                     */
/* ------------------------------------------------------------------ */

export interface DataExport {
  format: 'kissa-backup';
  formatVersion: 1;
  exportedAt: string;
  appVersion: string;
  profile: LocalProfile | null;
  settings: AppSettings | null;
  providers: AIProvider[];
  playthroughs: Playthrough[];
  messages: ChatMessage[];
  memories: MemoryEntry[];
  favorites: Favorite[];
  stats: LocalStats | null;
  /** Rolling memory digests, keyed by playthrough id (additive; older files lack it). */
  memoryDigests?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Navigation params                                                   */
/* ------------------------------------------------------------------ */

export type RootStackParamList = {
  Splash: undefined;
  OnboardingName: undefined;
  OnboardingAge: { nickname: string };
  Main: undefined;
  StoryDetail: { storyId: string };
  Chat: { playthroughId: string };
  Saves: { storyId: string };
  AIAddons: undefined;
  ProviderEditor: { providerId?: string };
  SettingsProfile: undefined;
  SettingsAppearance: undefined;
  SettingsAudio: undefined;
  SettingsNotifications: undefined;
  SettingsStorage: undefined;
  Terms: undefined;
  Privacy: undefined;
  About: undefined;
  SubmitStory: { mode?: 'idea' | 'story' };
  SubmissionSuccess: { id: string; type: 'idea' | 'story'; creatorName: string; resetsAt: number };
  MySubmissions: undefined;
  AdminPanel: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Discover: { genre?: string } | undefined;
  Library: undefined;
  Settings: undefined;
};
