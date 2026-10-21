/**
 * Global app state: profile, settings, providers, story catalog, favorites.
 * Everything is loaded from the LOCAL database. No network, no accounts.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  AIProvider,
  AppSettings,
  LocalProfile,
  Playthrough,
  StoryMeta,
} from '../types';
import {
  addFavorite as dbAddFavorite,
  getProfile,
  getSettings,
  isFavorite as dbIsFavorite,
  listFavorites,
  listProviders,
  listRecentPlaythroughs,
  removeFavorite as dbRemoveFavorite,
  saveProfile as dbSaveProfile,
  updateSettings as dbUpdateSettings,
} from '../lib/db';
import { listStories } from '../content/loader';
import { hasApiKey } from '../lib/secureKeys';
import { nowIso } from '../lib/utils';
import { COLORS, Theme, ThemeName, UiTemplate } from '../theme';
import { COLORS as CLASSIC_COLORS } from '../ui/classic/theme';
import { BootSplash, SPLASH_INTRO_MS } from '../components/BootSplash';
import { StyleSheet, View } from 'react-native';

interface AppState {
  ready: boolean;
  /** Null until onboarding completes. */
  profile: LocalProfile | null;
  settings: AppSettings;
  theme: Theme;
  themeName: ThemeName;
  /** Whole-app look chosen in Settings → Appearance. */
  uiTemplate: UiTemplate;
  providers: AIProvider[];
  /** Provider ids that have a key stored in SecureStore. */
  providersWithKeys: Set<string>;
  activeProvider: AIProvider | null;
  stories: StoryMeta[];
  favoriteIds: Set<string>;
  recentPlaythroughs: Playthrough[];

  saveProfile: (p: LocalProfile) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  refreshProviders: () => Promise<void>;
  refreshStories: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  refreshRecent: () => Promise<void>;
  toggleFavorite: (storyId: string) => Promise<boolean>;
  reloadAll: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const onSplashDone = useCallback(() => setSplashDone(true), []);
  const [introDone, setIntroDone] = useState(false);
  const onIntroDone = useCallback(() => setIntroDone(true), []);
  const [appDrawn, setAppDrawn] = useState(false);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [providersWithKeys, setProvidersWithKeys] = useState<Set<string>>(new Set());
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentPlaythroughs, setRecentPlaythroughs] = useState<Playthrough[]>([]);

  const refreshProviders = useCallback(async () => {
    const list = await listProviders();
    setProviders(list);
    const withKeys = new Set<string>();
    for (const p of list) {
      if (await hasApiKey(p.id)) withKeys.add(p.id);
    }
    setProvidersWithKeys(withKeys);
  }, []);

  const refreshStories = useCallback(async () => {
    const p = await getProfile();
    if (!p) {
      setStories([]);
      return;
    }
    try {
      setStories(await listStories(p.ageGroup));
    } catch {
      setStories([]);
    }
  }, []);

  const refreshFavorites = useCallback(async () => {
    const favs = await listFavorites();
    setFavoriteIds(new Set(favs.map((f) => f.storyId)));
  }, []);

  const refreshRecent = useCallback(async () => {
    setRecentPlaythroughs(await listRecentPlaythroughs(12));
  }, []);

  const reloadAll = useCallback(async () => {
    const [p, s] = await Promise.all([getProfile(), getSettings()]);
    setProfile(p);
    setSettings(s);
    await Promise.all([
      refreshProviders(),
      (async () => {
        if (p) {
          try {
            setStories(await listStories(p.ageGroup));
          } catch {
            setStories([]);
          }
        }
      })(),
      refreshFavorites(),
      refreshRecent(),
    ]);
  }, [refreshProviders, refreshFavorites, refreshRecent]);

  useEffect(() => {
    (async () => {
      try {
        await reloadAll();
      } finally {
        setReady(true);
      }
    })();
  }, [reloadAll]);

  const saveProfile = useCallback(
    async (p: LocalProfile) => {
      await dbSaveProfile(p);
      setProfile(p);
      await refreshStories();
    },
    [refreshStories],
  );

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = await dbUpdateSettings(patch);
    setSettings(next);
  }, []);

  const toggleFavorite = useCallback(async (storyId: string): Promise<boolean> => {
    const isFav = await dbIsFavorite(storyId);
    if (isFav) {
      await dbRemoveFavorite(storyId);
      setFavoriteIds((prev) => {
        const n = new Set(prev);
        n.delete(storyId);
        return n;
      });
      return false;
    }
    await dbAddFavorite(storyId, nowIso());
    setFavoriteIds((prev) => new Set(prev).add(storyId));
    return true;
  }, []);

  const value = useMemo<AppState>(() => {
    const themeName: ThemeName = settings?.theme ?? 'midnight';
    const uiTemplate: UiTemplate = settings?.uiTemplate === 'classic' ? 'classic' : 'noir';
    const activeProvider =
      providers.find((p) => p.id === settings?.activeProviderId && p.enabled) ?? null;
    return {
      ready,
      profile,
      settings: settings as AppSettings,
      theme: uiTemplate === 'classic' ? CLASSIC_COLORS[themeName] : COLORS[themeName],
      themeName,
      uiTemplate,
      providers,
      providersWithKeys,
      activeProvider,
      stories,
      favoriteIds,
      recentPlaythroughs,
      saveProfile,
      updateSettings,
      refreshProviders,
      refreshStories,
      refreshRecent,
      refreshFavorites,
      toggleFavorite,
      reloadAll,
    };
  }, [
    ready,
    profile,
    settings,
    providers,
    providersWithKeys,
    stories,
    favoriteIds,
    recentPlaythroughs,
    saveProfile,
    updateSettings,
    refreshProviders,
    refreshStories,
    refreshRecent,
    refreshFavorites,
    toggleFavorite,
    reloadAll,
  ]);

  // Opening animation, smooth on slow phones too:
  //  1. the intro plays alone — mounting the whole app (catalog, covers,
  //     navigation) during it fought the animation for the UI/JS thread and
  //     made it stutter ("atak raha he");
  //  2. once it has played, the app mounts BEHIND the finished (still) splash;
  //  3. two frames later the first screen is drawn and the splash opens onto
  //     it — no blank frame, no jank. The local database loads in parallel
  //     with the intro, so this costs only the mount itself.
  const appReady = ready && !!settings;
  const mountApp = appReady && (introDone || splashDone);

  // Safety net: never hold the app back if the intro callback is lost.
  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), SPLASH_INTRO_MS + 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mountApp || appDrawn) return;
    const raf: (cb: () => void) => unknown =
      typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16);
    let alive = true;
    raf(() => raf(() => alive && setAppDrawn(true)));
    return () => {
      alive = false;
    };
  }, [mountApp, appDrawn]);

  return (
    <View style={styles.root}>
      {mountApp ? <Ctx.Provider value={value}>{children}</Ctx.Provider> : null}
      {!splashDone ? <BootSplash ready={appDrawn} onIntroDone={onIntroDone} onDone={onSplashDone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: COLORS.midnight.bg } });

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
